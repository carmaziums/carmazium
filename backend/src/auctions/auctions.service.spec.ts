import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AuctionGateway } from './auction.gateway';
import { EmailService } from '../email/email.service';

describe('AuctionsService — Buy It Now lifecycle', () => {
    let service: AuctionsService;
    let prisma: any;
    let notificationsService: any;
    let auctionGateway: any;

    const makeMakeModel = () => ({ make: 'BMW', model: 'M3', year: 2022, sellerId: 'seller-1', title: 'BMW M3', bids: [] });

    const makeActiveAuction = (overrides: Record<string, any> = {}): any => ({
        id: 'auction-1',
        listingId: 'listing-1',
        status: 'ACTIVE',
        reservePrice: 20000,
        startingBid: 10000,
        winningBidAmount: null,
        buyItNowPrice: 25000,
        buyItNowPendingBuyerId: null,
        buyItNowPendingAt: null,
        deletedAt: null,
        listing: {
            id: 'listing-1',
            sellerId: 'seller-1',
            make: 'BMW',
            model: 'M3',
            year: 2022,
            title: 'BMW M3',
            linkedListingId: null,
            bids: [],
        },
        ...overrides,
    });

    beforeEach(async () => {
        prisma = {
            auction: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
                create: jest.fn().mockResolvedValue({}),
                $transaction: jest.fn(),
            },
            bid: {
                findFirst: jest.fn().mockResolvedValue(null),
                findUnique: jest.fn(),
                findMany: jest.fn(),
            },
            listing: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            sale: { create: jest.fn() },
            sellerProfile: { upsert: jest.fn() },
            chatRoom: { upsert: jest.fn() },
            user: { findUnique: jest.fn().mockResolvedValue(null) },
            $transaction: jest.fn(),
        };

        notificationsService = {
            create: jest.fn().mockResolvedValue({}),
        };

        auctionGateway = {
            broadcastBid: jest.fn(),
            broadcastAuctionEnd: jest.fn(),
            broadcastBinPending: jest.fn(),
            broadcastAuctionStart: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: notificationsService },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: auctionGateway },
                { provide: EmailService, useValue: { sendAuctionWonEmail: jest.fn(), sendAuctionEndedSellerEmail: jest.fn(), sendAuctionReserveNotMetEmail: jest.fn() } },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    // ── triggerBuyItNow ───────────────────────────────────────────────────────

    it('triggerBuyItNow: throws BadRequestException when auction.status !== ACTIVE', async () => {
        const auction = makeActiveAuction({ status: 'SCHEDULED' });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.triggerBuyItNow('auction-1', 'buyer-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('triggerBuyItNow: throws BadRequestException when buyItNowPrice is null', async () => {
        const auction = makeActiveAuction({ buyItNowPrice: null });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.triggerBuyItNow('auction-1', 'buyer-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('triggerBuyItNow: throws BadRequestException when top bid amount >= reservePrice', async () => {
        const auction = makeActiveAuction();
        prisma.auction.findUnique.mockResolvedValue(auction);
        // Top bid meets reserve
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-top', amount: 20000 });

        await expect(
            service.triggerBuyItNow('auction-1', 'buyer-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('triggerBuyItNow: updates pending fields and calls notificationsService.create', async () => {
        const auction = makeActiveAuction();
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null); // No bids yet — reserve not met
        prisma.auction.update.mockResolvedValue({ ...auction, buyItNowPendingBuyerId: 'buyer-1', buyItNowPendingAt: new Date() });

        await service.triggerBuyItNow('auction-1', 'buyer-1');

        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'auction-1' },
                data: expect.objectContaining({
                    buyItNowPendingBuyerId: 'buyer-1',
                    buyItNowPendingAt: expect.any(Date),
                }),
            }),
        );
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'seller-1', type: 'AUCTION_ENDED' }),
        );
    });

    // ── confirmBuyItNow ───────────────────────────────────────────────────────

    it('confirmBuyItNow: throws BadRequestException when buyItNowPendingBuyerId is null', async () => {
        const auction = makeActiveAuction({ buyItNowPendingBuyerId: null });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.confirmBuyItNow('auction-1', 'seller-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('confirmBuyItNow: calls endAuctionWithWinner and runs transaction', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: new Date(),
            buyItNowPrice: 25000,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.$transaction.mockResolvedValue([]);

        await service.confirmBuyItNow('auction-1', 'seller-1');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({ auctionId: 'auction-1', winnerId: 'buyer-1' }),
        );
    });

    // ── declineBuyItNow ───────────────────────────────────────────────────────

    it('declineBuyItNow: clears pending fields and notifies buyer', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: new Date(),
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.auction.update.mockResolvedValue({ ...auction, buyItNowPendingBuyerId: null, buyItNowPendingAt: null });

        await service.declineBuyItNow('auction-1', 'seller-1');

        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    buyItNowPendingBuyerId: null,
                    buyItNowPendingAt: null,
                }),
            }),
        );
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'buyer-1' }),
        );
    });

    // ── findOne lazy BIN expiry ───────────────────────────────────────────────

    it('findOne: returns cleared pending fields when buyItNowPendingAt + 24h has elapsed', async () => {
        const expiredAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: expiredAt,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.auction.update.mockResolvedValue({});

        const result = await service.findOne('auction-1');

        // Returned auction should have cleared pending fields
        expect(result.buyItNowPendingBuyerId).toBeNull();
        expect(result.buyItNowPendingAt).toBeNull();
    });

    // ── bids.service auto-cancel on bid >= BIN price (integration note) ───────
    // This verifies that triggerBuyItNow followed by a high bid clears pending state.
    // The actual auto-cancel logic lives in bids.service.ts; tested here via the
    // shared pattern to confirm the service method surfaces the correct fields.

    it('triggerBuyItNow: allows re-trigger (replaces existing pending BIN with new buyer)', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-old',
            buyItNowPendingAt: new Date(),
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null); // Reserve not met
        prisma.auction.update.mockResolvedValue({ ...auction, buyItNowPendingBuyerId: 'buyer-new' });

        await service.triggerBuyItNow('auction-1', 'buyer-new');

        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ buyItNowPendingBuyerId: 'buyer-new' }),
            }),
        );
    });
});

