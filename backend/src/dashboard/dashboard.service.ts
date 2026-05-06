import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getBuyerDashboard(userId: string) {
        const [bids, watchlist, transactions, notifications] = await Promise.all([
            this.prisma.bid.count({ where: { bidderId: userId } }),
            this.prisma.watchlistItem.count({ where: { userId } }),
            this.prisma.transaction.findMany({
                where: { userId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { listing: true },
            }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        return {
            activeBids: bids,
            watchlistCount: watchlist,
            recentTransactions: transactions,
            unreadNotifications: notifications,
        };
    }

    async getUnifiedDashboard(userId: string) {
        const [
            activeBids,
            watchlistCount,
            totalListings,
            activeListings,
            soldListings,
            totalViews,
            totalRevenue,
            unreadMessages,
            incomingOffers
        ] = await Promise.all([
            // Buyer stats
            this.prisma.offer.count({ where: { buyerId: userId, status: 'PENDING' } }),
            this.prisma.watchlistItem.count({ where: { userId } }),
            // Seller stats
            this.prisma.listing.count({ where: { sellerId: userId, deletedAt: null } }),
            this.prisma.listing.count({ where: { sellerId: userId, status: 'ACTIVE', deletedAt: null } }),
            this.prisma.listing.count({ where: { sellerId: userId, status: 'SOLD', deletedAt: null } }),
            this.prisma.listing.aggregate({
                where: { sellerId: userId, deletedAt: null },
                _sum: { viewCount: true }
            }),
            // Revenue (from the new sales table)
            this.prisma.sale.aggregate({
                where: { sellerId: userId },
                _sum: { soldPrice: true }
            }),
            // Messaging & Notifications
            this.prisma.message.count({ 
                where: { 
                    chatRoom: { 
                        OR: [{ initiatorId: userId }, { participantId: userId }] 
                    },
                    senderId: { not: userId },
                    isRead: false
                }
            }),
            // Incoming offers for seller
            this.prisma.offer.count({
                where: {
                    listing: { sellerId: userId },
                    status: 'PENDING'
                }
            })
        ]);

        return {
            buyer: {
                activeBids,
                watchlistCount,
            },
            seller: {
                totalListings,
                activeListings,
                soldListings,
                totalViews: totalViews._sum.viewCount || 0,
                totalRevenue: Number(totalRevenue._sum.soldPrice || 0),
                incomingOffers
            },
            unreadMessages
        };
    }

    async getSellerDashboard(userId: string) {
        const [listings, activeAuctions, transactions, totalBids] = await Promise.all([
            this.prisma.listing.count({ where: { sellerId: userId } }),
            this.prisma.auction.count({
                where: {
                    listing: { sellerId: userId },
                    endTime: { gt: new Date() },
                },
            }),
            this.prisma.transaction.findMany({
                where: { listing: { sellerId: userId } },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: { listing: true, user: true },
            }),
            this.prisma.bid.count({
                where: { listing: { sellerId: userId } },
            }),
        ]);

        return {
            totalListings: listings,
            activeAuctions,
            recentSales: transactions,
            bidsReceived: totalBids,
        };
    }

    async getDealerDashboard(userId: string) {
        const sellerData = await this.getSellerDashboard(userId);
        const dealerProfile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
        });

        return {
            ...sellerData,
            profile: dealerProfile,
        };
    }

    async getContractorDashboard(userId: string) {
        const profile = await this.prisma.contractorProfile.findUnique({
            where: { userId },
        });

        if (!profile) return null;

        const [pending, active, completed] = await Promise.all([
            this.prisma.serviceRequest.count({ where: { contractorId: profile.id, status: 'PENDING' } }),
            this.prisma.serviceRequest.count({ where: { contractorId: profile.id, status: 'IN_PROGRESS' } }),
            this.prisma.serviceRequest.count({ where: { contractorId: profile.id, status: 'COMPLETED' } }),
        ]);

        const recentRequests = await this.prisma.serviceRequest.findMany({
            where: { contractorId: profile.id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { requester: true },
        });

        return {
            statusCounts: { pending, active, completed },
            recentRequests,
            profile,
        };
    }

    async getFinanceDashboard(userId: string) {
        const [pending, approved, rejected] = await Promise.all([
            this.prisma.financeApplication.count({ where: { status: 'PENDING' } }),
            this.prisma.financeApplication.count({ where: { status: 'APPROVED' } }),
            this.prisma.financeApplication.count({ where: { status: 'REJECTED' } }),
        ]);

        const recentApplications = await this.prisma.financeApplication.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { user: true, listing: true },
        });

        return {
            stats: { pending, approved, rejected },
            recentApplications,
        };
    }

    async getInsuranceDashboard(userId: string) {
        const [pending, quoted, declined] = await Promise.all([
            this.prisma.insuranceQuote.count({ where: { status: 'PENDING' } }),
            this.prisma.insuranceQuote.count({ where: { status: 'QUOTED' } }),
            this.prisma.insuranceQuote.count({ where: { status: 'REJECTED' } }),
        ]);

        const recentQuotes = await this.prisma.insuranceQuote.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { user: true, listing: true },
        });

        return {
            stats: { pending, quoted, declined },
            recentQuotes,
        };
    }

    async getAdminDashboard() {
        const [users, listings, auctions, revenue] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.listing.count(),
            this.prisma.auction.count({ where: { endTime: { gt: new Date() } } }),
            this.prisma.transaction.aggregate({
                _sum: { amount: true },
            }),
        ]);

        const recentUsers = await this.prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
        });

        return {
            totalUsers: users,
            totalListings: listings,
            activeAuctions: auctions,
            totalRevenue: revenue._sum.amount || 0,
            recentUsers,
        };
    }
}
