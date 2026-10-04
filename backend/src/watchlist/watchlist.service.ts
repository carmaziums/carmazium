import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
        });

        if (!listing || listing.deletedAt) {
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
        });

        if (!item) {
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

        const [items, total] = await Promise.all([
            this.prisma.watchlistItem.findMany({
                where: { userId },
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
                            fuelType: true,
                            transmission: true,
                            bodyType: true,
                            color: true,
                            location: true,
                            latitude: true,
                            longitude: true,
                            viewCount: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.watchlistItem.count({ where: { userId } }),
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
        const item = await this.prisma.watchlistItem.findUnique({
            where: {
                userId_listingId: { userId, listingId },
            },
        });
        return !!item;
    }

    /**
     * Get watchlist count for user
     */
    async getCount(userId: string): Promise<number> {
        return this.prisma.watchlistItem.count({ where: { userId } });
    }
}
