import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BidsService } from './bids.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Direct auction-bid validation. Mirrors the offer-side incremental rules but
 * for the auction `bids` table.
 */
describe('BidsService — incremental bidding', () => {
    let service: BidsService;
    let prisma: any;

    const auctionListing = {
        id: 'listing-1',
        type: 'AUCTION',
        deletedAt: null,
        price: 10000,
        auction: { startingBid: 5000, minIncrement: 100 },
    };

    beforeEach(async () => {
        prisma = {
            listing: { findUnique: jest.fn() },
            bid: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
                create: jest.fn(),
            },
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<BidsService>(BidsService);
    });

    it('rejects a bid equal to the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });

        await expect(
            service.create('bidder-B', { listingId: 'listing-1', amount: 6000 } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a bid below the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });

        await expect(
            service.create('bidder-B', { listingId: 'listing-1', amount: 5500 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/higher than current highest bid/i) });
    });

    it('accepts a bid strictly higher than the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });
        prisma.bid.create.mockResolvedValue({ id: 'bid-B', amount: 6100 });

        const result = await service.create('bidder-B', {
            listingId: 'listing-1',
            amount: 6100,
        } as any);

        expect(result.id).toBe('bid-B');
    });

    it('rejects the first bid if it is below the auction starting bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 4500 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/starting bid/i) });
    });

    it('rejects bids on non-auction listings', async () => {
        prisma.listing.findUnique.mockResolvedValue({ ...auctionListing, type: 'CLASSIFIED' });

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 6000 } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects bids on missing/deleted listings', async () => {
        prisma.listing.findUnique.mockResolvedValue(null);

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 6000 } as any),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});
