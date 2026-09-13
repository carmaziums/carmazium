import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    CapabilityStatus,
    DeliveryStatus,
    ServiceJobStatus,
    ServiceStatus,
    ServiceType,
    UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileReviewDto } from './dto/create-profile-review.dto';

const SERVICE_LABELS: Partial<Record<ServiceType, string>> = {
    [ServiceType.DELIVERY]: 'Delivery & Recovery',
    [ServiceType.INSPECTION]: 'Vehicle Inspection',
    [ServiceType.FINANCE]: 'Vehicle Finance',
    [ServiceType.WARRANTY]: 'Vehicle Warranty',
};

@Injectable()
export class ProfilesService {
    constructor(private readonly prisma: PrismaService) { }

    private async ensureReviewProfile(userId: string) {
        return this.prisma.sellerProfile.upsert({
            where: { userId },
            update: {},
            create: { userId },
        });
    }

    private buildBadges(user: any) {
        const badges: Array<{ key: string; label: string; verified: boolean }> = [];
        const seen = new Set<string>();
        const add = (key: string, label: string, verified = true) => {
            if (seen.has(key)) return;
            seen.add(key);
            badges.push({ key, label, verified });
        };

        // DealerProfile is also the reusable Partner business record. Its mere
        // existence must not claim the Vehicle Dealer add-on. The Partner
        // dashboard considers that service active only after dealer/KYC
        // verification, so the public badge follows that same authoritative
        // state rather than a user-editable business field.
        if (user.dealerProfile?.isVerified) {
            add('vehicle-dealer', 'Vehicle Dealer', true);
        }

        for (const capability of user.contractorProfile?.capabilities ?? []) {
            if (capability.status !== CapabilityStatus.APPROVED) continue;
            const label = SERVICE_LABELS[capability.serviceType as ServiceType];
            if (label) add(`service-${String(capability.serviceType).toLowerCase()}`, label, true);
        }

        if (user.role === UserRole.FINANCE_PARTNER && user.financePartnerProfile) {
            add('vehicle-finance', 'Vehicle Finance', !!user.financePartnerProfile.isActive);
        }
        if (user.role === UserRole.INSURANCE_PARTNER && user.insurancePartnerProfile) {
            add('vehicle-insurance', 'Vehicle Insurance', !!user.insurancePartnerProfile.isActive);
        }

        return badges;
    }

    private reviewSummary(reviews: Array<{ rating: number }>) {
        const count = reviews.length;
        const average = count
            ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10
            : 0;
        const distribution = [5, 4, 3, 2, 1].map((star) => ({
            star,
            count: reviews.filter((review) => review.rating === star).length,
        }));
        return { average, count, distribution };
    }

    /**
     * Generic profile reviews reuse the existing SellerProfile/SellerReview
     * storage so existing marketplace reputation is preserved. Keep the legacy
     * seller reliability score in sync whenever one of those shared reviews is
     * created or changed, otherwise /seller/:id and /profile/:id could disagree.
     */
    private async recalculateReliabilityScore(sellerProfileId: string) {
        const profile = await this.prisma.sellerProfile.findUnique({
            where: { id: sellerProfileId },
            include: { reviews: { select: { rating: true } } },
        });
        if (!profile) return;

        const reviewCount = profile.reviews.length;
        const avgRating = reviewCount
            ? profile.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
            : 0;
        const responseScore = (profile.responseRate / 100) * 5;
        const salesRatio = profile.totalListings > 0 ? profile.totalSales / profile.totalListings : 0;
        const salesScore = Math.min(salesRatio, 1) * 5;
        const raw = avgRating * 0.5 + responseScore * 0.3 + salesScore * 0.2;
        const reliabilityScore = Math.min(Math.max(Math.round(raw * 10) / 10, 0), 5);

        await this.prisma.sellerProfile.update({
            where: { id: sellerProfileId },
            data: { reliabilityScore },
        });
    }

