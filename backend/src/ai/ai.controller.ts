import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto, AiChatDto } from './ai.dto';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('search')
    async search(@Body() dto: AiSearchDto) {
        const result = await this.aiService.searchRecommendation(dto.query);
        return { success: true, data: result };
    }

    @Post('chat')
    async chat(@Body() dto: AiChatDto) {
        const result = await this.aiService.chatCompletion(dto.messages);
        return { success: true, data: result };
    }

    @Post('generate-description')
    async generateDescription(@Body() dto: any) {
        const result = await this.aiService.generateDescription(dto);
        return { success: true, data: result };
    }
}
