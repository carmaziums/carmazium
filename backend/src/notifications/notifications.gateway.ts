import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard'; // Not directly used here but logic similar to ChatGateway

@WebSocketGateway({
    cors: {
        origin: [
            'http://localhost:3000',
            'https://carmazium.vercel.app',
            'https://carmazium.onrender.com',
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
    private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

    afterInit(server: Server): void {
        this.logger.log('Notifications WebSocket Gateway initialized');
    }

    handleConnection(client: Socket): void {
        try {
            const req = client.request as any;
            const userId = req?.session?.userId;

            if (!userId) {
                // For notifications, we might just disconnect without error to avoid spamming logs if user isn't logged in
                client.disconnect();
                return;
            }

            client.data.userId = userId;

            // Track connected user
            if (!this.connectedUsers.has(userId)) {
                this.connectedUsers.set(userId, new Set());
            }
            this.connectedUsers.get(userId)?.add(client.id);

            // Join a room specifically for this user's notifications
            client.join(`user:${userId}`);

            this.logger.log(`User ${userId} connected to notifications - Socket: ${client.id}`);
        } catch (error) {
            client.disconnect();
        }
    }

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
        }
    }

    /**
     * Send a real-time notification to a specific user
     */
    sendNotification(userId: string, notification: any) {
        this.server.to(`user:${userId}`).emit('notification:new', notification);
    }
}
