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
    BadRequestException,
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
import { BlockChatRoomDto, CreateChatAttachmentUploadDto, CreateRoomDto, OpenDisputeDto, ReportChatMessageDto, SendChatAttachmentDto, SendMessageDto } from './dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';
import { ChatRateLimitService } from './chat-rate-limit.service';
import { ChatAttachmentService } from './chat-attachment.service';

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
        private readonly chatRateLimit: ChatRateLimitService,
        private readonly chatAttachmentService: ChatAttachmentService,
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

    @Get('rooms-page')
    @ApiOperation({ summary: 'Get my chat rooms with stable cursor pagination' })
    @ApiQuery({ name: 'limit', required: false, description: 'Page size, max 100' })
    @ApiQuery({ name: 'before', required: false, description: 'Updated-at cursor timestamp' })
    @ApiQuery({ name: 'beforeId', required: false, description: 'Room ID paired with before cursor' })
    async getRoomsPage(
        @CurrentUser() user: any,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
        @Query('beforeId') beforeId?: string,
    ) {
        const safeLimit = Math.min(Math.max(Number(limit || 50) || 50, 1), 100);
        if ((before && !beforeId) || (!before && beforeId)) {
            throw new BadRequestException('Both before and beforeId are required for room pagination.');
        }

        let beforeDate: Date | undefined;
        if (before) {
            beforeDate = new Date(before);
            if (Number.isNaN(beforeDate.getTime())) {
                throw new BadRequestException('Invalid room pagination cursor.');
            }
        }

        const rows = await this.chatService.getUserRooms(user.id, {
            limit: safeLimit + 1,
            before: beforeDate,
            beforeId,
        });
        const hasMore = rows.length > safeLimit;
        const rooms = rows.slice(0, safeLimit);
        const oldest = rooms[rooms.length - 1];

        return new StandardResponse({
            rooms,
            pagination: {
                limit: safeLimit,
                hasMore,
                nextCursor: hasMore && oldest
                    ? { updatedAt: oldest.updatedAt, id: oldest.id }
                    : null,
            },
        });
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
        this.chatRateLimit.consumeRoomCreate(user.id);
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
        this.chatRateLimit.consumeRoomCreate(user.id);
        const room = await this.chatService.findOrCreateSupportRoom(user.id);
        this.chatGateway.joinRoomForUser(user.id, room.id);
        this.chatGateway.joinRoomForUser((room as any).otherUser.id, room.id);
        return new StandardResponse(room);
    }

    @Post('rooms/:id/dispute')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Open or return the dispute for a vehicle conversation' })
    @ApiParam({ name: 'id', description: 'Source retail/auction chat room ID' })
    async openDispute(
        @CurrentUser() user: any,
        @Param('id') sourceRoomId: string,
        @Body() dto: OpenDisputeDto,
    ) {
        this.chatRateLimit.consumeRoomCreate(user.id);
        const result = await this.chatService.openDispute(
            sourceRoomId,
            user.id,
            dto,
        );

        this.chatGateway.joinRoomForUser(result.room.initiatorId, result.room.id);
        this.chatGateway.joinRoomForUser(result.room.participantId, result.room.id);
        if (result.created && result.eventMessage) {
            this.chatGateway.broadcastMessage(result.room.id, result.eventMessage);
        }

        return new StandardResponse(result);
    }

    @Post('rooms/:id/block')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Block messaging in a private vehicle conversation' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async blockRoom(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Body() dto: BlockChatRoomDto,
    ) {
        this.chatRateLimit.consumeBlockChange(user.id);
        const room: any = await this.chatService.blockRoom(roomId, user.id, dto);
        const otherUserId = room.initiatorId === user.id
            ? room.participantId
            : room.initiatorId;
        const otherRoom = await this.chatService.getRoom(roomId, otherUserId);

        // A block pauses all private realtime activity, not only message sends.
        // Existing history remains available through the authenticated REST API.
        this.chatGateway.leaveRoomForUser(user.id, roomId);
        this.chatGateway.leaveRoomForUser(otherUserId, roomId);
        this.chatGateway.emitRoomUpdatedToUser(user.id, room);
        this.chatGateway.emitRoomUpdatedToUser(otherUserId, otherRoom);

        return new StandardResponse(room);
    }

    @Post('rooms/:id/unblock')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove my block from a private vehicle conversation' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async unblockRoom(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
    ) {
        this.chatRateLimit.consumeBlockChange(user.id);
        const room: any = await this.chatService.unblockRoom(roomId, user.id);
        const otherUserId = room.initiatorId === user.id
            ? room.participantId
            : room.initiatorId;
        const otherRoom = await this.chatService.getRoom(roomId, otherUserId);

        if (!room.chatBlocked) {
            this.chatGateway.joinRoomForUser(user.id, roomId);
            this.chatGateway.joinRoomForUser(otherUserId, roomId);
        }
        this.chatGateway.emitRoomUpdatedToUser(user.id, room);
        this.chatGateway.emitRoomUpdatedToUser(otherUserId, otherRoom);

        return new StandardResponse(room);
    }

    @Post('messages/:id/report')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Report one member-to-member chat message to CarMazium' })
    @ApiParam({ name: 'id', description: 'Message ID' })
    async reportMessage(
        @CurrentUser() user: any,
        @Param('id') messageId: string,
        @Body() dto: ReportChatMessageDto,
    ) {
        this.chatRateLimit.consumeReport(user.id);
        const report = await this.chatService.reportMessage(
            messageId,
            user.id,
            dto,
        );
        return new StandardResponse(report);
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
    @ApiQuery({
        name: 'before',
        required: false,
        type: String,
        description: 'ISO timestamp of the oldest loaded message',
    })
    @ApiQuery({
        name: 'beforeId',
        required: false,
        type: String,
        description: 'ID of the oldest loaded message',
    })
    async getMessages(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
        @Query('beforeId') beforeId?: string,
    ) {
        const pageNum = Math.max(parseInt(page || '1') || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit || '50') || 50, 1), 100);

        if ((before && !beforeId) || (!before && beforeId)) {
            throw new BadRequestException(
                'Both before and beforeId are required for cursor pagination.',
            );
        }

        let beforeDate: Date | undefined;
        if (before) {
            beforeDate = new Date(before);
            if (Number.isNaN(beforeDate.getTime())) {
                throw new BadRequestException('Invalid before timestamp.');
            }
        }

        const { data, total, hasMore, nextCursor } =
            await this.chatService.getRoomMessages(
                roomId,
                user.id,
                pageNum,
                limitNum,
                beforeDate,
                beforeId,
            );

        const response: any = new PaginatedResponse(
            data,
            total,
            pageNum,
            limitNum,
        );
        response.pagination.hasMore = hasMore;
        response.pagination.nextCursor = nextCursor;
        return response;
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
        this.chatRateLimit.consumeMessage(user.id);
        const { message, created } = await this.chatService.sendMessage(
            roomId,
            user.id,
            sendMessageDto,
        );

        // HTTP is the fallback transport when the socket is unavailable or
        // acknowledgement times out. New HTTP-saved messages still need the
        // same realtime broadcast as WebSocket-saved messages.
        if (created) {
            this.chatGateway.broadcastMessage(roomId, message);
        }

        return new StandardResponse(message);
    }

    /**
     * Create a short-lived signed upload ticket for a private chat photo.
     * The backend authorizes the room before issuing the path/token.
     */
    @Post('rooms/:id/attachments/upload-url')
    @ApiOperation({ summary: 'Create a private photo upload ticket' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async createAttachmentUpload(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Body() dto: CreateChatAttachmentUploadDto,
    ) {
        this.chatRateLimit.consumeAttachmentTicket(user.id);
        await this.chatService.assertCanMessageRoom(roomId, user.id);
        const ticket = await this.chatAttachmentService.createUploadTicket(
            roomId,
            user.id,
            dto.name,
            dto.mime,
            dto.size,
        );
        return new StandardResponse(ticket);
    }

    /**
     * Persist a photo message after the signed upload has completed.
     */
    @Post('rooms/:id/attachments')
    @ApiOperation({ summary: 'Send a private photo message' })
    @ApiParam({ name: 'id', description: 'Chat room ID' })
    async sendAttachment(
        @CurrentUser() user: any,
        @Param('id') roomId: string,
        @Body() dto: SendChatAttachmentDto,
    ) {
        this.chatRateLimit.consumeMessage(user.id);
        const { message, created } = await this.chatService.sendAttachmentMessage(
            roomId,
            user.id,
            dto,
        );

        if (created) {
            this.chatGateway.broadcastMessage(roomId, message);
        }

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
        this.chatGateway.broadcastReadReceipt(roomId, user.id, count);
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
