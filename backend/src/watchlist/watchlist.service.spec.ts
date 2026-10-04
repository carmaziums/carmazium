import { GUARDS_METADATA } from '@nestjs/common/constants';
import { VerifiedDealerGuard } from '../auth/guards/verified-dealer.guard';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

describe('Dealer auction shortlist', () => {
    const prisma = {
        watchlistItem: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    };
    let service: WatchlistService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.watchlistItem.findMany.mockResolvedValue([]);
        prisma.watchlistItem.count.mockResolvedValue(0);
        service = new WatchlistService(prisma as any);
    });

    it('requires verified trade access rather than a basic logged-in account', () => {
        const guards = Reflect.getMetadata(
            GUARDS_METADATA, WatchlistController.prototype.findAuctionShortlist,
        ) as Array<new (...args: any[]) => unknown>;
        expect(guards).toContain(VerifiedDealerGuard);
    });

    it('queries only this user\'s currently-live, approved, non-deleted auction listings', async () => {
        const before = Date.now();
        await service.findAuctionShortlist('dealer-one', 1, 12, true);
        const after = Date.now();
        const query = prisma.watchlistItem.findMany.mock.calls[0][0];
        expect(query.where.userId).toBe('dealer-one');
        expect(query.where.listing.deletedAt).toBeNull();
        expect(query.where.listing.status).toBe('ACTIVE');
        expect(query.where.listing.auction.is.status).toBe('ACTIVE');
        expect(query.where.listing.auction.is.deletedAt).toBeNull();
        expect(query.where.listing.auction.is.endTime.gt.getTime()).toBeGreaterThanOrEqual(before);
        expect(query.where.listing.auction.is.endTime.gt.getTime()).toBeLessThanOrEqual(after);
        expect(query.select.listing.select.auction.select).not.toHaveProperty('reservePrice');
        expect(query.select.listing.select).not.toHaveProperty('seller');
        expect(query.select.listing.select.bids.where).toEqual({
            deletedAt: null, cancelledAt: null, archivedAt: null,
        });
        expect(prisma.watchlistItem.count).toHaveBeenCalledWith({ where: query.where });
    });

    it('allows the All Saved view to retain expired/cancelled auctions without exposing personal data', async () => {
        prisma.watchlistItem.findMany.mockResolvedValueOnce([{ id: 'saved-one' }]);
        prisma.watchlistItem.count.mockResolvedValueOnce(1);
        const result = await service.findAuctionShortlist('dealer-two', 2, 10, false);
        expect(result).toEqual({ data: [{ id: 'saved-one' }], total: 1, page: 2, limit: 10 });
        const query = prisma.watchlistItem.findMany.mock.calls[0][0];
        expect(query.where.userId).toBe('dealer-two');
        expect(query.where.listing).not.toHaveProperty('status');
        expect(query.where.listing.auction.is).not.toHaveProperty('status');
        expect(query.where.listing.auction.is.deletedAt).toBeNull();
        expect(query.skip).toBe(10);
        expect(query.take).toBe(10);
        expect(query.select.listing.select.auction.select).not.toHaveProperty('winnerId');
    });

    it('clamps invalid pagination and does not load more than 50 shortlist rows', async () => {
        await service.findAuctionShortlist('dealer', -20, 500, false);
        expect(prisma.watchlistItem.findMany.mock.calls[0][0]).toEqual(
            expect.objectContaining({ skip: 0, take: 50 }),
        );
        await service.findAuctionShortlist('dealer', Number.NaN, Number.NaN, true);
        expect(prisma.watchlistItem.findMany.mock.calls[1][0]).toEqual(
            expect.objectContaining({ skip: 0, take: 12 }),
        );
    });
});