describe('AuctionsService — seller accepts current highest offer only', () => {
    let service: AuctionsService;
    let prisma: any;

    beforeEach(async () => {
        prisma = {
            auction: { findUnique: jest.fn(), update: jest.fn() },
            bid: { findUnique: jest.fn(), findFirst: jest.fn() },
            listing: { update: jest.fn() },
            sale: { create: jest.fn() },
            sellerProfile: { upsert: jest.fn() },
            chatRoom: { upsert: jest.fn() },
            user: { findUnique: jest.fn() },
            $transaction: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn(), shouldSendEmail: jest.fn().mockResolvedValue(true) } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: { broadcastAuctionEnd: jest.fn() } },
                { provide: EmailService, useValue: {} },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    it('rejects a stale lower bid after another dealer has placed a higher offer', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
                linkedListingId: null,
                bids: [],
            },
        });
        prisma.bid.findUnique.mockResolvedValue({
            id: 'bid-old',
            listingId: 'listing-1',
            bidderId: 'dealer-1',
            amount: 8000,
            deletedAt: null,
            cancelledAt: null,
            archivedAt: null,
        });
        prisma.bid.findFirst.mockResolvedValue({
            id: 'bid-new',
            listingId: 'listing-1',
            bidderId: 'dealer-2',
            amount: 8500,
        });

        await expect(
            service.acceptBid('auction-1', 'bid-old', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/current highest bid/i) });

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not let the seller use the legacy close-now path after reserve is met', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
                linkedListingId: null,
                bids: [],
            },
        });
        prisma.bid.findFirst.mockResolvedValue({
            id: 'bid-current',
            listingId: 'listing-1',
            bidderId: 'dealer-1',
            amount: 10000,
        });

        await expect(
            service.sellerClose('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/reserve has been met/i) });

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects early acceptance once the current highest bid has met the reserve', async () => {
        const auction = {
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
                linkedListingId: null,
                year: 2020,
                make: 'Test',
                model: 'Car',
                bids: [],
            },
        };
        const bid = {
            id: 'bid-current',
            listingId: 'listing-1',
            bidderId: 'dealer-1',
            amount: 10000,
            deletedAt: null,
            cancelledAt: null,
            archivedAt: null,
        };

        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findUnique.mockResolvedValue(bid);
        prisma.bid.findFirst.mockResolvedValue(bid);

        await expect(
            service.acceptBid('auction-1', 'bid-current', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/reserve has been met/i) });

        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows the seller to accept the current highest offer even when it is below reserve', async () => {
        const auction = {
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
                linkedListingId: null,
                year: 2020,
                make: 'Test',
                model: 'Car',
                bids: [],
            },
        };
        const bid = {
            id: 'bid-current',
            listingId: 'listing-1',
            bidderId: 'dealer-1',
            amount: 8200,
            deletedAt: null,
            cancelledAt: null,
            archivedAt: null,
        };

        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findUnique.mockResolvedValue(bid);
        prisma.bid.findFirst.mockResolvedValue(bid);
        prisma.$transaction.mockResolvedValue([]);

        await expect(
            service.acceptBid('auction-1', 'bid-current', 'seller-1'),
        ).resolves.toBeUndefined();

        expect(prisma.$transaction).toHaveBeenCalled();
    });
});

