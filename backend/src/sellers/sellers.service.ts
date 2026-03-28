import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSellerReviewDto } from './dto/create-seller-review.dto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SellerProfileResponse {
    profile: {
        id: string;
        userId: string;
        reliabilityScore: number;
        totalSales: number;
        totalListings: number;
        responseRate: number;
        avgResponseHours: number | null;
        createdAt: Date;
    };
    user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        profileImage: string | null;
        role: string;
        createdAt: Date;
    };
    reviewCount: number;
    averageRating: number;
}

export interface ReviewsResponse {
    data: {
        id: string;
        rating: number;
        comment: string | null;
        createdAt: Date;
        reviewer: {
            id: string;
            firstName: string | null;
            lastName: string | null;
            profileImage: string | null;
        };
        listingId: string | null;
    }[];
    total: number;
    page: number;
    limit: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SellersService {
    constructor(private readonly prisma: PrismaService) { }

    // ── Ensure a SellerProfile exists for a user (upsert) ──────────────────

    /**
     * Returns the existing SellerProfile for a user, or creates one
     * with default values. Called lazily when a user first lists a vehicle.
     */
    async ensureProfile(userId: string) {
        return this.prisma.sellerProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        });
    }

    // ── Get public seller profile ───────────────────────────────────────────

    /**
     * Returns a public-safe seller profile for the given userId.
     * Includes: stats, aggregated review count, and average rating.
     * Password hash is never included.
     */
    async getPublicProfile(userId: string): Promise<SellerProfileResponse> {
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profileImage: true,
                        role: true,
                        createdAt: true,
                    },
                },
                reviews: {
                    select: { rating: true },
                },
            },
        });

        if (!sellerProfile) {
            throw new NotFoundException(`Seller profile not found for user "${userId}"`);
        }

        const reviewCount = sellerProfile.reviews.length;
        const averageRating =
            reviewCount > 0
                ? sellerProfile.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
                : 0;

        const { reviews: _, ...profileWithoutReviews } = sellerProfile;

        return {
            profile: {
                id: profileWithoutReviews.id,
                userId: profileWithoutReviews.userId,
                reliabilityScore: profileWithoutReviews.reliabilityScore,
                totalSales: profileWithoutReviews.totalSales,
                totalListings: profileWithoutReviews.totalListings,
                responseRate: profileWithoutReviews.responseRate,
                avgResponseHours: profileWithoutReviews.avgResponseHours,
                createdAt: profileWithoutReviews.createdAt,
            },
            user: profileWithoutReviews.user,
            reviewCount,
            averageRating: Math.round(averageRating * 10) / 10,
        };
    }

    // ── Get all active listings by a seller ────────────────────────────────

    /**
     * Returns paginated active listings for a given seller (public).
     */
    async getSellerListings(userId: string, page = 1, limit = 12) {
        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.listing.findMany({
                where: {
                    sellerId: userId,
                    status: 'ACTIVE',
                    deletedAt: null,
                },
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    price: true,
                    images: true,
                    make: true,
                    model: true,
                    year: true,
                    mileage: true,
                    fuelType: true,
                    bodyType: true,
                    location: true,
                    viewCount: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.listing.count({
                where: {
                    sellerId: userId,
                    status: 'ACTIVE',
                    deletedAt: null,
                },
            }),
        ]);

        return { data, total, page, limit };
    }

    // ── Get paginated reviews for a seller ─────────────────────────────────

    async getSellerReviews(
        sellerProfileId: string,
        page = 1,
        limit = 10,
    ): Promise<ReviewsResponse> {
        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.sellerReview.findMany({
                where: { sellerId: sellerProfileId },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    listingId: true,
                    createdAt: true,
                    reviewer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            profileImage: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.sellerReview.count({ where: { sellerId: sellerProfileId } }),
        ]);

        return { data, total, page, limit };
    }

    // ── Submit a review ────────────────────────────────────────────────────

    /**
     * Submits a review for a seller.
     * Business rules:
     *   - Reviewer cannot review themselves.
     *   - One review per (reviewer, seller, listing) combination.
     *   - After submission, the seller's reliabilityScore is recalculated.
     */
    async submitReview(reviewerId: string, dto: CreateSellerReviewDto) {
        // 1. Resolve the SellerProfile
        const sellerProfile = await this.prisma.sellerProfile.findUnique({
            where: { id: dto.sellerId },
            include: { user: { select: { id: true } } },
        });

        if (!sellerProfile) {
            throw new NotFoundException('Seller profile not found');
        }

        // 2. Self-review guard
        if (sellerProfile.userId === reviewerId) {
            throw new BadRequestException('You cannot review yourself');
        }

        // 3. Duplicate review guard
        const existing = await this.prisma.sellerReview.findFirst({
            where: {
                sellerId: dto.sellerId,
                reviewerId,
                listingId: dto.listingId ?? null,
            },
        });

        if (existing) {
            throw new BadRequestException('You have already reviewed this seller for this listing');
        }

        // 4. Create review
        const review = await this.prisma.sellerReview.create({
            data: {
                sellerId: dto.sellerId,
                reviewerId,
                listingId: dto.listingId ?? null,
                rating: dto.rating,
                comment: dto.comment ?? null,
            },
        });

        // 5. Recalculate and persist the reliability score
        await this.recalculateReliabilityScore(dto.sellerId);

        return review;
    }

    // ── Internal: Recalculate reliability score ────────────────────────────

    /**
     * Reliability Score formula (0–5.0 scale):
     *   score = (avgRating * 0.5) + (responseRate/100 * 0.3 * 5) + (salesRatio * 0.2 * 5)
     *
     *   - avgRating    = average of all review ratings (already on 1–5 scale)
     *   - responseRate = stored as 0–100, normalized to 0–1, then weighted
     *   - salesRatio   = totalSales / max(totalListings, 1), normalized to 0–1
     *
     * Result is clamped to [0, 5.0].
     */
    private async recalculateReliabilityScore(sellerProfileId: string) {
        const profile = await this.prisma.sellerProfile.findUnique({
            where: { id: sellerProfileId },
            include: { reviews: { select: { rating: true } } },
        });

        if (!profile) return;

        const reviewCount = profile.reviews.length;
        const avgRating =
            reviewCount > 0
                ? profile.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
                : 0;

        const responseScore = (profile.responseRate / 100) * 5;
        const salesRatio =
            profile.totalListings > 0 ? profile.totalSales / profile.totalListings : 0;
        const salesScore = Math.min(salesRatio, 1) * 5;

        const raw = avgRating * 0.5 + responseScore * 0.3 + salesScore * 0.2;
        const reliabilityScore = Math.min(Math.max(Math.round(raw * 10) / 10, 0), 5);

        await this.prisma.sellerProfile.update({
            where: { id: sellerProfileId },
            data: { reliabilityScore },
        });
    }

    // ── Increment totalListings counter ────────────────────────────────────

    /**
     * Called by ListingsService when a listing goes ACTIVE.
     * Creates the SellerProfile if it doesn't exist yet.
     */
    async incrementListings(userId: string) {
        const profile = await this.ensureProfile(userId);
        await this.prisma.sellerProfile.update({
            where: { id: profile.id },
            data: { totalListings: { increment: 1 } },
        });
    }

    // ── Increment totalSales counter ───────────────────────────────────────

    /**
     * Called by ListingsService when a listing status changes to SOLD.
     */
    async incrementSales(userId: string) {
        const profile = await this.prisma.sellerProfile.findUnique({ where: { userId } });
        if (!profile) return;

        await this.prisma.sellerProfile.update({
            where: { id: profile.id },
            data: { totalSales: { increment: 1 } },
        });

        await this.recalculateReliabilityScore(profile.id);
    }
}
