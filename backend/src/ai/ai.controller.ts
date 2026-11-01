import { Controller, Post, Get, Patch, Body, Param, Query, Req, UsePipes, ValidationPipe, UseGuards, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiSearchDto, AiChatDto, AiDescriptionDto, AiReportDto, UpdateAiReportDto } from './ai.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ChatRateLimitService } from '../chat/chat-rate-limit.service';
import { ChatService } from '../chat/chat.service';
import { ChatContext } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { classifySupportMessage } from '../chat/mazium-support-policy';

@ApiTags('AI')
@Controller('ai')
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly rateLimit: ChatRateLimitService,
        private readonly chatService: ChatService,
        private readonly configService: ConfigService,
    ) { }

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

    /**
     * Admin-only preview. Does not post to chat, impersonate an administrator,
     * or authorise any account, financial, or listing action.
     */
    @Post('admin/support-draft/:roomId')
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Preview a MaziuM reply for human review (never sends)' })
    async supportDraft(
        @Param('roomId') roomId: string,
        @CurrentUser() user: { id: string },
    ) {
        if (this.configService.get<string>('MAZIUM_SUPPORT_DRAFT_ENABLED') !== 'true') {
            throw new BadRequestException('MaziuM support drafts are disabled.');
        }
        await this.rateLimit.consumeMessage(user.id);
        const room = await this.chatService.getRoom(roomId, user.id);
        if (room.context !== ChatContext.SUPPORT || room.supportClosedAt || room.deletedAt) {
            throw new BadRequestException('Only open official support rooms can be drafted.');
        }
        const transcript = await this.chatService.getRoomMessages(roomId, user.id, 1, 10);
        const latest = transcript.data[transcript.data.length - 1];
        const messages = transcript.data.filter((m: any) =>
            typeof m.content === 'string' && m.content.trim() && !m.deletedAt && !m.attachmentPath
        );
        const customerId = room.initiator?.role === UserRole.ADMIN ? room.participantId : room.participant?.role === UserRole.ADMIN ? room.initiatorId : null;
        if (!latest || !customerId || latest.senderId !== customerId || latest.attachmentPath || !latest.content?.trim() || room.supportAiOptedOutAt || room.supportHumanTakeoverAt) {
            throw new BadRequestException('No unanswered customer message to draft.');
        }
        const classification = classifySupportMessage(latest.content);
        if (classification.action === 'ESCALATE') {
            return { success: true, data: { status: 'HUMAN_REVIEW', reason: classification.reason } };
        }
        const draft = await this.aiService.draftSupportReply(messages.map((m: any) => ({
            role: m.sender?.role === UserRole.ADMIN ? 'assistant' as const : 'user' as const,
            content: m.content,
        })));
        const outputDecision = draft ? classifySupportMessage(draft) : null;
        // Do not offer a draft for a message that was answered or superseded
        // while the external model was generating its response.
        const current = await this.chatService.getRoomMessages(roomId, user.id, 1, 1);
        const latestNow = current.data[current.data.length - 1];
        const refreshedRoom = await this.chatService.getRoom(roomId, user.id);
        if (!latestNow || latestNow.id !== latest.id || latestNow.senderId !== customerId || refreshedRoom.supportClosedAt || refreshedRoom.deletedAt || refreshedRoom.supportAiOptedOutAt || refreshedRoom.supportHumanTakeoverAt) {
            return { success: true, data: { status: 'HUMAN_REVIEW', reason: 'CONVERSATION_CHANGED' } };
        }
        if (outputDecision?.action === 'ESCALATE') {
            return { success: true, data: { status: 'HUMAN_REVIEW', reason: 'DRAFT_REQUIRES_REVIEW' } };
        }
        return {
            success: true,
            data: draft
                ? { status: 'DRAFT', text: draft, sourceMessageId: latest.id, requiresHumanApproval: true }
                : { status: 'HUMAN_REVIEW', reason: 'DRAFT_UNAVAILABLE' },
        };
    }

    @Post('report')
    @ApiOperation({ summary: 'Report an unsafe, offensive or misleading MaziuM AI response' })
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    async report(@Body() dto: AiReportDto, @Req() req: any) {
        const forwarded = String(req.headers?.['x-forwarded-for'] || '')
            .split(',')[0]
            .trim();
        const source = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
        await this.rateLimit.consumeAiReport(source);
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
    async generateDescription(@Body() dto: AiDescriptionDto, @CurrentUser() user: { id: string }) {
        const result = await this.aiService.generateDescription(dto, user.id);
        return { success: true, data: result };
    }
}
