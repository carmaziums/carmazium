import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatContext } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaziumSupportAutoReplyService } from './mazium-support-auto-reply.service';

/**
 * Conservative polling dispatcher. Only new customer messages are considered.
 * Disabled unless both the core and dispatcher flags are explicitly enabled.
 * The persistence service remains the final authority on eligibility.
 */
@Injectable()
export class MaziumSupportDispatcher {
    private readonly logger = new Logger(MaziumSupportDispatcher.name);
    private running = false;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly autoReply: MaziumSupportAutoReplyService,
    ) {}

    @Cron(CronExpression.EVERY_30_SECONDS)
    async dispatch(): Promise<void> {
        if (this.running
            || this.config.get<string>('MAZIUM_SUPPORT_AUTO_REPLY_ENABLED') !== 'true'
            || this.config.get<string>('MAZIUM_SUPPORT_DISPATCH_ENABLED') !== 'true'
            || !this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID')) return;
        this.running = true;
        try {
            // Only messages arriving after the customer opted in may trigger
            // an autonomous reply. Older messages require human handling.
            const since = new Date(Date.now() - 2 * 60 * 1000);
            // Avoid paying for model generations after the reply quota is
            // exhausted. The transactional insert independently rechecks.
            const maxDaily = Math.min(100, Math.max(1,
                Number(this.config.get<string>('MAZIUM_SUPPORT_MAX_DAILY_REPLIES') || 20) || 20));
            const dayStart = new Date();
            dayStart.setUTCHours(0, 0, 0, 0);
            const sentToday = await this.prisma.message.count({
                where: { aiGenerated: true, createdAt: { gte: dayStart } },
            });
            if (sentToday >= maxDaily) return;
            const testUsers = (this.config.get<string>('MAZIUM_SUPPORT_TEST_USER_IDS') || '')
                .split(',').map((id) => id.trim()).filter(Boolean);
            // A missing allowlist must never result in sending to every customer.
            if (!testUsers.length) return;
            const messages = await this.prisma.message.findMany({
                where: {
                    createdAt: { gte: since },
                    aiSourceMessageId: null,
                    deletedAt: null,
                    aiGenerated: false,
                    aiSupportAttemptedAt: null,
                    attachmentPath: null,
                    // Exclude all messages authored by the configured AI
                    // identity, even if older records lack AI provenance.
                    senderId: { in: testUsers },
                    sender: { role: { not: 'ADMIN' } },
                    chatRoom: {
                        context: ChatContext.SUPPORT,
                        deletedAt: null,
                        supportClosedAt: null,
                        supportAiConsentAt: { not: null },
                        supportAiOptedOutAt: null,
                        supportHumanTakeoverAt: null,
                    },
                },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                take: 5,
                select: { id: true, chatRoomId: true },
            });
            for (const message of messages) {
                const room = await this.prisma.chatRoom.findUnique({
                    where: { id: message.chatRoomId },
                    select: { supportAiConsentAt: true },
                });
                const participantIds = await this.prisma.chatRoom.findUnique({
                    where: { id: message.chatRoomId },
                    select: { initiatorId: true, participantId: true },
                });
                if (!participantIds) continue;
                const customer = await this.prisma.message.findUnique({
                    where: { id: message.id }, select: { senderId: true },
                });
                if (!customer || !testUsers.includes(customer.senderId)) continue;
                const source = await this.prisma.message.findUnique({
                    where: { id: message.id },
                    select: { createdAt: true },
                });
                if (!room?.supportAiConsentAt || !source
                    || source.createdAt < room.supportAiConsentAt) continue;
                // Atomic claim prevents repeated OpenAI calls from parallel
                // workers or from the next 30-second polling cycle.
                const claimed = await this.prisma.$transaction(async (tx) => {
                    await tx.$queryRaw`SELECT pg_advisory_xact_lock(186729, 2)`;
                    const now = new Date();
                    const today = new Date(now);
                    today.setUTCHours(0, 0, 0, 0);
                    const attemptsToday = await tx.message.count({
                        where: { aiSupportAttemptedAt: { gte: today } },
                    });
                    if (attemptsToday >= maxDaily) return false;
                    const recentRoomAttempt = await tx.message.count({
                        where: {
                            chatRoomId: message.chatRoomId,
                            aiSupportAttemptedAt: { gte: new Date(now.getTime() - 60_000) },
                        },
                    });
                    if (recentRoomAttempt > 0) return false;
                    const latest = await tx.message.findFirst({
                        where: { chatRoomId: message.chatRoomId, deletedAt: null },
                        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                        select: { id: true },
                    });
                    if (latest?.id !== message.id) return false;
                    const claim = await tx.message.updateMany({
                        where: {
                            id: message.id,
                            chatRoomId: message.chatRoomId,
                            aiGenerated: false,
                            aiSupportAttemptedAt: null,
                        },
                        data: { aiSupportAttemptedAt: now },
                    });
                    return claim.count === 1;
                });
                if (!claimed) continue;
                await this.autoReply.processCustomerMessage(message.chatRoomId, message.id);
            }
        } catch {
            this.logger.warn('MaziuM dispatcher deferred to human support');
        } finally {
            this.running = false;
        }
    }
}
