import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { AiService } from './ai.service';
import { safeAutomaticSupportReply } from '../chat/mazium-support-policy';
import { SUPPORT_UNAVAILABLE_REPLY } from '../chat/support-automatic-responses';

@Injectable()
export class MaziumSupportAutoReplyService {
    private readonly logger = new Logger(MaziumSupportAutoReplyService.name);
    constructor(private readonly config: ConfigService, private readonly chat: ChatService,
        private readonly gateway: ChatGateway, private readonly ai: AiService) {}

    async inspect(roomId: string, sourceMessageId: string) {
        return this.chat.inspectSupportAutoReply(roomId, sourceMessageId);
    }
    async processCustomerMessage(roomId: string, sourceMessageId: string, allowGeneration = true): Promise<boolean> {
        if (this.config.get<string>('MAZIUM_SUPPORT_AUTO_REPLY_ENABLED') !== 'true') return false;
        const botUserId = this.config.get<string>('MAZIUM_SUPPORT_BOT_USER_ID');
        if (!botUserId) return false;
        try {
            const eligible = await this.inspect(roomId, sourceMessageId);
            if (!eligible.eligible) return false;
            let kind: 'FIXED' | 'AI' = 'FIXED';
            let reply = eligible.plan.kind === 'FIXED' ? eligible.plan.reply : SUPPORT_UNAVAILABLE_REPLY;
            if (eligible.plan.kind === 'AI' && allowGeneration) {
                const draft = await this.ai.draftSupportReply([{ role: 'user', content: eligible.content }], { automatic: true });
                if (draft && safeAutomaticSupportReply(draft)) { reply = draft; kind = 'AI'; }
            }
            let saved = await this.chat.persistSupportAutoReply(roomId, sourceMessageId, botUserId, reply, kind);
            if (!saved.created && ['DAILY_LIMIT_REACHED', 'ROOM_COOLDOWN'].includes(saved.reason)) {
                saved = await this.chat.persistSupportAutoReply(roomId, sourceMessageId, botUserId, SUPPORT_UNAVAILABLE_REPLY, 'FIXED');
            }
            if (!saved.created) return false;
            this.gateway.broadcastMessage(roomId, saved.message);
            return true;
        } catch {
            this.logger.warn('MaziuM support automation deferred to human review');
            return false;
        }
    }
}
