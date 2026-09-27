import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { Bid } from '@prisma/client';
import { calculateMinimumAuctionBid } from '../auctions/auction-pricing';
import {
    assertDealerPermission,
    resolveBusinessBuyerId,
    resolveDealerActor,
} from '../dealers/dealer-access';

const BID_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const ANTI_SNIPE_WINDOW_MS = 3 * 60 * 1000;

@Injectable()
export class BidsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auctionGateway: AuctionGateway,
        private readonly notificationsService: NotificationsService,
    ) { }

    async create(bidderId: string, createBidDto: CreateBidDto): Promise<Bid> {
        const listing = await this.prisma.listing.findUnique({
            where: { id: createBidDto.listingId },
            include: { auction: true },
        });

        if (!listing || listing.deletedAt) {
            throw new NotFoundException('Listing not found');
        }

        if (listing.type !== 'AUCTION') {
            throw new BadRequestException('This listing is not an auction');
        }

        const auction = listing.auction;
        if (!auction) {
            throw new BadRequestException('No auction has been created for this listing');
        }

        if (auction.status !== 'ACTIVE') {
            throw new BadRequestException('This auction is not currently active');
        }

        // A dealer staff member bids as the dealership, not as a shadow
        // personal buyer. This keeps the auction winner, purchase and buyer fee
        // attached to one canonical business identity.
        const bidder = await this.prisma.user.findUnique({
            where: { id: bidderId },
            select: { role: true, firstName: true, lastName: true },
        });
        if (bidder?.role !== 'DEALER') {
            throw new ForbiddenException('Only verified dealers can place bids on auctions.');
        }

        const dealerActor = await resolveDealerActor(this.prisma, bidderId);
        if (!dealerActor?.isVerified) {
            throw new ForbiddenException('Only verified dealers can place bids on auctions.');
        }
        assertDealerPermission(
            dealerActor,
            'PLACE_BID',
            'Your dealership role does not allow auction bidding.',
        );
        const businessBidderId = dealerActor.ownerUserId;

        // Staff acting for the seller's own dealership still cannot bid against
        // that dealership's vehicle.
        if (listing.sellerId === businessBidderId) {
            throw new BadRequestException('You cannot bid on your own auction');
        }

        // Serialize the critical bid-validation + insert path per listing.
        //
        // Without this lock, two dealers can both read "no active bids" at the
        // same time and both pass the first-offer floor before either insert is
        // visible to the other. PostgreSQL transaction-scoped advisory locks
        // make one bidder wait, then force the second bidder to re-read the
        // current highest bid and obey the normal increment rule.
        const placement = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${createBidDto.listingId}, 0))`;

            // Re-read inside the lock. The auction may have been cancelled,
            // activated, or repriced after the initial request validation.
            const lockedListing = await tx.listing.findUnique({
                where: { id: createBidDto.listingId },
                include: { auction: true },
            });

            if (!lockedListing || lockedListing.deletedAt) {
                throw new NotFoundException('Listing not found');
            }
            if (lockedListing.type !== 'AUCTION') {
                throw new BadRequestException('This listing is not an auction');
            }

            const lockedAuction = lockedListing.auction;
            if (!lockedAuction) {
                throw new BadRequestException('No auction has been created for this listing');
            }
            if (lockedAuction.status !== 'ACTIVE') {
                throw new BadRequestException('This auction is not currently active');
            }

            const bidReceivedAt = new Date();
            if (bidReceivedAt.getTime() >= lockedAuction.endTime.getTime()) {
                throw new BadRequestException('This auction has ended and is no longer accepting bids');
            }

            if (lockedListing.sellerId === businessBidderId) {
                throw new BadRequestException('You cannot bid on your own auction');
            }

            const minIncrement = Number(lockedAuction.minIncrement);
            const startingBid = Number(lockedAuction.startingBid);
            const reservePrice = Number(lockedAuction.reservePrice);

            const highestBid = await tx.bid.findFirst({
                where: {
                    listingId: createBidDto.listingId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                },
                orderBy: { amount: 'desc' },
            });

            let minAllowed: number;
            try {
                minAllowed = calculateMinimumAuctionBid({
                    startingBid,
                    reservePrice,
                    minIncrement,
                    highestActiveBid: highestBid ? Number(highestBid.amount) : null,
                });
            } catch {
                throw new BadRequestException('This auction does not have valid bidding prices');
            }

            if (createBidDto.amount < minAllowed) {
                if (highestBid) {
                    throw new BadRequestException(
                        `Bid must be at least £${minAllowed.toLocaleString()} (current: £${Number(highestBid.amount).toLocaleString()} + £${minIncrement.toLocaleString()} increment)`,
                    );
                }

                const referencePrice = Math.min(startingBid, reservePrice);
                throw new BadRequestException(
                    `First offer must be at least £${minAllowed.toLocaleString()} (30% below the lower of the £${startingBid.toLocaleString()} starting bid and £${reservePrice.toLocaleString()} reserve; reference £${referencePrice.toLocaleString()})`,
                );
            }

            const bid = await tx.bid.create({
                data: {
                    listingId: createBidDto.listingId,
                    bidderId: businessBidderId,
                    amount: createBidDto.amount,
                },
            });

            let pendingBuyerId: string | null = null;
            if (
                lockedAuction.buyItNowPrice &&
                (lockedAuction as any).buyItNowPendingBuyerId &&
                createBidDto.amount >= Number(lockedAuction.buyItNowPrice)
            ) {
                pendingBuyerId = (lockedAuction as any).buyItNowPendingBuyerId as string;
            }

            // Anti-snipe extension is part of the same locked transaction as the
            // bid itself. This prevents the lifecycle closer from ending the
            // auction in the tiny gap between bid commit and end-time extension.
            const bidPlacedAt = bid.timestamp instanceof Date ? bid.timestamp : new Date(bid.timestamp);
            const timeLeft = lockedAuction.endTime.getTime() - bidPlacedAt.getTime();
            const shouldExtend = timeLeft > 0 && timeLeft <= ANTI_SNIPE_WINDOW_MS;
            const newEndTime = shouldExtend
                ? new Date(lockedAuction.endTime.getTime() + ANTI_SNIPE_WINDOW_MS)
                : null;

            if (pendingBuyerId || newEndTime) {
                await tx.auction.update({
                    where: { id: lockedAuction.id },
                    data: {
                        ...(pendingBuyerId && {
                            buyItNowPendingBuyerId: null,
                            buyItNowPendingAt: null,
                        }),
                        ...(newEndTime && { endTime: newEndTime }),
                    },
                });
            }

            return {
                bid,
                highestBid,
                lockedListing,
                lockedAuction,
                reservePrice,
                pendingBuyerId,
                newEndTime,
            };
        });

        const {
            bid,
            highestBid,
            lockedListing,
            lockedAuction,
            reservePrice,
            pendingBuyerId,
            newEndTime,
        } = placement;

        if (pendingBuyerId) {
            this.notificationsService.create({
                userId: pendingBuyerId,
                type: 'AUCTION_ENDED',
                title: 'Buy It Now request cancelled',
                message: `A new bid cancelled your Buy It Now request on ${lockedListing.make} ${lockedListing.model}.`,
                entityType: 'AUCTION',
                entityId: lockedAuction.id,
                link: `/auctions/live/${lockedAuction.id}`,
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        // Every new highest bid below reserve is a real provisional offer.
        // Notify the seller immediately so they can accept the current highest
        // offer or simply leave the auction running for more competition.
        const bidAmount = Number(bid.amount);
        if (lockedListing.sellerId && bidAmount < reservePrice) {
            const vehicle = [lockedListing.year, lockedListing.make, lockedListing.model].filter(Boolean).join(' ') || lockedListing.title;
            this.notificationsService.create({
                userId: lockedListing.sellerId,
                type: 'AUCTION_OFFER_RECEIVED',
                title: 'New auction offer received',
                message: `Highest offer: £${bidAmount.toLocaleString('en-GB')} on ${vehicle}. Your reserve is £${reservePrice.toLocaleString('en-GB')}. Accept it now or keep the auction running.`,
                entityType: 'AUCTION',
                entityId: lockedAuction.id,
                actionType: 'ACCEPT_OR_WAIT',
                link: `/auctions/live/${lockedAuction.id}?sellerOffer=${bid.id}`,
                data: {
                    listingId: lockedListing.id,
                    bidId: bid.id,
                    amount: bidAmount,
                    reservePrice,
                    belowReserve: true,
                },
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        // Notify the displaced highest bidder they've been outbid
        if (highestBid && highestBid.bidderId !== businessBidderId) {
            this.notificationsService.create({
                userId:     highestBid.bidderId,
                type:       'OUTBID',
                title:      "You've been outbid",
                message:    `A new bid of £${createBidDto.amount.toLocaleString()} was placed on ${lockedListing.make} ${lockedListing.model}. Bid again to stay in the lead.`,
                entityType: 'AUCTION',
                entityId:   lockedAuction.id,
                link:       `/auctions/live/${lockedAuction.id}`,
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        const initials = `${bidder?.firstName?.[0] ?? '?'}${bidder?.lastName?.[0] ?? ''}`.toUpperCase();

        // Broadcast to all viewers of this auction via WebSocket
        this.auctionGateway.broadcastBid(lockedAuction.id, {
            bidId: bid.id,
            auctionId: lockedAuction.id,
            listingId: bid.listingId,
            amount: Number(bid.amount),
            bidderInitials: initials,
            bidderId: businessBidderId,
            timestamp: bid.timestamp.toISOString(),
            newEndTime: newEndTime?.toISOString(),
        });

        return bid;
    }

    async cancelBid(bidId: string, bidderId: string): Promise<void> {
        const actor = await resolveDealerActor(this.prisma, bidderId);
        if (actor) {
            assertDealerPermission(
                actor,
                'PLACE_BID',
                'Your dealership role does not allow auction bidding.',
            );
        }
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);
        const bid = await this.prisma.bid.findUnique({ where: { id: bidId } });

        if (!bid || bid.bidderId !== businessBidderId) {
            throw new ForbiddenException('Not your bid');
        }

        if (bid.archivedAt) {
            throw new BadRequestException('This bid belongs to a previous auction and can no longer be cancelled');
        }

        if (bid.cancelledAt || bid.deletedAt) {
            throw new BadRequestException('Bid already cancelled');
        }

        if (Date.now() - bid.createdAt.getTime() > BID_CANCEL_WINDOW_MS) {
            throw new BadRequestException('Cancel window has expired (24 hours)');
        }

        const listing = await this.prisma.listing.findUnique({
            where: { id: bid.listingId },
            include: { auction: true },
        });

        if (!listing?.auction || listing.auction.status !== 'ACTIVE') {
            throw new BadRequestException('Cannot cancel a bid on an auction that is not ACTIVE');
        }

        await this.prisma.bid.update({
            where: { id: bidId },
            data: { cancelledAt: new Date() },
        });

        this.auctionGateway.broadcastBidCancelled(listing.auction.id, bidId);
    }

    async findMyActiveAuctionPositions(bidderId: string): Promise<any[]> {
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);
        const myBids = await this.prisma.bid.findMany({
            where: {
                bidderId: businessBidderId,
                deletedAt: null,
                cancelledAt: null,
                archivedAt: null,
                listing: {
                    auction: { status: 'ACTIVE' },
                },
            },
            include: {
                listing: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: true,
                        make: true,
                        model: true,
                        year: true,
                        mileage: true,
                        sellerId: true,
                        auction: {
                            select: {
                                id: true,
                                status: true,
                                endTime: true,
                                minIncrement: true,
                                startingBid: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (myBids.length === 0) return [];

        // A trader can bid several times on the same vehicle. The dashboard
        // needs one position per auction, so keep the trader's highest active
        // bid for each listing rather than rendering duplicate bid-history rows.
        const myHighestByListing = new Map<string, any>();
        for (const bid of myBids) {
            const existing = myHighestByListing.get(bid.listingId);
            if (!existing || Number(bid.amount) > Number(existing.amount)) {
                myHighestByListing.set(bid.listingId, bid);
            }
        }

        const listingIds = [...myHighestByListing.keys()];
        const allLiveBids = await this.prisma.bid.findMany({
            where: {
                listingId: { in: listingIds },
                deletedAt: null,
                cancelledAt: null,
                archivedAt: null,
            },
            select: {
                id: true,
                listingId: true,
                bidderId: true,
                amount: true,
                createdAt: true,
            },
            orderBy: { amount: 'desc' },
        });

        const highestByListing = new Map<string, any>();
        const bidCountByListing = new Map<string, number>();
        for (const bid of allLiveBids) {
            bidCountByListing.set(
                bid.listingId,
                (bidCountByListing.get(bid.listingId) ?? 0) + 1,
            );
            if (!highestByListing.has(bid.listingId)) {
                highestByListing.set(bid.listingId, bid);
            }
        }

        return [...myHighestByListing.values()]
            .map((myBid) => {
                const auction = myBid.listing.auction;
                const highest = highestByListing.get(myBid.listingId);
                const currentHighestBid = highest ? Number(highest.amount) : Number(myBid.amount);
                const minIncrement = Number(auction?.minIncrement ?? 0);
                const createdAt = myBid.createdAt instanceof Date
                    ? myBid.createdAt
                    : new Date(myBid.createdAt);
                const cancelDeadline = new Date(createdAt.getTime() + BID_CANCEL_WINDOW_MS);

                return {
                    listingId: myBid.listingId,
                    auctionId: auction?.id,
                    listing: myBid.listing,
                    myHighestBid: Number(myBid.amount),
                    myBidId: myBid.id,
                    myBidCreatedAt: createdAt,
                    currentHighestBid,
                    isLeading: highest?.bidderId === businessBidderId,
                    nextMinimumBid: currentHighestBid + minIncrement,
                    bidCount: bidCountByListing.get(myBid.listingId) ?? 0,
                    canCancelCurrentBid: Date.now() < cancelDeadline.getTime(),
                    cancelDeadline,
                    endTime: auction?.endTime,
                };
            })
            .sort((a, b) => {
                const aEnd = a.endTime ? new Date(a.endTime).getTime() : Number.MAX_SAFE_INTEGER;
                const bEnd = b.endTime ? new Date(b.endTime).getTime() : Number.MAX_SAFE_INTEGER;
                return aEnd - bEnd;
            });
    }

    async findMyBids(bidderId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const businessBidderId = await resolveBusinessBuyerId(this.prisma, bidderId);
        const skip = (page - 1) * limit;

        const [bids, total] = await Promise.all([
            this.prisma.bid.findMany({
                where: { bidderId: businessBidderId, deletedAt: null, cancelledAt: null },
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            images: true,
                            price: true,
                            status: true,
                            make: true,
                            model: true,
                            year: true,
                            sellerId: true,
                            auction: {
                                select: {
                                    id: true,
                                    status: true,
                                    endTime: true,
                                    winnerId: true,
                                    winningBidAmount: true,
                                    wonAt: true,
                                    buyerFeePaid: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bid.count({ where: { bidderId: businessBidderId, deletedAt: null, cancelledAt: null } }),
        ]);

        const listingIds = [...new Set(bids.map(b => b.listingId))];
        const topBids = await this.prisma.bid.findMany({
            where: { listingId: { in: listingIds }, deletedAt: null, cancelledAt: null, archivedAt: null },
            orderBy: { amount: 'desc' },
            distinct: ['listingId'],
            select: { id: true, listingId: true },
        });
        const winningMap = new Map(topBids.map(b => [b.listingId, b.id]));
        const enrichedBids = bids.map(bid => ({
            ...bid,
            isArchived: Boolean(bid.archivedAt),
            isWinning: !bid.archivedAt && winningMap.get(bid.listingId) === bid.id,
        }));

        return { data: enrichedBids, total };
    }

    async findByListing(listingId: string): Promise<Bid[]> {
        return this.prisma.bid.findMany({
            where: { listingId, deletedAt: null, cancelledAt: null, archivedAt: null },
            include: {
                bidder: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { amount: 'desc' },
        });
    }

    async getBuyerStats(userId: string): Promise<{
        activeBids: number;
        wonAuctions: number;
        watchlistCount: number;
        totalSpent: number;
    }> {
        const businessBuyerId = await resolveBusinessBuyerId(this.prisma, userId);
        const [activeBids, wonAuctions, watchlistCount, totalSpentAgg] = await Promise.all([
            // Bids placed on currently ACTIVE auctions only
            this.prisma.bid.count({
                where: {
                    bidderId: businessBuyerId,
                    deletedAt: null,
                    cancelledAt: null,
                    archivedAt: null,
                    listing: { auction: { status: 'ACTIVE' } },
                },
            }),
            this.prisma.auction.count({
                where: { winnerId: businessBuyerId, status: 'ENDED' },
            }),
            this.prisma.watchlistItem.count({
                where: { userId },
            }),
            // Sum of soldPrice for all purchases where this user is the buyer
            this.prisma.sale.aggregate({
                where: { buyerId: businessBuyerId },
                _sum: { soldPrice: true },
            }),
        ]);

        return {
            activeBids,
            wonAuctions,
            watchlistCount,
            totalSpent: Number(totalSpentAgg._sum.soldPrice ?? 0),
        };
    }
}
