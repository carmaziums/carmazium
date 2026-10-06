import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';
import { VerifiedDealerGuard } from '../auth/guards/verified-dealer.guard';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

describe('Saved Cars / dealer shortlist access boundary', () => {
    const prisma = {
        listing: {
            findUnique: jest.fn(),
        },
        watchlistItem: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
        },
    };
    let service: WatchlistService;

    beforeEach(() => {
        jest.clearAllMocks();
        prisma.watchlistItem.findMany.mockResolvedValue([]);
        prisma.watchlistItem.count.mockResolvedValue(0);
        prisma.watchlistItem.findFirst.mockResolvedValue(null);
        prisma.watchlistItem.findUnique.mockResolvedValue(null);
        service = new WatchlistService(prisma as any);
    });

    const expectRetailWhere = (where: any, userId = 'buyer-one') => {
        expect(where.userId).toBe(userId);
        expect(where.listing.type).toBe('CLASSIFIED');
        expect(where.listing.deletedAt).toBeNull();
        expect(new Set(where.listing.status.in)).toEqual(
            new Set(['ACTIVE', 'SOLD', 'OFFER_ACCEPTED']),
        );
    };

    describe('generic Saved Cars stays retail-only', () => {
        it('filters both generic list and count to public classified rows', async () => {
            await service.findAll('buyer-one', 2, 12);
            const listQuery = prisma.watchlistItem.findMany.mock.calls[0][0];
            expectRetailWhere(listQuery.where);
            expect(listQuery.skip).toBe(12);
            expect(listQuery.take).toBe(12);
            expect(prisma.watchlistItem.count).toHaveBeenCalledWith({
                where: listQuery.where,
            });

            await service.getCount('buyer-one');
            expectRetailWhere(prisma.watchlistItem.count.mock.calls[1][0].where);
        });

        it('generic Saved Cars status check cannot reveal a saved auction row', async () => {
            prisma.watchlistItem.findFirst.mockResolvedValue(null);
            expect(await service.isInWatchlist('buyer-one', 'known-auction-id')).toBe(false);
            const where = prisma.watchlistItem.findFirst.mock.calls[0][0].where;
            expect(where.userId).toBe('buyer-one');
            expect(where.listingId).toBe('known-auction-id');
            expectRetailWhere({ userId: where.userId, listing: where.listing });
        });

        it('rejects a known auction ID through the generic retail POST path', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'auction-listing', type: 'AUCTION', status: 'ACTIVE', deletedAt: null,
            });
            await expect(service.add('buyer-one', 'auction-listing'))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.watchlistItem.create).not.toHaveBeenCalled();
        });

        it.each(['DRAFT', 'PENDING_REVIEW', 'WITHDRAWN', 'REJECTED'])(
            'does not save non-public classified status %s through generic Saved Cars',
            async (status) => {
                prisma.listing.findUnique.mockResolvedValue({
                    id: 'private-retail', type: 'CLASSIFIED', status, deletedAt: null,
                });
                await expect(service.add('buyer-one', 'private-retail'))
                    .rejects.toBeInstanceOf(NotFoundException);
                expect(prisma.watchlistItem.create).not.toHaveBeenCalled();
            },
        );

        it('continues saving a visible classified listing under the same account key', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'retail-one', type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null,
            });
            prisma.watchlistItem.findUnique.mockResolvedValue(null);
            prisma.watchlistItem.create.mockResolvedValue({
                id: 'saved-one', userId: 'buyer-one', listingId: 'retail-one',
            });
            await service.add('buyer-one', 'retail-one');
            expect(prisma.watchlistItem.create).toHaveBeenCalledWith({
                data: { userId: 'buyer-one', listingId: 'retail-one' },
                include: { listing: true },
            });
        });

        it('generic DELETE cannot mutate an existing auction shortlist row', async () => {
            prisma.watchlistItem.findUnique.mockResolvedValue({
                id: 'saved-auction',
                listing: { type: 'AUCTION', status: 'ACTIVE', deletedAt: null },
            });
            await expect(service.remove('dealer-one', 'auction-listing'))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.watchlistItem.delete).not.toHaveBeenCalled();
        });
    });

    describe('verified-dealer auction mutations', () => {
        it.each([
            ['findAuctionShortlist', WatchlistController.prototype.findAuctionShortlist],
            ['checkAuction', WatchlistController.prototype.checkAuction],
            ['addAuction', WatchlistController.prototype.addAuction],
            ['removeAuction', WatchlistController.prototype.removeAuction],
        ])('%s requires VerifiedDealerGuard', (_name, handler) => {
            const guards = Reflect.getMetadata(
                GUARDS_METADATA, handler,
            ) as Array<new (...args: any[]) => unknown>;
            expect(guards).toContain(VerifiedDealerGuard);
        });

        it('saves a real auction through only the dedicated mutation', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'auction-one',
                type: 'AUCTION',
                deletedAt: null,
                auction: { id: 'auction-record', deletedAt: null },
            });
            prisma.watchlistItem.findUnique.mockResolvedValue(null);
            prisma.watchlistItem.create.mockResolvedValue({ id: 'shortlist-one' });
            await service.addAuction('dealer-one', 'auction-one');
            expect(prisma.watchlistItem.create).toHaveBeenCalledWith({
                data: { userId: 'dealer-one', listingId: 'auction-one' },
                include: { listing: true },
            });
        });

        it('dealer auction status check is account-bound and auction-only', async () => {
            prisma.watchlistItem.findFirst.mockResolvedValue({ id: 'saved-auction' });
            expect(await service.isInAuctionShortlist('dealer-one', 'auction-one')).toBe(true);
            expect(prisma.watchlistItem.findFirst).toHaveBeenCalledWith({
                where: {
                    userId: 'dealer-one',
                    listingId: 'auction-one',
                    listing: {
                        type: 'AUCTION',
                        deletedAt: null,
                        auction: { is: { deletedAt: null } },
                    },
                },
                select: { id: true },
            });
        });

        it('dealer auction mutation rejects a classified listing', async () => {
            prisma.listing.findUnique.mockResolvedValue({
                id: 'retail-one',
                type: 'CLASSIFIED',
                deletedAt: null,
                auction: null,
            });
            await expect(service.addAuction('dealer-one', 'retail-one'))
                .rejects.toBeInstanceOf(NotFoundException);
            expect(prisma.watchlistItem.create).not.toHaveBeenCalled();
        });

        it('dedicated removal deletes only an auction shortlist row owned by that user', async () => {
            prisma.watchlistItem.findUnique.mockResolvedValue({
                id: 'saved-auction',
                listing: {
                    type: 'AUCTION',
                    deletedAt: null,
                    auction: { deletedAt: null },
                },
            });
            await service.removeAuction('dealer-one', 'auction-one');
            expect(prisma.watchlistItem.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId_listingId: {
                            userId: 'dealer-one', listingId: 'auction-one',
                        },
                    },
                }),
            );
            expect(prisma.watchlistItem.delete).toHaveBeenCalledWith({
                where: { id: 'saved-auction' },
            });
        });
    });

    describe('dealer auction shortlist reads', () => {
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

        it('All Saved retains expired/cancelled auction rows without exposing personal data', async () => {
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
});
