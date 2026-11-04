import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSellerReviewDto } from './dto/create-seller-review.dto';
import { canRevealListingContact } from '../core/listing-contact-visibility';
import { computeReliabilityScore, loadResponseStats } from './seller-reputation';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SellerProfileResponse {
    profile: {
        id: string;
        userId: string;
        reliabilityScore: number;
        totalSales: number;
        totalListings: number;
        /** 0–100 from real offer replies; null until the seller has one to answer. */
        responseRate: number | null;
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
    /** Review sentiment split — returned by getSellerProfile since it was written. */
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    starCounts: { star: number; count: number }[];
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

    private async ensureVerifiedPublicUser(userId: string) {
        const user = await this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                isEmailVerified: true,
                showPublicProfile: true,
            },
            select: { id: true },
        });
        if (!user) {
            // Deliberately use the same public not-found response for missing,
            // deleted, private and unverified accounts so account state is not
            // disclosed to visitors.
            throw new NotFoundException('Seller profile not found');
        }
        return user;
    }

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

    /**
     * Returns the seller's contact phone (personal or dealership).
     *
     * Anonymous access is listing-scoped: only an ACTIVE PREMIUM retail
     * listing belonging to this seller may reveal the number. Calling this
     * endpoint without a listing id keeps the public seller-profile behaviour
     * login-gated.
     */
    async getContactPhone(
        userId: string,
        viewerAuthenticated: boolean,
        listingId?: string,
    ): Promise<{ phone: string | null; phoneAvailable: boolean }> {
        await this.ensureVerifiedPublicUser(userId);
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                phone: true,
                dealerProfile: { select: { phone: true } },
            },
        });

        if (!user) {
            throw new NotFoundException('Seller profile not found');
        }

        let listingContext: {
            type: string;
            status: string;
            badgeTier: string;
        } | null = null;

        if (!viewerAuthenticated && listingId) {
            listingContext = await this.prisma.listing.findFirst({
                where: {
                    id: listingId,
                    sellerId: userId,
                    deletedAt: null,
                },
                select: {
                    type: true,
                    status: true,
                    badgeTier: true,
                },
            });
        }

        const revealContact = canRevealListingContact({
            viewerAuthenticated,
            listingType: listingContext?.type,
            listingStatus: listingContext?.status,
            badgeTier: listingContext?.badgeTier,
        });

        const realPhone = user.dealerProfile?.phone || user.phone || null;
        return {
            phone: revealContact ? realPhone : null,
            phoneAvailable: !!realPhone,
        };
    }

    // ── Get public seller profile ───────────────────────────────────────────

    /**
     * Returns a public-safe seller profile for a verified account.
     * Includes: stats, aggregated review count, and average rating.
     * Password hash is never included.
     */
    async getPublicProfile(userId: string): Promise<SellerProfileResponse> {
        await this.ensureVerifiedPublicUser(userId);

        let sellerProfile = await this.prisma.sellerProfile.findUnique({
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
            // Only verified/public users reach this point. Preserve the legacy
            // lazy SellerProfile creation behaviour without creating reputation
            // records for unverified visitor-facing accounts.
            await this.ensureProfile(userId);

            sellerProfile = await this.prisma.sellerProfile.findUnique({
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
                throw new NotFoundException('Seller profile not found');
            }
        }

        const reviewCount = sellerProfile.reviews.length;
        const averageRating =
            reviewCount > 0
                ? sellerProfile.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
                : 0;

        // Positive = 4–5 stars, Neutral = 3, Negative = 1–2
        const positiveCount = sellerProfile.reviews.filter(r => r.rating >= 4).length;
        const neutralCount  = sellerProfile.reviews.filter(r => r.rating === 3).length;
        const negativeCount = sellerProfile.reviews.filter(r => r.rating <= 2).length;

        // Star distribution (1–5)
        const starCounts = [1, 2, 3, 4, 5].map(star => ({
            star,
            count: sellerProfile.reviews.filter(r => r.rating === star).length,
        }));

        const { reviews: _, ...profileWithoutReviews } = sellerProfile;

        // Response figures and the reliability score are derived live from
        // real offers and reviews, then written back so listing pages (which
        // read the stored columns) agree with this profile.
        const response = await loadResponseStats(this.prisma, sellerProfile.userId);
        const reliabilityScore = computeReliabilityScore({
            ratings: sellerProfile.reviews.map(r => r.rating),
            responseRate: response.responseRate,
            totalSales: profileWithoutReviews.totalSales,
            totalListings: profileWithoutReviews.totalListings,
        });
        const storedRate = response.responseRate ?? 0;
        if (
            profileWithoutReviews.responseRate !== storedRate
            || profileWithoutReviews.avgResponseHours !== response.avgResponseHours
            || profileWithoutReviews.reliabilityScore !== reliabilityScore
        ) {
            await this.prisma.sellerProfile.update({
                where: { id: profileWithoutReviews.id },
                data: { responseRate: storedRate, avgResponseHours: response.avgResponseHours, reliabilityScore },
            }).catch(() => undefined);
        }

        return {
            profile: {
                id: profileWithoutReviews.id,
                userId: profileWithoutReviews.userId,
                reliabilityScore,
                totalSales: profileWithoutReviews.totalSales,
                totalListings: profileWithoutReviews.totalListings,
                responseRate: response.responseRate,
                avgResponseHours: response.avgResponseHours,
                createdAt: profileWithoutReviews.createdAt,
            },
            user: profileWithoutReviews.user,
            reviewCount,
            averageRating: Math.round(averageRating * 10) / 10,
            positiveCount,
            neutralCount,
            negativeCount,
            starCounts,
        };
    }

    // ── Get all active listings by a seller ────────────────────────────────

    /**
     * Returns paginated active listings for a verified public seller.
     */
    async getSellerListings(userId: string, page = 1, limit = 12) {
        await this.ensureVerifiedPublicUser(userId);
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
        const publicProfile = await this.prisma.sellerProfile.findFirst({
            where: {
                id: sellerProfileId,
                user: {
                    is: {
                        deletedAt: null,
                        isEmailVerified: true,
                        showPublicProfile: true,
                    },
                },
            },
            select: { id: true },
        });
        if (!publicProfile) throw new NotFoundException('Seller profile not found');

        const skip = (page - 1) * limit;
        const where = {
            sellerId: sellerProfileId,
            reviewer: {
                isEmailVerified: true,
                deletedAt: null,
                showPublicProfile: true,
            },
        };

        const [data, total] = await this.prisma.$transaction([
            this.prisma.sellerReview.findMany({
                where,
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
            this.prisma.sellerReview.count({ where }),
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

        const response = await loadResponseStats(this.prisma, profile.userId);
        const reliabilityScore = computeReliabilityScore({
            ratings: profile.reviews.map(r => r.rating),
            responseRate: response.responseRate,
            totalSales: profile.totalSales,
            totalListings: profile.totalListings,
        });

        await this.prisma.sellerProfile.update({
            where: { id: sellerProfileId },
            data: {
                reliabilityScore,
                responseRate: response.responseRate ?? 0,
                avgResponseHours: response.avgResponseHours,
            },
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
