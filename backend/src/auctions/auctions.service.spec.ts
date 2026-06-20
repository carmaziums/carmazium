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
});
