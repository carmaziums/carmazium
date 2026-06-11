import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ReviewKycDto } from './dto/review-kyc.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentsService: PaymentsService,
        private readonly emailService: EmailService,
        private readonly notificationsGateway: NotificationsGateway,
        private readonly notificationsService: NotificationsService,
    ) { }

    async getAllUsers(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
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
                },
            }),
            this.prisma.user.count(),
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

            if (seller?.stripeConnectAccountId && seller?.stripeConnectOnboardingComplete) {
                await this.paymentsService.issueSellerPayout(seller.stripeConnectAccountId).catch(err =>
                    console.error(`Stripe payout failed for auction ${auctionId}:`, err),
                );
            }

            this.notificationsGateway.sendNotification(sellerId, {
                type: 'HANDOVER_APPROVED',
                title: 'Handover verified',
                message: seller?.stripeConnectOnboardingComplete
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
            this.prisma.listing.count(),
            this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
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

