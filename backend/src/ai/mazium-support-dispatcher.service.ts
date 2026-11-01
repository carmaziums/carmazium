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
            const since = new Date(Date.now() - 2 * 60 * 1000);
            const messages = await this.prisma.message.findMany({
                where: {
                    createdAt: { gte: since },
                    deletedAt: null,
                    aiGenerated: false,
                    attachmentPath: null,
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
                await this.autoReply.processCustomerMessage(message.chatRoomId, message.id);
            }
        } catch {
            this.logger.warn('MaziuM dispatcher deferred to human support');
        } finally {
            this.running = false;
        }
    }
}
