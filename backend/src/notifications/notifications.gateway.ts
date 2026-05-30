import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({
    cors: {
        origin: [
            'http://localhost:3000',
            'https://carmazium.vercel.app',
            'https://carmazium.fly.dev',
        ],
        credentials: true,
    },
    namespace: '/notifications',
})
export class NotificationsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationsGateway.name);
    /** userId -> ordered list of socket ids (oldest first). Max MAX_SOCKETS_PER_USER per user. */
    private connectedUsers: Map<string, string[]> = new Map();
    private static readonly MAX_SOCKETS_PER_USER = 5;

    constructor(
        @Inject(forwardRef(() => NotificationsService))
        private readonly notificationsService: NotificationsService,
    ) { }

    afterInit(server: Server): void {
        this.logger.log('Notifications WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket): Promise<void> {
        try {
            const req = client.request as any;
            const userId = req?.session?.userId;

            if (!userId) {
                client.disconnect();
                return;
            }

            client.data.userId = userId;

            // Enforce per-user socket limit (disconnect oldest when over limit)
            let socketIds = this.connectedUsers.get(userId);
            if (!socketIds) {
                socketIds = [];
                this.connectedUsers.set(userId, socketIds);
            }
            while (socketIds.length >= NotificationsGateway.MAX_SOCKETS_PER_USER && socketIds.length > 0) {
                const oldestId = socketIds.shift();
                const oldestSocket = this.server.sockets.sockets.get(oldestId!);
                if (oldestSocket) {
                    oldestSocket.disconnect(true);
                }
            }
            socketIds.push(client.id);

            // Join a room specifically for this user's notifications
            client.join(`user:${userId}`);

            // Catch-up: emit recent unread notifications so reconnecting clients get them
            const recentUnread = await this.notificationsService.getRecentUnread(userId, 10);
            for (const notification of recentUnread) {
                client.emit('notification:new', notification);
            }

            this.logger.log(`User ${userId} connected to notifications - Socket: ${client.id}`);
        } catch (error) {
            client.disconnect();
        }
    }

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
        }
    }

    /**
     * Send a real-time notification to a specific user.
     */
    sendNotification(userId: string, notification: any) {
        this.server.to(`user:${userId}`).emit('notification:new', notification);
    }

    /**
     * Check if a user has at least one active socket connection to /notifications.
     * Used by NotificationsService to skip FCM push when user is online (prevents duplicates).
     */
    isUserConnected(userId: string): boolean {
        const socketIds = this.connectedUsers.get(userId);
        return !!socketIds && socketIds.length > 0;
    }
}
