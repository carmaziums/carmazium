import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { WsMessageDto, WsTypingDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket Gateway for real-time chat functionality
 * Handles socket connections, message delivery, and typing indicators
 */
@WebSocketGateway({
    cors: {
        origin: [
            'http://localhost:3000',
            'https://carmazium.vercel.app',
            'https://carmazium.onrender.com'
        ],
        credentials: true,
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

    constructor(
        private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    afterInit(server: Server): void {
        this.logger.log('Chat WebSocket Gateway initialized');
    }

    /**
     * Handle new WebSocket connection
     * Authenticates user via JWT and auto-joins their chat rooms
     */
    async handleConnection(client: Socket): Promise<void> {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

            if (!token) {
                this.logger.warn(`Connection rejected: No token provided - ${client.id}`);
                client.disconnect();
                return;
            }

            this.logger.debug(`WebSocket Token received (len: ${token.length}): ${token.substring(0, 10)}...`);

            // Verify JWT
            const payload = this.jwtService.verify(token, {
                algorithms: ['HS256'],
            });

            const userId = payload.sub;
            if (!userId) {
                client.disconnect();
                return;
            }

            // Store user data on socket
            client.data.userId = userId;

            // Track connected user
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId)?.add(client.id);

            // Auto-join user's chat rooms
            const roomIds = await this.chatService.getUserRoomIds(userId);
            for (const roomId of roomIds) {
                await client.join(`room:${roomId}`);
            }

            this.logger.log(`User ${userId} connected with ${roomIds.length} rooms - Socket: ${client.id}`);
        } catch (error) {
            this.logger.error(`Connection error: ${error.message}`);
            client.disconnect();
        }
    }

    /**
     * Handle WebSocket disconnection
     */
    handleDisconnect(client: Socket): void {
        const userId = client.data.userId;
        if (userId) {
            const userSockets = this.connectedUsers.get(userId);
            if (userSockets) {
                userSockets.delete(client.id);
                if (userSockets.size === 0) {
                    this.connectedUsers.delete(userId);
                }
            }
            this.logger.log(`User ${userId} disconnected - Socket: ${client.id}`);
        }
    }

    /**
     * Handle sending a message
     */
    @SubscribeMessage('message:send')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsMessageDto,
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            const message = await this.chatService.sendMessage(data.roomId, userId, {
                content: data.content,
            });

            // Broadcast to all members in the room
            this.server.to(`room:${data.roomId}`).emit('message:new', message);
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle joining a specific room
     */
    @SubscribeMessage('room:join')
    async handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomId: string },
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            // Verify user is member of room
            await this.chatService.getRoom(data.roomId, userId);
            await client.join(`room:${data.roomId}`);
            client.emit('room:joined', { roomId: data.roomId });
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle marking messages as read
     */
    @SubscribeMessage('message:read')
    async handleMarkRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomId: string },
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            const count = await this.chatService.markMessagesAsRead(data.roomId, userId);

            // Notify other user that messages were read
            this.server.to(`room:${data.roomId}`).emit('messages:read', {
                roomId: data.roomId,
                readBy: userId,
                count,
            });
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle typing start indicator
     */
    @SubscribeMessage('typing:start')
    @UsePipes(new ValidationPipe({ transform: true }))
    handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsTypingDto,
    ): void {
        const userId = client.data.userId;
        if (!userId) return;

        // Broadcast to room except sender
        client.to(`room:${data.roomId}`).emit('user:typing', {
            roomId: data.roomId,
            userId,
            isTyping: true,
        });
    }

    /**
     * Handle typing stop indicator
     */
    @SubscribeMessage('typing:stop')
    @UsePipes(new ValidationPipe({ transform: true }))
    handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsTypingDto,
    ): void {
        const userId = client.data.userId;
        if (!userId) return;

        client.to(`room:${data.roomId}`).emit('user:typing', {
            roomId: data.roomId,
            userId,
            isTyping: false,
        });
    }

    /**
     * Check if a user is online
     */
    isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    /**
     * Get online user IDs
     */
    getOnlineUsers(): string[] {
        return Array.from(this.connectedUsers.keys());
    }
}
