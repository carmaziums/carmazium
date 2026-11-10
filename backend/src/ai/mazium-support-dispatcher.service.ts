import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatContext, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaziumSupportAutoReplyService } from './mazium-support-auto-reply.service';
import { SupportMessageEvents } from '../chat/support-message-events';

/** Inbound events reply immediately; polling recovers missed events, never old conversations. */
@Injectable()
export class MaziumSupportDispatcher implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MaziumSupportDispatcher.name);
    private running = false;
    private startedAt = new Date();
    private unsubscribe?: () => void;
    private botReady = false;
    constructor(private readonly config: ConfigService, private readonly prisma: PrismaService,
        private readonly autoReply: MaziumSupportAutoReplyService, private readonly events: SupportMessageEvents) {}
    private enabled() {
        return this.config.get<string>('MAZIUM_SUPPORT_AUTO_REPLY_ENABLED') === 'true'
            && this.config.get<string>('MAZIUM_SUPPORT_DISPATCH_ENABLED') === 'true'
            && !!this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID');
    }
    async status() {
        const botId = this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID');
        const bot = botId ? await this.prisma.user.findUnique({ where: { id: botId }, select: { role: true, deletedAt: true, lockoutUntil: true } }) : null;
        return { enabled: this.enabled(), audience: this.config.get<string>('MAZIUM_SUPPORT_AUDIENCE') || 'test',
            botReady: !!bot && bot.role !== UserRole.ADMIN && !bot.deletedAt && !!bot.lockoutUntil && bot.lockoutUntil > new Date(),
            modelAvailable: !!this.config.get<string>('OPENAI_API_KEY') };
    }
    private allowedCustomer(id: string) {
        return this.config.get<string>('MAZIUM_SUPPORT_AUDIENCE') === 'all'
            || (this.config.get<string>('MAZIUM_SUPPORT_TEST_USER_IDS') || '').split(',').map(x => x.trim()).filter(Boolean).includes(id);
    }
    async onModuleInit() {
        if (!this.enabled()) return;
        this.startedAt = new Date();
        this.unsubscribe = this.events.subscribe((roomId, messageId) => {
            void this.processOne(roomId, messageId).catch(() => this.logger.warn('Support event deferred to polling'));
        });
        await this.ensureBot();
    }
    onModuleDestroy() { this.unsubscribe?.(); }
    private async ensureBot(): Promise<boolean> {
        if (this.botReady) return true;
        const id = this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID');
        if (!id) return false;
        try {
            const bot = await this.prisma.user.upsert({
                where: { id }, update: {},
                create: { id, email: `mazium-support-${id}@system.carmazium.invalid`,
                    passwordHash: '!SYSTEM_ACCOUNT_NO_LOGIN!', role: UserRole.BUYER,
                    firstName: 'MaziuM', lastName: 'Automated Support',
                    lockoutUntil: new Date('9999-12-31T00:00:00.000Z'), isEmailVerified: false, showPublicProfile: false },
                select: { id: true, email: true, role: true, deletedAt: true, lockoutUntil: true },
            });
            this.botReady = bot.email === `mazium-support-${id}@system.carmazium.invalid`
                && bot.role !== UserRole.ADMIN && !bot.deletedAt && !!bot.lockoutUntil && bot.lockoutUntil > new Date();
            if (!this.botReady) this.logger.error('Support bot identity is not a locked system account');
            return this.botReady;
        } catch { this.logger.error('Could not prepare the locked support bot identity'); return false; }
    }
    async processOne(roomId: string, messageId: string) {
        if (!this.enabled() || !(await this.ensureBot())) return;
        const eligible = await this.autoReply.inspect(roomId, messageId);
        if (!eligible.eligible || !this.allowedCustomer(eligible.customerId)) return;
        const claimed = await this.prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(186729, 2)`;
            const maxDaily = Math.min(1000, Math.max(1, Number(this.config.get<string>('MAZIUM_SUPPORT_MAX_DAILY_REPLIES') || 200) || 200));
            const today = new Date(); today.setUTCHours(0, 0, 0, 0);
            const attempts = eligible.plan.kind === 'AI' ? await tx.message.count({ where: { aiSupportAttemptedAt: { gte: today } } }) : 0;
            const claim = await tx.message.updateMany({
                where: { id: messageId, chatRoomId: roomId, aiGenerated: false, deletedAt: null, aiSupportAttemptedAt: null, createdAt: { gte: this.startedAt } },
                data: { aiSupportAttemptedAt: new Date() },
            });
            return { claimed: claim.count === 1, allowGeneration: attempts < maxDaily };
        });
        if (claimed.claimed) {
            const delivered = await this.autoReply.processCustomerMessage(roomId, messageId, claimed.allowGeneration);
            if (!delivered && eligible.plan.kind === 'FIXED') {
                // Retry a failed local receipt without paying for another model call.
                await this.prisma.message.updateMany({ where: { id: messageId, chatRoomId: roomId, aiGenerated: false }, data: { aiSupportAttemptedAt: null } });
            }
        }
    }
    @Cron(CronExpression.EVERY_5_SECONDS)
    async dispatch(): Promise<void> {
        if (this.running || !this.enabled() || !(await this.ensureBot())) return;
        this.running = true;
        try {
            const since = new Date(Math.max(this.startedAt.getTime(), Date.now() - 2 * 60 * 1000));
            const testUsers = (this.config.get<string>('MAZIUM_SUPPORT_TEST_USER_IDS') || '').split(',').map(id => id.trim()).filter(Boolean);
            if (this.config.get<string>('MAZIUM_SUPPORT_AUDIENCE') !== 'all' && !testUsers.length) return;
            const messages = await this.prisma.message.findMany({
                where: { createdAt: { gte: since }, deletedAt: null, aiGenerated: false, aiSupportAttemptedAt: null, aiSourceMessageId: null,
                    senderId: { not: this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID'), ...(this.config.get<string>('MAZIUM_SUPPORT_AUDIENCE') !== 'all' ? { in: testUsers } : {}) },
                    sender: { role: { not: 'ADMIN' } }, chatRoom: { context: ChatContext.SUPPORT, deletedAt: null, supportClosedAt: null } },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, select: { id: true, chatRoomId: true },
            });
            for (const message of messages) await this.processOne(message.chatRoomId, message.id);
        } catch { this.logger.warn('Support dispatcher deferred to human support'); }
        finally { this.running = false; }
    }
}
