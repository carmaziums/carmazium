import { Controller, Post, Body, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto, AiChatDto, AiDescriptionDto } from './ai.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('search')
    @ApiOperation({ summary: 'AI-powered vehicle search' })
    async search(@Body() dto: AiSearchDto) {
        const result = await this.aiService.searchRecommendation(dto.query);
        return { success: true, data: result };
    }

    @Post('chat')
    @ApiOperation({ summary: 'AI assistant chat' })
    async chat(@Body() dto: AiChatDto) {
        const result = await this.aiService.chatCompletion(dto.messages);
        return { success: true, data: result };
    }

    @Post('generate-description')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Generate a vehicle description using AI' })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    async generateDescription(@Body() dto: AiDescriptionDto) {
        const result = await this.aiService.generateDescription(dto);
        return { success: true, data: result };
    }
}