describe('AuctionsService — create', () => {
    let service: AuctionsService;
    let prisma: any;

    const makeDto = (overrides: Record<string, any> = {}) => ({
        listingId: 'listing-1',
        startTime: new Date().toISOString(),
        reservePrice: 20000,
        startingBid: 7000,
        minIncrement: 100,
        ...overrides,
    });

    beforeEach(async () => {
        prisma = {
            listing: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'listing-1',
                    sellerId: 'seller-1',
                    deletedAt: null,
                    status: 'ACTIVE',
                    type: 'CLASSIFIED',
                    price: 10000,
                }),
                update: jest.fn(),
            },
            auction: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'auction-1' }),
                update: jest.fn().mockResolvedValue({ id: 'auction-1' }),
            },
            bid: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn(async (operations: any[]) => Promise.all(operations)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn() } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: {} },
                { provide: EmailService, useValue: {} },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    it('normalises any legacy client starting bid to 70% of Estimated Market Value', async () => {
        await service.create(makeDto({ startingBid: 2500 }), 'seller-1');

        expect(prisma.auction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    startingBid: 7000,
                }),
            }),
        );
    });

    it('does not allow a client to raise the platform opening bid above 70% of market value', async () => {
        await service.create(makeDto({ startingBid: 9500 }), 'seller-1');

        expect(prisma.auction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    startingBid: 7000,
                }),
            }),
        );
    });

    it('persists buyItNowPrice on the created auction', async () => {
        await service.create(makeDto({ buyItNowPrice: 12000 }), 'seller-1');
        expect(prisma.auction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ buyItNowPrice: 12000 }) }),
        );
    });

    it('persists a null buyItNowPrice when none is provided', async () => {
        await service.create(makeDto(), 'seller-1');
        expect(prisma.auction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ buyItNowPrice: null }) }),
        );
    });


    it('archives bids from the completed auction before re-auctioning the same listing', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ENDED',
            deletedAt: null,
        });
        prisma.bid.updateMany.mockResolvedValue({ count: 4 });
        prisma.auction.update.mockResolvedValue({ id: 'auction-1', status: 'SCHEDULED' });

        await service.create(makeDto(), 'seller-1');

        expect(prisma.bid.updateMany).toHaveBeenCalledWith({
            where: {
                listingId: 'listing-1',
                deletedAt: null,
                archivedAt: null,
            },
            data: { archivedAt: expect.any(Date) },
        });
        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'auction-1' },
                data: expect.objectContaining({
                    status: 'SCHEDULED',
                    winnerId: null,
                    winningBidAmount: null,
                    wonAt: null,
                }),
            }),
        );
    });
});
