import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    forwardRef,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuctionsService } from '../auctions/auctions.service';
import { AuctionGateway } from '../auctions/auction.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { Bid } from '@prisma/client';

@Injectable()
export class BidsService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => AuctionsService))
        private readonly auctionsService: AuctionsService,
        @Inject(forwardRef(() => AuctionGateway))
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

        // Prevent seller from bidding on their own auction
        if (listing.sellerId === bidderId) {
            throw new BadRequestException('You cannot bid on your own auction');
        }

        // Role must still be DEALER and KYC-verified — having a past dealerProfile after a role switch is not enough
        const bidder = await this.prisma.user.findUnique({
            where: { id: bidderId },
            select: { role: true, firstName: true, lastName: true, dealerProfile: { select: { isVerified: true } } },
        });
        if (bidder?.role !== 'DEALER' || !bidder?.dealerProfile?.isVerified) {
            throw new ForbiddenException('Only verified dealers can place bids on auctions.');
        }

        const minIncrement = Number(auction.minIncrement);
        const startingBid = Number(auction.startingBid);

        const highestBid = await this.prisma.bid.findFirst({
            where: { listingId: createBidDto.listingId, deletedAt: null },
            orderBy: { amount: 'desc' },
        });

        if (highestBid) {
            const minAllowed = Number(highestBid.amount) + minIncrement;
            if (createBidDto.amount < minAllowed) {
                throw new BadRequestException(
                    `Bid must be at least £${minAllowed.toLocaleString()} (current: £${Number(highestBid.amount).toLocaleString()} + £${minIncrement.toLocaleString()} increment)`,
                );
            }
        } else {
            if (createBidDto.amount < startingBid) {
                throw new BadRequestException(
                    `Bid must be at least the starting bid of £${startingBid.toLocaleString()}`,
                );
            }
        }

        const bid = await this.prisma.bid.create({
            data: {
                listingId: createBidDto.listingId,
                bidderId,
                amount: createBidDto.amount,
            },
        });

        // Notify the displaced highest bidder they've been outbid
        if (highestBid && highestBid.bidderId !== bidderId) {
            this.notificationsService.create({
                userId:     highestBid.bidderId,
                type:       'OUTBID',
                title:      "You've been outbid",
                message:    `A new bid of £${createBidDto.amount.toLocaleString()} was placed on ${listing.make} ${listing.model}. Bid again to stay in the lead.`,
                entityType: 'AUCTION',
                entityId:   auction.id,
                link:       `/auction/${auction.id}`,
            }).catch(() => { /* notification failure must not fail the bid */ });
        }

        // Anti-snipe: extend auction if bid placed in the final window
        const updatedAuction = await this.auctionsService.maybeExtend(auction.id, bid.timestamp);

        const initials = `${bidder?.firstName?.[0] ?? '?'}${bidder?.lastName?.[0] ?? ''}`.toUpperCase();

        // Broadcast to all viewers of this auction via WebSocket
        this.auctionGateway.broadcastBid(auction.id, {
            bidId: bid.id,
            auctionId: auction.id,
            listingId: bid.listingId,
            amount: Number(bid.amount),
            bidderInitials: initials,
            bidderId,
            timestamp: bid.timestamp.toISOString(),
            newEndTime: updatedAuction?.endTime?.toISOString(),
        });

        return bid;
    }

    async findMyBids(bidderId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
        const skip = (page - 1) * limit;

        const [bids, total] = await Promise.all([
            this.prisma.bid.findMany({
                where: { bidderId, deletedAt: null },
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
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bid.count({ where: { bidderId, deletedAt: null } }),
        ]);

        const listingIds = [...new Set(bids.map(b => b.listingId))];
        const topBids = await this.prisma.bid.findMany({
            where: { listingId: { in: listingIds }, deletedAt: null },
            orderBy: { amount: 'desc' },
            distinct: ['listingId'],
            select: { id: true, listingId: true },
        });
        const winningMap = new Map(topBids.map(b => [b.listingId, b.id]));
        const enrichedBids = bids.map(bid => ({
            ...bid,
            isWinning: winningMap.get(bid.listingId) === bid.id,
        }));

        return { data: enrichedBids, total };
    }

    async findByListing(listingId: string): Promise<Bid[]> {
        return this.prisma.bid.findMany({
            where: { listingId, deletedAt: null },
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
        const [activeBids, wonAuctions, watchlistCount, totalSpentAgg] = await Promise.all([
            // Bids placed on currently ACTIVE auctions only
            this.prisma.bid.count({
                where: {
                    bidderId: userId,
                    deletedAt: null,
                    listing: { auction: { status: 'ACTIVE' } },
                },
            }),
            this.prisma.auction.count({
                where: { winnerId: userId, status: 'ENDED' },
            }),
            this.prisma.watchlistItem.count({
                where: { userId },
            }),
            // Sum of soldPrice for all purchases where this user is the buyer
            this.prisma.sale.aggregate({
                where: { buyerId: userId },
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
