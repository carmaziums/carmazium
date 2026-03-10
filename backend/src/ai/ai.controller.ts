import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto, AiChatDto, AiDescriptionDto } from './ai.dto';

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
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    async generateDescription(@Body() dto: AiDescriptionDto) {
        const result = await this.aiService.generateDescription(dto);
        return { success: true, data: result };
    }
}
