import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminAudienceDto, AdminSendMessageDto } from './dto/admin-message.dto';
import {
    AssignSupportRoomDto,
    CreateSupportNoteDto,
    UpdateSupportClosedDto,
    UpdateSupportTagsDto,
} from './dto/admin-support.dto';

@ApiTags('Admin Messaging')
@Controller('admin/messaging')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMessagingController {
    constructor(private readonly messaging: AdminMessagingService) {}

    @Get('support/agents')
    @ApiOperation({ summary: 'List active admin support agents' })
    async supportAgents() {
        return new StandardResponse(await this.messaging.listSupportAgents());
    }

    @Patch('support/rooms/:id/assignment')
    @ApiOperation({ summary: 'Assign or unassign a support conversation' })
    async assignSupportRoom(
        @Param('id') roomId: string,
        @Body() dto: AssignSupportRoomDto,
    ) {
        return new StandardResponse(
            await this.messaging.assignSupportRoom(roomId, dto.adminId ?? null),
        );
    }

    @Patch('support/rooms/:id/tags')
    @ApiOperation({ summary: 'Update internal support tags' })
    async updateSupportTags(
        @Param('id') roomId: string,
        @Body() dto: UpdateSupportTagsDto,
    ) {
        return new StandardResponse(
            await this.messaging.updateSupportTags(roomId, dto.tags),
        );
    }

    @Patch('support/rooms/:id/closed')
    @ApiOperation({ summary: 'Close or reopen a support conversation' })
    async updateSupportClosed(
        @Param('id') roomId: string,
        @Body() dto: UpdateSupportClosedDto,
    ) {
        return new StandardResponse(
            await this.messaging.updateSupportClosed(roomId, dto.closed),
        );
    }

    @Get('support/rooms/:id/notes')
    @ApiOperation({ summary: 'List private admin notes for a support conversation' })
    async supportNotes(@Param('id') roomId: string) {
        return new StandardResponse(await this.messaging.listSupportNotes(roomId));
    }

    @Post('support/rooms/:id/notes')
    @ApiOperation({ summary: 'Add a private admin note to a support conversation' })
    async addSupportNote(
        @CurrentUser() admin: any,
        @Param('id') roomId: string,
        @Body() dto: CreateSupportNoteDto,
    ) {
        return new StandardResponse(
            await this.messaging.addSupportNote(roomId, admin.id, dto.body),
        );
    }

    @Delete('support/rooms/:id/notes/:noteId')
    @ApiOperation({ summary: 'Delete a private admin support note' })
    async deleteSupportNote(
        @Param('id') roomId: string,
        @Param('noteId') noteId: string,
    ) {
        return new StandardResponse(
            await this.messaging.deleteSupportNote(roomId, noteId),
        );
    }

    @Get('broadcasts')
    @ApiOperation({ summary: 'List admin broadcast campaign history' })
    async broadcasts(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return new StandardResponse(
            await this.messaging.listBroadcastCampaigns(
                Number(page || 1),
                Number(limit || 20),
            ),
        );
    }

    @Get('broadcasts/:id')
    @ApiOperation({ summary: 'Get one broadcast campaign and recipient delivery statuses' })
    async broadcast(@Param('id') campaignId: string) {
        return new StandardResponse(
            await this.messaging.getBroadcastCampaign(campaignId),
        );
    }

    @Post('broadcasts/:id/retry-failed')
    @ApiOperation({ summary: 'Retry only failed recipients from a broadcast campaign' })
    async retryBroadcast(
        @CurrentUser() admin: any,
        @Param('id') campaignId: string,
    ) {
        return new StandardResponse(
            await this.messaging.retryFailedBroadcast(campaignId, admin.id),
        );
    }

    @Post('preview')
    @ApiOperation({ summary: 'Preview the recipient count for an admin message audience' })
    async preview(@Body() dto: AdminAudienceDto) {
        return new StandardResponse(await this.messaging.previewAudience(dto));
    }

    @Post('send')
    @ApiOperation({ summary: 'Send a text, picture or video message to an admin-selected audience' })
    async send(@CurrentUser() admin: any, @Body() dto: AdminSendMessageDto) {
        return new StandardResponse(await this.messaging.send(admin.id, dto));
    }
}
