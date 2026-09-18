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
import { WS_CORS } from '../core/allowed-origins';
import { ChatRateLimitService } from './chat-rate-limit.service';

/**
 * WebSocket Gateway for real-time chat functionality.
 * Handles socket connections, message delivery, and typing indicators.
 *
 * Authentication: Clients must establish an HTTP session first (via /auth/login),
 * then connect to this gateway. The session cookie is sent with the WebSocket
 * handshake and the userId is extracted from client.request.session.
 */
@WebSocketGateway({
    cors: WS_CORS,
    namespace: '/chat',
})
export class ChatGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    /** Local cache retained only for diagnostic helpers; authoritative realtime
     * membership/presence is represented by Socket.IO user rooms so the Redis
     * adapter can coordinate it across backend instances. */
    private connectedUsers: Map<string, string[]> = new Map();
    private static readonly MAX_SOCKETS_PER_USER = 5;

    private userRoom(userId: string): string {
        return `user:${userId}`;
    }

    private async userSockets(userId: string): Promise<any[]> {
        return this.server?.in(this.userRoom(userId)).fetchSockets() ?? [];
    }

    constructor(
        private readonly chatService: ChatService,
        private readonly authService: AuthService,
        private readonly chatRateLimit: ChatRateLimitService,
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

            // Store user data on socket for later use. A per-user Socket.IO
            // room is the cross-instance presence primitive used by the Redis
            // adapter.
            client.data.userId = userId;
            client.data.connectedAt = Date.now();

            const existingSockets = await this.userSockets(userId);
            const wasOffline = existingSockets.length === 0;

            // Enforce the socket limit across all backend instances, not just
            // the process that accepted this connection.
            const oldestFirst = [...existingSockets].sort(
                (a: any, b: any) =>
                    Number(a.data?.connectedAt || 0) - Number(b.data?.connectedAt || 0),
            );
            while (oldestFirst.length >= ChatGateway.MAX_SOCKETS_PER_USER) {
                const oldest = oldestFirst.shift();
                oldest?.emit('error', {
                    code: 'CONNECTION_LIMIT',
                    message: 'Too many connections; reconnecting.',
                });
                oldest?.disconnect(true);
            }

            await client.join(this.userRoom(userId));

            // Keep a small local cache for diagnostic helpers only.
            const socketIds = this.connectedUsers.get(userId) ?? [];
            socketIds.push(client.id);
            this.connectedUsers.set(userId, socketIds);

            // Auto-join user's existing chat rooms
            const roomIds = await this.chatService.getUserRoomIds(userId);
            for (const roomId of roomIds) {
                await client.join(`room:${roomId}`);
            }

            // First socket for this user this session — tell everyone who
            // shares a room with them that they're actually reachable now.
            if (wasOffline) {
                for (const roomId of roomIds) {
                    client.to(`room:${roomId}`).emit('presence:update', { userId, online: true });
                }
            }

            // The above only covers *future* presence changes — this client
            // also needs to know who's already online right now, otherwise
            // every conversation partner reads as offline until their next
            // connect/disconnect.
            const partnerIds = await this.chatService.getUserPresencePartnerIds(userId);
            const onlineChecks = await Promise.all(
                partnerIds.map(async (partnerId) => ({
                    partnerId,
                    online: (await this.userSockets(partnerId)).length > 0,
                })),
            );
            const onlineUserIds = onlineChecks
                .filter((entry) => entry.online)
                .map((entry) => entry.partnerId);
            client.emit('presence:snapshot', { onlineUserIds });

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
    async handleDisconnect(client: Socket): Promise<void> {
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

            // Socket.IO removes the disconnecting client from its rooms before
            // this lifecycle hook completes. Query the distributed user room so
            // another socket on another Fly instance keeps presence online.
            const wentOffline = (await this.userSockets(userId)).length === 0;

            // Last socket for this user gone — tell their conversation
            // partners so the "Online" indicator doesn't lie after they've
            // actually left.
            if (wentOffline) {
                const roomIds = await this.chatService.getUserRoomIds(userId);
                for (const roomId of roomIds) {
                    this.server.to(`room:${roomId}`).emit('presence:update', { userId, online: false });
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
    ): Promise<
        | { ok: true; message: any; duplicate: boolean }
        | { ok: false; error: { code: string; message: string } }
    > {
        const userId = client.data.userId;
        if (!userId) {
            return {
                ok: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Please log in before sending messages.',
                },
            };
        }

        try {
            await this.chatRateLimit.consumeMessage(userId);
            const { message, created } = await this.chatService.sendMessage(
                data.roomId,
                userId,
                {
                    content: data.content,
                    clientMessageId: data.clientMessageId,
                },
            );

            if (created) {
                this.broadcastMessage(data.roomId, message);
            }

            // Returning a value from a Socket.IO gateway handler is delivered
            // to the client's acknowledgement callback.
            return {
                ok: true,
                message,
                duplicate: !created,
            };
        } catch (error) {
            return {
                ok: false,
                error: {
                    code: error?.code || error?.name || 'SEND_FAILED',
                    message: error?.message || 'Message could not be sent.',
                },
            };
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

            // Notify the other room members that messages were read.
            this.broadcastReadReceipt(data.roomId, userId, count);
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle typing start indicator.
     */
    @SubscribeMessage('typing:start')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleTypingStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsTypingDto,
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            await this.chatRateLimit.consumeTyping(userId);
            await this.chatService.assertCanMessageRoom(data.roomId, userId);
            client.to(`room:${data.roomId}`).emit('user:typing', {
                roomId: data.roomId,
                userId,
                isTyping: true,
            });
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Handle typing stop indicator.
     */
    @SubscribeMessage('typing:stop')
    @UsePipes(new ValidationPipe({ transform: true }))
    async handleTypingStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: WsTypingDto,
    ): Promise<void> {
        const userId = client.data.userId;
        if (!userId) return;

        try {
            await this.chatRateLimit.consumeTyping(userId);
            await this.chatService.assertCanMessageRoom(data.roomId, userId);
            client.to(`room:${data.roomId}`).emit('user:typing', {
                roomId: data.roomId,
                userId,
                isTyping: false,
            });
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    /**
     * Broadcast a newly persisted message to every live socket in the room.
     * Used by both WebSocket sends and the REST fallback path.
     */
    broadcastMessage(roomId: string, message: any): void {
        this.server?.to(`room:${roomId}`).emit('message:new', message);
    }

    /**
     * Broadcast an authoritative read receipt. REST and Socket.IO read paths
     * both call this so sender-side ticks cannot depend on which transport the
     * recipient happened to use.
     */
    broadcastReadReceipt(roomId: string, readBy: string, count: number): void {
        this.server?.to(`room:${roomId}`).emit('messages:read', {
            roomId,
            readBy,
            count,
        });
    }

    /**
     * Makes every currently-connected socket for this user join a room's
     * channel. `handleConnection` only auto-joins the rooms that already
     * existed at connect time, so a room created afterwards via REST (any
     * findOrCreateRoom call — new listing chat, admin-initiated chat,
     * support chat) is invisible to an already-open socket until it
     * reconnects. Called right after room creation so real-time delivery
     * works immediately for both participants, not just after a refresh.
     */
    joinRoomForUser(userId: string, roomId: string): void {
        this.server
            ?.in(this.userRoom(userId))
            .socketsJoin(`room:${roomId}`);
    }

    leaveRoomForUser(userId: string, roomId: string): void {
        this.server
            ?.in(this.userRoom(userId))
            .socketsLeave(`room:${roomId}`);
    }

    emitRoomUpdatedToUser(userId: string, room: any): void {
        this.server
            ?.to(this.userRoom(userId))
            .emit('room:updated', room);
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
