import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { HandoverDocumentsService } from './handover-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { AuctionGateway } from './auction.gateway';
import { EmailService } from '../email/email.service';
import { ChatService } from '../chat/chat.service';
import { PaymentsService } from '../payments/payments.service';

describe('AuctionsService — Buy It Now lifecycle', () => {
    let service: AuctionsService;
    let prisma: any;
    let notificationsService: any;
    let auctionGateway: any;
    let paymentsService: any;

    const makeMakeModel = () => ({ make: 'BMW', model: 'M3', year: 2022, sellerId: 'seller-1', title: 'BMW M3', bids: [] });

    const makeActiveAuction = (overrides: Record<string, any> = {}): any => ({
        id: 'auction-1',
        listingId: 'listing-1',
        status: 'ACTIVE',
        startTime: new Date(Date.now() - 60 * 60 * 1000),
        endTime: new Date(Date.now() + 60 * 60 * 1000),
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
            status: 'ACTIVE',
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
                count: jest.fn().mockResolvedValue(0),
            },
            listing: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({ id: 'listing-1', status: 'PENDING_REVIEW' }),
            },
            sale: { create: jest.fn(), deleteMany: jest.fn() },
            sellerProfile: { upsert: jest.fn(), update: jest.fn() },
            chatRoom: { upsert: jest.fn() },
            user: {
                findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({
                    id: where.id,
                    role: 'DEALER',
                    deletedAt: null,
                })),
            },
            dealerProfile: {
                findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({
                    id: `dealer-${where.userId}`,
                    userId: where.userId,
                    isVerified: true,
                })),
                count: jest.fn().mockResolvedValue(742),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
            $transaction: jest.fn(async (arg: any) => {
                if (typeof arg === 'function') return arg(prisma);
                return Promise.all(arg);
            }),
        };

        notificationsService = {
            create: jest.fn().mockResolvedValue({}),
        };

        paymentsService = {
            issueFullRefundForAuctionInspection: jest.fn().mockResolvedValue(undefined),
        };

        auctionGateway = {
            broadcastBid: jest.fn(),
            broadcastAuctionEnd: jest.fn(),
            broadcastBinPending: jest.fn(),
            broadcastAuctionStart: jest.fn(),
            broadcastPriceUpdated: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: notificationsService },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: auctionGateway },
                {
                    provide: HandoverDocumentsService,
                    useValue: {
                        // Pass-through: these tests assert auction state, not
                        // how handover proof URLs are signed.
                        hydrateProof: jest.fn(async (a: any) => a),
                        hydrateMany: jest.fn(async (a: any) => a),
                        signPath: jest.fn(async () => null),
                        deleteProof: jest.fn().mockResolvedValue(undefined),
                    },
                },
                { provide: EmailService, useValue: { sendAuctionWonEmail: jest.fn(), sendAuctionEndedSellerEmail: jest.fn(), sendAuctionReserveNotMetEmail: jest.fn() } },
                {
                    provide: ChatService,
                    useValue: {
                        findOrCreateRoom: jest.fn().mockResolvedValue({ id: 'room_1' }),
                        findOrCreateSupportRoom: jest.fn().mockResolvedValue({
                            id: 'support-room-1',
                            initiatorId: 'seller-1',
                            participantId: 'support-admin-1',
                        }),
                        sendMessage: jest.fn().mockResolvedValue({
                            message: { id: 'message-1' },
                            created: true,
                        }),
                    },
                },
                { provide: PaymentsService, useValue: paymentsService },
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

    it('triggerBuyItNow: rejects after the auction deadline even before lifecycle finalisation', async () => {
        const auction = makeActiveAuction({ endTime: new Date(Date.now() - 1000) });
        prisma.auction.findUnique.mockResolvedValue(auction);

        await expect(
            service.triggerBuyItNow('auction-1', 'buyer-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastBinPending).not.toHaveBeenCalled();
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

    it('triggerBuyItNow: blocks non-dealer and unverified accounts before any auction mutation', async () => {
        prisma.user.findUnique.mockResolvedValueOnce({ role: 'BUYER' });

        await expect(
            service.triggerBuyItNow('auction-1', 'retail-buyer'),
        ).rejects.toBeInstanceOf(ForbiddenException);

        prisma.user.findUnique.mockResolvedValueOnce({ role: 'DEALER' });
        prisma.dealerProfile.findUnique.mockResolvedValueOnce({
            id: 'dealer-unverified',
            userId: 'dealer-unverified',
            isVerified: false,
        });

        await expect(
            service.triggerBuyItNow('auction-1', 'dealer-unverified'),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('triggerBuyItNow: blocks the seller dealership from buying its own auction', async () => {
        const auction = makeActiveAuction();
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerProfile.findUnique.mockResolvedValue({
            id: 'dealer-seller',
            userId: 'seller-1',
            isVerified: true,
        });

        await expect(
            service.triggerBuyItNow('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/own auction/i) });

        expect(prisma.auction.update).not.toHaveBeenCalled();
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
        await service.confirmBuyItNow('auction-1', 'seller-1');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({ auctionId: 'auction-1', winnerId: 'buyer-1' }),
        );
    });

    it('confirmBuyItNow: rejects after the auction deadline before lifecycle finalisation', async () => {
        const auction = makeActiveAuction({
            endTime: new Date(Date.now() - 1000),
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: new Date(),
            buyItNowPrice: 25000,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);

        await expect(
            service.confirmBuyItNow('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.sale.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastAuctionEnd).not.toHaveBeenCalled();
    });

    it('confirmBuyItNow: refuses a stale confirmation when a locked bid has already met reserve', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: new Date(),
            buyItNowPrice: 25000,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-reserve', amount: 20000 });
        prisma.bid.count.mockResolvedValue(1);

        await expect(
            service.confirmBuyItNow('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/reserve is met/i) });

        expect(prisma.sale.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastAuctionEnd).not.toHaveBeenCalled();
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

    it('triggerBuyItNow: blocks a different dealership from replacing an unexpired pending request under the auction lock', async () => {
        const pendingAt = new Date(Date.now() - 5 * 60 * 1000);
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-old',
            buyItNowPendingAt: pendingAt,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.triggerBuyItNow('auction-1', 'buyer-new'),
        ).rejects.toBeInstanceOf(ConflictException);

        expect(prisma.$queryRaw).toHaveBeenCalled();
        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastBinPending).not.toHaveBeenCalled();
    });

    it('triggerBuyItNow: same dealership retry is idempotent and does not reset the pending clock or duplicate notifications', async () => {
        const pendingAt = new Date(Date.now() - 5 * 60 * 1000);
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-old',
            buyItNowPendingAt: pendingAt,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);

        await service.triggerBuyItNow('auction-1', 'buyer-old');

        expect(prisma.$queryRaw).toHaveBeenCalled();
        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastBinPending).not.toHaveBeenCalled();
        expect(auction.buyItNowPendingAt).toBe(pendingAt);
    });

    it('triggerBuyItNow: treats authorised staff retries as the same dealership identity', async () => {
        const pendingAt = new Date(Date.now() - 5 * 60 * 1000);
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'owner-1',
            buyItNowPendingAt: pendingAt,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER' });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await service.triggerBuyItNow('auction-1', 'sales-2');

        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(notificationsService.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastBinPending).not.toHaveBeenCalled();
        expect(auction.buyItNowPendingBuyerId).toBe('owner-1');
        expect(auction.buyItNowPendingAt).toBe(pendingAt);
    });

    it('triggerBuyItNow: allows a new dealership after the existing pending request has expired', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-old',
            buyItNowPendingAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null); // Reserve not met
        prisma.auction.update.mockResolvedValue({
            ...auction,
            buyItNowPendingBuyerId: 'buyer-new',
        });

        await service.triggerBuyItNow('auction-1', 'buyer-new');

        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    buyItNowPendingBuyerId: 'buyer-new',
                    buyItNowPendingAt: expect.any(Date),
                }),
            }),
        );
        expect(notificationsService.create).toHaveBeenCalledTimes(1);
        expect(auctionGateway.broadcastBinPending).toHaveBeenCalledWith(
            'auction-1',
            'buyer-new',
        );
    });


    it('SALES_AGENT Buy It Now is recorded against the dealership owner identity', async () => {
        const auction = makeActiveAuction();
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await service.triggerBuyItNow('auction-1', 'sales-1');

        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                buyItNowPendingBuyerId: 'owner-1',
            }),
        });
        expect(auctionGateway.broadcastBinPending).toHaveBeenCalledWith(
            'auction-1',
            'owner-1',
        );
    });

    it('FINANCE_MANAGER cannot trigger Buy It Now because it is a bidding commitment', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'FINANCE_MANAGER',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });

        await expect(
            service.triggerBuyItNow('auction-1', 'finance-1'),
        ).rejects.toThrow(/does not allow auction purchase commitments/i);

        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('dealer ADMIN confirms Buy It Now as the dealership seller, not a staff seller identity', async () => {
        const auction = makeActiveAuction({
            buyItNowPendingBuyerId: 'buyer-1',
            buyItNowPendingAt: new Date(),
            buyItNowPrice: 25000,
        });
        prisma.auction.findUnique.mockResolvedValue(auction);
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'ADMIN',
            dealerProfile: {
                id: 'dealer-seller',
                userId: 'seller-1',
                isVerified: true,
            },
        });
        await service.confirmBuyItNow('auction-1', 'admin-staff-1');

        expect(prisma.sale.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                listingId: 'listing-1',
                sellerId: 'seller-1',
                buyerId: 'buyer-1',
            }),
        });
        expect(prisma.sellerProfile.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: 'seller-1' },
            }),
        );
    });

    const atomicReserveRow = ({
        decision = 'OK',
        oldReserve,
        newReserve,
        startingBid = 10000,
        minIncrement = 100,
        topBid = null,
        activeBidCount = 0,
        buyItNowPrice = 25000,
        auctionStatus = 'ACTIVE',
        listingStatus = 'ACTIVE',
    }: {
        decision?: string;
        oldReserve: number;
        newReserve: number;
        startingBid?: number;
        minIncrement?: number;
        topBid?: number | null;
        activeBidCount?: number;
        buyItNowPrice?: number | null;
        auctionStatus?: string;
        listingStatus?: string;
    }) => [{
        id: 'auction-1',
        listingId: 'listing-1',
        auction_status: auctionStatus,
        old_reserve: oldReserve,
        starting_bid: startingBid,
        min_increment: minIncrement,
        buy_it_now_price: buyItNowPrice,
        start_time: new Date(Date.now() - 60 * 60 * 1000),
        end_time: new Date(Date.now() + 60 * 60 * 1000),
        deleted_at: null,
        listing_title: 'BMW M3',
        seller_id: 'seller-1',
        listing_status: listingStatus,
        top_bid: topBid,
        active_bid_count: activeBidCount,
        decision_code: decision,
        updated_auction: decision === 'OK'
            ? {
                ...makeActiveAuction({
                    reservePrice: newReserve,
                    startingBid,
                    minIncrement,
                    buyItNowPrice,
                }),
                reservePrice: newReserve,
            }
            : null,
    }];

    it('adminCorrectReservePrice: lowers a live reserve without changing bids and clears pending BIN when reserve becomes met', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            oldReserve: 20000,
            newReserve: 17500,
            topBid: 18000,
            activeBidCount: 3,
            buyItNowPrice: 25000,
        }));

        const result = await service.adminCorrectReservePrice(
            'auction-1',
            17500,
            'Seller entered the wrong reserve',
        );

        expect(Number((result as any).reservePrice)).toBe(17500);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastPriceUpdated).toHaveBeenCalledWith('auction-1', 17500);
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_reserve_corrected',
                payload: expect.objectContaining({
                    old_reserve: 20000,
                    new_reserve: 17500,
                    active_bid_count: 3,
                    reserve_met_after: true,
                }),
            }),
        });
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                type: 'AUCTION_UPDATED',
                actionType: 'PRICE_CORRECTED',
                message: expect.stringMatching(/current highest bid of £18,000 now meets the reserve/i),
                data: expect.objectContaining({
                    oldReserve: 20000,
                    newReserve: 17500,
                    topBidAmount: 18000,
                    reserveMet: true,
                }),
            }),
        );
    });

    it('adminCorrectReservePrice: recalculates the zero-bid first-offer floor after lowering reserve', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            oldReserve: 9000,
            newReserve: 6000,
            startingBid: 7000,
            topBid: null,
            activeBidCount: 0,
            buyItNowPrice: 12000,
        }));

        await service.adminCorrectReservePrice(
            'auction-1',
            6000,
            'Seller requested a lower reserve',
        );

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                message: expect.stringMatching(/first offers can now be made from £4,200/i),
                data: expect.objectContaining({
                    oldReserve: 9000,
                    newReserve: 6000,
                    topBidAmount: null,
                    firstOfferFloor: 4200,
                    startingBid: 7000,
                    reserveMet: false,
                }),
            }),
        );
        expect(auctionGateway.broadcastPriceUpdated).toHaveBeenCalledWith('auction-1', 6000);
    });

    it('adminCorrectReservePrice: covers the production zero-bid £12,400 -> £8,500 case', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            oldReserve: 12400,
            newReserve: 8500,
            startingBid: 6650,
            minIncrement: 100,
            topBid: null,
            activeBidCount: 0,
            buyItNowPrice: null,
        }));

        const result = await service.adminCorrectReservePrice('auction-1', 8500);

        expect(Number((result as any).reservePrice)).toBe(8500);
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    oldReserve: 12400,
                    newReserve: 8500,
                    firstOfferFloor: 4655,
                    startingBid: 6650,
                    reserveMet: false,
                }),
            }),
        );
        expect(auctionGateway.broadcastPriceUpdated).toHaveBeenCalledWith('auction-1', 8500);
    });

    it('adminCorrectReservePrice: revalidates auction state after acquiring the bid lock', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            decision: 'INVALID_STATUS',
            oldReserve: 9000,
            newReserve: 6000,
            startingBid: 7000,
            auctionStatus: 'ENDED',
        }));

        await expect(
            service.adminCorrectReservePrice('auction-1', 6000),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(auctionGateway.broadcastPriceUpdated).not.toHaveBeenCalled();
    });

    it('adminCorrectReservePrice: refuses a live reserve change after the auction deadline', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            decision: 'ENDED',
            oldReserve: 9000,
            newReserve: 6000,
            startingBid: 7000,
        }));

        await expect(
            service.adminCorrectReservePrice('auction-1', 6000),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(auctionGateway.broadcastPriceUpdated).not.toHaveBeenCalled();
    });

    it('adminCorrectReservePrice: refuses to raise a reserve above the top bid after reserve was already met', async () => {
        prisma.$queryRaw.mockResolvedValueOnce(atomicReserveRow({
            decision: 'RESERVE_ALREADY_MET',
            oldReserve: 15000,
            newReserve: 17000,
            topBid: 16000,
            activeBidCount: 1,
            buyItNowPrice: 25000,
        }));

        await expect(
            service.adminCorrectReservePrice('auction-1', 17000),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(auctionGateway.broadcastPriceUpdated).not.toHaveBeenCalled();
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
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue(null),
                count: jest.fn().mockResolvedValue(742),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
            $transaction: jest.fn(async (arg: any) =>
                typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
            ),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn(), shouldSendEmail: jest.fn().mockResolvedValue(true) } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: { broadcastAuctionEnd: jest.fn() } },
                {
                    provide: HandoverDocumentsService,
                    useValue: {
                        // Pass-through: these tests assert auction state, not
                        // how handover proof URLs are signed.
                        hydrateProof: jest.fn(async (a: any) => a),
                        hydrateMany: jest.fn(async (a: any) => a),
                        signPath: jest.fn(async () => null),
                        deleteProof: jest.fn().mockResolvedValue(undefined),
                    },
                },
                { provide: EmailService, useValue: {} },
                {
                    provide: ChatService,
                    useValue: {
                        findOrCreateRoom: jest.fn().mockResolvedValue({ id: 'room_1' }),
                        findOrCreateSupportRoom: jest.fn().mockResolvedValue({
                            id: 'support-room-1',
                            initiatorId: 'seller-1',
                            participantId: 'support-admin-1',
                        }),
                        sendMessage: jest.fn().mockResolvedValue({
                            message: { id: 'message-1' },
                            created: true,
                        }),
                    },
                },
                { provide: PaymentsService, useValue: { issueFullRefundForAuctionInspection: jest.fn().mockResolvedValue(undefined) } },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    it('rejects a stale lower bid after another dealer has placed a higher offer', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() + 60 * 60 * 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
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

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('does not let the seller use the legacy close-now path after reserve is met', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() + 60 * 60 * 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 10000,
                linkedListingId: null,
                bids: [{
                    id: 'bid-current',
                    listingId: 'listing-1',
                    bidderId: 'dealer-1',
                    amount: 10000,
                }],
            },
        });

        await expect(
            service.sellerClose('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/reserve has been met/i) });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('does not let the seller close an expired auction before lifecycle finalisation', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() - 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 10000,
                linkedListingId: null,
                bids: [],
            },
        });

        await expect(
            service.sellerClose('auction-1', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('rejects early acceptance once the current highest bid has met the reserve', async () => {
        const auction = {
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() + 60 * 60 * 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
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

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('rejects accepting a below-reserve offer after the auction deadline before cron finalises it', async () => {
        const auction = {
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() - 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
                price: 10000,
                linkedListingId: null,
                year: 2020,
                make: 'Test',
                model: 'Car',
                bids: [],
            },
        };
        prisma.auction.findUnique.mockResolvedValue(auction);

        await expect(
            service.acceptBid('auction-1', 'bid-current', 'seller-1'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.bid.findUnique).not.toHaveBeenCalled();
        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('allows the seller to accept the current highest offer even when it is below reserve', async () => {
        const auction = {
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ACTIVE',
            endTime: new Date(Date.now() + 60 * 60 * 1000),
            reservePrice: 10000,
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                status: 'ACTIVE',
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
        await expect(
            service.acceptBid('auction-1', 'bid-current', 'seller-1'),
        ).resolves.toBeUndefined();

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                status: 'ENDED',
                winnerId: 'dealer-1',
                winningBidAmount: 8200,
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            }),
        });
        expect(prisma.auction.update.mock.calls[0][0].data).not.toHaveProperty('buyerFeePaid', true);
        expect(prisma.sale.create).toHaveBeenCalledWith({
            data: {
                listingId: 'listing-1',
                sellerId: 'seller-1',
                buyerId: 'dealer-1',
                soldPrice: 8200,
            },
        });
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_offer_accepted',
                userId: 'seller-1',
                payload: expect.objectContaining({
                    auction_id: 'auction-1',
                    amount: 8200,
                    outcome: 'SELLER_ACCEPTED_BELOW_RESERVE',
                }),
            }),
        });
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_outcome',
                payload: expect.objectContaining({
                    auction_id: 'auction-1',
                    outcome: 'SELLER_ACCEPTED_BELOW_RESERVE',
                }),
            }),
        });
        expect((service as any).chatService.findOrCreateRoom).not.toHaveBeenCalled();
    });
});

