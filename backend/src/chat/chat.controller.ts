import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiCookieAuth,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateRoomDto, SendMessageDto } from './dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

/**
 * REST Controller for chat operations.
 * Provides HTTP endpoints for chat room and message management.
 */
@ApiTags('Chat')
@Controller('chat')
@UseGuards(SessionAuthGuard)
@ApiCookieAuth()
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
    ) { }

    /**
     * Get all chat rooms for the current user.
     */
    @Get('rooms')
    @ApiOperation({ summary: 'Get my chat rooms' })
    @ApiResponse({ status: 200, description: 'List of chat rooms with last message' })
    async getRooms(@CurrentUser() user: any) {
        const rooms = await this.chatService.getUserRooms(user.id);
        return new StandardResponse(rooms);
    }

    /**
     * Create or find a chat room with another user.
     */
    @Post('rooms')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create or find a chat room' })
    @ApiResponse({ status: 201, description: 'Chat room created or found' })
    async createRoom(
        @CurrentUser() user: any,
        @Body() createRoomDto: CreateRoomDto,
    ) {
        const room = await this.chatService.findOrCreateRoom(
            user.id,
            createRoomDto,
        );
        // Room may be brand new — make sure both participants' live sockets
        // (if any) are actually subscribed to it, not just the DB record.
        this.chatGateway.joinRoomForUser(user.id, room.id);
        this.chatGateway.joinRoomForUser(createRoomDto.participantId, room.id);
        return new StandardResponse(room);
    }

    /**
     * Get or create the current user's conversation with official CarMazium
     * support. Registered before `rooms/:id` so it isn't shadowed by that
     * param route.
     */
    @Post('support')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get or create my support conversation with CarMazium' })
    async getSupportRoom(@CurrentUser() user: any) {
        const room = await this.chatService.findOrCreateSupportRoom(user.id);
        this.chatGateway.joinRoomForUser(user.id, room.id);
        this.chatGateway.joinRoomForUser((room as any).otherUser.id, room.id);
        return new StandardResponse(room);
    }

    /**
     * Get a specific chat room.
     */
    @Get('rooms/:id')
    @ApiOperation({ summary: 'Get a chat room' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async getRoom(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
    ) {
        const room = await this.chatService.getRoom(roomId, user.id);
        return new StandardResponse(room);
    }

    /**
     * Get messages for a chat room.
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
        const pageNum = parseInt(page || '1');
        const limitNum = parseInt(limit || '50');

        const { data, total } = await this.chatService.getRoomMessages(
            roomId,
            user.id,
            pageNum,
            limitNum,
        );
        return new PaginatedResponse(data, total, pageNum, limitNum);
    }

    /**
     * Send a message to a room (HTTP fallback for WebSocket).
     */
    @Post('rooms/:id/messages')
    @ApiOperation({ summary: 'Send a message' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async sendMessage(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Body() sendMessageDto: SendMessageDto,
    ) {
        const message = await this.chatService.sendMessage(
            roomId,
            user.id,
            sendMessageDto,
        );
        return new StandardResponse(message);
    }

    /**
     * Mark messages as read.
     */
    @Patch('rooms/:id/read')
    @ApiOperation({ summary: 'Mark messages as read' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async markRead(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
    ) {
        const count = await this.chatService.markMessagesAsRead(roomId, user.id);
        return new StandardResponse({ markedCount: count });
    }

    /**
     * Get total unread message count.
     */
    @Get('unread')
    @ApiOperation({ summary: 'Get unread message count' })
    async getUnreadCount(@CurrentUser() user: any) {
        const count = await this.chatService.getUnreadCount(user.id);
        return new StandardResponse({ count });
    }
}
