import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertTradeAuctionAccess } from './trade-access';
import { Server, Socket } from 'socket.io';
import { WS_CORS } from '../core/allowed-origins';

export interface BidBroadcastPayload {
    bidId: string;
    auctionId: string;
    listingId: string;
    amount: number;
    bidderInitials: string;
    bidderId: string;
    timestamp: string;
    newEndTime?: string;
}

export interface AuctionEndPayload {
    auctionId: string;
    winnerId: string | null;
    winningBidAmount: number | null;
    reserveMet: boolean;
}

@WebSocketGateway({
    cors: WS_CORS,
    namespace: '/auctions',
})
export class AuctionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AuctionGateway.name);

    constructor(
        private readonly authService: AuthService,
        private readonly prisma: PrismaService,
    ) { }

    private async authenticateClient(client: Socket): Promise<string | null> {
        if (client.data.userId) return client.data.userId;

        const req = client.request as any;
        let userId = req?.session?.userId as string | undefined;

        if (!userId) {
            const rawToken = client.handshake.auth?.token || client.handshake.query?.token;
            const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
            if (typeof token === 'string' && token.trim()) {
                const user = await this.authService.verifySupabaseToken(token);
                userId = user?.id;
            }
        }

        if (userId) client.data.userId = userId;
        return userId ?? null;
    }

    afterInit(_server: Server): void {
        this.logger.log('Auction WebSocket Gateway initialized');
    }

    async handleConnection(client: Socket): Promise<void> {
        const userId = await this.authenticateClient(client);
        if (!userId) {
            this.logger.warn(`Auction connection rejected: unauthenticated socket ${client.id}`);
            client.emit('error', {
                code: 'AUTH_REQUIRED',
                message: 'Please sign in before connecting to the Trade Exchange.',
            });
            client.disconnect(true);
            return;
        }

        this.logger.log(`Auction client connected: ${client.id} (${userId})`);
    }

    handleDisconnect(client: Socket): void {
        this.logger.log(`Auction client disconnected: ${client.id}`);

        // Notify each auction room the viewer count decreased
        for (const [room] of client.rooms) {
            if (room.startsWith('auction:')) {
                const auctionId = room.slice('auction:'.length);
                // Slight delay so adapter count updates before we read it
                setTimeout(async () => {
                    const sockets = await this.server.in(room).fetchSockets();
                    this.server.to(room).emit('auction:viewers', { auctionId, count: sockets.length });
                }, 100);
            }
        }
    }

    @SubscribeMessage('auction:join')
    async handleJoin(client: Socket, payload: { auctionId: string }): Promise<void> {
        const auctionId = payload?.auctionId;
        if (!auctionId) {
            client.emit('error', { code: 'INVALID_AUCTION', message: 'auctionId is required.' });
            return;
        }

        const userId = await this.authenticateClient(client);
        if (!userId) {
            client.emit('error', {
                code: 'AUTH_REQUIRED',
                message: 'Please sign in before joining a Trade Exchange auction.',
            });
            return;
        }

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: {
                deletedAt: true,
                listing: { select: { sellerId: true } },
            },
        });

        if (!auction || auction.deletedAt) {
            client.emit('error', { code: 'AUCTION_NOT_FOUND', message: 'Auction not found.' });
            return;
        }

        try {
            await assertTradeAuctionAccess(this.prisma, userId, auction.listing?.sellerId);
        } catch (error: any) {
            client.emit('error', {
                code: 'TRADE_ACCESS_DENIED',
                message: error?.message || 'Trade Exchange access denied.',
            });
            return;
        }

        const room = `auction:${auctionId}`;
        await client.join(room);

        const sockets = await this.server.in(room).fetchSockets();
        this.server.to(room).emit('auction:viewers', { auctionId, count: sockets.length });

        this.logger.log(`Client ${client.id} joined auction room ${room} (${sockets.length} viewers)`);
    }

    // Called by AuctionLifecycleService when a SCHEDULED auction becomes ACTIVE
    broadcastAuctionStart(auctionId: string): void {
        this.server.to(`auction:${auctionId}`).emit('auction:started', { auctionId });
    }

    // Called by BidsService after a bid is saved and possibly extended
    broadcastBid(auctionId: string, payload: BidBroadcastPayload): void {
        this.server.to(`auction:${auctionId}`).emit('bid:new', payload);
    }

    // Called by AuctionsService.closeAuction() after auction ends
    broadcastAuctionEnd(auctionId: string, payload: AuctionEndPayload): void {
        this.server.to(`auction:${auctionId}`).emit('auction:ended', payload);
    }

    // Called by AuctionsService.triggerBuyItNow() — notifies all viewers a BIN request is pending
    broadcastBinPending(auctionId: string, buyerId: string): void {
        this.server.to(`auction:${auctionId}`).emit('bin:pending', { auctionId, buyerId });
    }

    // Called by BidsService.cancelBid() — removes a cancelled bid from all viewers' feed
    broadcastBidCancelled(auctionId: string, bidId: string): void {
        this.server.to(`auction:${auctionId}`).emit('bid:cancelled', { auctionId, bidId });
    }
}