import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

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
    cors: {
        origin: [
            'http://localhost:3000',
            'https://carmazium.vercel.app',
            'https://carmazium.fly.dev',
        ],
        credentials: true,
    },
    namespace: '/auctions',
})
export class AuctionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(AuctionGateway.name);

    afterInit(_server: Server): void {
        this.logger.log('Auction WebSocket Gateway initialized');
    }

    handleConnection(client: Socket): void {
        this.logger.log(`Auction client connected: ${client.id}`);
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
        const { auctionId } = payload;
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
