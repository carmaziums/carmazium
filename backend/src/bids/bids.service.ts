import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { Bid } from '@prisma/client';

@Injectable()
export class BidsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Place a bid on a listing
     */
    async create(bidderId: string, createBidDto: CreateBidDto): Promise<Bid> {
        // Verify listing exists and is an auction
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

        // Check bid is higher than current highest
        const highestBid = await this.prisma.bid.findFirst({
            where: { listingId: createBidDto.listingId, deletedAt: null },
            orderBy: { amount: 'desc' },
        });

        const minBid = listing.auction?.startingBid || listing.price;
        const minIncrement = listing.auction?.minIncrement || 100;

        if (highestBid && createBidDto.amount <= Number(highestBid.amount)) {
            throw new BadRequestException(`Bid must be higher than current highest bid of £${highestBid.amount}`);
        }

        if (!highestBid && createBidDto.amount < Number(minBid)) {
            throw new BadRequestException(`Bid must be at least the starting bid of £${minBid}`);
        }

        // Create the bid
        const bid = await this.prisma.bid.create({
            data: {
                listingId: createBidDto.listingId,
                bidderId,
                amount: createBidDto.amount,
            },
        });

        return bid;
    }

    /**
     * Get all bids for the current user
     */
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
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bid.count({ where: { bidderId, deletedAt: null } }),
        ]);

        // Add bid status (winning/outbid)
        const enrichedBids = await Promise.all(
            bids.map(async (bid) => {
                const highestBid = await this.prisma.bid.findFirst({
                    where: { listingId: bid.listingId, deletedAt: null },
                    orderBy: { amount: 'desc' },
                });
                return {
                    ...bid,
                    isWinning: highestBid?.id === bid.id,
                };
            })
        );

        return { data: enrichedBids, total };
    }

    /**
     * Get all bids for a specific listing
     */
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

    /**
     * Get buyer dashboard stats
     */
    async getBuyerStats(userId: string): Promise<{
        activeBids: number;
        wonAuctions: number;
        watchlistCount: number;
        totalSpent: number;
    }> {
        const [activeBids, wonAuctions] = await Promise.all([
            this.prisma.bid.count({
                where: { bidderId: userId, deletedAt: null },
            }),
            // Won auctions = listings where user has highest bid and status is SOLD
            this.prisma.$queryRaw<{ count: bigint }[]>`
                SELECT COUNT(DISTINCT l.id) as count
                FROM listings l
                JOIN bids b ON b."listingId" = l.id
                WHERE l.status = 'SOLD'
                AND b."bidderId" = ${userId}::uuid
                AND b.amount = (
                    SELECT MAX(b2.amount) FROM bids b2 WHERE b2."listingId" = l.id
                )
            `,
        ]);

        // For now, watchlist count is 0 (we'll implement watchlist separately)
        const watchlistCount = 0;

        // Total spent from won auctions
        const totalSpent = 0; // Will be calculated from transactions later

        return {
            activeBids,
            wonAuctions: Number(wonAuctions[0]?.count || 0),
            watchlistCount,
            totalSpent,
        };
    }
}
