import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type ChatSafetyCategory =
    | 'THREAT_OR_SEVERE_HARASSMENT'
    | 'SEXUAL_EXPLOITATION'
    | 'CREDENTIAL_THEFT'
    | 'PLATFORM_MODERATION';

const LOCAL_HIGH_CONFIDENCE_RULES: Array<{
    category: ChatSafetyCategory;
    pattern: RegExp;
}> = [
    {
        category: 'THREAT_OR_SEVERE_HARASSMENT',
        pattern: /\b(?:i(?:'|’)ll|i\s+will|i(?:'|’)m\s+going\s+to|im\s+going\s+to)\s+(?:kill|murder|stab|shoot|rape|seriously\s+hurt)\s+(?:you|your\s+(?:family|wife|husband|child|children)|him|her|them)\b/i,
    },
    {
        category: 'SEXUAL_EXPLOITATION',
        pattern: /\b(?:child\s+porn(?:ography)?|underage\s+sex(?:ual)?|nude\s+(?:child|minor)|sexual\s+(?:image|images|photo|photos)\s+of\s+(?:a\s+)?(?:child|minor))\b/i,
    },
    {
        category: 'CREDENTIAL_THEFT',
        pattern: /\b(?:send|share|give|tell)\s+(?:me\s+)?(?:your\s+)?(?:password|one[-\s]?time\s+(?:code|password)|otp|bank\s+login|online\s+banking\s+(?:login|password)|card\s+pin|cvv|security\s+code)\b/i,
    },
];

/**
 * One server-side moderation boundary for member-authored chat text.
 *
 * The local rules catch a deliberately narrow set of high-confidence abuse
 * even if the external moderation provider is unavailable. When OpenAI is
 * configured, omni-moderation-latest adds a broader classifier before the
 * message is persisted or broadcast. We do not log the rejected message body.
 */
@Injectable()
export class ChatContentSafetyService {
    private readonly logger = new Logger(ChatContentSafetyService.name);
    private readonly openai: OpenAI | null;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('OPENAI_API_KEY');
        this.openai = apiKey ? new OpenAI({ apiKey }) : null;

        if (!apiKey) {
            this.logger.warn(
                'OPENAI_API_KEY not configured: chat safety is using local high-confidence filtering only.',
            );
        }
    }

    private localCategory(text: string): ChatSafetyCategory | null {
        const normalized = text
            .normalize('NFKC')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        for (const rule of LOCAL_HIGH_CONFIDENCE_RULES) {
            if (rule.pattern.test(normalized)) return rule.category;
        }
        return null;
    }

    async assertAllowedText(
        text: string | null | undefined,
        context: 'MESSAGE' | 'ATTACHMENT_CAPTION' = 'MESSAGE',
    ): Promise<void> {
        const clean = text?.trim();
        if (!clean) return;

        const local = this.localCategory(clean);
        if (local) {
            this.logger.warn(`Blocked chat content via local safety rule: ${local} (${context})`);
            throw new BadRequestException(
                'This message cannot be sent because it violates CarMazium chat safety rules.',
            );
        }

        if (!this.openai) return;

        try {
            const response = await this.openai.moderations.create({
                model: 'omni-moderation-latest',
                input: clean,
            });

            const result = response.results?.[0];
            if (result?.flagged) {
                const categories = Object.entries(result.categories ?? {})
                    .filter(([, flagged]) => Boolean(flagged))
                    .map(([name]) => name)
                    .slice(0, 6)
                    .join(', ');

                this.logger.warn(
                    `Blocked chat content via moderation model (${context})${categories ? `: ${categories}` : ''}`,
                );
                throw new BadRequestException(
                    'This message cannot be sent because it violates CarMazium chat safety rules.',
                );
            }
        } catch (error) {
            if (error instanceof BadRequestException) throw error;

            // Availability must not turn an external moderation outage into a
            // marketplace-wide messaging outage. The local filter, reporting,
            // blocking and admin review controls remain active.
            this.logger.error(
                `External chat moderation unavailable (${context}): ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
