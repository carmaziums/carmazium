import { AuctionLifecycleService } from './auction-lifecycle.service';
import { AUCTION_DURATION_MS } from '../auctions/auction-pricing';

describe('AuctionLifecycleService integrity', () => {
    let prisma: any;
    let auctionsService: any;
    let auctionGateway: any;
    let notificationsGateway: any;
    let service: AuctionLifecycleService;

    beforeEach(() => {
        prisma = {
            auction: {
                findMany: jest.fn().mockResolvedValue([]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            bid: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn(async (fn: any) => fn(prisma)),
        };
        auctionsService = { closeAuction: jest.fn() };
        auctionGateway = {
            broadcastAuctionStart: jest.fn(),
            broadcastAuctionEnd: jest.fn(),
        };
        notificationsGateway = { sendNotification: jest.fn() };

        service = new AuctionLifecycleService(
            prisma,
            auctionsService,
            auctionGateway,
            notificationsGateway,
        );
    });

    it('cancels a scheduled auction whose parent listing is withdrawn and archives current bids', async () => {
        const now = new Date('2026-09-25T08:00:00.000Z');
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'SCHEDULED',
            listing: { status: 'WITHDRAWN', deletedAt: null },
        }]);

        await (service as any).reconcileInvalidOpenAuctions(now);

        expect(prisma.auction.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'auction-1',
                status: 'SCHEDULED',
                deletedAt: null,
            },
            data: {
                status: 'CANCELLED',
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            },
        });
        expect(prisma.bid.updateMany).toHaveBeenCalledWith({
            where: {
                listingId: 'listing-1',
                deletedAt: null,
                cancelledAt: null,
                archivedAt: null,
            },
            data: { archivedAt: now },
        });
        expect(auctionGateway.broadcastAuctionEnd).not.toHaveBeenCalled();
    });

    it('broadcasts an end event when an invalid ACTIVE auction is cancelled', async () => {
        const now = new Date('2026-09-25T08:00:00.000Z');
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-2',
            listingId: 'listing-2',
            status: 'ACTIVE',
            listing: { status: 'ACTIVE', deletedAt: now },
        }]);

        await (service as any).reconcileInvalidOpenAuctions(now);

        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith('auction-2', {
            auctionId: 'auction-2',
            winnerId: null,
            winningBidAmount: null,
            reserveMet: false,
        });
    });

    it('restores a full 24-hour window instead of activating an already-expired schedule', async () => {
        const now = new Date('2026-09-25T08:00:00.000Z');
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-3',
            startTime: new Date('2026-09-23T08:00:00.000Z'),
            endTime: new Date('2026-09-24T08:00:00.000Z'),
        }]);

        await (service as any).activateScheduledAuctions(now);

        expect(prisma.auction.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'auction-3',
                    status: 'SCHEDULED',
                    listing: { status: 'ACTIVE', deletedAt: null },
                }),
                data: {
                    status: 'ACTIVE',
                    startTime: now,
                    endTime: new Date(now.getTime() + AUCTION_DURATION_MS),
                },
            }),
        );
        expect(auctionGateway.broadcastAuctionStart).toHaveBeenCalledWith('auction-3');
    });

    it('does not emit a start event when the compare-and-set loses a lifecycle race', async () => {
        const now = new Date('2026-09-25T08:00:00.000Z');
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-4',
            startTime: new Date('2026-09-25T07:59:00.000Z'),
            endTime: new Date('2026-09-26T07:59:00.000Z'),
        }]);
        prisma.auction.updateMany.mockResolvedValue({ count: 0 });

        await (service as any).activateScheduledAuctions(now);

        expect(auctionGateway.broadcastAuctionStart).not.toHaveBeenCalled();
    });
});

describe('AuctionLifecycleService ending-soon persistence', () => {
    const now = new Date('2026-10-23T10:00:00.000Z');
    const runStart = new Date('2026-10-22T10:00:00.000Z');
    const auction = {
        id: 'auction-9',
        startTime: runStart,
        status: 'ACTIVE',
        endTime: new Date(now.getTime() + 2 * 60 * 1000),
        listing: { bids: [{ bidderId: 'dealer-a' }, { bidderId: 'dealer-b' }] },
    };

    function setup() {
        const prisma: any = {
            auction: { findMany: jest.fn().mockResolvedValue([auction]) },
            notification: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        const notificationsGateway: any = { sendNotification: jest.fn() };
        const notificationsService: any = { create: jest.fn().mockResolvedValue({ id: 'n' }) };
        const service = new AuctionLifecycleService(
            prisma, {} as any, {} as any, notificationsGateway, notificationsService,
        );
        return { prisma, notificationsGateway, notificationsService, service };
    }

    it('persists warning per bidder rather than just using an online socket', async () => {
        const { service, notificationsService, notificationsGateway } = setup();
        await (service as any).sendEndingSoonWarnings(now);
        expect(notificationsService.create).toHaveBeenCalledTimes(2);
        expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'dealer-a',
            type: 'AUCTION_ENDING',
            entityId: 'auction-9',
            actionType: `AUCTION_ENDING_SOON_auction-9_${runStart.getTime()}`,
        }));
        expect(notificationsGateway.sendNotification).not.toHaveBeenCalled();
    });

    it('does not re-send a stored warning after restart', async () => {
        const { service, notificationsService, prisma } = setup();
        prisma.notification.findFirst.mockResolvedValue({ id: 'already' });
        await (service as any).sendEndingSoonWarnings(now);
        expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('preserves the socket-only fallback in older module wiring', async () => {
        const { prisma, notificationsGateway } = setup();
        const service = new AuctionLifecycleService(
            prisma, {} as any, {} as any, notificationsGateway,
        );
        await (service as any).sendEndingSoonWarnings(now);
        expect(notificationsGateway.sendNotification).toHaveBeenCalledTimes(2);
    });
});
