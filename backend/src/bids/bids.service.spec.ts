import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BidsService } from './bids.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('BidsService — incremental bidding', () => {
    let service: BidsService;
    let prisma: any;
    let notificationsService: any;
    let atomicPlacementMock: (...args: any[]) => Promise<any>;

    const auctionListing = {
        id: 'listing-1',
        type: 'AUCTION',
        status: 'ACTIVE',
        deletedAt: null,
        price: 10000,
        sellerId: 'seller-1',
        auction: {
            id: 'auction-1',
            status: 'ACTIVE',
            startingBid: 5000,
            minIncrement: 100,
            reservePrice: 9000,
            startTime: new Date('2026-09-27T10:00:00.000Z'),
            endTime: new Date(Date.now() + 60 * 60 * 1000),
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
            dealerProfile: {
                findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({
                    id: `dealer-${where.userId}`,
                    userId: where.userId,
                    isVerified: true,
                })),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            auction: { update: jest.fn() },
            analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
            $queryRaw: jest.fn(),
            $transaction: jest.fn(async (callback: any) => callback(prisma)),
        };

        atomicPlacementMock = async (...rawArgs: any[]) => {
            // Prisma tagged-template call shape: [strings, listingId, amount,
            // businessBidderId, amount, generatedBidId, businessBidderId, amount].
            const listingId = String(rawArgs[1]);
            const amount = Number(rawArgs[2]);
            const businessBidderId = String(rawArgs[3]);
            const generatedBidId = String(rawArgs[5]);

            const lockedListing = await prisma.listing.findUnique({
                where: { id: listingId },
                include: { auction: true },
            });
            if (!lockedListing) return [];

            const auction = lockedListing.auction;
            const highestBid = auction
                ? await prisma.bid.findFirst({
                    where: {
                        listingId,
                        deletedAt: null,
                        cancelledAt: null,
                        archivedAt: null,
                    },
                    orderBy: { amount: 'desc' },
                })
                : null;

            const startingBid = auction ? Number(auction.startingBid) : 0;
            const reservePrice = auction ? Number(auction.reservePrice) : 0;
            const minIncrement = auction ? Number(auction.minIncrement) : 0;
            const highestAmount = highestBid ? Number(highestBid.amount) : null;
            const minAllowed = highestAmount == null
                ? Math.round(Math.min(startingBid, reservePrice) * 0.70 * 100) / 100
                : Math.round((highestAmount + minIncrement) * 100) / 100;

            let decision = 'OK';
            if (lockedListing.deletedAt) decision = 'NOT_FOUND';
            else if (lockedListing.type !== 'AUCTION') decision = 'NOT_AUCTION';
            else if (!auction) decision = 'NO_AUCTION';
            else if (auction.status !== 'ACTIVE') decision = 'AUCTION_NOT_ACTIVE';
            else if (lockedListing.status !== 'ACTIVE') decision = 'LISTING_NOT_ACTIVE';
            else if (Date.now() >= auction.endTime.getTime()) decision = 'ENDED';
            else if (lockedListing.sellerId === businessBidderId) decision = 'OWN_AUCTION';
            else if (
                highestAmount == null
                && (startingBid <= 0 || reservePrice <= 0)
            ) decision = 'INVALID_PRICES';
            else if (
                highestAmount != null
                && (highestAmount <= 0 || minIncrement <= 0)
            ) decision = 'INVALID_PRICES';
            else if (amount < minAllowed) decision = 'BID_TOO_LOW';

            let bid: any = null;
            let pendingBuyerToCancel: string | null = null;
            let newEndTime: Date | null = null;

            if (decision === 'OK') {
                bid = await prisma.bid.create({
                    data: {
                        listingId,
                        bidderId: businessBidderId,
                        amount,
                    },
                });
                const timestamp = bid.timestamp instanceof Date ? bid.timestamp : new Date(bid.timestamp ?? Date.now());
                bid = {
                    id: bid.id ?? generatedBidId,
                    listingId: bid.listingId ?? listingId,
                    bidderId: bid.bidderId ?? businessBidderId,
                    amount: bid.amount ?? amount,
                    timestamp,
                    createdAt: bid.createdAt ?? timestamp,
                    updatedAt: bid.updatedAt ?? timestamp,
                    deletedAt: bid.deletedAt ?? null,
                    cancelledAt: bid.cancelledAt ?? null,
                    archivedAt: bid.archivedAt ?? null,
                };

                pendingBuyerToCancel = auction.buyItNowPendingBuyerId && amount >= reservePrice
                    ? auction.buyItNowPendingBuyerId
                    : null;
                const timeLeft = auction.endTime.getTime() - timestamp.getTime();
                if (timeLeft > 0 && timeLeft <= 3 * 60 * 1000) {
                    newEndTime = new Date(auction.endTime.getTime() + 3 * 60 * 1000);
                }
                if (pendingBuyerToCancel || newEndTime) {
                    await prisma.auction.update({
                        where: { id: auction.id },
                        data: {
                            ...(pendingBuyerToCancel && {
                                buyItNowPendingBuyerId: null,
                                buyItNowPendingAt: null,
                            }),
                            ...(newEndTime && { endTime: newEndTime }),
                        },
                    });
                }
            }

            return [{
                listing_id: lockedListing.id,
                listing_type: lockedListing.type,
                listing_status: lockedListing.status,
                listing_deleted_at: lockedListing.deletedAt ?? null,
                seller_id: lockedListing.sellerId ?? null,
                listing_title: lockedListing.title ?? '',
                listing_make: lockedListing.make ?? null,
                listing_model: lockedListing.model ?? null,
                listing_year: lockedListing.year ?? null,
                listing_vrm: lockedListing.vrm ?? null,
                listing_price: lockedListing.price ?? 0,
                auction_id: auction?.id ?? null,
                auction_status: auction?.status ?? null,
                start_time: auction?.startTime ?? null,
                end_time: auction?.endTime ?? null,
                starting_bid: auction?.startingBid ?? null,
                reserve_price: auction?.reservePrice ?? null,
                min_increment: auction?.minIncrement ?? null,
                buy_it_now_pending_buyer_id: auction?.buyItNowPendingBuyerId ?? null,
                highest_bid_id: highestBid?.id ?? null,
                highest_bidder_id: highestBid?.bidderId ?? null,
                highest_bid_amount: highestBid?.amount ?? null,
                min_allowed: minAllowed,
                pending_buyer_to_cancel: pendingBuyerToCancel,
                should_extend: Boolean(newEndTime),
                decision_code: decision,
                bid_id: bid?.id ?? null,
                bid_listing_id: bid?.listingId ?? null,
                bid_bidder_id: bid?.bidderId ?? null,
                bid_amount: bid?.amount ?? null,
                bid_timestamp: bid?.timestamp ?? null,
                bid_created_at: bid?.createdAt ?? null,
                bid_updated_at: bid?.updatedAt ?? null,
                bid_deleted_at: bid?.deletedAt ?? null,
                bid_cancelled_at: bid?.cancelledAt ?? null,
                bid_archived_at: bid?.archivedAt ?? null,
                new_end_time: newEndTime,
            }];
        };
        prisma.$queryRaw.mockImplementation(atomicPlacementMock);
        notificationsService = { create: jest.fn().mockResolvedValue(null) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: AuctionGateway,
                    useValue: { broadcastBid: jest.fn(), broadcastBidCancelled: jest.fn() },
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsService,
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

    it('allows the first real dealer offer below the displayed starting bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-first-offer',
            amount: 4500,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        const result = await service.create('bidder-A', {
            listingId: 'listing-1',
            amount: 4500,
        } as any);

        expect(result.id).toBe('bid-first-offer');
        expect(prisma.bid.create).toHaveBeenCalledWith({
            data: {
                listingId: 'listing-1',
                bidderId: 'bidder-A',
                amount: 4500,
            },
        });
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_bid_placed',
                userId: 'bidder-A',
                payload: expect.objectContaining({
                    auction_id: 'auction-1',
                    auction_run_key: 'auction-1:2026-09-27T10:00:00.000Z',
                    bid_id: 'bid-first-offer',
                    amount: 4500,
                    is_first_offer: true,
                    first_offer_floor: 3500,
                    starting_bid: 5000,
                    reserve_price: 9000,
                    percent_below_reserve: 50,
                    percent_below_starting_bid: 10,
                }),
            }),
        });
    });

    it('rejects a first offer more than 30% below the lower of starting bid and reserve', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 3499 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/first offer must be at least £3,500/i) });
    });

    it('uses a lowered reserve instead of the higher starting bid when there are no real bids', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            ...auctionListing,
            auction: {
                ...auctionListing.auction,
                startingBid: 5000,
                reservePrice: 4000,
            },
        });
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-low-reserve',
            amount: 2800,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 2799 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/first offer must be at least £2,800/i) });

        const result = await service.create('bidder-A', {
            listingId: 'listing-1',
            amount: 2800,
        } as any);

        expect(result.id).toBe('bid-low-reserve');
    });

    it('returns to normal increment bidding after the first real bid exists', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue({ id: 'bid-A', amount: 4500 });

        await expect(
            service.create('bidder-B', { listingId: 'listing-1', amount: 4599 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/at least £4,600/i) });
    });

    it('places validation and bid creation in one atomic SQL statement under the auction lock', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-locked',
            amount: 3500,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await service.create('bidder-A', { listingId: 'listing-1', amount: 3500 } as any);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.bid.findFirst).toHaveBeenCalledTimes(1);
        expect(prisma.bid.create).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
            prisma.bid.findFirst.mock.invocationCallOrder[0],
        );
        expect(prisma.bid.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
            prisma.bid.create.mock.invocationCallOrder[0],
        );
    });

    it('forces a simultaneous second first-offer attempt onto the normal increment rule', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve({
            role: 'DEALER',
            firstName: where.id === 'bidder-A' ? 'Alice' : 'Bob',
            lastName: 'Dealer',
        }));

        const storedBids: any[] = [];
        prisma.bid.findFirst.mockImplementation(async () => {
            return storedBids.length
                ? [...storedBids].sort((a, b) => Number(b.amount) - Number(a.amount))[0]
                : null;
        });
        prisma.bid.create.mockImplementation(async ({ data }: any) => {
            const bid = {
                id: `bid-${storedBids.length + 1}`,
                ...data,
                timestamp: new Date(),
            };
            storedBids.push(bid);
            return bid;
        });

        // Unit-test mutex emulates the PostgreSQL advisory lock embedded
        // in the single raw statement: the second statement re-reads the first
        // committed bid before evaluating its own minimum.
        const baseAtomicPlacementMock = atomicPlacementMock;
        let lockTail = Promise.resolve();
        prisma.$queryRaw.mockImplementation(async (...args: any[]) => {
            const previous = lockTail;
            let release!: () => void;
            lockTail = new Promise<void>((resolve) => { release = resolve; });
            await previous;
            try {
                return await baseAtomicPlacementMock(...args);
            } finally {
                release();
            }
        });

        const results = await Promise.allSettled([
            service.create('bidder-A', { listingId: 'listing-1', amount: 3500 } as any),
            service.create('bidder-B', { listingId: 'listing-1', amount: 3500 } as any),
        ]);

        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect(storedBids).toHaveLength(1);
        expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason.message)
            .toMatch(/at least £3,600/i);
    });

    it('rejects a bid that reaches the locked backend after the auction deadline', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            ...auctionListing,
            auction: {
                ...auctionListing.auction,
                endTime: new Date(Date.now() - 1000),
            },
        });
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User' });
        prisma.bid.findFirst.mockResolvedValue(null);

        await expect(
            service.create('bidder-A', { listingId: 'listing-1', amount: 3500 } as any),
        ).rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.bid.create).not.toHaveBeenCalled();
    });

    it('extends the end time inside the same locked transaction for an anti-snipe bid', async () => {
        const endTime = new Date(Date.now() + 2 * 60 * 1000);
        prisma.listing.findUnique.mockResolvedValue({
            ...auctionListing,
            auction: {
                ...auctionListing.auction,
                endTime,
            },
        });
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User' });
        prisma.bid.findFirst.mockResolvedValue(null);
        const timestamp = new Date();
        prisma.bid.create.mockResolvedValue({
            id: 'bid-anti-snipe',
            amount: 3500,
            timestamp,
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await service.create('bidder-A', { listingId: 'listing-1', amount: 3500 } as any);

        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                endTime: new Date(endTime.getTime() + 3 * 60 * 1000),
            }),
        });
    });

    it('clears a pending Buy It Now request when a bid reaches reserve even below the BIN price', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            ...auctionListing,
            auction: {
                ...auctionListing.auction,
                reservePrice: 9000,
                buyItNowPrice: 12000,
                buyItNowPendingBuyerId: 'bin-buyer',
                buyItNowPendingAt: new Date(),
            },
        });
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User' });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-reserve',
            amount: 9000,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await service.create('bidder-A', { listingId: 'listing-1', amount: 9000 } as any);

        expect(prisma.auction.update).toHaveBeenCalledWith({
            where: { id: 'auction-1' },
            data: expect.objectContaining({
                buyItNowPendingBuyerId: null,
                buyItNowPendingAt: null,
            }),
        });
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'bin-buyer',
                title: 'Buy It Now request cancelled',
            }),
        );
        expect((service as any).auctionGateway.broadcastBid).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({
                bidId: 'bid-reserve',
                buyItNowCancelled: true,
            }),
        );
    });

    it('notifies the seller when the new highest bid is below reserve and can be accepted', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-offer',
            amount: 7000,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await service.create('bidder-A', { listingId: 'listing-1', amount: 7000 } as any);

        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                type: 'AUCTION_OFFER_RECEIVED',
                entityType: 'AUCTION',
                entityId: 'auction-1',
                actionType: 'ACCEPT_OR_WAIT',
                data: expect.objectContaining({
                    bidId: 'bid-offer',
                    amount: 7000,
                    reservePrice: 9000,
                    belowReserve: true,
                }),
            }),
        );
    });

    it('does not send a below-reserve offer notification once the reserve is met', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({ role: 'DEALER', firstName: 'Test', lastName: 'User', dealerProfile: { isVerified: true } });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockResolvedValue({
            id: 'bid-reserve',
            amount: 9000,
            timestamp: new Date(),
            listingId: 'listing-1',
            bidderId: 'bidder-A',
        });

        await service.create('bidder-A', { listingId: 'listing-1', amount: 9000 } as any);

        expect(notificationsService.create).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'AUCTION_OFFER_RECEIVED' }),
        );
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

    it('records a verified SALES_AGENT bid against the dealership owner identity', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({
            role: 'DEALER',
            firstName: 'Sally',
            lastName: 'Sales',
        });
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        prisma.dealerStaff.findFirst.mockResolvedValue({
            role: 'SALES_AGENT',
            dealerProfile: {
                id: 'dealer-1',
                userId: 'owner-1',
                isVerified: true,
            },
        });
        prisma.bid.findFirst.mockResolvedValue(null);
        prisma.bid.create.mockImplementation(({ data }: any) => Promise.resolve({
            id: 'bid-staff',
            ...data,
            timestamp: new Date(),
        }));

        await service.create('sales-1', {
            listingId: 'listing-1',
            amount: 7000,
        } as any);

        expect(prisma.bid.create).toHaveBeenCalledWith({
            data: {
                listingId: 'listing-1',
                bidderId: 'owner-1',
                amount: 7000,
            },
        });
    });

    it('blocks a FINANCE_MANAGER from placing a dealership bid', async () => {
        prisma.listing.findUnique.mockResolvedValue(auctionListing);
        prisma.user.findUnique.mockResolvedValue({
            role: 'DEALER',
            firstName: 'Fran',
            lastName: 'Finance',
        });
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
            service.create('finance-1', {
                listingId: 'listing-1',
                amount: 7000,
            } as any),
        ).rejects.toThrow(/does not allow auction bidding/i);

        expect(prisma.bid.create).not.toHaveBeenCalled();
    });
});

