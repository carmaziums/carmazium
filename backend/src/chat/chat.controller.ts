import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateRoomDto, SendMessageDto, MarkReadDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * REST Controller for chat operations
 * Provides HTTP endpoints for chat room and message management
 */
@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    /**
     * Get all chat rooms for the current user
     */
    @Get('rooms')
    @ApiOperation({ summary: 'Get my chat rooms' })
    @ApiResponse({ status: 200, description: 'List of chat rooms with last message' })
    async getRooms(@CurrentUser() user: any) {
        const rooms = await this.chatService.getUserRooms(user.id);
        return { success: true, data: rooms };
    }

    /**
     * Create or find a chat room with another user
     */
    @Post('rooms')
    @ApiOperation({ summary: 'Create or find a chat room' })
    @ApiResponse({ status: 201, description: 'Chat room created or found' })
    async createRoom(
        @CurrentUser() user: any,
        @Body() createRoomDto: CreateRoomDto,
    ) {
        const room = await this.chatService.findOrCreateRoom(user.id, createRoomDto);
        return { success: true, data: room };
    }

    /**
     * Get a specific chat room
     */
    @Get('rooms/:id')
    @ApiOperation({ summary: 'Get a chat room' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async getRoom(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
    ) {
        const room = await this.chatService.getRoom(roomId, user.id);
        return { success: true, data: room };
    }

    /**
     * Get messages for a chat room
     */
    @Get('rooms/:id/messages')
    @ApiOperation({ summary: 'Get messages for a room' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getMessages(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const { data, total } = await this.chatService.getRoomMessages(
            roomId,
            user.id,
            parseInt(page || '1'),
            parseInt(limit || '50'),
        );

        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '50');

        return {
            success: true,
            data,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        };
    }

    /**
     * Send a message to a room (HTTP fallback for WebSocket)
     */
    @Post('rooms/:id/messages')
    @ApiOperation({ summary: 'Send a message' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async sendMessage(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Body() sendMessageDto: SendMessageDto,
    ) {
        const message = await this.chatService.sendMessage(roomId, user.id, sendMessageDto);
        return { success: true, data: message };
    }

    /**
     * Mark messages as read
     */
    @Patch('rooms/:id/read')
    @ApiOperation({ summary: 'Mark messages as read' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async markRead(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
    ) {
        const count = await this.chatService.markMessagesAsRead(roomId, user.id);
        return { success: true, data: { markedCount: count } };
    }

    /**
     * Get total unread message count
     */
    @Get('unread')
    @ApiOperation({ summary: 'Get unread message count' })
    async getUnreadCount(@CurrentUser() user: any) {
        const count = await this.chatService.getUnreadCount(user.id);
        return { success: true, data: { count } };
    }
}
