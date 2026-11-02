import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from './notifications.service';
import { resolveFrontendUrl } from '../core/frontend-url';
import {
    EMAIL_MAX_AGE_MS,
    EMAIL_MAX_ATTEMPTS,
    EmailQueueStatus,
    MESSAGE_EMAIL_DELAY_MS,
    MESSAGE_EMAIL_THROTTLE_MS,
    boundedSetting,
    isMessageNotification,
    messageEmailSkipReason,
    notificationEmailUrl,
    renderNotificationEmail,
} from './notification-email-policy';

/**
 * Sends the email copy of queued notifications.
 *
 * The queue lives on the notification row (data.emailQueue), so it survives
 * restarts and deploys. Rows are claimed with FOR UPDATE SKIP LOCKED plus a
 * lease, so several backend machines never send the same email twice, and a
 * crashed send is retried a bounded number of times.
 *
 * Off unless NOTIFICATION_EMAILS_ENABLED=true. A daily cap protects the mail
 * provider's sending limit (Gmail SMTP allows roughly 500-2,000 a day).
 */
@Injectable()
export class NotificationEmailOutboxService {
    private readonly logger = new Logger(NotificationEmailOutboxService.name);
    private running = false;
    private static readonly BATCH_SIZE = 25;

    constructor(
        private readonly prisma: PrismaService,
        private readonly email: EmailService,
        private readonly notifications: NotificationsService,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async processQueue(): Promise<void> {
        if (process.env.NOTIFICATION_EMAILS_ENABLED !== 'true' || this.running) return;
        this.running = true;
        try {
            const dailyCap = boundedSetting(process.env.NOTIFICATION_EMAIL_DAILY_CAP, 400, 1, 5000);
            const sentToday = await this.sentToday();
            const room = Math.max(0, dailyCap - sentToday);
            if (room === 0) return;
            const claimed = await this.claimBatch(Math.min(room, NotificationEmailOutboxService.BATCH_SIZE));
            for (const { id, token } of claimed) {
                await this.sendOne(id, token);
            }
        } catch (error: any) {
            this.logger.warn(`Notification email run failed: ${error?.message}`);
        } finally {
            this.running = false;
        }
    }

    private async sentToday(): Promise<number> {
        const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT count(*)::bigint AS count FROM "notifications"
            WHERE data->>'emailQueue' = 'submitted'
              AND (data->>'emailSentAt')::timestamptz >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        `;
        return Number(rows[0]?.count ?? 0);
    }

    private async claimBatch(limit: number): Promise<Array<{ id: string; token: string }>> {
        const token = randomUUID();
        const maxAgeSeconds = Math.floor(EMAIL_MAX_AGE_MS / 1000);
        const messageDelaySeconds = Math.floor(MESSAGE_EMAIL_DELAY_MS / 1000);
        const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
            UPDATE "notifications" AS n
            SET data = n.data || jsonb_build_object(
                'emailQueue', 'sending',
                'emailClaimToken', ${token}::text,
                'emailAttempts', COALESCE((n.data->>'emailAttempts')::int, 0) + 1,
                'emailLeaseUntil', (now() + interval '10 minutes')::text
            )
            WHERE n.id IN (
                SELECT id FROM "notifications"
                WHERE data->>'emailQueue' IN ('pending', 'retry', 'sending')
                  AND "createdAt" > now() - make_interval(secs => ${maxAgeSeconds})
                  AND "createdAt" <= now() - CASE WHEN type IN ('MESSAGE_RECEIVED', 'NEW_MESSAGE')
                        THEN make_interval(secs => ${messageDelaySeconds}) ELSE interval '0' END
                  AND COALESCE((data->>'emailAttempts')::int, 0) < ${EMAIL_MAX_ATTEMPTS}
                  AND (data->>'emailLeaseUntil' IS NULL
                       OR (data->>'emailLeaseUntil')::timestamptz <= now())
                ORDER BY "createdAt" ASC
                LIMIT ${limit}
                FOR UPDATE SKIP LOCKED
            )
            RETURNING n.id
        `;
        return rows.map((row) => ({ id: row.id, token }));
    }

    private async sendOne(id: string, token: string): Promise<void> {
        try {
            const notice = await this.prisma.notification.findUnique({
                where: { id },
                select: {
                    id: true, userId: true, type: true, title: true, message: true,
                    data: true, isRead: true, createdAt: true,
                    user: { select: { email: true, deletedAt: true } },
                },
            });
            if (!notice) return;
            const data = (notice.data as Record<string, any> | null) ?? {};

            if (!notice.user?.email || notice.user.deletedAt
                || notice.userId === process.env.MAZIUM_SUPPORT_BOT_USER_ID?.trim()) {
                return this.complete(id, token, 'skipped', 'No reachable recipient');
            }
            if (!(await this.notifications.shouldSendEmail(notice.userId, notice.type))) {
                return this.complete(id, token, 'skipped', 'Email notifications switched off');
            }
            if (isMessageNotification(notice.type)) {
                const skip = messageEmailSkipReason({
                    isRead: notice.isRead,
                    emailedForRoomRecently: await this.roomEmailedRecently(notice.userId, data.roomId, id),
                });
                if (skip) return this.complete(id, token, 'skipped', skip);
            }

            const frontendUrl = resolveFrontendUrl(process.env.FRONTEND_URL);
            const { subject, bodyHtml } = renderNotificationEmail({
                title: notice.title,
                message: notice.message,
                url: notificationEmailUrl(frontendUrl, data.link),
                settingsUrl: notificationEmailUrl(frontendUrl, '/notifications'),
            });
            const result = await this.email.sendBrandedEmail({ to: notice.user.email, subject, bodyHtml });
            if (result?.id) return this.complete(id, token, 'submitted', '');
            const attempts = Number(data.emailAttempts ?? 1);
            return this.complete(id, token, attempts >= EMAIL_MAX_ATTEMPTS ? 'failed' : 'retry',
                'Email provider did not accept the message');
        } catch (error: any) {
            this.logger.warn(`Notification email ${id} failed: ${error?.message}`);
            await this.complete(id, token, 'retry', 'Unexpected error').catch(() => undefined);
        }
    }

    private async roomEmailedRecently(userId: string, roomId: unknown, excludeId: string): Promise<boolean> {
        if (typeof roomId !== 'string' || !roomId) return false;
        const since = new Date(Date.now() - MESSAGE_EMAIL_THROTTLE_MS).toISOString();
        const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "notifications"
            WHERE "userId" = ${userId}
              AND id <> ${excludeId}
              AND data->>'roomId' = ${roomId}
              AND data->>'emailQueue' = 'submitted'
              AND (data->>'emailSentAt')::timestamptz >= ${since}::timestamptz
            LIMIT 1
        `;
        return rows.length > 0;
    }

    private async complete(id: string, token: string, status: EmailQueueStatus, reason: string) {
        await this.prisma.$executeRaw`
            UPDATE "notifications"
            SET data = data || jsonb_build_object(
                'emailQueue', ${status}::text,
                'emailReason', ${reason}::text,
                'emailLeaseUntil', NULL
            ) || CASE WHEN ${status}::text = 'submitted'
                    THEN jsonb_build_object('emailSentAt', now()::text) ELSE '{}'::jsonb END
            WHERE id = ${id} AND data->>'emailClaimToken' = ${token}
        `;
    }
}
