import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    UseGuards,
    NotFoundException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginatedResponse, StandardResponse } from '../listings/dto/response.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    @ApiOperation({ summary: 'Get my notifications' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async findAll(
        @CurrentUser() user: any,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ): Promise<PaginatedResponse<any>> {
        // Bounded paging: the full history is browsable page by page, but a
        // single request can never ask for an unbounded or invalid slice.
        const safePage = Math.min(10_000, Math.max(1, Math.floor(Number(page)) || 1));
        const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 20));
        const { data, total } = await this.notificationsService.findAll(user.id, safePage, safeLimit);
        return new PaginatedResponse(data, total, safePage, safeLimit);
    }

    @Get('unread-count')
    @ApiOperation({ summary: 'Get unread notification count' })
    async getUnreadCount(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const count = await this.notificationsService.getUnreadCount(user.id);
        return new StandardResponse({ count });
    }

    @Patch('read-all')
    @ApiOperation({ summary: 'Mark all notifications as read' })
    async markAllAsRead(@CurrentUser() user: any): Promise<StandardResponse<any>> {
        const result = await this.notificationsService.markAllAsRead(user.id);
        return new StandardResponse({ count: result.count });
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark notification as read' })
    @ApiParam({ name: 'id', description: 'Notification UUID' })
    async markAsRead(
        @CurrentUser() user: any,
        @Param('id') id: string,
    ): Promise<StandardResponse<any>> {
        const notification = await this.notificationsService.markAsRead(id, user.id);
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        return new StandardResponse(notification);
    }
}
