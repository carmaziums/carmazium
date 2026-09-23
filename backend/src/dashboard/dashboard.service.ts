import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, ServiceJobStatus } from '@prisma/client';
import { subDays, subMonths, subYears } from 'date-fns';
import { assertDealerPermission, resolveDealerActor } from '../dealers/dealer-access';

type DealerDashboardRangeOptions = {
    period?: '7d' | '30d';
    rangeValue?: number;
    rangeUnit?: 'days' | 'months' | 'years';
    allTime?: boolean;
    from?: string;
    to?: string;
    compare?: boolean;
};

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    private buildPeriodFilter(period: '7d' | '30d'): { gte: Date } {
        return { gte: subDays(new Date(), period === '7d' ? 7 : 30) };
    }

    async getBuyerDashboard(userId: string, period: '7d' | '30d' = '30d') {
        const dateFilter = this.buildPeriodFilter(period);
        const [
            activeBids,
            activeOffers,
            watchlistCount,
            wonAuctions,
            bids,
            offers,
            history,
        ] = await Promise.all([
            this.prisma.bid.count({
                where: {
                    bidderId: userId,
                    createdAt: dateFilter,
                    cancelledAt: null,
                    archivedAt: null,
                    listing: { auction: { status: 'ACTIVE' } },
                },
            }),
            this.prisma.offer.count({ where: { buyerId: userId, status: { in: ['PENDING', 'COUNTERED'] }, createdAt: dateFilter } }),
            this.prisma.watchlistItem.count({ where: { userId, createdAt: dateFilter } }),
            this.prisma.auction.count({ where: { winnerId: userId, createdAt: dateFilter } }),
            this.prisma.bid.findMany({
                where: { bidderId: userId, createdAt: dateFilter, cancelledAt: null },
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    amount: true,
                    createdAt: true,
                    archivedAt: true,
                    listingId: true,
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            images: true,
                            auction: {
                                select: {
                                    id: true,
                                    status: true,
                                    winnerId: true,
                                    winningBidAmount: true,
                                    endTime: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.offer.findMany({
                where: { buyerId: userId, createdAt: dateFilter },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: {
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            images: true,
                        },
                    },
                    seller: {
                        select: {
                            firstName: true,
                            lastName: true,
                            dealerProfile: { select: { companyName: true } },
                        },
                    },
                },
            }),
            this.prisma.sale.findMany({
                where: { buyerId: userId, createdAt: dateFilter },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { listing: { select: { title: true } } },
            }),
        ]);

        return {
            activeBids,
            activeOffers,
            watchlistCount,
            wonAuctions,
            bids: (bids as any[]).map(b => ({
                id: b.id,
                amount: Number(b.amount),
                auctionStatus: b.archivedAt ? 'ENDED' : (b.listing?.auction?.status ?? 'ENDED'),
                auctionId: b.listing?.auction?.id ?? null,
                isArchived: Boolean(b.archivedAt),
                isWinner: !b.archivedAt && b.listing?.auction?.winnerId === userId,
                winningBidAmount: b.listing?.auction?.winningBidAmount
                    ? Number(b.listing.auction.winningBidAmount)
                    : null,
                paymentDeadline: !b.archivedAt && b.listing?.auction?.endTime
                    ? new Date(new Date(b.listing.auction.endTime).getTime() + 24 * 60 * 60 * 1000).toISOString()
                    : null,
                bidCount: null,
                listing: {
                    id: b.listing?.id ?? null,
                    title: b.listing?.title ?? 'Vehicle',
                    images: b.listing?.images ?? [],
                },
                listingId: b.listingId,
                createdAt: b.createdAt,
            })),
            offers: (offers as any[]).map(o => ({
                id: o.id,
                amount: Number(o.amount),
                status: o.status,
                listing: {
                    id: o.listing?.id ?? null,
                    title: o.listing?.title ?? 'Vehicle',
                    images: o.listing?.images ?? [],
                },
                seller: o.seller
                    ? {
                          firstName: o.seller.firstName,
                          lastName: o.seller.lastName,
                          dealerProfile: o.seller.dealerProfile
                              ? { companyName: o.seller.dealerProfile.companyName }
                              : null,
                      }
                    : null,
                listingId: o.listingId,
                createdAt: o.createdAt,
            })),
            history: history.map(s => ({
                id: s.id,
                price: Number(s.soldPrice),
                listing: { title: s.listing?.title ?? 'Vehicle' },
                listingId: s.listingId,
                createdAt: s.createdAt,
            })),
        };
    }

    async getUnifiedDashboard(userId: string) {
        // Handle staff/owner logic to show dealership stats to staff
        let targetOwnerId = userId;
        try {
            const staffRecord = await this.prisma.dealerStaff.findFirst({
                where: { userId, isActive: true },
                select: { dealerProfile: { select: { userId: true } } }
            });
            if (staffRecord) {
                targetOwnerId = staffRecord.dealerProfile.userId;
            }
        } catch (err) {
            console.error('Staff lookup failed, falling back to user ID:', err.message);
        }

        const [
            activeBids,
            watchlistCount,
            buyerCounteredOffers,
            totalListings,
            activeListings,
            soldListings,
            totalViews,
            totalRevenue,
            unreadMessages,
            incomingOffers
        ] = await Promise.all([
            // Buyer stats (Always specific to the logged-in user)
            this.prisma.offer.count({ where: { buyerId: userId, status: 'PENDING' } }),
            this.prisma.watchlistItem.count({ where: { userId } }),
            // Buyer: seller countered — needs accept/decline in My Offers
            this.prisma.offer.count({ where: { buyerId: userId, status: 'COUNTERED' } }),
            
            // Seller/Dealer stats (Aggregated for the dealership if staff)
            // Phase 10: include SOLD in total count — no status filter intentional (DRAFT + ACTIVE + SOLD all count)
            this.prisma.listing.count({ where: { sellerId: targetOwnerId, deletedAt: null } }),
            // Phase 10: activeListings intentionally ACTIVE only — this is the current live inventory count
            this.prisma.listing.count({ where: { sellerId: targetOwnerId, status: 'ACTIVE', deletedAt: null } }),
            // Phase 10: soldListings correctly counts only SOLD — used for sold count stat
            this.prisma.listing.count({ where: { sellerId: targetOwnerId, status: 'SOLD', deletedAt: null } }),
            this.prisma.listing.aggregate({
                where: { sellerId: targetOwnerId, deletedAt: null },
                _sum: { viewCount: true }
            }),
            
            // Revenue tracking (Aggregated for the dealership if staff)
            this.prisma.sale.aggregate({
                where: { sellerId: targetOwnerId },
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
            
            // Incoming offers for seller/dealer
            this.prisma.offer.count({
                where: {
                    listing: { sellerId: targetOwnerId },
                    status: 'PENDING'
                }
            })
        ]);

        return {
            buyer: {
                activeBids,
                watchlistCount,
                counteredOffersPending: buyerCounteredOffers,
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

    async getSellerDashboard(userId: string, period: '7d' | '30d' = '30d') {
        const dateFilter = this.buildPeriodFilter(period);
        const [activeListings, activeAuctions, offerCount, savedCount, offers, earnings] = await Promise.all([
            this.prisma.listing.count({ where: { sellerId: userId, status: 'ACTIVE', deletedAt: null, createdAt: dateFilter } }),
            this.prisma.auction.count({
                where: { listing: { sellerId: userId }, endTime: { gt: new Date() }, createdAt: dateFilter },
            }),
            this.prisma.offer.count({
                where: { listing: { sellerId: userId }, status: { in: ['PENDING', 'COUNTERED'] }, createdAt: dateFilter },
            }),
            this.prisma.watchlistItem.count({
                where: { listing: { sellerId: userId }, createdAt: dateFilter },
            }),
            this.prisma.offer.findMany({
                where: { listing: { sellerId: userId }, status: { in: ['PENDING', 'COUNTERED'] }, createdAt: dateFilter },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: {
                    listing: { select: { title: true } },
                    buyer: { select: { firstName: true, lastName: true } },
                },
            }),
            this.prisma.sale.findMany({
                where: { sellerId: userId, createdAt: dateFilter },
                take: 20,
                orderBy: { createdAt: 'desc' },
                include: { listing: { select: { title: true } } },
            }),
        ]);

        return {
            activeListings,
            activeAuctions,
            offerCount,
            savedCount,
            enquiries: offerCount,
            offers: offers.map(o => ({
                id: o.id,
                amount: Number(o.amount),
                status: o.status,
                listing: { title: o.listing.title },
                buyer: o.buyer,
            })),
            earnings: earnings.map(s => ({
                id: s.id,
                soldPrice: Number(s.soldPrice),
                platformFee: Number(s.soldPrice) * 0.025,
                net: Number(s.soldPrice) * 0.975,
                listing: { title: s.listing?.title ?? 'Vehicle' },
                createdAt: s.createdAt,
            })),
        };
    }

    async getDealerDashboard(userId: string, options: DealerDashboardRangeOptions | '7d' | '30d' = {}) {
        const rangeOptions: DealerDashboardRangeOptions =
            typeof options === 'string' ? { period: options } : options;

        const actor = await resolveDealerActor(this.prisma, userId);
        assertDealerPermission(actor, 'VIEW_ANALYTICS');

        const ownerUserId = actor.ownerUserId;
        const dealerProfileId = actor.dealerProfileId;
        const now = new Date();

        const dealerProfile = await this.prisma.dealerProfile.findUnique({
            where: { id: dealerProfileId },
            select: {
                companyName: true,
                createdAt: true,
                staff: {
                    where: { isActive: true },
                    select: { id: true },
                },
            },
        });

        const accountCreatedAt = dealerProfile?.createdAt ?? now;
        const safeDate = (value?: string) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const requestedTo = safeDate(rangeOptions.to);
        const rangeEnd = requestedTo && requestedTo < now ? requestedTo : now;

        let rangeStart: Date;
        let rangeLabel: string;

        const requestedFrom = safeDate(rangeOptions.from);
        if (requestedFrom) {
            rangeStart = requestedFrom;
            rangeLabel = 'Custom range';
        } else if (rangeOptions.allTime) {
            rangeStart = accountCreatedAt;
            rangeLabel = 'All time';
        } else {
            const legacyDays = rangeOptions.period === '7d' ? 7 : rangeOptions.period === '30d' ? 30 : undefined;
            const rawValue = rangeOptions.rangeValue ?? legacyDays ?? 30;
            const value = Math.min(Math.max(Math.floor(rawValue || 1), 1), 10000);
            const unit = rangeOptions.rangeUnit ?? 'days';

            if (unit === 'months') {
                rangeStart = subMonths(rangeEnd, value);
                rangeLabel = `Last ${value} month${value === 1 ? '' : 's'}`;
            } else if (unit === 'years') {
                rangeStart = subYears(rangeEnd, value);
                rangeLabel = `Last ${value} year${value === 1 ? '' : 's'}`;
            } else {
                rangeStart = subDays(rangeEnd, value);
                rangeLabel = `Last ${value} day${value === 1 ? '' : 's'}`;
            }
        }

        if (rangeStart < accountCreatedAt) {
            rangeStart = accountCreatedAt;
            if (!rangeOptions.from && !rangeOptions.allTime) {
                rangeLabel = 'Since account creation';
            }
        }
        if (rangeStart > rangeEnd) {
            rangeStart = rangeEnd;
        }

        const dateFilter = { gte: rangeStart, lte: rangeEnd };

        const [
            activeListings,
            activeAuctions,
            soldListings,
            leadCounts,
            allTimeViewAgg,
            totalRevenue,
            trackedViewsRaw,
            leadsCreated,
        ] = await Promise.all([
            this.prisma.listing.count({
                where: {
                    sellerId: ownerUserId,
                    status: 'ACTIVE',
                    deletedAt: null,
                },
            }),
            this.prisma.auction.count({
                where: {
                    listing: { sellerId: ownerUserId, deletedAt: null },
                    endTime: { gt: now },
                    status: 'ACTIVE',
                },
            }),
            this.prisma.sale.count({
                where: {
                    sellerId: ownerUserId,
                    createdAt: dateFilter,
                },
            }),
            this.prisma.lead.groupBy({
                by: ['status'],
                where: { dealerProfileId },
                _count: { status: true },
            }),
            this.prisma.listing.aggregate({
                where: { sellerId: ownerUserId, deletedAt: null },
                _sum: { viewCount: true },
                _count: { id: true },
            }),
            this.prisma.sale.aggregate({
                where: {
                    sellerId: ownerUserId,
                    createdAt: dateFilter,
                },
                _sum: { soldPrice: true },
            }),
            this.prisma.$queryRaw<Array<{ views: bigint }>>`
                SELECT COUNT(*)::bigint AS views
                FROM analytics_events ae
                INNER JOIN listings l
                    ON l.id = ae.payload->>'item_id'
                WHERE ae.type = 'view_item'
                  AND ae."createdAt" >= ${rangeStart}
                  AND ae."createdAt" <= ${rangeEnd}
                  AND l."sellerId" = ${ownerUserId}
                  AND l."deletedAt" IS NULL
            `,
            this.prisma.lead.count({
                where: {
                    dealerProfileId,
                    createdAt: dateFilter,
                },
            }),
        ]);

        const funnelMap: Record<string, number> = {};
        for (const row of leadCounts as any[]) {
            funnelMap[row.status] = row._count.status;
        }

        const totalLeads = Object.values(funnelMap).reduce((a, b) => a + b, 0);
        const wonLeads = funnelMap['WON'] ?? 0;
        const lostLeads = funnelMap['LOST'] ?? 0;
        const activeLeads = Math.max(0, totalLeads - wonLeads - lostLeads);
        const totalViews = Number(trackedViewsRaw?.[0]?.views ?? 0);
        const allTimeViews = Number(allTimeViewAgg._sum.viewCount ?? 0);
        const totalListings = Number(allTimeViewAgg._count?.id ?? 0);
        const revenue = Number(totalRevenue._sum.soldPrice ?? 0);

        let comparison: any = null;
        if (rangeOptions.compare) {
            const durationMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
            const previousEnd = new Date(rangeStart.getTime() - 1);
            const previousStart = new Date(Math.max(
                accountCreatedAt.getTime(),
                previousEnd.getTime() - durationMs,
            ));

            if (previousEnd >= accountCreatedAt && previousStart <= previousEnd) {
                const previousFilter = { gte: previousStart, lte: previousEnd };
                const [previousSold, previousRevenue, previousViewsRaw, previousLeadsCreated] = await Promise.all([
                    this.prisma.sale.count({
                        where: { sellerId: ownerUserId, createdAt: previousFilter },
                    }),
                    this.prisma.sale.aggregate({
                        where: { sellerId: ownerUserId, createdAt: previousFilter },
                        _sum: { soldPrice: true },
                    }),
                    this.prisma.$queryRaw<Array<{ views: bigint }>>`
                        SELECT COUNT(*)::bigint AS views
                        FROM analytics_events ae
                        INNER JOIN listings l
                            ON l.id = ae.payload->>'item_id'
                        WHERE ae.type = 'view_item'
                          AND ae."createdAt" >= ${previousStart}
                          AND ae."createdAt" <= ${previousEnd}
                          AND l."sellerId" = ${ownerUserId}
                          AND l."deletedAt" IS NULL
                    `,
                    this.prisma.lead.count({
                        where: { dealerProfileId, createdAt: previousFilter },
                    }),
                ]);

                const previousViews = Number(previousViewsRaw?.[0]?.views ?? 0);
                const previousRevenueValue = Number(previousRevenue._sum.soldPrice ?? 0);
                const percentChange = (current: number, previous: number) => {
                    if (previous === 0) return current === 0 ? 0 : null;
                    return Math.round(((current - previous) / previous) * 1000) / 10;
                };

                comparison = {
                    available: true,
                    from: previousStart.toISOString(),
                    to: previousEnd.toISOString(),
                    totalViews: {
                        current: totalViews,
                        previous: previousViews,
                        percentChange: percentChange(totalViews, previousViews),
                    },
                    soldListings: {
                        current: soldListings,
                        previous: previousSold,
                        percentChange: percentChange(soldListings, previousSold),
                    },
                    totalRevenue: {
                        current: revenue,
                        previous: previousRevenueValue,
                        percentChange: percentChange(revenue, previousRevenueValue),
                    },
                    leadsCreated: {
                        current: leadsCreated,
                        previous: previousLeadsCreated,
                        percentChange: percentChange(leadsCreated, previousLeadsCreated),
                    },
                };
            } else {
                comparison = { available: false };
            }
        }

        return {
            companyName: dealerProfile?.companyName ?? 'Your Dealership',
            isVerified: actor.isVerified,
            accountCreatedAt: accountCreatedAt.toISOString(),
            range: {
                from: rangeStart.toISOString(),
                to: rangeEnd.toISOString(),
                label: rangeLabel,
                allTime: rangeOptions.allTime === true,
            },

            // Current snapshot KPIs
            activeListings,
            activeAuctions,
            activeLeads,
            staffCount: (dealerProfile?.staff?.length ?? 0) + 1,

            // Selected-range KPIs
            totalViews,
            soldListings,
            soldThisMonth: soldListings,
            totalRevenue: revenue,
            leadsCreated,
            comparison,

            // Supporting analytics
            allTimeViews,
            totalLeads,
            leadFunnel: {
                NEW:         funnelMap['NEW']         ?? 0,
                CONTACTED:   funnelMap['CONTACTED']   ?? 0,
                QUALIFIED:   funnelMap['QUALIFIED']   ?? 0,
                NEGOTIATING: funnelMap['NEGOTIATING'] ?? 0,
                WON:         wonLeads,
                LOST:        lostLeads,
            },
            conversionRate: totalLeads > 0 ? wonLeads / totalLeads : 0,
            avgViews: totalListings > 0
                ? Math.round(allTimeViews / totalListings)
                : 0,
        };
    }

    async getContractorDashboard(userId: string) {
        const profile = await this.prisma.contractorProfile.findUnique({
            where: { userId },
        });

        if (!profile) return null;

        // Reads ServiceJob, not the retired ServiceRequest model. ServiceRequest
        // was removed from the schema while these four calls were left behind, so
        // `this.prisma.serviceRequest` was undefined at runtime and every request
        // to GET /dashboard/contractor threw before returning anything. The build
        // did not catch it because SWC strips types without checking them.
        const [pending, active, completed] = await Promise.all([
            this.prisma.serviceJob.count({
                where: { contractorId: profile.id, status: { in: [ServiceJobStatus.ACCEPTED, ServiceJobStatus.PAID] } },
            }),
            this.prisma.serviceJob.count({
                where: { contractorId: profile.id, status: ServiceJobStatus.IN_PROGRESS },
            }),
            this.prisma.serviceJob.count({
                where: { contractorId: profile.id, status: { in: [ServiceJobStatus.COMPLETED, ServiceJobStatus.RELEASED] } },
            }),
        ]);

        const recentRequests = await this.prisma.serviceJob.findMany({
            where: { contractorId: profile.id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: {
                    select: { id: true, firstName: true, lastName: true, email: true, role: true },
                },
            },
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
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                listing: { select: { id: true, title: true, price: true, status: true } },
            },
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
            include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
                listing: { select: { id: true, title: true, price: true, status: true } },
            },
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
            select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
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
