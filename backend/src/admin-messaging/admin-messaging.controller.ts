import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse } from '../listings/dto/response.dto';
import { AdminMessagingService } from './admin-messaging.service';
import { AdminAudienceDto, AdminSendMessageDto } from './dto/admin-message.dto';

@ApiTags('Admin Messaging')
@Controller('admin/messaging')
@ApiCookieAuth()
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMessagingController {
    constructor(private readonly messaging: AdminMessagingService) {}

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