    async getPublicProfile(userId: string) {
        // Public identity is only available after the account has verified its
        // email. Keep the account record itself intact so verification can be
        // completed later; this gate only removes unverified accounts from
        // visitor-facing surfaces.
        const user = await this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                showPublicProfile: true,
                isEmailVerified: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
                location: true,
                createdAt: true,
                showPublicProfile: true,
                isEmailVerified: true,
                isAddressVerified: true,
                dealerProfile: {
                    select: {
                        id: true,
                        companyName: true,
                        registrationNumber: true,
                        businessAddress: true,
                        logo: true,
                        description: true,
                        phone: true,
                        website: true,
                        openingHours: true,
                        isVerified: true,
                        verificationDate: true,
                    },
                },
                contractorProfile: {
                    select: {
                        businessName: true,
                        serviceArea: true,
                        certifications: true,
                        capabilities: {
                            where: { status: CapabilityStatus.APPROVED },
                            select: { serviceType: true, status: true },
                        },
                    },
                },
                financePartnerProfile: {
                    select: { companyName: true, isActive: true },
                },
                insurancePartnerProfile: {
                    select: { companyName: true, isActive: true },
                },
                sellerProfile: {
                    select: {
                        id: true,
                        reviews: { select: { rating: true } },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Profile not found');
        }

        const personalName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'CarMazium Member';
        const businessName = user.dealerProfile?.companyName || user.contractorProfile?.businessName || null;
        const displayName = businessName || personalName;
        const avatar = user.dealerProfile?.logo || user.profileImage || null;
        const accountLabel = user.dealerProfile || user.role === UserRole.DEALER || user.role === UserRole.CONTRACTOR
            ? 'Partner Account'
            : 'Personal Account';

        return {
            id: user.id,
            displayName,
            avatar,
            accountLabel,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
            location: user.location,
            memberSince: user.createdAt,
            verification: {
                email: user.isEmailVerified,
                address: user.isAddressVerified,
                business: !!user.dealerProfile?.isVerified,
            },
            business: user.dealerProfile,
            provider: user.contractorProfile
                ? {
                    businessName: user.contractorProfile.businessName,
                    serviceArea: user.contractorProfile.serviceArea,
                    certifications: user.contractorProfile.certifications,
                }
                : null,
            badges: this.buildBadges(user),
            rating: this.reviewSummary(user.sellerProfile?.reviews ?? []),
        };
    }

    async getReceivedReviews(userId: string, page = 1, limit = 10) {
        const target = await this.prisma.user.findFirst({
            where: {
                id: userId,
                deletedAt: null,
                showPublicProfile: true,
                isEmailVerified: true,
            },
            select: { id: true, sellerProfile: { select: { id: true } } },
        });
        if (!target) throw new NotFoundException('Profile not found');
        if (!target.sellerProfile) return { data: [], total: 0, page, limit };

        const skip = (page - 1) * limit;
        const reviewWhere = {
            sellerId: target.sellerProfile.id,
            reviewer: {
                isEmailVerified: true,
                deletedAt: null,
                showPublicProfile: true,
            },
        };
        const [data, total] = await this.prisma.$transaction([
            this.prisma.sellerReview.findMany({
                where: reviewWhere,
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    listingId: true,
                    createdAt: true,
                    updatedAt: true,
                    reviewer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            profileImage: true,
                            dealerProfile: { select: { companyName: true, logo: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.sellerReview.count({ where: reviewWhere }),
        ]);

        return {
            data: data.map((review) => ({
                ...review,
                reviewer: {
                    id: review.reviewer.id,
                    displayName: review.reviewer.dealerProfile?.companyName
                        || [review.reviewer.firstName, review.reviewer.lastName].filter(Boolean).join(' ')
                        || 'CarMazium Member',
                    avatar: review.reviewer.dealerProfile?.logo || review.reviewer.profileImage || null,
                },
            })),
            total,
            page,
            limit,
        };
    }

    async getReviewsGiven(reviewerId: string, page = 1, limit = 10, publicOnly = false) {
        const skip = (page - 1) * limit;
        const where = publicOnly
            ? {
                reviewerId,
                sellerProfile: {
                    user: {
                        isEmailVerified: true,
                        deletedAt: null,
                        showPublicProfile: true,
                    },
                },
            }
            : { reviewerId };

        const [data, total] = await this.prisma.$transaction([
            this.prisma.sellerReview.findMany({
                where,
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    listingId: true,
                    createdAt: true,
                    updatedAt: true,
                    sellerProfile: {
                        select: {
                            user: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    profileImage: true,
                                    dealerProfile: { select: { companyName: true, logo: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.sellerReview.count({ where }),
        ]);

        return {
            data: data.map((review) => {
                const target = review.sellerProfile.user;
                return {
                    id: review.id,
                    rating: review.rating,
                    comment: review.comment,
                    listingId: review.listingId,
                    createdAt: review.createdAt,
                    updatedAt: review.updatedAt,
                    target: {
                        id: target.id,
                        displayName: target.dealerProfile?.companyName
                            || [target.firstName, target.lastName].filter(Boolean).join(' ')
                            || 'CarMazium Member',
                        avatar: target.dealerProfile?.logo || target.profileImage || null,
                    },
                };
            }),
            total,
            page,
            limit,
        };
    }

    private async hasCompletedInteraction(firstUserId: string, secondUserId: string) {
        const [sale, delivery, serviceJob, legacyService, auction] = await Promise.all([
            this.prisma.sale.findFirst({
                where: {
                    OR: [
                        { sellerId: firstUserId, buyerId: secondUserId },
                        { sellerId: secondUserId, buyerId: firstUserId },
                    ],
                },
                select: { listingId: true },
            }),
            this.prisma.deliveryRequest.findFirst({
                where: {
                    status: DeliveryStatus.COMPLETED,
                    OR: [
                        { buyerId: firstUserId, sellerId: secondUserId },
                        { buyerId: secondUserId, sellerId: firstUserId },
                    ],
                },
                select: { listingId: true },
            }),
            this.prisma.serviceJob.findFirst({
                where: {
                    status: { in: [ServiceJobStatus.COMPLETED, ServiceJobStatus.RELEASED] },
                    OR: [
                        { customerId: firstUserId, contractor: { is: { userId: secondUserId } } },
                        { customerId: secondUserId, contractor: { is: { userId: firstUserId } } },
                    ],
                },
                select: { id: true },
            }),
            this.prisma.serviceRequest.findFirst({
                where: {
                    status: ServiceStatus.COMPLETED,
                    OR: [
                        { requesterId: firstUserId, contractor: { userId: secondUserId } },
                        { requesterId: secondUserId, contractor: { userId: firstUserId } },
                    ],
                },
                select: { id: true },
            }),
            this.prisma.auction.findFirst({
                where: {
                    handoverSubmittedAt: { not: null },
                    OR: [
                        { winnerId: firstUserId, listing: { sellerId: secondUserId } },
                        { winnerId: secondUserId, listing: { sellerId: firstUserId } },
                    ],
                },
                select: { listingId: true },
            }),
        ]);

        return {
            eligible: !!(sale || delivery || serviceJob || legacyService || auction),
            listingId: sale?.listingId || delivery?.listingId || auction?.listingId || null,
        };
    }

    async submitReview(reviewerId: string, targetUserId: string, dto: CreateProfileReviewDto) {
        if (reviewerId === targetUserId) {
            throw new BadRequestException('You cannot review your own profile.');
        }

        const target = await this.prisma.user.findFirst({
            where: { id: targetUserId, deletedAt: null },
            select: { id: true },
        });
        if (!target) throw new NotFoundException('Profile not found');

        const interaction = await this.hasCompletedInteraction(reviewerId, targetUserId);
        if (!interaction.eligible) {
            throw new ForbiddenException(
                'Reviews can only be left after a completed CarMazium vehicle transaction, handover, delivery or service job with this profile.',
            );
        }

        const reviewProfile = await this.ensureReviewProfile(targetUserId);
        const existing = await this.prisma.sellerReview.findFirst({
            where: { sellerId: reviewProfile.id, reviewerId },
            orderBy: { createdAt: 'desc' },
        });

        let review;
        if (existing) {
            review = await this.prisma.sellerReview.update({
                where: { id: existing.id },
                data: {
                    rating: dto.rating,
                    comment: dto.comment?.trim() || null,
                    ...(existing.listingId ? {} : interaction.listingId ? { listingId: interaction.listingId } : {}),
                },
            });
        } else {
            review = await this.prisma.sellerReview.create({
                data: {
                    sellerId: reviewProfile.id,
                    reviewerId,
                    listingId: interaction.listingId,
                    rating: dto.rating,
                    comment: dto.comment?.trim() || null,
                },
            });
        }

        await this.recalculateReliabilityScore(reviewProfile.id);
        return review;
    }
}