describe('BidsService — cancelBid', () => {
    let service: BidsService;
    let prisma: any;
    let auctionGateway: any;
    let notificationsService: any;

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
            dealerProfile: {
                findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({
                    id: `dealer-${where.userId}`,
                    userId: where.userId,
                    isVerified: true,
                })),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
            $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
            $transaction: jest.fn(async (callback: any) => callback(prisma)),
        };
        auctionGateway = {
            broadcastBid: jest.fn(),
            broadcastBidCancelled: jest.fn(),
        };
        notificationsService = { create: jest.fn().mockResolvedValue(null) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: AuctionGateway,
                    useValue: auctionGateway,
                },
                {
                    provide: NotificationsService,
                    useValue: notificationsService,
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
            title: 'Test vehicle',
            sellerId: 'seller-1',
            status: 'ACTIVE',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                startingBid: 7000,
                reservePrice: 6000,
            },
        });
        prisma.bid.findFirst
            .mockResolvedValueOnce(mockBid)
            .mockResolvedValueOnce(null);
        prisma.bid.count.mockResolvedValue(0);
        prisma.bid.update.mockResolvedValue({ ...mockBid, cancelledAt: new Date() });

        await expect(
            (service as any).cancelBid('bid-1', 'owner-user'),
        ).resolves.toBeUndefined();

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
        expect(prisma.bid.update).toHaveBeenCalledWith({
            where: { id: 'bid-1' },
            data: { cancelledAt: expect.any(Date) },
        });
        expect(auctionGateway.broadcastBidCancelled).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({
                auctionId: 'auction-1',
                bidId: 'bid-1',
                highestActiveBid: null,
                highestActiveBidId: null,
                highestActiveBidderId: null,
                activeBidCount: 0,
                reserveMet: false,
            }),
        );
    });

    it('returns to the 30% zero-bid floor when the final active bid is cancelled', async () => {
        const mockBid = {
            id: 'bid-only',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        prisma.bid.findUnique.mockResolvedValue(mockBid);
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            title: 'BMW M3',
            year: 2022,
            make: 'BMW',
            model: 'M3',
            sellerId: 'seller-1',
            status: 'ACTIVE',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                startingBid: 7000,
                reservePrice: 6000,
            },
        });
        prisma.bid.findFirst
            .mockResolvedValueOnce(mockBid)
            .mockResolvedValueOnce(null);
        prisma.bid.count.mockResolvedValue(0);

        await service.cancelBid('bid-only', 'owner-user');

        expect(auctionGateway.broadcastBidCancelled).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({
                activeBidCount: 0,
                highestActiveBid: null,
                firstOfferFloor: 4200,
                reserveMet: false,
            }),
        );
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                title: 'Highest auction bid cancelled',
                message: expect.stringMatching(/first offers can be made from £4,200/i),
            }),
        );
        expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                type: 'auction_bid_cancelled',
                userId: 'owner-user',
                payload: expect.objectContaining({
                    auction_id: 'auction-1',
                    cancelled_bid_id: 'bid-only',
                    active_bid_count_after: 0,
                    first_offer_floor_after: 4200,
                    reserve_met_after: false,
                }),
            }),
        });
    });

    it('drops reserve-met state to the next real bid when the highest bid is cancelled', async () => {
        const cancelledBid = {
            id: 'bid-high',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 10000,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        const nextBid = {
            id: 'bid-next',
            bidderId: 'dealer-2',
            listingId: 'listing-1',
            amount: 8500,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        prisma.bid.findUnique.mockResolvedValue(cancelledBid);
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            title: 'BMW M3',
            year: 2022,
            make: 'BMW',
            model: 'M3',
            sellerId: 'seller-1',
            status: 'ACTIVE',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                startingBid: 7000,
                reservePrice: 9000,
            },
        });
        prisma.bid.findFirst
            .mockResolvedValueOnce(cancelledBid)
            .mockResolvedValueOnce(nextBid);
        prisma.bid.count.mockResolvedValue(1);

        await service.cancelBid('bid-high', 'owner-user');

        expect(auctionGateway.broadcastBidCancelled).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({
                highestActiveBid: 8500,
                highestActiveBidId: 'bid-next',
                highestActiveBidderId: 'dealer-2',
                activeBidCount: 1,
                reserveMet: false,
                firstOfferFloor: null,
            }),
        );
        expect(notificationsService.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'seller-1',
                title: 'Reserve is no longer met',
                data: expect.objectContaining({
                    highestActiveBid: 8500,
                    highestActiveBidId: 'bid-next',
                    reserveMet: false,
                }),
            }),
        );
    });

    it('does not change the current leader when a lower historical bid is cancelled', async () => {
        const lowerBid = {
            id: 'bid-lower',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        const highestBid = {
            id: 'bid-high',
            bidderId: 'dealer-2',
            listingId: 'listing-1',
            amount: 9500,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        prisma.bid.findUnique.mockResolvedValue(lowerBid);
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'seller-1',
            status: 'ACTIVE',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime: new Date(Date.now() + 60 * 60 * 1000),
                startingBid: 7000,
                reservePrice: 9000,
            },
        });
        prisma.bid.findFirst
            .mockResolvedValueOnce(highestBid)
            .mockResolvedValueOnce(highestBid);
        prisma.bid.count.mockResolvedValue(1);

        await service.cancelBid('bid-lower', 'owner-user');

        expect(auctionGateway.broadcastBidCancelled).toHaveBeenCalledWith(
            'auction-1',
            expect.objectContaining({
                highestActiveBid: 9500,
                highestActiveBidId: 'bid-high',
                activeBidCount: 1,
                reserveMet: true,
            }),
        );
        expect(notificationsService.create).not.toHaveBeenCalled();
    });

    it('rejects cancelling a bid after the auction deadline even before lifecycle finalisation', async () => {
        const bid = {
            id: 'bid-ended',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: null,
            createdAt: new Date(),
        };
        prisma.bid.findUnique.mockResolvedValue(bid);
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'seller-1',
            status: 'ACTIVE',
            auction: {
                id: 'auction-1',
                status: 'ACTIVE',
                endTime: new Date(Date.now() - 1000),
                startingBid: 7000,
                reservePrice: 9000,
            },
        });

        await expect(service.cancelBid('bid-ended', 'owner-user'))
            .rejects.toMatchObject({ message: expect.stringMatching(/auction has ended/i) });

        expect(prisma.bid.update).not.toHaveBeenCalled();
        expect(auctionGateway.broadcastBidCancelled).not.toHaveBeenCalled();
    });

    it('rejects cancelling a bid archived from a previous auction run', async () => {
        prisma.bid.findUnique.mockResolvedValue({
            id: 'bid-old',
            bidderId: 'owner-user',
            listingId: 'listing-1',
            amount: 7000,
            cancelledAt: null,
            deletedAt: null,
            archivedAt: new Date(),
            createdAt: new Date(),
        });

        await expect(
            service.cancelBid('bid-old', 'owner-user'),
        ).rejects.toMatchObject({ message: expect.stringMatching(/previous auction/i) });

        expect(prisma.listing.findUnique).not.toHaveBeenCalled();
        expect(prisma.bid.update).not.toHaveBeenCalled();
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
            dealerProfile: {
                findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({
                    id: `dealer-${where.userId}`,
                    userId: where.userId,
                    isVerified: true,
                })),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            $queryRaw: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BidsService,
                { provide: PrismaService, useValue: prisma },
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

        expect(prisma.bid.findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({
                    bidderId: 'dealer-1',
                    archivedAt: null,
                }),
            }),
        );
        expect(prisma.bid.findMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: expect.objectContaining({
                    archivedAt: null,
                }),
            }),
        );
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
