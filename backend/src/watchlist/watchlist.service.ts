import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingStatus, ListingType } from '@prisma/client';

const RETAIL_SAVED_STATUSES: ListingStatus[] = [
    ListingStatus.ACTIVE,
    ListingStatus.SOLD,
    ListingStatus.OFFER_ACCEPTED,
];

@Injectable()
export class WatchlistService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Add a listing to user's watchlist
     */
    async add(userId: string, listingId: string) {
        // Check if listing exists
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: { id: true, type: true, status: true, deletedAt: true },
        });

        // Generic Saved Cars is a RETAIL surface. Do not disclose whether a
        // supplied ID belongs to trade-only auction inventory or a private
        // draft/rejected row; expose the same not-found response instead.
        if (!listing || listing.deletedAt ||
            listing.type !== ListingType.CLASSIFIED ||
            !RETAIL_SAVED_STATUSES.includes(listing.status)) {
            throw new NotFoundException('Listing not found');
        }

        // Check if already in watchlist
        const existing = await this.prisma.watchlistItem.findUnique({
            where: {
                userId_listingId: { userId, listingId },
            },
        });

        if (existing) {
            throw new ConflictException('Listing already in watchlist');
        }

        return this.prisma.watchlistItem.create({
            data: { userId, listingId },
            include: { listing: true },
        });
    }

    /**
     * Remove a listing from user's watchlist
     */
    async remove(userId: string, listingId: string) {
        const item = await this.prisma.watchlistItem.findUnique({
            where: {
                userId_listingId: { userId, listingId },
            },
            include: {
                listing: {
                    select: { type: true, status: true, deletedAt: true },
                },
            },
        });

        if (!item || item.listing.deletedAt ||
            item.listing.type !== ListingType.CLASSIFIED ||
            !RETAIL_SAVED_STATUSES.includes(item.listing.status)) {
            throw new NotFoundException('Listing not in watchlist');
        }

        await this.prisma.watchlistItem.delete({
            where: { id: item.id },
        });

        return { success: true };
    }

    /**
     * Get user's watchlist
     */
    async findAll(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = {
            userId,
            listing: {
                type: ListingType.CLASSIFIED,
                deletedAt: null,
                status: {
                    in: [
                        ListingStatus.ACTIVE,
                        ListingStatus.SOLD,
                        ListingStatus.OFFER_ACCEPTED,
                    ],
                },
            },
        };

        const [items, total] = await Promise.all([
            this.prisma.watchlistItem.findMany({
                where,
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            images: true,
                            price: true,
                            status: true,
                            type: true,
                            sellerId: true,
                            make: true,
                            model: true,
                            year: true,
                            mileage: true,
                            viewCount: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.watchlistItem.count({ where }),
        ]);

        return { data: items, total };
    }

    /**
     * Dealer-only auction shortlist. Reuses the existing per-user watchlist,
     * but does not expose trade auction data from the general watchlist route.
     * Include cancelled/ended items in All so they can be removed deliberately.
     */
    async findAuctionShortlist(userId: string, page = 1, limit = 12, liveOnly = true) {
        const validPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
        const validLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 50) : 12;
        const now = new Date();
        const where = {
            userId,
            listing: {
                deletedAt: null,
                ...(liveOnly ? { status: 'ACTIVE' as const } : {}),
                auction: {
                    is: {
                        deletedAt: null,
                        ...(liveOnly ? { status: 'ACTIVE' as const, endTime: { gt: now } } : {}),
                    },
                },
            },
        };
        const activeBidWhere = { deletedAt: null, cancelledAt: null, archivedAt: null };
        const [items, total] = await Promise.all([
            this.prisma.watchlistItem.findMany({
                where,
                select: {
                    id: true,
                    listingId: true,
                    createdAt: true,
                    listing: {
                        select: {
                            id: true, title: true, images: true, make: true, model: true,
                            year: true, mileage: true, status: true,
                            auction: {
                                select: {
                                    id: true, status: true, startTime: true,
                                    endTime: true, startingBid: true, minIncrement: true,
                                },
                            },
                            bids: {
                                where: activeBidWhere,
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: { where: activeBidWhere } } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (validPage - 1) * validLimit,
                take: validLimit,
            }),
            this.prisma.watchlistItem.count({ where }),
        ]);
        return { data: items, total, page: validPage, limit: validLimit };
    }

    /**
     * Check if a listing is in user's watchlist
     */
    async isInWatchlist(userId: string, listingId: string): Promise<boolean> {
        const item = await this.prisma.watchlistItem.findFirst({
            where: {
                userId,
                listingId,
                listing: {
                    type: ListingType.CLASSIFIED,
                    deletedAt: null,
                    status: {
                        in: [
                            ListingStatus.ACTIVE,
                            ListingStatus.SOLD,
                            ListingStatus.OFFER_ACCEPTED,
                        ],
                    },
                },
            },
            select: { id: true },
        });
        return !!item;
    }

    /**
     * Get retail Saved Cars count for user
     */
    async getCount(userId: string): Promise<number> {
        return this.prisma.watchlistItem.count({
            where: {
                userId,
                listing: {
                    type: ListingType.CLASSIFIED,
                    deletedAt: null,
                    status: {
                        in: [
                            ListingStatus.ACTIVE,
                            ListingStatus.SOLD,
                            ListingStatus.OFFER_ACCEPTED,
                        ],
                    },
                },
            },
        });
    }

    /**
     * Verified-dealer auction shortlist mutation. The controller owns trade
     * verification; this service still verifies that the supplied listing is
     * genuinely an auction so callers cannot route retail records through the
     * trade mutation endpoint.
     */
    async addAuction(userId: string, listingId: string) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                type: true,
                deletedAt: true,
                auction: { select: { id: true, deletedAt: true } },
            },
        });
        if (!listing || listing.deletedAt ||
            listing.type !== ListingType.AUCTION ||
            !listing.auction || listing.auction.deletedAt) {
            throw new NotFoundException('Auction listing not found');
        }

        const existing = await this.prisma.watchlistItem.findUnique({
            where: { userId_listingId: { userId, listingId } },
        });
        if (existing) {
            throw new ConflictException('Listing already in watchlist');
        }
        return this.prisma.watchlistItem.create({
            data: { userId, listingId },
            include: { listing: true },
        });
    }

    async removeAuction(userId: string, listingId: string) {
        const item = await this.prisma.watchlistItem.findUnique({
            where: { userId_listingId: { userId, listingId } },
            include: {
                listing: {
                    select: {
                        type: true,
                        deletedAt: true,
                        auction: { select: { deletedAt: true } },
                    },
                },
            },
        });
        if (!item || item.listing.deletedAt ||
            item.listing.type !== ListingType.AUCTION ||
            !item.listing.auction || item.listing.auction.deletedAt) {
            throw new NotFoundException('Auction listing not in shortlist');
        }
        await this.prisma.watchlistItem.delete({ where: { id: item.id } });
        return { success: true };
    }
}
