import { Controller, Post, Get, Patch, Body, Param, Query, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto, AiChatDto, AiDescriptionDto, AiReportDto, UpdateAiReportDto } from './ai.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

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

    @Post('report')
    @ApiOperation({ summary: 'Report an unsafe, offensive or misleading MaziuM AI response' })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async report(@Body() dto: AiReportDto) {
        const result = await this.aiService.createReport(dto);
        return { success: true, data: { id: result.id, status: result.status } };
    }

    @Get('admin/reports')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'List MaziuM AI reports for admin review' })
    async listReports(
        @Query('page') page = 1,
        @Query('limit') limit = 30,
        @Query('status') status?: string,
    ) {
        return {
            success: true,
            data: await this.aiService.listReports(Number(page), Number(limit), status),
        };
    }

    @Patch('admin/reports/:id')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Review a MaziuM AI report' })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async updateReport(
        @Param('id') id: string,
        @CurrentUser() user: { id: string },
        @Body() dto: UpdateAiReportDto,
    ) {
        return {
            success: true,
            data: await this.aiService.updateReport(id, user.id, dto),
        };
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