describe('AuctionsService — create', () => {
    let service: AuctionsService;
    let prisma: any;
    let paymentsService: { issueFullRefundForAuctionInspection: jest.Mock };

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
                    createdAt: new Date('2026-09-19T01:00:00.000Z'),
                    status: 'DRAFT',
                    type: 'AUCTION',
                    price: 10000,
                    title: 'BMW M3 2022',
                    images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
                    vrm: 'AB12CDE',
                    make: 'BMW',
                    model: 'M3',
                    year: 2022,
                    mileage: 30000,
                    fuelType: 'PETROL',
                    transmission: 'AUTOMATIC',
                    bodyType: 'COUPE',
                    location: 'Birmingham',
                    owners: '1',
                    description: 'Well presented vehicle with full details.',
                    condition: 'GOOD',
                    stolenRecovered: false,
                    hasOutstandingFinance: false,
                    isLegalRegisteredKeeper: true,
                    isDepartedSale: false,
                }),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findMany: jest.fn().mockResolvedValue([]),
            },
            auction: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'auction-1' }),
                update: jest.fn().mockResolvedValue({ id: 'auction-1' }),
            },
            bid: {
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            hpiReport: {
                findUnique: jest.fn().mockResolvedValue({ id: 'hpi-1' }),
            },
            sale: {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            sellerProfile: {
                update: jest.fn().mockResolvedValue({}),
            },
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue(null),
                count: jest.fn().mockResolvedValue(742),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
            $transaction: jest.fn(async (arg: any) =>
                typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
            ),
        };

        paymentsService = {
            issueFullRefundForAuctionInspection: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: { create: jest.fn() } },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: { broadcastAuctionEnd: jest.fn() } },
                {
                    provide: HandoverDocumentsService,
                    useValue: {
                        // Pass-through: these tests assert auction state, not
                        // how handover proof URLs are signed.
                        hydrateProof: jest.fn(async (a: any) => a),
                        hydrateMany: jest.fn(async (a: any) => a),
                        signPath: jest.fn(async () => null),
                        deleteProof: jest.fn().mockResolvedValue(undefined),
                    },
                },
                { provide: EmailService, useValue: {} },
                {
                    provide: ChatService,
                    useValue: {
                        findOrCreateRoom: jest.fn().mockResolvedValue({ id: 'room_1' }),
                        findOrCreateSupportRoom: jest.fn().mockResolvedValue({
                            id: 'support-room-1',
                            initiatorId: 'seller-1',
                            participantId: 'support-admin-1',
                        }),
                        sendMessage: jest.fn().mockResolvedValue({
                            message: { id: 'message-1' },
                            created: true,
                        }),
                    },
                },
                { provide: PaymentsService, useValue: paymentsService },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    it('rejects direct scheduling when the listing is incomplete before it can enter review', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'seller-1',
            deletedAt: null,
            createdAt: new Date('2026-09-19T01:00:00.000Z'),
            status: 'DRAFT',
            type: 'AUCTION',
            price: 10000,
            title: 'BMW M3 2022',
            images: [],
        });

        await expect(service.create(makeDto(), 'seller-1'))
            .rejects.toThrow(/at least 10 photos/i);

        expect(prisma.listing.update).not.toHaveBeenCalled();
        expect(prisma.auction.create).not.toHaveBeenCalled();
    });

    it('allows a complete auction to enter review without an HPI request', async () => {
        prisma.hpiReport.findUnique.mockResolvedValue(null);

        await expect(service.create(makeDto(), 'seller-1'))
            .resolves.toEqual({ id: 'auction-1' });

        expect(prisma.listing.update).toHaveBeenCalled();
        expect(prisma.auction.create).toHaveBeenCalled();
    });

    it('always creates a 24-hour schedule', async () => {
        const start = new Date(Date.now() + 60_000);
        await service.create(makeDto({ startTime: start.toISOString() }), 'seller-1');

        const createCall = prisma.auction.create.mock.calls[0][0];
        expect(createCall.data.endTime.getTime() - createCall.data.startTime.getTime())
            .toBe(24 * 60 * 60 * 1000);
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

    it('re-auctions an ended reserve-not-met CLASSIFIED draft by switching it back to AUCTION atomically', async () => {
        const revertedRetailDraft = {
            id: 'listing-1',
            sellerId: 'seller-1',
            deletedAt: null,
            createdAt: new Date('2026-09-19T01:00:00.000Z'),
            status: 'DRAFT',
            type: 'CLASSIFIED',
            price: 10000,
            title: 'BMW M3 2022',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
            vrm: 'AB12CDE',
            make: 'BMW',
            model: 'M3',
            year: 2022,
            mileage: 30000,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            bodyType: 'COUPE',
            location: 'Birmingham',
            owners: '1',
            description: 'Well presented vehicle with full details.',
            condition: 'GOOD',
            stolenRecovered: false,
            hasOutstandingFinance: false,
            isLegalRegisteredKeeper: true,
            isDepartedSale: false,
        };
        prisma.listing.findUnique.mockResolvedValue(revertedRetailDraft);
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ENDED',
            deletedAt: null,
            winnerId: null,
        });
        prisma.auction.update.mockResolvedValue({ id: 'auction-1', status: 'SCHEDULED' });

        await service.create(makeDto(), 'seller-1');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: {
                status: 'PENDING_REVIEW',
                rejectionReason: null,
                type: 'AUCTION',
            },
        });
        expect(prisma.bid.updateMany).toHaveBeenCalled();
        expect(prisma.auction.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'auction-1' },
                data: expect.objectContaining({ status: 'SCHEDULED' }),
            }),
        );
    });

    it('relinks one legacy failed-auction clone to its still-active retail sibling before restarting', async () => {
        const revertedRetailDraft = {
            id: 'listing-1',
            sellerId: 'seller-1',
            deletedAt: null,
            createdAt: new Date('2026-09-19T01:00:00.000Z'),
            status: 'DRAFT',
            type: 'CLASSIFIED',
            price: 10000,
            title: 'BMW M3 2022',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
            vrm: 'AB12 CDE',
            make: 'BMW',
            model: 'M3',
            year: 2022,
            mileage: 30000,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            bodyType: 'COUPE',
            location: 'Birmingham',
            owners: '1',
            description: 'Well presented vehicle with full details.',
            condition: 'GOOD',
            stolenRecovered: false,
            hasOutstandingFinance: false,
            isLegalRegisteredKeeper: true,
            isDepartedSale: false,
            linkedListingId: null,
        };
        prisma.listing.findUnique.mockResolvedValue(revertedRetailDraft);
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'ENDED',
            deletedAt: null,
            winnerId: null,
        });
        prisma.listing.findMany.mockResolvedValue([{
            id: 'retail-1',
            sellerId: 'seller-1',
            deletedAt: null,
            status: 'ACTIVE',
            type: 'CLASSIFIED',
            vrm: 'AB12CDE',
            linkedListingId: null,
            hpiReport: { id: 'retail-hpi' },
        }]);
        prisma.hpiReport.findUnique.mockResolvedValue(null);
        prisma.auction.update.mockResolvedValue({ id: 'auction-1', status: 'SCHEDULED' });

        await service.create(makeDto(), 'seller-1');

        expect(prisma.listing.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'retail-1',
                sellerId: 'seller-1',
                type: 'CLASSIFIED',
                status: 'ACTIVE',
                deletedAt: null,
                linkedListingId: null,
            },
            data: { linkedListingId: 'listing-1' },
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: {
                status: 'PENDING_REVIEW',
                rejectionReason: null,
                type: 'AUCTION',
                linkedListingId: 'retail-1',
            },
        });
    });

    it('still rejects an arbitrary CLASSIFIED draft that was not reverted from an ended auction', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'seller-1',
            deletedAt: null,
            status: 'DRAFT',
            type: 'CLASSIFIED',
            price: 10000,
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        });
        prisma.auction.findUnique.mockResolvedValue(null);

        await expect(service.create(makeDto(), 'seller-1'))
            .rejects.toThrow(/only schedules an AUCTION listing/i);

        expect(prisma.listing.update).not.toHaveBeenCalled();
    });
});


