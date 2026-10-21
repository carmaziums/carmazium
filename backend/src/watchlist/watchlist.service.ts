import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchlistService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Add a listing to user's watchlist
     */
    // Retail and trade rows share the same existing storage, but *never*
    // share the same access path. A basic buyer knowing an auction listing ID
    // must not use generic Saved Cars to inspect trade stock.
    private retailWhere(userId: string) {
        return { userId, listing: { type: 'CLASSIFIED' as const, deletedAt: null } };
    }

    async add(userId: string, listingId: string) {
        return this.addByType(userId, listingId, 'CLASSIFIED');
    }

    /** Only call through SessionAuthGuard + VerifiedDealerGuard. */
    async addAuction(userId: string, listingId: string) {
        return this.addByType(userId, listingId, 'AUCTION');
    }

    private async addByType(userId: string, listingId: string, expected: 'CLASSIFIED' | 'AUCTION') {
        const listing = await this.prisma.listing.findUnique({
            where: { id: listingId },
            select: {
                id: true, type: true, deletedAt: true, status: true,
                auction: { select: { status: true, deletedAt: true, endTime: true } },
            },
        });
        // Do not confirm a forbidden trade listing's existence through
        // the retail endpoint. Only the verified dealer route can reach it.
        if (!listing || listing.deletedAt || listing.type !== expected) {
            throw new NotFoundException('Listing not found');
        }
        if (expected === 'AUCTION' && (
            listing.status !== 'ACTIVE' || !listing.auction ||
            listing.auction.deletedAt || listing.auction.status !== 'ACTIVE' ||
            listing.auction.endTime <= new Date()
        )) {
            throw new NotFoundException('Live auction not found');
        }

        const existing = await this.prisma.watchlistItem.findUnique({
            where: { userId_listingId: { userId, listingId } },
        });
        if (existing) {
            throw new ConflictException('Listing already in watchlist');
        }
        // The generic POST previously included the ENTIRE Prisma listing,
        // exposing confidential priceMin/priceMax and any future private
        // columns. Return minimal confirmation on both routes instead.
        return this.prisma.watchlistItem.create({
            data: { userId, listingId },
            select: { id: true, listingId: true, createdAt: true },
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
                where: this.retailWhere(userId),
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
            this.prisma.watchlistItem.count({ where: this.retailWhere(userId) }),
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
                type: 'AUCTION' as const,
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
        // General Saved Cars checks are retail-only, even if a previously
        // saved trade auction remains in the user's legacy watchlist.
        return !!await this.prisma.watchlistItem.findFirst({
            where: { ...this.retailWhere(userId), listingId },
            select: { id: true },
        });
    }

    async isInAuctionShortlist(userId: string, listingId: string): Promise<boolean> {
        return !!await this.prisma.watchlistItem.findFirst({
            where: { userId, listingId, listing: { type: 'AUCTION', deletedAt: null } },
            select: { id: true },
        });
    }

    async removeAuction(userId: string, listingId: string): Promise<void> {
        const item = await this.prisma.watchlistItem.findFirst({
            where: { userId, listingId, listing: { type: 'AUCTION', deletedAt: null } },
            select: { id: true },
        });
        if (!item) throw new NotFoundException('Auction not shortlisted');
        await this.prisma.watchlistItem.delete({ where: { id: item.id } });
    }

    /**
     * Get watchlist count for user
     */
    async getCount(userId: string): Promise<number> {
        return this.prisma.watchlistItem.count({ where: this.retailWhere(userId) });
    }
}
