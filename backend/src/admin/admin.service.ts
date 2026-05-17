import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly paymentsService: PaymentsService,
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
        return this.prisma.listing.delete({
            where: { id },
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
                        seller: { select: { id: true, email: true, firstName: true, lastName: true } },
                    },
                },
                winner: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
    }

    async approveHandover(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction) throw new NotFoundException('Auction not found');

        return this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                sellerBonusReleased: true,
                sellerBonusReleasedAt: new Date(),
            },
        });
    }

    async denyHandover(auctionId: string) {
        const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
        if (!auction) throw new NotFoundException('Auction not found');

        // Issue £100 partial Stripe refund to buyer if they paid
        if (auction.buyerFeePaid && auction.buyerFeeTransactionId) {
            await this.paymentsService.issueRefundForAuction(auctionId).catch(err => {
                console.error('Stripe refund failed during handover denial:', err);
            });
        }

        // Clear the proof URL so seller can resubmit if needed
        return this.prisma.auction.update({
            where: { id: auctionId },
            data: {
                handoverProofUrl: null,
                handoverSubmittedAt: null,
            },
        });
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
}
