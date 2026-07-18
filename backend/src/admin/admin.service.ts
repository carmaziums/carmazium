import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { SellersService } from '../sellers/sellers.service';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentsService: PaymentsService,
        private readonly emailService: EmailService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly notificationsService: NotificationsService,
        private readonly sellersService: SellersService,
    ) { }

    async getAllUsers(page = 1, limit = 20, search?: string) {
        const skip = (page - 1) * limit;
        const where = search
            ? {
                  OR: [
                      { email: { contains: search, mode: 'insensitive' as const } },
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                  ],
              }
            : undefined;

        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isEmailVerified: true,
                    createdAt: true,
                    deletedAt: true,
                    lockoutUntil: true,
                    dealerProfile: { select: { isVerified: true, companyName: true } },
                    _count: { select: { listings: true } },
                    stripeConnectOnboardingComplete: true,
                    bankAccountName: true,
                    bankSortCode: true,
                    bankAccountNumber: true,
                    payoutPreference: true,
                },
            }),
            this.prisma.user.count({ where }),
        ]);
        return { data, total };
    }

    async updateUserRole(userId: string, role: UserRole) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { role },
        });
    }

    async banUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        if (user.role === 'ADMIN') throw new BadRequestException('Cannot ban another admin');
        return this.prisma.user.update({
            where: { id: userId },
            data: { deletedAt: new Date() },
        });
    }

    async unbanUser(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { deletedAt: null },
        });
    }

    async lockUser(userId: string) {
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        return this.prisma.user.update({
            where: { id: userId },
            data: { lockoutUntil: lockUntil },
        });
    }

    async unlockUser(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { lockoutUntil: null, loginAttempts: 0 },
        });
    }

    async verifyUser(userId: string, isVerified: boolean) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { dealerProfile: true } });

        if (user?.role === 'DEALER' && user.dealerProfile) {
            await this.prisma.dealerProfile.update({
                where: { userId },
                data: { isVerified },
            });
        }

        return this.prisma.user.update({
            where: { id: userId },
            data: { isEmailVerified: isVerified },
        });
    }

    async getAllListings(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.listing.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { seller: { select: { id: true, email: true, firstName: true, lastName: true } } },
            }),
            this.prisma.listing.count(),
        ]);
        return { data, total };
    }

    async deleteListing(id: string) {
        return this.prisma.listing.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    // ── Listing Review ───────────────────────────────────────────────────────

    /**
     * All listings currently awaiting admin review, plus previously-rejected
     * listings still sitting in that state (mirrors getPendingKyc's "pending or
     * rejected" pattern so the admin can track outstanding fixes, not just new
     * submissions).
     */
    async getPendingListingReviews() {
        return this.prisma.listing.findMany({
            where: { status: { in: ['PENDING_REVIEW', 'REJECTED'] }, deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: { seller: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } },
        });
    }

    async approveListing(id: string) {
        const listing = await this.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only listings awaiting review can be approved');
        }

        const isPremium = listing.badgeTier === 'PREMIUM';
        const updated = await this.prisma.listing.update({
            where: { id },
            data: {
                status: 'ACTIVE',
                rejectionReason: null,
                reviewedAt: new Date(),
                isFeatured: isPremium,
                featuredUntil: isPremium ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : null,
            },
        });

        if (listing.sellerId) {
            await this.sellersService.incrementListings(listing.sellerId);

            const seller = await this.prisma.user.findUnique({
                where: { id: listing.sellerId },
                select: { email: true, firstName: true },
            });
            if (seller?.email) {
                await this.emailService
                    .sendListingApprovedAlert(seller.email, seller.firstName || 'there', listing.title, listing.slug)
                    .catch(console.error);
            }

            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_APPROVED',
                title: 'Your Listing is Live!',
                message: `"${listing.title}" has been approved and is now visible to buyers.`,
                link: `/buy-cars/${listing.slug}`,
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'APPROVED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        }

        return updated;
    }

    async rejectListing(id: string, dto: RejectListingDto) {
        const listing = await this.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            throw new NotFoundException('Listing not found');
        }
        if (listing.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only listings awaiting review can be rejected');
        }

        const updated = await this.prisma.listing.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: dto.reason,
                reviewedAt: new Date(),
            },
        });

        if (listing.sellerId) {
            const seller = await this.prisma.user.findUnique({
                where: { id: listing.sellerId },
                select: { email: true, firstName: true },
            });
            if (seller?.email) {
                await this.emailService
                    .sendListingRejectedAlert(seller.email, seller.firstName || 'there', listing.title, dto.reason)
                    .catch(console.error);
            }

            const notification = await this.notificationsService.create({
                userId: listing.sellerId,
                type: 'LISTING_REJECTED',
                title: 'Listing Needs Attention',
                message: `"${listing.title}" was not approved: ${dto.reason}`,
                link: '/dashboard/seller/listings',
                entityType: 'Listing',
                entityId: listing.id,
                actionType: 'REJECTED',
            }).catch(() => null);
            if (notification) {
                this.notificationsGateway.sendNotification(listing.sellerId, notification);
            }
        }

        return updated;
    }

    async getAllAuctions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.auction.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
                            seller: { select: { id: true, email: true, firstName: true, lastName: true } },
                            bids: {
                                where: { deletedAt: null },
                                orderBy: { amount: 'desc' },
                                take: 1,
                                select: { amount: true },
                            },
                            _count: { select: { bids: true } },
                        },
                    },
                    winner: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            }),
            this.prisma.auction.count(),
        ]);
        return { data, total };
    }

    async getPendingHandovers() {
        return this.prisma.auction.findMany({
            where: {
                deletedAt: null,
                status: 'ENDED',
                handoverProofUrl: { not: null },
                sellerBonusReleased: false,
            },
            orderBy: { handoverSubmittedAt: 'asc' },
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
                        seller: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                stripeConnectOnboardingComplete: true,
                                bankAccountName: true,
                                bankSortCode: true,
                                bankAccountNumber: true,
                                payoutPreference: true,
                            },
                        },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
    }

    async approveHandover(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });
        if (!auction) throw new NotFoundException('Auction not found');
        // Idempotency guard — prevents double-payout if called more than once
        if (auction.sellerBonusReleased) {
            return auction;
        }

        const updated = await this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                sellerBonusReleased: true,
                sellerBonusReleasedAt: new Date(),
            },
        });

        const sellerId = auction.listing?.sellerId;
        if (sellerId) {
            // Issue £100 payout to seller's connected Stripe account
            const seller = await this.prisma.user.findUnique({
                where: { id: sellerId },
                select: {
                    email: true,
                    firstName: true,
                    stripeConnectAccountId: true,
                    stripeConnectOnboardingComplete: true,
                },
            });

            let payoutSucceeded = false;
            if (seller?.stripeConnectAccountId && seller?.stripeConnectOnboardingComplete) {
                try {
                    const transferId = await this.paymentsService.issueSellerPayout(
                        seller.stripeConnectAccountId,
                    );
                    // Record transfer ID for audit trail
                    await this.prisma.auction.update({
                        where: { id: auctionId },
                        data: { stripePayoutTransferId: transferId },
                    });
                    payoutSucceeded = true;
                } catch (err: any) {
                    const errMsg = err?.message || 'Unknown Stripe error';
                    console.error(`[Admin] Stripe payout failed for auction ${auctionId}:`, errMsg);
                    // Persist error so admins can see it in the handovers view
                    await this.prisma.auction.update({
                        where: { id: auctionId },
                        data: { stripePayoutError: errMsg },
                    });
                    // Notify every admin so they can manually transfer
                    const admins = await this.prisma.user.findMany({
                        where: { role: 'ADMIN', deletedAt: null },
                        select: { id: true },
                    });
                    for (const admin of admins) {
                        this.notificationsGateway.sendNotification(admin.id, {
                            type: 'PAYOUT_FAILED',
                            title: '⚠️ Payout failed — manual action needed',
                            message: `Auto-transfer of £100 to seller for "${auction.listing.title}" failed: ${errMsg}. Please pay manually.`,
                            entityType: 'AUCTION',
                            entityId: auctionId,
                            link: '/dashboard/admin/handovers',
                        });
                    }
                }
            }

            this.notificationsGateway.sendNotification(sellerId, {
                type: 'HANDOVER_APPROVED',
                title: 'Handover verified',
                message: payoutSucceeded
                    ? `Your handover proof for "${auction.listing.title}" has been approved. Your £100 bonus is on its way to your bank account.`
                    : `Your handover proof for "${auction.listing.title}" has been approved. Connect your bank account in Settings to receive your £100 bonus.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: '/dashboard/seller/auctions',
            });

            if (seller?.email) {
                this.emailService.sendHandoverApprovedEmail(seller.email, seller.firstName || 'there', auction.listing.title).catch(console.error);
            }
        }

        return updated;
    }

    async denyHandover(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            include: { listing: { select: { sellerId: true, title: true } } },
        });
        if (!auction) throw new NotFoundException('Auction not found');

        // Issue £100 partial Stripe refund to buyer if they paid
        if (auction.buyerFeePaid && auction.buyerFeeTransactionId) {
            await this.paymentsService.issueRefundForAuction(auctionId).catch(err => {
                console.error('Stripe refund failed during handover denial:', err);
            });
        }

        // Clear the proof URL so seller can resubmit
        const updated = await this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                handoverProofUrl: null,
                handoverSubmittedAt: null,
            },
        });

        const sellerId = auction.listing?.sellerId;
        if (sellerId) {
            this.notificationsGateway.sendNotification(sellerId, {
                type: 'HANDOVER_DENIED',
                title: 'Handover proof rejected',
                message: `Your handover proof for "${auction.listing.title}" was not accepted. Please upload a clearer or more appropriate document to receive your £100 bonus.`,
                entityType: 'AUCTION',
                entityId: auctionId,
                link: '/dashboard/seller/auctions',
            });

            const seller = await this.prisma.user.findUnique({ where: { id: sellerId }, select: { email: true, firstName: true } });
            if (seller?.email) {
                this.emailService.sendHandoverDeniedEmail(seller.email, seller.firstName || 'there', auction.listing.title).catch(console.error);
            }
        }

        return updated;
    }

    async getAllTransactions(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.transaction.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    listing: { select: { id: true, title: true, slug: true, make: true, model: true, year: true } },
                },
            }),
            this.prisma.transaction.count(),
        ]);
        return { data, total };
    }

    async getPlatformStats() {
        const [users, listings, activeListings, soldListings, auctions, activeAuctions, endedAuctions, bids, revenueAgg] = await Promise.all([
            this.prisma.user.count(),
            // Phase 10: include SOLD in total count — no status filter, counts DRAFT + ACTIVE + SOLD
            this.prisma.listing.count(),
            // Phase 10: activeListings intentionally ACTIVE only — current live count
            this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
            // Phase 10: soldListings correctly counts SOLD listings only
            this.prisma.listing.count({ where: { status: 'SOLD' } }),
            this.prisma.auction.count({ where: { deletedAt: null } }),
            this.prisma.auction.count({ where: { status: 'ACTIVE', deletedAt: null } }),
            this.prisma.auction.count({ where: { status: 'ENDED', deletedAt: null } }),
            this.prisma.bid.count({ where: { deletedAt: null } }),
            this.prisma.transaction.aggregate({
                where: { status: 'COMPLETED', deletedAt: null },
                _sum: { amount: true },
            }),
        ]);

        return {
            totalUsers: users,
            totalListings: listings,
            activeListings,
            soldListings,
            totalAuctions: auctions,
            activeAuctions,
            endedAuctions,
            totalBids: bids,
            totalRevenue: Number(revenueAgg._sum?.amount ?? 0),
        };
    }

    async getAnalyticsData() {
        // Last 6 months of data
        const now = new Date();
        const months: { label: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            months.push({
                label: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
                start,
                end,
            });
        }

        const data = await Promise.all(
            months.map(async ({ label, start, end }) => {
                const [newUsers, newListings, completedTxns] = await Promise.all([
                    this.prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
                    this.prisma.listing.count({ where: { createdAt: { gte: start, lte: end } } }),
                    this.prisma.transaction.aggregate({
                        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end }, deletedAt: null },
                        _sum: { amount: true },
                    }),
                ]);
                return {
                    month: label,
                    newUsers,
                    newListings,
                    revenue: Number(completedTxns._sum?.amount ?? 0),
                };
            }),
        );

        return data;
    }

    async getPendingKyc() {
        return this.prisma.dealerKyc.findMany({
            where: {
                status: {
                    in: ['PENDING', 'REJECTED']
                }
            },
            include: {
                dealerProfile: {
                    include: {
                        user: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' },
        });
    }

    async reviewKyc(kycId: string, dto: ReviewKycDto) {
        const kyc = await this.prisma.dealerKyc.findUnique({
            where: { id: kycId },
            include: {
                dealerProfile: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            }
        });

        if (!kyc) {
            throw new NotFoundException('KYC record not found');
        }

        const currentDocStatuses = (kyc.documentStatuses as Record<string, any>) || {};
        const updatedDocStatuses = { ...currentDocStatuses };

        // Process the reviews granularly
        for (const review of dto.fields) {
            updatedDocStatuses[review.field] = {
                status: review.status,
                note: review.status === 'REJECTED' ? (review.note || '') : '',
            };
        }

        // Determine if all are approved, or if any is rejected
        const allFields = [
            'companyHouseName',
            'representativeName',
            'representativePosition',
            'vatNumber',
            'vatProof',
            'companyRegistrationNumber',
            'companyRegistrationProof',
            'personOfSignificantControl',
            'directorName',
            'directorIdProof',
            'businessWebsite',
            'businessRegisteredAddress',
            'tradingAddress',
            'googleReviewsLink',
            'paymentReference',
            'paymentScreenshot',
        ];

        let hasRejected = false;
        let hasPending = false;
        const rejectedFields: { field: string; note: string }[] = [];

        for (const field of allFields) {
            const fieldStatus = updatedDocStatuses[field]?.status || 'PENDING';
            if (fieldStatus === 'REJECTED') {
                hasRejected = true;
                rejectedFields.push({
                    field,
                    note: updatedDocStatuses[field]?.note || '',
                });
            } else if (fieldStatus === 'PENDING') {
                hasPending = true;
            }
        }

        let overallStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
        if (hasRejected) {
            overallStatus = 'REJECTED';
        } else if (!hasPending) {
            overallStatus = 'APPROVED';
        }

        // Update the KYC record
        const updatedKyc = await this.prisma.dealerKyc.update({
            where: { id: kycId },
            data: {
                status: overallStatus,
                documentStatuses: updatedDocStatuses,
                reviewedAt: new Date(),
            },
        });

        const dealerEmail = kyc.dealerProfile.user.email;
        const dealerName = kyc.dealerProfile.companyName || kyc.dealerProfile.user.firstName || 'Dealer';

        const dealerUserId = kyc.dealerProfile.user?.id ?? null;

        if (overallStatus === 'APPROVED') {
            // Unblock dealer dashboard
            await this.prisma.dealerProfile.update({
                where: { id: kyc.dealerProfileId },
                data: {
                    isVerified: true,
                    verificationDate: new Date(),
                },
            });

            // Send approval email
            await this.emailService.sendKycApprovedDealerAlert(dealerEmail, dealerName).catch(console.error);

            // In-app notification to dealer
            if (dealerUserId) {
                const notification = await this.notificationsService.create({
                    userId: dealerUserId,
                    type: 'KYC_APPROVED',
                    title: 'KYC Verification Approved',
                    message: 'Your dealership documents have been verified. Your dealer dashboard is now fully unlocked!',
                    link: '/dashboard/dealer',
                    entityType: 'DealerKyc',
                    entityId: kyc.id,
                    actionType: 'APPROVED',
                }).catch(() => null);
                if (notification) {
                    this.notificationsGateway.sendNotification(dealerUserId, notification);
                }
            }
        } else if (overallStatus === 'REJECTED') {
            // Keep blocked
            await this.prisma.dealerProfile.update({
                where: { id: kyc.dealerProfileId },
                data: {
                    isVerified: false,
                },
            });

            // Send rejection email
            await this.emailService.sendKycRejectedDealerAlert(dealerEmail, dealerName, rejectedFields).catch(console.error);

            // In-app notification to dealer
            if (dealerUserId) {
                const fieldNames = rejectedFields.map(f => f.field.replace(/([A-Z])/g, ' $1').trim()).join(', ');
                const notification = await this.notificationsService.create({
                    userId: dealerUserId,
                    type: 'KYC_REJECTED',
                    title: 'KYC Documents Need Attention',
                    message: `Some documents require revision: ${fieldNames}. Please log in and re-upload the flagged items.`,
                    link: '/dashboard/dealer',
                    entityType: 'DealerKyc',
                    entityId: kyc.id,
                    actionType: 'REJECTED',
                }).catch(() => null);
                if (notification) {
                    this.notificationsGateway.sendNotification(dealerUserId, notification);
                }
            }
        }

        return updatedKyc;
    }
}

