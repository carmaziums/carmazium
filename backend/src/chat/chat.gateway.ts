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
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';
import { WsMessageDto, WsTypingDto, WsRoomIdDto } from './dto';

/**
 * WebSocket Gateway for real-time chat functionality.
 * Handles socket connections, message delivery, and typing indicators.
 *
 * Authentication: Clients must establish an HTTP session first (via /auth/login),
 * then connect to this gateway. The session cookie is sent with the WebSocket
 * handshake and the userId is extracted from client.request.session.
 */
@WebSocketGateway({
    cors: {
        origin: [
            'http://localhost:3000',
            'https://carmazium.vercel.app',
            'https://carmazium.fly.dev',
            'https://carmazium-hjoh9w.fly.dev',
            ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
        ],
        credentials: true,
    },
    namespace: '/chat',
})
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    /** userId -> ordered list of socket ids (oldest first). Max MAX_SOCKETS_PER_USER per user. */
    private connectedUsers: Map<string, string[]> = new Map();
    private static readonly MAX_SOCKETS_PER_USER = 5;

    constructor(
        private readonly chatService: ChatService,
        private readonly authService: AuthService,
    ) { }

    afterInit(server: Server): void {
        this.logger.log('Chat WebSocket Gateway initialized');
    }

    /**
     * Handle new WebSocket connection.
     * Authenticates user via session cookie OR Bearer token (Supabase JWT).
     */
    async handleConnection(client: Socket): Promise<void> {
        try {
            // 1. Try session cookie first
            const req = client.request as any;
            let userId = req?.session?.userId;

            // 2. Fallback to Bearer token in handshake auth
            if (!userId) {
                const token = client.handshake.auth?.token || client.handshake.query?.token;
                if (token) {
                    const user = await this.authService.verifySupabaseToken(token);
                    if (user) {
                        userId = user.id;
                    }
                }
            }

            if (!userId) {
                this.logger.warn(
                    `Connection rejected: No session or valid token - ${client.id}`,
                );
                client.emit('error', {
                    code: 'AUTH_REQUIRED',
                    message: 'Please log in before connecting to chat',
                });
                client.disconnect();
                return;
            }

            // Store user data on socket for later use
            client.data.userId = userId;

            // Enforce per-user socket limit (disconnect oldest when over limit)
            let socketIds = this.connectedUsers.get(userId);
            if (!socketIds) {
                socketIds = [];
                this.connectedUsers.set(userId, socketIds);
            }
            while (socketIds.length >= ChatGateway.MAX_SOCKETS_PER_USER && socketIds.length > 0) {
                const oldestId = socketIds.shift();
                const oldestSocket = this.server?.sockets?.sockets?.get(oldestId!);
                if (oldestSocket) {
                    oldestSocket.emit('error', { code: 'CONNECTION_LIMIT', message: 'Too many connections; reconnecting.' });
                    oldestSocket.disconnect(true);
                }
            }
            socketIds.push(client.id);

            // Auto-join user's existing chat rooms
            const roomIds = await this.chatService.getUserRoomIds(userId);
            for (const roomId of roomIds) {
                await client.join(`room:${roomId}`);
            }

            this.logger.log(
                `User ${userId} connected with ${roomIds.length} rooms - Socket: ${client.id}`,
            );
        } catch (error) {
            this.logger.error(
                `Connection error: ${error.message}`,
                error.stack,
            );
            client.emit('error', {
                code: 'CONNECTION_ERROR',
                message: 'Authentication failed',
            });
            client.disconnect();
        }
    }

    /**
     * Handle WebSocket disconnection.
     */
    handleDisconnect(client: Socket): void {
        const userId = client.data.userId;
        if (userId) {
            const socketIds = this.connectedUsers.get(userId);
            if (socketIds) {
                const idx = socketIds.indexOf(client.id);
                if (idx !== -1) socketIds.splice(idx, 1);
                if (socketIds.length === 0) {
                    this.connectedUsers.delete(userId);
                }
            }
            this.logger.log(
                `User ${userId} disconnected - Socket: ${client.id}`,
            );
        }
    }

    /**
     * Handle sending a message.
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
            const message = await this.chatService.sendMessage(
                data.roomId,
                userId,
                { content: data.content },
            );

            // Broadcast to all members in the room
            this.server.to(`room:${data.roomId}`).emit('message:new', message);
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle joining a specific room.
     */
    @SubscribeMessage('room:join')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsRoomIdDto,
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            // Verify user is a member of the room
            await this.chatService.getRoom(data.roomId, userId);
            await client.join(`room:${data.roomId}`);
            client.emit('room:joined', { roomId: data.roomId });
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle marking messages as read.
     */
    @SubscribeMessage('message:read')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleMarkRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsRoomIdDto,
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            const count = await this.chatService.markMessagesAsRead(
                data.roomId,
                userId,
            );

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
     * Handle typing start indicator.
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
     * Handle typing stop indicator.
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
     * Check if a user is online.
     */
    isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId) && (this.connectedUsers.get(userId)?.length ?? 0) > 0;
    }

    /**
     * Get online user IDs.
     */
    getOnlineUsers(): string[] {
        return Array.from(this.connectedUsers.keys()).filter(
            (uid) => (this.connectedUsers.get(uid)?.length ?? 0) > 0,
        );
    }
}
