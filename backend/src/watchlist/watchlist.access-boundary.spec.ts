import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { VerifiedDealerGuard } from '../auth/guards/verified-dealer.guard';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';

describe('Retail Saved Cars vs verified dealer auction shortlist boundary', () => {
    let prisma: any;
    let service: WatchlistService;
    const liveAuction = () => ({
        id: 'auction-id', type: 'AUCTION', status: 'ACTIVE', deletedAt: null,
        auction: { status: 'ACTIVE', deletedAt: null,
            endTime: new Date(Date.now() + 86400000) },
    });
    beforeEach(() => {
        prisma = {
            listing: { findUnique: jest.fn() },
            watchlistItem: {
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue(null),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockResolvedValue({
                    id: 'saved-id', listingId: 'auction-id',
                    createdAt: new Date('2026-10-04T10:00:00Z'),
                }),
                delete: jest.fn().mockResolvedValue({}),
            },
        };
        service = new WatchlistService(prisma as any);
    });

    it('requires both auth and verified trade KYC on all separate auction operations', () => {
        for (const method of [
            WatchlistController.prototype.findAuctionShortlist,
            WatchlistController.prototype.addAuction,
            WatchlistController.prototype.removeAuction,
            WatchlistController.prototype.checkAuction,
        ]) {
            const guards = Reflect.getMetadata(GUARDS_METADATA, method);
            expect(guards).toContain(SessionAuthGuard);
            expect(guards).toContain(VerifiedDealerGuard);
        }
        for (const method of [
            WatchlistController.prototype.findAll,
            WatchlistController.prototype.add,
            WatchlistController.prototype.check,
            WatchlistController.prototype.getCount,
        ]) {
            const guards = Reflect.getMetadata(GUARDS_METADATA, method);
            expect(guards).toContain(SessionAuthGuard);
            expect(guards).not.toContain(VerifiedDealerGuard);
        }
    });

    it('does not confirm a trade listing exists through the retail POST', async () => {
        prisma.listing.findUnique.mockResolvedValue(liveAuction());
        await expect(service.add('buyer', 'auction-id'))
            .rejects.toThrow(NotFoundException);
        expect(prisma.watchlistItem.create).not.toHaveBeenCalled();
    });

    it('retail POST returns only safe item metadata, never entire listing/private prices', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'retail-car', type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null,
        });
        const saved = await service.add('buyer', 'retail-car');
        expect(saved).toHaveProperty('listingId');
        expect(prisma.watchlistItem.create).toHaveBeenCalledWith({
            data: { userId: 'buyer', listingId: 'retail-car' },
            select: { id: true, listingId: true, createdAt: true },
        });
        expect(saved).not.toHaveProperty('listing');
    });

    it('dealer auction save accepts only active, existing, non-deleted auctions', async () => {
        prisma.listing.findUnique.mockResolvedValue(liveAuction());
        await service.addAuction('verified-dealer', 'auction-id');
        expect(prisma.watchlistItem.create).toHaveBeenCalledTimes(1);
        for (const change of [
            { type: 'CLASSIFIED' },
            { status: 'DRAFT' },
            { auction: null },
            { auction: { status: 'CANCELLED', deletedAt: null, endTime: new Date(Date.now() + 86400000) } },
            { auction: { status: 'ACTIVE', deletedAt: null, endTime: new Date(Date.now() - 1) } },
        ]) {
            prisma.watchlistItem.create.mockClear();
            prisma.listing.findUnique.mockResolvedValue({ ...liveAuction(), ...change });
            await expect(service.addAuction('dealer', 'auction-id')).rejects.toThrow(NotFoundException);
            expect(prisma.watchlistItem.create).not.toHaveBeenCalled();
        }
    });

    it('does not allow a duplicate trade save through the verified route', async () => {
        prisma.listing.findUnique.mockResolvedValue(liveAuction());
        prisma.watchlistItem.findUnique.mockResolvedValue({ id: 'already-saved' });
        await expect(service.addAuction('dealer', 'auction-id'))
            .rejects.toThrow(ConflictException);
    });

    it('separates retail rows and counts, retaining legacy trade saves for verified shortlist', async () => {
        await service.findAll('user-one', 3, 12);
        const retailWhere = {
            userId: 'user-one',
            listing: { type: 'CLASSIFIED', deletedAt: null },
        };
        expect(prisma.watchlistItem.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: retailWhere, skip: 24, take: 12 }),
        );
        expect(prisma.watchlistItem.count).toHaveBeenCalledWith({ where: retailWhere });
        await service.getCount('user-one');
        expect(prisma.watchlistItem.count).toHaveBeenLastCalledWith({ where: retailWhere });
        await service.findAuctionShortlist('user-one', 1, 12, false);
        expect(prisma.watchlistItem.findMany).toHaveBeenLastCalledWith(
            expect.objectContaining({ where: expect.objectContaining({
                userId: 'user-one',
                listing: expect.objectContaining({ type: 'AUCTION', deletedAt: null }),
            }) }),
        );
    });

    it('retail check cannot detect an old saved auction record, dealer check can', async () => {
        await service.isInWatchlist('buyer', 'auction-id');
        expect(prisma.watchlistItem.findFirst).toHaveBeenCalledWith({
            where: {
                userId: 'buyer', listingId: 'auction-id',
                listing: { type: 'CLASSIFIED', deletedAt: null },
            },
            select: { id: true },
        });
        await service.isInAuctionShortlist('dealer', 'auction-id');
        expect(prisma.watchlistItem.findFirst).toHaveBeenLastCalledWith({
            where: {
                userId: 'dealer', listingId: 'auction-id',
                listing: { type: 'AUCTION', deletedAt: null },
            },
            select: { id: true },
        });
    });

    it('dealer remove only deletes matching user-owned trade row', async () => {
        await expect(service.removeAuction('dealer', 'auction-id'))
            .rejects.toThrow(NotFoundException);
        expect(prisma.watchlistItem.delete).not.toHaveBeenCalled();
        prisma.watchlistItem.findFirst.mockResolvedValue({ id: 'owned-row' });
        await service.removeAuction('dealer', 'auction-id');
        expect(prisma.watchlistItem.delete).toHaveBeenCalledWith({
            where: { id: 'owned-row' },
        });
    });
});
