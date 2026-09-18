import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BidsService } from './bids.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionsService } from '../auctions/auctions.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('BidsService — incremental bidding', () => {
    let service: BidsService;
    let prisma: any;

    const auctionListing = {
        id: 'listing-1',
        type: 'AUCTION',
        deletedAt: null,
        price: 10000,
        sellerId: 'seller-1',
        auction: {
            id: 'auction-1',
            status: 'ACTIVE',
            startingBid: 5000,
            minIncrement: 100,
        },
    };

    beforeEach(async () => {
        prisma = {
            listing: { findUnique: jest.fn() },
            bid: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Test', lastName: 'User' }) },
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: AuctionsService,
                    useValue: { maybeExtend: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: AuctionGateway,
                    useValue: { broadcastBid: jest.fn(), broadcastBidCancelled: jest.fn() },
                },
                {
                    provide: NotificationsService,
                    useValue: { create: jest.fn().mockResolvedValue(null) },
                },
            ],
        }).compile();

        service = module.get<BidsService>(BidsService);
    });

    it('rejects a bid equal to the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });

        await expect(
            service.create('bidder-B', { listingId: 'listing-1', amount: 6000 } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a bid below the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });

        await expect(
            service.create('bidder-B', { listingId: 'listing-1', amount: 5500 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/bid must be at least/i) });
    });

    it('accepts a bid strictly higher than the current highest bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 6000 });
        prisma.bid.create.mockResolvedValue({
            id: 'bid-B',
            amount: 6100,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-B',
        });

        const result = await service.create('bidder-B', {
            listingId: 'listing-1',
            amount: 6100,
        } as any);

        expect(result.id).toBe('bid-B');
    });

    it('rejects the first bid if it is below the auction starting bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
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

describe('BidsService — cancelBid', () => {
    let service: BidsService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            listing: { findUnique: jest.fn() },
            bid: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Test', lastName: 'User' }) },
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: AuctionsService,
                    useValue: { maybeExtend: jest.fn().mockResolvedValue(null) },
                },
                {
                    provide: AuctionGateway,
                    useValue: { broadcastBid: jest.fn(), broadcastBidCancelled: jest.fn() },
                },
                {
                    provide: NotificationsService,
                    useValue: { create: jest.fn().mockResolvedValue(null) },
                },
            ],
        }).compile();

        service = module.get<BidsService>(BidsService);
    });

    it('throws ForbiddenException when caller is not the bid owner', async () => {
        const mockBid = {
            id: 'bid-1',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            createdAt: new Date(),
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);

        await expect(
            (service as any).cancelBid('bid-1', 'different-user'),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the 24-hour cancel window has expired', async () => {
        const mockBid = {
            id: 'bid-1',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('succeeds even when the caller is no longer the current high bidder', async () => {
        const mockBid = {
            id: 'bid-1',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            createdAt: new Date(), // within window
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);

        // Listing with ACTIVE auction
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            auction: { id: 'auction-1', status: 'ACTIVE' },
        });
        prisma.bid.update.mockResolvedValue({ ...mockBid, cancelledAt: new Date() });

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).resolves.toBeUndefined();

        expect(prisma.bid.update).toHaveBeenCalledWith({
            where: { id: 'bid-1' },
            data: { cancelledAt: expect.any(Date) },
        });
    });

    it('throws BadRequestException when auction status is not ACTIVE', async () => {
        const mockBid = {
            id: 'bid-1',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            createdAt: new Date(), // within window
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);

        // Listing with ENDED auction
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            auction: { id: 'auction-1', status: 'ENDED' },
        });

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});


describe('BidsService — current auction positions', () => {
    let service: BidsService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            listing: { findUnique: jest.fn() },
            bid: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                count: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            user: { findUnique: jest.fn() },
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AuctionsService, useValue: { maybeExtend: jest.fn().mockResolvedValue(null) } },
                { provide: AuctionGateway, useValue: { broadcastBid: jest.fn(), broadcastBidCancelled: jest.fn() } },
                { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue(null) } },
            ],
        }).compile();

        service = module.get<BidsService>(BidsService);
    });

    it('returns one live position per auction using the user\'s highest bid', async () => {
        const endTime = new Date(Date.now() + 60 * 60 * 1000);
        const baseListing = {
            id: 'listing-1',
            title: '2019 Test Car',
            slug: '2019-test-car',
            images: [],
            make: 'Test',
            model: 'Car',
            year: 2019,
            mileage: 50000,
            sellerId: 'seller-1',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime,
                minIncrement: 100,
                startingBid: 5000,
            },
        };

        prisma.bid.findMany
            .mockResolvedValueOnce([
                { id: 'mine-2', listingId: 'listing-1', bidderId: 'dealer-1', amount: 6200, createdAt: new Date(), listing: baseListing },
                { id: 'mine-1', listingId: 'listing-1', bidderId: 'dealer-1', amount: 6000, createdAt: new Date(), listing: baseListing },
            ])
            .mockResolvedValueOnce([
                { id: 'other', listingId: 'listing-1', bidderId: 'dealer-2', amount: 6500, createdAt: new Date() },
                { id: 'mine-2', listingId: 'listing-1', bidderId: 'dealer-1', amount: 6200, createdAt: new Date() },
                { id: 'mine-1', listingId: 'listing-1', bidderId: 'dealer-1', amount: 6000, createdAt: new Date() },
            ]);

        const result = await service.findMyActiveAuctionPositions('dealer-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            listingId: 'listing-1',
            auctionId: 'auction-1',
            myHighestBid: 6200,
            currentHighestBid: 6500,
            isLeading: false,
            nextMinimumBid: 6600,
            bidCount: 3,
        });
    });

    it('marks the trader as leading when their highest bid is the live highest bid', async () => {
        const listing = {
            id: 'listing-2',
            title: 'Lead Car',
            slug: 'lead-car',
            images: [],
            make: 'Lead',
            model: 'Car',
            year: 2020,
            mileage: 40000,
            sellerId: 'seller-2',
            auction: {
                id: 'auction-2',
                status: 'ACTIVE',
                endTime: new Date(Date.now() + 3600000),
                minIncrement: 250,
                startingBid: 5000,
            },
        };
        const now = new Date();

        prisma.bid.findMany
            .mockResolvedValueOnce([
                { id: 'mine', listingId: 'listing-2', bidderId: 'dealer-1', amount: 7000, createdAt: now, listing },
            ])
            .mockResolvedValueOnce([
                { id: 'mine', listingId: 'listing-2', bidderId: 'dealer-1', amount: 7000, createdAt: now },
                { id: 'other', listingId: 'listing-2', bidderId: 'dealer-2', amount: 6500, createdAt: now },
            ]);

        const result = await service.findMyActiveAuctionPositions('dealer-1');

        expect(result[0].isLeading).toBe(true);
        expect(result[0].nextMinimumBid).toBe(7250);
        expect(result[0].canCancelCurrentBid).toBe(true);
    });
});
