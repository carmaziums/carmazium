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
            this.prisma.watchlistItem.count({ where: { userId } }),
        ]);

        return { data: items, total };
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