describe('AuctionsService — final lifecycle consistency', () => {
    let service: AuctionsService;
    let prisma: any;
    let auctionGateway: any;
    let notificationsService: any;
    let paymentsService: { issueFullRefundForAuctionInspection: jest.Mock };

    beforeEach(async () => {
        prisma = {
            auction: {
                findUnique: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn().mockResolvedValue({ id: 'auction-1' }),
            },
            listing: {
                update: jest.fn().mockResolvedValue({ id: 'listing-1' }),
            },
            bid: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            sale: {
                create: jest.fn(),
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            sellerProfile: {
                upsert: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
            chatRoom: {
                upsert: jest.fn(),
            },
            user: {
                findUnique: jest.fn().mockResolvedValue(null),
            },
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue(null),
                count: jest.fn().mockResolvedValue(742),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
            $transaction: jest.fn(async (arg: any) =>
                typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
            ),
        };
        auctionGateway = {
            broadcastAuctionEnd: jest.fn(),
        };
        notificationsService = {
            create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        };
        paymentsService = {
            issueFullRefundForAuctionInspection: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuctionsService,
                { provide: PrismaService, useValue: prisma },
                { provide: NotificationsService, useValue: notificationsService },
                { provide: NotificationsGateway, useValue: { sendNotification: jest.fn() } },
                { provide: AuctionGateway, useValue: auctionGateway },
                {
                    provide: HandoverDocumentsService,
                    useValue: {
                        // Pass-through: these tests assert auction state, not
                        // how handover proof URLs are signed.
                        hydrateProof: jest.fn(async (a: any) => a),
                        hydrateMany: jest.fn(async (a: any) => a),
                        signPath: jest.fn(async () => null),
                        deleteProof: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: EmailService,
                    useValue: {
                        sendAuctionReserveNotMetEmail: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: ChatService,
                    useValue: {
                        findOrCreateRoom: jest.fn().mockResolvedValue({ id: 'room_1' }),
                        findOrCreateSupportRoom: jest.fn().mockResolvedValue({
                            id: 'support-room-1',
                            initiatorId: 'seller-1',
                            participantId: 'support-admin-1',
                        }),
                        sendMessage: jest.fn().mockResolvedValue({
                            message: { id: 'message-1' },
                            created: true,
                        }),
                    },
                },
                { provide: PaymentsService, useValue: paymentsService },
            ],
        }).compile();

        service = module.get<AuctionsService>(AuctionsService);
    });

    it('keeps a failed linked auction paired with its active retail counterpart', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'auction-listing-1',
            status: 'ACTIVE',
            reservePrice: 15000,
            listing: {
                id: 'auction-listing-1',
                sellerId: 'seller-1',
                linkedListingId: 'retail-1',
                year: 2022,
                make: 'BMW',
                model: 'M3',
                bids: [],
            },
        });

        await service.closeAuction('auction-1');

        expect(prisma.listing.update).toHaveBeenCalledTimes(1);
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'auction-listing-1' },
            data: {
                status: 'DRAFT',
                type: 'AUCTION',
            },
        });
        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({ reserveMet: false, winnerId: null }),
        );
    });

    it('does not close an auction when a committed anti-snipe extension moved the end time into the future', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-anti-snipe',
            listingId: 'listing-1',
            deletedAt: null,
            status: 'ACTIVE',
            reservePrice: 10000,
            endTime: new Date(Date.now() + 2 * 60 * 1000),
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                linkedListingId: null,
                year: 2022,
                make: 'BMW',
                model: 'M3',
                bids: [{ id: 'bid-1', bidderId: 'dealer-1', amount: 10500 }],
            },
        });

        await service.closeAuction('auction-anti-snipe');

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.auction.update).not.toHaveBeenCalled();
        expect(prisma.sale.create).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastAuctionEnd).not.toHaveBeenCalled();
    });

    it('ends below-reserve bidding with no accidental winner or sale', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-below-reserve',
            listingId: 'listing-1',
            deletedAt: null,
            status: 'ACTIVE',
            reservePrice: 10000,
            endTime: new Date(Date.now() - 1000),
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
                year: 2022,
                make: 'BMW',
                model: 'M3',
                bids: [{ id: 'bid-1', bidderId: 'dealer-1', amount: 7000 }],
            },
        });

        await service.closeAuction('auction-below-reserve');

        expect(prisma.sale.create).not.toHaveBeenCalled();
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-below-reserve' },
            data: expect.objectContaining({
                status: 'ENDED',
                winnerId: null,
                winningBidAmount: null,
            }),
        });
        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith(
            'auction-below-reserve',
            expect.objectContaining({
                winnerId: null,
                winningBidAmount: null,
                reserveMet: false,
            }),
        );
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_outcome',
                payload: expect.objectContaining({
                    auction_id: 'auction-below-reserve',
                    outcome: 'BELOW_RESERVE_UNSOLD',
                    highest_bid_amount: 7000,
                }),
            }),
        });
    });

    it('creates the normal winner and sale when the final real bid meets reserve', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-winner',
            listingId: 'listing-1',
            deletedAt: null,
            status: 'ACTIVE',
            reservePrice: 10000,
            endTime: new Date(Date.now() - 1000),
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
                year: 2022,
                make: 'BMW',
                model: 'M3',
                bids: [{ id: 'bid-1', bidderId: 'dealer-1', amount: 10100 }],
            },
        });

        await service.closeAuction('auction-winner');

        expect(prisma.sale.create).toHaveBeenCalledWith({
            data: {
                listingId: 'listing-1',
                sellerId: 'seller-1',
                buyerId: 'dealer-1',
                soldPrice: 10100,
            },
        });
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-winner' },
            data: expect.objectContaining({
                status: 'ENDED',
                winnerId: 'dealer-1',
                winningBidAmount: 10100,
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            }),
        });
        expect(prisma.auction.update.mock.calls[0][0].data).not.toHaveProperty('buyerFeePaid', true);
        expect(auctionGateway.broadcastAuctionEnd).toHaveBeenCalledWith(
            'auction-winner',
            expect.objectContaining({
                winnerId: 'dealer-1',
                winningBidAmount: 10100,
                reserveMet: true,
            }),
        );
    });

    it('sends an unsold-auction retail recommendation through notification, support chat and email', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: '550e8400-e29b-41d4-a716-446655440000',
            listingId: 'listing-1',
            status: 'ACTIVE',
            reservePrice: 15000,
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
                year: 2022,
                make: 'BMW',
                model: 'M3',
                bids: [],
            },
        });
        prisma.user.findUnique.mockResolvedValue({
            email: 'seller@example.com',
            firstName: 'Sam',
        });

        await service.closeAuction('550e8400-e29b-41d4-a716-446655440000');

        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                type: 'AUCTION_ENDED_NO_SALE',
                actionType: 'LIST_RETAIL',
                data: expect.objectContaining({
                    listingId: 'listing-1',
                    retailAlreadyLive: false,
                    retailUrl: '/sell?editId=listing-1&sellMode=retail',
                }),
            }),
        );

        const chat = (service as any).chatService;
        expect(chat.findOrCreateSupportRoom).toHaveBeenCalledWith('seller-1');
        expect(chat.sendMessage).toHaveBeenCalledWith(
            'support-room-1',
            'support-admin-1',
            expect.objectContaining({
                clientMessageId: '550e8400-e29b-41d4-a716-446655440000',
                content: expect.stringContaining('Retail Listing'),
            }),
        );

        const email = (service as any).emailService;
        expect(email.sendAuctionReserveNotMetEmail).toHaveBeenCalledWith(
            'seller@example.com',
            'Sam',
            expect.stringContaining('BMW'),
            '550e8400-e29b-41d4-a716-446655440000',
            'listing-1',
            false,
        );

        expect(prisma.dealerProfile.count).not.toHaveBeenCalled();

        const notificationCall = notificationsService.create.mock.calls.find(
            ([payload]: any[]) => payload.type === 'AUCTION_ENDED_NO_SALE',
        )?.[0];
        expect(notificationCall?.message).toContain('CarMazium’s verified dealer network');
        expect(notificationCall?.message).not.toMatch(/\b\d+[,.]?\d*\s+verified dealers\b/i);
    });

    it('retires a cancelled linked auction clone while returning the retail source to an unlinked state', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'auction-listing-1',
            status: 'SCHEDULED',
            listing: {
                id: 'auction-listing-1',
                sellerId: 'seller-1',
                linkedListingId: 'retail-1',
            },
        });

        await service.cancel('auction-1', 'seller-1');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'auction-listing-1' },
            data: expect.objectContaining({
                status: 'DRAFT',
                linkedListingId: null,
                deletedAt: expect.any(Date),
            }),
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'retail-1' },
            data: { linkedListingId: null },
        });
    });

    it('rejects moving a scheduled auction start into the past', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'SCHEDULED',
            startTime: new Date(Date.now() + 60_000),
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
            },
        });

        await expect(service.update(
            'auction-1',
            { startTime: new Date(Date.now() - 5 * 60_000).toISOString() } as any,
            'seller-1',
        )).rejects.toThrow(/past/i);

        expect(prisma.auction.update).not.toHaveBeenCalled();
    });

    it('restores the retail channel when a linked auction winner never pays the buyer fee', async () => {
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-1',
            winnerId: 'buyer-1',
            buyerFeePaid: false,
            wonAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
            listing: {
                id: 'auction-listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: 'retail-1',
            },
        }]);

        await service.revertUnpaidWins();

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'auction-listing-1' },
            data: expect.objectContaining({
                status: 'DRAFT',
                linkedListingId: null,
                deletedAt: expect.any(Date),
            }),
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'retail-1' },
            data: {
                status: 'ACTIVE',
                linkedListingId: null,
            },
        });
    });

    it('returns a standalone unpaid-win vehicle to a retail draft instead of leaving an ACTIVE listing behind a cancelled auction', async () => {
        prisma.auction.findMany.mockResolvedValue([{
            id: 'auction-1',
            winnerId: 'buyer-1',
            buyerFeePaid: false,
            wonAt: new Date(Date.now() - 80 * 60 * 60 * 1000),
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
            },
        }]);

        await service.revertUnpaidWins();

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: {
                status: 'DRAFT',
                type: 'CLASSIFIED',
                linkedListingId: null,
            },
        });
    });

    it('refuses a won vehicle only when a completed linked inspection recorded faults', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            status: 'ENDED',
            deletedAt: null,
            winnerId: 'buyer-1',
            buyerFeePaid: true,
            buyerFeeTransactionId: 'txn-1',
            sellerBonusReleased: false,
            buyerRefusedAt: null,
            handoverProofPath: null,
            handoverProofUrl: null,
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
            },
            serviceJobs: [{
                id: 'inspection-1',
                inspectionSummary: 'Gearbox fault confirmed.',
                completedAt: new Date(),
            }],
        });

        const result = await service.refuseAfterInspection('auction-1', 'buyer-1', 'Gearbox fault');

        expect(paymentsService.issueFullRefundForAuctionInspection).toHaveBeenCalledWith('auction-1');
        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                status: 'CANCELLED',
                winnerId: null,
                buyerFeePaid: false,
                buyerRefusedById: 'buyer-1',
                buyerRefusalInspectionJobId: 'inspection-1',
            }),
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: {
                status: 'DRAFT',
                type: 'CLASSIFIED',
                linkedListingId: null,
            },
        });
        expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
            where: { listingId: 'listing-1', buyerId: 'buyer-1' },
        });
        expect(result).toEqual({
            refused: true,
            refundedAmount: 125,
            inspectionJobId: 'inspection-1',
        });
    });

    it('returns a faulted linked retail listing to DRAFT instead of advertising it immediately', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            status: 'ENDED',
            deletedAt: null,
            winnerId: 'buyer-1',
            buyerFeePaid: true,
            buyerFeeTransactionId: 'txn-1',
            sellerBonusReleased: false,
            buyerRefusedAt: null,
            handoverProofPath: null,
            handoverProofUrl: null,
            listing: {
                id: 'auction-listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: 'retail-1',
            },
            serviceJobs: [{
                id: 'inspection-1',
                inspectionSummary: 'Oil leak and gearbox fault confirmed.',
                completedAt: new Date(),
            }],
        });

        await service.refuseAfterInspection('auction-1', 'buyer-1');

        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'auction-listing-1' },
            data: expect.objectContaining({
                status: 'DRAFT',
                linkedListingId: null,
                deletedAt: expect.any(Date),
            }),
        });
        expect(prisma.listing.update).toHaveBeenCalledWith({
            where: { id: 'retail-1' },
            data: {
                status: 'DRAFT',
                linkedListingId: null,
            },
        });
    });

    it('does not refund or unwind when no linked inspection recorded faults', async () => {
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            status: 'ENDED',
            deletedAt: null,
            winnerId: 'buyer-1',
            buyerFeePaid: true,
            buyerFeeTransactionId: 'txn-1',
            sellerBonusReleased: false,
            buyerRefusedAt: null,
            listing: {
                id: 'listing-1',
                title: 'BMW M3 2022',
                sellerId: 'seller-1',
                linkedListingId: null,
            },
            serviceJobs: [],
        });

        await expect(
            service.refuseAfterInspection('auction-1', 'buyer-1'),
        ).rejects.toThrow(/FAULTS_FOUND/i);

        expect(paymentsService.issueFullRefundForAuctionInspection).not.toHaveBeenCalled();
        expect(prisma.sale.deleteMany).not.toHaveBeenCalled();
    });

    it('keeps edited scheduled auctions at exactly 24 hours and persists Buy It Now', async () => {
        const futureStart = new Date(Date.now() + 60 * 60_000);
        prisma.auction.findUnique.mockResolvedValue({
            id: 'auction-1',
            listingId: 'listing-1',
            status: 'SCHEDULED',
            startTime: new Date(Date.now() + 30 * 60_000),
            listing: {
                id: 'listing-1',
                sellerId: 'seller-1',
                price: 10000,
            },
        });
        prisma.auction.update.mockResolvedValue({ id: 'auction-1' });

        await service.update(
            'auction-1',
            {
                startTime: futureStart.toISOString(),
                reservePrice: 9000,
                minIncrement: 100,
                buyItNowPrice: 11000,
            } as any,
            'seller-1',
        );

        const updateData = prisma.auction.update.mock.calls[0][0].data;
        expect(updateData.endTime.getTime() - updateData.startTime.getTime())
            .toBe(24 * 60 * 60 * 1000);
        expect(updateData.buyItNowPrice).toBe(11000);
        expect(updateData.startingBid).toBe(7000);
    });
});
