import { Controller, Get, Header, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatRateLimitService } from '../chat/chat-rate-limit.service';
import { TourNarrationService } from './tour-narration.service';

@Controller('ai/tour-narration')
@UseGuards(SessionAuthGuard)
export class TourNarrationController {
    constructor(private readonly narration: TourNarrationService, private readonly rateLimit: ChatRateLimitService) {}

    @Get(':key')
    @Header('Cache-Control', 'private, max-age=3600')
    @Header('Vary', 'Authorization, Cookie')
    @Header('X-Content-Type-Options', 'nosniff')
    async get(@Param('key') key: string, @CurrentUser() user: { id: string }) {
        await this.rateLimit.consumeTourNarration(user.id);
        const audio = await this.narration.get(key);
        return new StreamableFile(audio, { type: 'audio/mpeg', length: audio.length });
    }
}
