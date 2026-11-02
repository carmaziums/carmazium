import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { EmailService } from '../email/email.service';
import { notificationEmailPolicy } from './notification-email-policy';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

// Imported only as a type to avoid the circular module-level reference that
// caused "Cannot access NotificationsGateway before initialization" at startup.
import type { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
    private readonly expo = new Expo();
    private readonly logger = new Logger(NotificationsService.name);
    private emailWorkerTimer: NodeJS.Timeout | null = null;
    private emailWorkerRunning = false;

    private static readonly EMAIL_BATCH_SIZE = 40;
    private static readonly EMAIL_MAX_ATTEMPTS = 4;
    private static readonly EMAIL_POLL_MS = 30_000;

    constructor(
        private readonly prisma: PrismaService,
        private readonly moduleRef: ModuleRef,
        private readonly emailService: EmailService,
    ) { }

    onModuleInit() {
        if (!this.notificationEmailsEnabled()) return;
        const firstRun = setTimeout(() => void this.processEmailQueue(), 5_000);
        firstRun.unref?.();
        this.emailWorkerTimer = setInterval(
            () => void this.processEmailQueue(),
            NotificationsService.EMAIL_POLL_MS,
        );
        this.emailWorkerTimer.unref?.();
    }

    onModuleDestroy() {
        if (this.emailWorkerTimer) clearInterval(this.emailWorkerTimer);
        this.emailWorkerTimer = null;
    }

    private notificationEmailsEnabled(): boolean {
        return String(process.env.NOTIFICATION_EMAILS_ENABLED || '').toLowerCase() === 'true';
    }

    private dailyEmailCap(): number {
        const configured = Number(process.env.NOTIFICATION_EMAIL_DAILY_CAP || 400);
        return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 400;
    }

    private asRecord(value: unknown): Record<string, any> {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, any>
            : {};
    }

    private escapeHtml(value: string): string {
        return value.replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char] || char));
    }

    // Lazily resolved to break the circular import at class-definition time.
    private get gateway(): NotificationsGateway {
        return this.moduleRef.get('NotificationsGateway', { strict: false });
    }

    // Maps a notification's `type` string to the specific per-event toggle key
    // NotificationSettingsScreen.tsx saves under preferences.notifications.*.
    // Types with no entry here (chat messages, payments, delivery, KYC, admin
    // actions, etc.) were never meant to be individually gated by that screen
    // — only these "can get noisy" categories have dedicated toggles.
    private static readonly TYPE_PREF_KEY: Record<string, string> = {
        OUTBID: 'outbid',
        AUCTION_WON: 'winning',
        AUCTION_FEE_REMINDER: 'winning',
        AUCTION_ENDING: 'endingSoon',
        OFFER_COUNTERED: 'counterOffer',
        OFFER_ACCEPTED: 'offerAccepted',
        OFFER_REJECTED: 'offerDeclined',
    };

    private isMuted(type: string, notifPrefs: Record<string, any>): boolean {
        if (notifPrefs.muteAll === true) return true;
        const key = NotificationsService.TYPE_PREF_KEY[type];
        return !!key && notifPrefs[key] === false;
    }

    // Used by EmailService call sites (offers.service.ts, auctions.service.ts)
    // whose email corresponds 1:1 to one of the events NotificationSettingsScreen.tsx
    // actually offers a toggle for — see TYPE_PREF_KEY above. Emails with no
    // dedicated toggle (welcome, KYC, staff invite, offer-received, handover,
    // etc.) are intentionally not routed through this and keep sending
    // unconditionally, same as before.
    async shouldSendEmail(userId: string, type: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const prefs = user?.preferences as Record<string, any> | null;
        const notifPrefs = prefs?.notifications as Record<string, any> | undefined;
        if (!notifPrefs) return true;
        if (this.isMuted(type, notifPrefs)) return false;
        return notifPrefs.email !== false;
    }

    // Server-local-time comparison — there's no per-user timezone on the User
    // model to do this precisely, so this is a best-effort improvement over
    // the previous "always push, quiet hours are decorative" behavior, not a
    // guarantee the push lands outside the user's actual quiet window.
    private isQuietHours(notifPrefs?: Record<string, any>): boolean {
        if (!notifPrefs || notifPrefs.quietHours !== true) return false;
        const start = notifPrefs.quietStart as string | undefined;
        const end = notifPrefs.quietEnd as string | undefined;
        if (!start || !end) return false;
        const toMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        const startM = toMinutes(start);
        const endM = toMinutes(end);
        if (startM === endM) return false;
        const now = new Date();
        const nowM = now.getHours() * 60 + now.getMinutes();
        return startM < endM
            ? nowM >= startM && nowM < endM
            : nowM >= startM || nowM < endM; // wraps midnight, e.g. 22:00 -> 08:00
    }

    async create(dto: CreateNotificationDto) {
        // Read preferences before inserting so optional generic-email queue
        // metadata is committed with the notification row itself.
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            select: { preferences: true },
        });
        const prefs = user?.preferences as Record<string, any> | null;
        const notifPrefs = prefs?.notifications as Record<string, any> | undefined;
        const muted = !!notifPrefs && this.isMuted(dto.type, notifPrefs);

        // 'link' is not a Prisma column — merge it into the JSON 'data' field.
        // _email is private worker state; it is never copied into push payloads.
        const { link, ...prismaFields } = dto;
        const mergedData = { ...(dto.data || {}), ...(link ? { link } : {}) };
        const emailPolicy = notificationEmailPolicy({ type: dto.type, data: mergedData });
        const queueGenericEmail =
            this.notificationEmailsEnabled() &&
            emailPolicy.eligible &&
            !muted &&
            notifPrefs?.email !== false;

        const storedData = queueGenericEmail
            ? {
                ...mergedData,
                _email: {
                    state: 'pending',
                    attempts: 0,
                    notBefore: new Date(Date.now() + emailPolicy.delayMs).toISOString(),
                },
            }
            : mergedData;

        const notification = await this.prisma.notification.create({
            data: {
                ...prismaFields,
                data: Object.keys(storedData).length > 0
                    ? storedData as Prisma.InputJsonValue
                    : undefined,
            },
        });

        // Respect the recipient's saved notification preferences before doing
        // anything interruptive. The row above is still always created; muted
        // events remain available in notification history.

        if (!muted) {
            // Real-time delivery (foreground — user has active socket connection)
            this.gateway.sendNotification(dto.userId, notification);

            // Expo push delivery (background / killed — user has no active
            // socket). Gated by the "Push" delivery-channel toggle too, not
            // just quiet hours — don't buzz the phone during the user's
            // chosen window, or at all if they turned push off. The row
            // above is already saved either way, so it's waiting next time
            // they open the app.
            const pushEnabled = notifPrefs?.push !== false;
            if (pushEnabled && !this.gateway.isUserConnected(dto.userId) && !this.isQuietHours(notifPrefs)) {
                const expoPushToken = prefs?.expoPushToken;
                if (expoPushToken) {
                    await this.pushToExpo(expoPushToken, {
                        title: dto.title,
                        body: dto.message,
                        data: {
                            ...mergedData,
                            type: dto.type,
                            ...(dto.entityType ? { entityType: dto.entityType } : {}),
                            ...(dto.entityId ? { entityId: dto.entityId } : {}),
                            ...(dto.actionType ? { actionType: dto.actionType } : {}),
                            notifId: notification.id,
                        },
                        channelId: this.getChannelId(dto.type),
                    });
                }
            }
        }

        return notification;
    }

    async findAll(userId: string, page = 1, limit = 20) {
        const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
        const safeLimit = Number.isFinite(limit)
            ? Math.min(50, Math.max(1, Math.floor(limit)))
            : 20;
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeLimit,
            }),
            this.prisma.notification.count({ where: { userId } }),
        ]);
        return { data, total, page: safePage, limit: safeLimit };
    }

    async getUnreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    /**
     * Get recent unread notifications for catch-up when a user reconnects to the notifications socket.
     */
    async getRecentUnread(userId: string, limit = 10) {
        return this.prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async markAsRead(id: string, userId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id, userId },
        });

        if (!notification) {
            return null;
        }

        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    // ─── Generic notification email queue ───────────────────────────────────

    private async processEmailQueue(): Promise<void> {
        if (!this.notificationEmailsEnabled() || this.emailWorkerRunning) return;
        this.emailWorkerRunning = true;
        try {
            const claimed = await this.claimEmailBatch();
            for (const notification of claimed) {
                await this.deliverClaimedEmail(notification);
            }
        } catch (error: any) {
            this.logger.error(`Notification email worker failed: ${error?.message || error}`);
        } finally {
            this.emailWorkerRunning = false;
        }
    }

    private async claimEmailBatch(): Promise<any[]> {
        return this.prisma.$queryRaw<any[]>(Prisma.sql`
            WITH picked AS (
                SELECT id
                FROM "notifications"
                WHERE (data #>> '{_email,state}') IN ('pending', 'retry', 'sending')
                  AND COALESCE(
                        (data #>> '{_email,notBefore}')::timestamptz,
                        "createdAt"
                      ) <= NOW()
                  AND (
                        (data #>> '{_email,state}') <> 'sending'
                        OR COALESCE(
                            (data #>> '{_email,claimedAt}')::timestamptz,
                            to_timestamp(0)
                        ) < NOW() - INTERVAL '10 minutes'
                      )
                ORDER BY "createdAt" ASC
                LIMIT ${NotificationsService.EMAIL_BATCH_SIZE}
                FOR UPDATE SKIP LOCKED
            )
            UPDATE "notifications" AS n
            SET data = jsonb_set(
                COALESCE(n.data, '{}'::jsonb),
                '{_email}',
                COALESCE(n.data -> '_email', '{}'::jsonb) ||
                jsonb_build_object(
                    'state', 'sending',
                    'claimedAt', NOW(),
                    'attempts', COALESCE((n.data #>> '{_email,attempts}')::int, 0) + 1
                ),
                true
            )
            FROM picked
            WHERE n.id = picked.id
            RETURNING n.id, n."userId", n.type, n.title, n.message, n.data,
                      n."isRead", n."createdAt"
        `);
    }

    private async sentTodayCount(): Promise<number> {
        const rows = await this.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "notifications"
            WHERE data #>> '{_email,state}' = 'sent'
              AND (data #>> '{_email,sentAt}') IS NOT NULL
              AND (data #>> '{_email,sentAt}')::timestamptz
                    >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        `);
        return Number(rows[0]?.count || 0);
    }

    private async reserveConversationEmailSlot(
        notification: any,
        roomId: string,
    ): Promise<boolean> {
        return this.prisma.$transaction(async (tx) => {
            // Serialize reservation decisions per conversation. This is a very
            // short DB-only transaction; the actual email send happens after
            // the lock is released.
            await tx.$queryRaw(Prisma.sql`
                SELECT id
                FROM "chat_rooms"
                WHERE id = ${roomId}
                FOR UPDATE
            `);

            const rows = await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
                SELECT EXISTS (
                    SELECT 1
                    FROM "notifications"
                    WHERE id <> ${notification.id}
                      AND "userId" = ${notification.userId}
                      AND type IN ('MESSAGE_RECEIVED', 'NEW_MESSAGE')
                      AND data ->> 'roomId' = ${roomId}
                      AND (
                            (
                                (data #>> '{_email,sentAt}') IS NOT NULL
                                AND (data #>> '{_email,sentAt}')::timestamptz
                                    > NOW() - INTERVAL '30 minutes'
                            )
                            OR (
                                (data #>> '{_email,slotReservedAt}') IS NOT NULL
                                AND (data #>> '{_email,slotReservedAt}')::timestamptz
                                    > NOW() - INTERVAL '30 minutes'
                            )
                      )
                ) AS exists
            `);
            if (rows[0]?.exists === true) return false;

            const data = this.asRecord(notification.data);
            const previous = this.asRecord(data._email);
            const next = {
                ...data,
                _email: {
                    ...previous,
                    slotReservedAt: new Date().toISOString(),
                },
            };
            notification.data = next;
            await tx.notification.update({
                where: { id: notification.id },
                data: { data: next as Prisma.InputJsonValue },
            });
            return true;
        });
    }

    private async updateEmailState(
        notification: any,
        updates: Record<string, string | number | boolean | null>,
    ): Promise<void> {
        const data = this.asRecord(notification.data);
        const previous = this.asRecord(data._email);
        const next = {
            ...data,
            _email: {
                ...previous,
                ...updates,
            },
        };
        notification.data = next;
        await this.prisma.notification.update({
            where: { id: notification.id },
            data: { data: next as Prisma.InputJsonValue },
        });
    }

    private async deliverClaimedEmail(notification: any): Promise<void> {
        const data = this.asRecord(notification.data);
        const emailState = this.asRecord(data._email);
        const attempts = Number(emailState.attempts || 1);

        if (notification.isRead) {
            await this.updateEmailState(notification, {
                state: 'skipped',
                skippedAt: new Date().toISOString(),
                reason: 'notification-read',
            });
            return;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: notification.userId },
            select: { email: true, firstName: true, deletedAt: true, preferences: true },
        });
        if (!user?.email || user.deletedAt) {
            await this.updateEmailState(notification, {
                state: 'skipped',
                skippedAt: new Date().toISOString(),
                reason: 'recipient-unavailable',
            });
            return;
        }

        const prefs = user.preferences as Record<string, any> | null;
        const notifPrefs = prefs?.notifications as Record<string, any> | undefined;
        if (notifPrefs?.email === false || (!!notifPrefs && this.isMuted(notification.type, notifPrefs))) {
            await this.updateEmailState(notification, {
                state: 'skipped',
                skippedAt: new Date().toISOString(),
                reason: 'email-preference-disabled',
            });
            return;
        }

        const isChat = notification.type === 'MESSAGE_RECEIVED' || notification.type === 'NEW_MESSAGE';
        if (isChat) {
            const messageId = typeof data.messageId === 'string' ? data.messageId : null;
            if (messageId) {
                const message = await this.prisma.message.findUnique({
                    where: { id: messageId },
                    select: { isRead: true, deletedAt: true },
                });
                if (!message || message.isRead || message.deletedAt) {
                    await this.updateEmailState(notification, {
                        state: 'skipped',
                        skippedAt: new Date().toISOString(),
                        reason: 'chat-message-already-read',
                    });
                    return;
                }
            }

            const roomId = typeof data.roomId === 'string' ? data.roomId : null;
            if (roomId && !(await this.reserveConversationEmailSlot(notification, roomId))) {
                await this.updateEmailState(notification, {
                    state: 'skipped',
                    skippedAt: new Date().toISOString(),
                    reason: 'conversation-throttled',
                });
                return;
            }
        }

        if (await this.sentTodayCount() >= this.dailyEmailCap()) {
            await this.updateEmailState(notification, {
                state: 'retry',
                claimedAt: null,
                notBefore: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                reason: 'daily-cap-reached',
            });
            return;
        }

        const frontend = (process.env.FRONTEND_URL || 'https://www.carmazium.com').replace(/\/$/, '');
        const link = typeof data.link === 'string' && data.link.startsWith('/')
            ? `${frontend}${data.link}`
            : `${frontend}/dashboard`;
        const safeName = this.escapeHtml(user.firstName?.trim() || 'there');
        const safeTitle = this.escapeHtml(String(notification.title || 'CarMazium update'));
        const safeMessage = this.escapeHtml(String(notification.message || 'You have a new CarMazium notification.'));
        const result = await this.emailService.sendBrandedEmail({
            to: user.email,
            subject: `${notification.title || 'CarMazium update'} — CarMazium`,
            bodyHtml: `
                <p>Hi ${safeName},</p>
                <h1>${safeTitle}</h1>
                <p>${safeMessage}</p>
                <p><a href="${this.escapeHtml(link)}">Open CarMazium</a></p>
                <p>You can turn notification emails off from your CarMazium notification settings.</p>
            `,
        });

        if (result) {
            await this.updateEmailState(notification, {
                state: 'sent',
                sentAt: new Date().toISOString(),
                providerId: result.id,
                claimedAt: null,
                reason: null,
            });
            return;
        }

        if (attempts >= NotificationsService.EMAIL_MAX_ATTEMPTS) {
            await this.updateEmailState(notification, {
                state: 'failed',
                failedAt: new Date().toISOString(),
                claimedAt: null,
                reason: 'all-email-providers-failed',
            });
            return;
        }

        const backoffMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempts - 1)));
        await this.updateEmailState(notification, {
            state: 'retry',
            claimedAt: null,
            notBefore: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
            reason: 'send-failed-will-retry',
        });
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    private getChannelId(type: string): string {
        if (type.includes('BID') || type.includes('AUCTION')) return 'carmazium-bids';
        if (type.includes('MESSAGE') || type.includes('CHAT'))  return 'carmazium-messages';
        return 'carmazium-default';
    }

    private async pushToExpo(
        token: string,
        payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string },
    ): Promise<void> {
        if (!Expo.isExpoPushToken(token)) {
            this.logger.warn(`Invalid Expo push token: ${token}`);
            return;
        }

        const message: ExpoPushMessage = {
            to:        token,
            title:     payload.title,
            body:      payload.body,
            data:      payload.data ?? {},
            channelId: payload.channelId ?? 'carmazium-default',
            sound:     'default',
            priority:  'high',
        };

        const chunks = this.expo.chunkPushNotifications([message]);
        for (const chunk of chunks) {
            try {
                const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync(chunk);
                for (const ticket of tickets) {
                    if (ticket.status === 'error') {
                        this.logger.warn(`Expo push ticket error: ${ticket.details?.error} — token may be stale`);
                    }
                }
            } catch (err) {
                this.logger.error('Expo push send failed', err);
            }
        }
    }
}
