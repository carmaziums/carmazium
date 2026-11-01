import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { AiService } from './ai.service';
import { classifySupportMessage } from '../chat/mazium-support-policy';

/**
 * Internal orchestrator. Not a public controller or chat sender.
 * An inbound-event dispatcher may call this only for a newly persisted
 * official support customer message. All failures defer to human support.
 */
@Injectable()
export class MaziumSupportAutoReplyService {
    private readonly logger = new Logger(MaziumSupportAutoReplyService.name);

    constructor(
        private readonly config: ConfigService,
        private readonly chat: ChatService,
        private readonly gateway: ChatGateway,
        private readonly ai: AiService,
    ) {}

    async processCustomerMessage(roomId: string, sourceMessageId: string): Promise<boolean> {
        if (this.config.get<string>('MAZIUM_SUPPORT_AUTO_REPLY_ENABLED') !== 'true') return false;
        const botUserId = this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID');
        if (!botUserId) return false;
        try {
            const eligible = await this.chat.inspectSupportAutoReply(roomId, sourceMessageId);
            if (!eligible.eligible || classifySupportMessage(eligible.content).action !== 'DRAFT') {
                return false;
            }
            // Deliberately use only the current customer message. Previous
            // customer text and attachments can contain untrusted instructions.
            const draft = await this.ai.draftSupportReply([
                { role: 'user', content: eligible.content },
            ]);
            if (!draft || classifySupportMessage(draft).action !== 'DRAFT') return false;
            const saved = await this.chat.persistSupportAutoReply(
                roomId, sourceMessageId, botUserId, draft,
            );
            if (!saved.created) return false;
            this.gateway.broadcastMessage(roomId, saved.message);
            return true;
        } catch (error) {
            this.logger.warn('MaziuM support automation deferred to human review');
            return false;
        }
    }
}
