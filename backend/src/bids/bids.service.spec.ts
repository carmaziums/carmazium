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

    it('throws BadRequestException when the 2-minute cancel window has expired', async () => {
        const mockBid = {
            id: 'bid-1',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when caller is no longer the current high bidder', async () => {
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

        // Top bid is a different bid (higher amount from another bidder)
        prisma.bid.findFirst.mockResolvedValue({
            id: 'bid-99',
            bidderId: 'other-user',
            amount: 8000,
        });

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).rejects.toBeInstanceOf(BadRequestException);
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
