import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { subDays } from 'date-fns';
import { EmailService } from '../email/email.service';
import { CreateKycDto } from './dto/create-kyc.dto';

@Injectable()
export class DealersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) {}

    // ─── Profile helpers ────────────────────────────────────────────

    /** Get the DealerProfile for a user (owner or staff), or throw */
    async getDealerProfile(userId: string) {
        // 1. Check if user is the primary owner
        let profile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profileImage: true } } } } },
        });

        // 2. If not owner, check if they are a staff member
        if (!profile) {
            const staffRecord = await this.prisma.dealerStaff.findFirst({
                where: { userId, isActive: true },
                include: { dealerProfile: { include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profileImage: true } } } } } } },
            });
            if (staffRecord) {
                profile = staffRecord.dealerProfile as any;
            }
        }

        if (!profile) throw new NotFoundException('Dealer profile not found');
        return profile;
    }

    /** Get the KYC record for a dealer */
    async getKyc(userId: string) {
        const profile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            include: { kyc: true },
        });

        if (!profile) throw new NotFoundException('Dealer profile not found');
        return profile.kyc;
    }

    /** Submit/Update the KYC record for a dealer */
    async submitKyc(userId: string, dto: CreateKycDto) {
        const profile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            include: { kyc: true, user: true },
        });

        if (!profile) throw new NotFoundException('Dealer profile not found');

        const fieldsList = [
            'companyHouseName',
            'representativeName',
            'representativePosition',
            'vatNumber',
            'companyRegistrationNumber',
            'personOfSignificantControl',
            'directorName',
            'businessWebsite',
            'businessRegisteredAddress',
            'tradingAddress',
            'googleReviewsLink',
            'paymentReference',
            'paymentScreenshot',
        ];

        let documentStatuses: Record<string, any> = {};
        const updatedFields: Record<string, any> = {};

        if (profile.kyc) {
            // Existing KYC record
            const existingStatuses = (profile.kyc.documentStatuses as Record<string, any>) || {};
            
            for (const field of fieldsList) {
                const existingFieldStatus = existingStatuses[field]?.status;
                if (existingFieldStatus === 'APPROVED') {
                    // Lock: keep existing value and approved status
                    updatedFields[field] = (profile.kyc as any)[field];
                    documentStatuses[field] = existingStatuses[field];
                } else {
                    // Update: use new value, set to PENDING
                    updatedFields[field] = (dto as any)[field] ?? null;
                    documentStatuses[field] = {
                        status: 'PENDING',
                        note: '',
                    };
                }
            }

            // Update the KYC record
            const updatedKyc = await this.prisma.dealerKyc.update({
                where: { id: profile.kyc.id },
                data: {
                    ...updatedFields,
                    status: 'PENDING',
                    documentStatuses,
                    submittedAt: new Date(),
                } as any,
            });

            // Alert admins
            await this.notifyAdminsOfKycSubmission(profile.companyName);

            return updatedKyc;
        } else {
            // New KYC record
            for (const field of fieldsList) {
                updatedFields[field] = (dto as any)[field] ?? null;
                documentStatuses[field] = {
                    status: 'PENDING',
                    note: '',
                };
            }

            const newKyc = await this.prisma.dealerKyc.create({
                data: {
                    ...updatedFields,
                    dealerProfileId: profile.id,
                    status: 'PENDING',
                    documentStatuses,
                    submittedAt: new Date(),
                } as any,
            });

            // Alert admins
            await this.notifyAdminsOfKycSubmission(profile.companyName);

            return newKyc;
        }
    }

    private async notifyAdminsOfKycSubmission(companyName: string) {
        try {
            const admins = await this.prisma.user.findMany({
                where: { role: 'ADMIN' },
                select: { email: true },
            });
            const adminEmails = admins.map((a) => a.email).filter(Boolean);
            if (adminEmails.length > 0) {
                await this.emailService.sendKycSubmissionAdminAlert(adminEmails, companyName);
            }
        } catch (err) {
            console.error('Failed to send admin KYC submission alert email:', err);
        }
    }

    // ─── Dashboard KPIs ─────────────────────────────────────────────

    async getStats(userId: string) {
        const profile = await this.getDealerProfile(userId);

        // The dealership owner's userId is the canonical sellerId for all listings/sales
        // belonging to this dealership. Staff members must aggregate against the owner's
        // ID, not their own, otherwise dealer revenue would always read as zero for staff.
        const ownerUserId = (profile as any).userId ?? userId;

        const [activeListings, totalViews, soldListings, activeLeads, totalLeads, recentLeads, totalRevenue] = await Promise.all([
            this.prisma.listing.count({ where: { sellerId: ownerUserId, status: 'ACTIVE', deletedAt: null } }),
            this.prisma.listing.aggregate({ where: { sellerId: ownerUserId, deletedAt: null }, _sum: { viewCount: true } }),
            this.prisma.listing.count({ where: { sellerId: ownerUserId, status: 'SOLD', deletedAt: null } }),
            this.prisma.lead.count({ where: { dealerProfileId: profile.id, status: { notIn: ['WON', 'LOST'] } } }),
            this.prisma.lead.count({ where: { dealerProfileId: profile.id } }),
            this.prisma.lead.findMany({
                where: { dealerProfileId: profile.id },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    listing: { select: { title: true, slug: true } },
                    assignedTo: { select: { firstName: true, lastName: true } },
                },
            }),
            // Total dealership revenue sourced from Sale.soldPrice — same source-of-truth
            // used by /listings/earnings and /dashboard/unified, so the three KPIs match.
            this.prisma.sale.aggregate({
                where: { sellerId: ownerUserId },
                _sum: { soldPrice: true },
            }),
        ]);

        return {
            companyName: profile.companyName,
            isVerified: profile.isVerified,
            activeListings,
            totalViews: totalViews._sum.viewCount || 0,
            soldListings,
            activeLeads,
            totalLeads,
            totalRevenue: Number(totalRevenue._sum.soldPrice || 0),
            recentLeads,
            staffCount: profile.staff.length,
        };
    }

    // ─── Analytics ──────────────────────────────────────────────────

    private buildDateFilter(range: string, from?: string, to?: string): { gte: Date; lte?: Date } {
        const now = new Date();
        if (range === '7d') return { gte: subDays(now, 7) };
        if (range === '90d') return { gte: subDays(now, 90) };
        if (range === 'custom' && from && to) return { gte: new Date(from), lte: new Date(to) };
        return { gte: subDays(now, 30) }; // default 30d
    }

    private getPreviousPeriodFilter(range: string, from?: string, to?: string): { gte: Date; lte: Date } {
        const now = new Date();
        if (range === '7d') return { gte: subDays(now, 14), lte: subDays(now, 7) };
        if (range === '90d') return { gte: subDays(now, 180), lte: subDays(now, 90) };
        if (range === 'custom' && from && to) {
            const start = new Date(from);
            const end = new Date(to);
            const span = end.getTime() - start.getTime();
            return { gte: new Date(start.getTime() - span), lte: start };
        }
        return { gte: subDays(now, 60), lte: subDays(now, 30) }; // default prev 30d
    }

    private calcTrend(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    async getAnalytics(userId: string, range = '30d', from?: string, to?: string) {
        const profile = await this.getDealerProfile(userId);
        const ownerUserId = (profile as any).userId ?? userId;

        const dateFilter = this.buildDateFilter(range, from, to);
        const prevFilter = this.getPreviousPeriodFilter(range, from, to);

        // ─── Current Period KPIs ─────────────────────────────────────

        const [
            currentRevenue,
            currentUnitsSold,
            currentOfferTotal,
            currentOfferAccepted,
            currentLeadTotal,
            currentLeadWon,
            currentAvgViews,
            // Previous period for trend comparison
            prevRevenue,
            prevUnitsSold,
            prevOfferTotal,
            prevOfferAccepted,
            prevLeadTotal,
            prevLeadWon,
            prevAvgViews,
        ] = await Promise.all([
            // Current period
            this.prisma.sale.aggregate({
                where: { sellerId: ownerUserId, createdAt: dateFilter },
                _sum: { soldPrice: true },
            }),
            this.prisma.sale.count({
                where: { sellerId: ownerUserId, createdAt: dateFilter },
            }),
            this.prisma.offer.count({
                where: { listing: { sellerId: ownerUserId }, createdAt: dateFilter },
            }),
            this.prisma.offer.count({
                where: { listing: { sellerId: ownerUserId }, status: 'ACCEPTED', createdAt: dateFilter },
            }),
            this.prisma.lead.count({
                where: { dealerProfileId: profile.id, createdAt: dateFilter },
            }),
            this.prisma.lead.count({
                where: { dealerProfileId: profile.id, status: 'WON', createdAt: dateFilter },
            }),
            this.prisma.listing.aggregate({
                where: { sellerId: ownerUserId, deletedAt: null, createdAt: dateFilter },
                _avg: { viewCount: true },
            }),
            // Previous period (for trend %)
            this.prisma.sale.aggregate({
                where: { sellerId: ownerUserId, createdAt: prevFilter },
                _sum: { soldPrice: true },
            }),
            this.prisma.sale.count({
                where: { sellerId: ownerUserId, createdAt: prevFilter },
            }),
            this.prisma.offer.count({
                where: { listing: { sellerId: ownerUserId }, createdAt: prevFilter },
            }),
            this.prisma.offer.count({
                where: { listing: { sellerId: ownerUserId }, status: 'ACCEPTED', createdAt: prevFilter },
            }),
            this.prisma.lead.count({
                where: { dealerProfileId: profile.id, createdAt: prevFilter },
            }),
            this.prisma.lead.count({
                where: { dealerProfileId: profile.id, status: 'WON', createdAt: prevFilter },
            }),
            this.prisma.listing.aggregate({
                where: { sellerId: ownerUserId, deletedAt: null, createdAt: prevFilter },
                _avg: { viewCount: true },
            }),
        ]);

        const totalRev = Number(currentRevenue._sum.soldPrice || 0);
        const prevTotalRev = Number(prevRevenue._sum.soldPrice || 0);
        const offerConvRate = currentOfferTotal > 0 ? Math.round((currentOfferAccepted / currentOfferTotal) * 1000) / 10 : 0;
        const prevOfferConvRate = prevOfferTotal > 0 ? Math.round((prevOfferAccepted / prevOfferTotal) * 1000) / 10 : 0;
        const leadConvRate = currentLeadTotal > 0 ? Math.round((currentLeadWon / currentLeadTotal) * 1000) / 10 : 0;
        const prevLeadConvRate = prevLeadTotal > 0 ? Math.round((prevLeadWon / prevLeadTotal) * 1000) / 10 : 0;
        const avgViews = Math.round(currentAvgViews._avg.viewCount || 0);
        const prevAvgViewsVal = Math.round(prevAvgViews._avg.viewCount || 0);

        // ─── Revenue Trend (by month, last 12 months max) ───────────

        const revenueTrendRaw = await this.prisma.$queryRawUnsafe<Array<{ month: string; revenue: string; units: string }>>(
            `SELECT 
                TO_CHAR(s."createdAt", 'YYYY-MM') AS month,
                SUM(s."soldPrice")::TEXT AS revenue,
                COUNT(*)::TEXT AS units
             FROM sales s
             WHERE s."sellerId" = $1
               AND s."createdAt" >= $2
             GROUP BY TO_CHAR(s."createdAt", 'YYYY-MM')
             ORDER BY month ASC`,
            ownerUserId,
            subDays(new Date(), 365),
        );

        const revenueTrend = revenueTrendRaw.map(r => ({
            month: r.month,
            revenue: Number(r.revenue || 0),
            unitsSold: Number(r.units || 0),
        }));

        // ─── Lead Funnel ─────────────────────────────────────────────

        const leadsByStatus = await this.prisma.lead.groupBy({
            by: ['status'],
            where: { dealerProfileId: profile.id },
            _count: true,
        });

        const leadFunnel: Record<string, number> = {
            NEW: 0, CONTACTED: 0, QUALIFIED: 0, NEGOTIATING: 0, WON: 0, LOST: 0,
        };
        leadsByStatus.forEach(l => { leadFunnel[l.status] = l._count; });

        // ─── Offer Breakdown ─────────────────────────────────────────

        const offersByStatus = await this.prisma.offer.groupBy({
            by: ['status'],
            where: { listing: { sellerId: ownerUserId } },
            _count: true,
        });

        const offerBreakdown: Record<string, number> = {
            PENDING: 0, ACCEPTED: 0, REJECTED: 0, COUNTERED: 0, WITHDRAWN: 0,
        };
        offersByStatus.forEach(o => { offerBreakdown[o.status] = o._count; });

        // Average accepted offer amount
        const avgAccepted = await this.prisma.offer.aggregate({
            where: { listing: { sellerId: ownerUserId }, status: 'ACCEPTED' },
            _avg: { amount: true },
        });

        // Average response time (hours between offer creation and update for non-pending)
        const avgResponseRaw = await this.prisma.$queryRawUnsafe<Array<{ avg_hours: string }>>(
            `SELECT AVG(EXTRACT(EPOCH FROM (o."updatedAt" - o."createdAt")) / 3600)::TEXT AS avg_hours
             FROM offers o
             JOIN listings l ON o."listingId" = l.id
             WHERE l."sellerId" = $1
               AND o.status != 'PENDING'`,
            ownerUserId,
        );

        // ─── Inventory Health ────────────────────────────────────────

        const listingsByStatus = await this.prisma.listing.groupBy({
            by: ['status'],
            where: { sellerId: ownerUserId, deletedAt: null },
            _count: true,
        });

        const inventoryHealth: Record<string, number> = {
            DRAFT: 0, ACTIVE: 0, OFFER_ACCEPTED: 0, SOLD: 0, WITHDRAWN: 0,
        };
        listingsByStatus.forEach(l => { inventoryHealth[l.status] = l._count; });

        // Average listing age + stale count (active listings > 60 days)
        const agingRaw = await this.prisma.$queryRawUnsafe<Array<{ avg_days: string; stale_count: string }>>(
            `SELECT 
                AVG(EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400)::TEXT AS avg_days,
                COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400 > 60)::TEXT AS stale_count
             FROM listings l
             WHERE l."sellerId" = $1
               AND l."deletedAt" IS NULL
               AND l.status = 'ACTIVE'`,
            ownerUserId,
        );

        // Aging buckets for active listings
        const agingBucketsRaw = await this.prisma.$queryRawUnsafe<Array<{ bucket: string; count: string }>>(
            `SELECT 
                CASE 
                    WHEN EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400 <= 7 THEN '0-7d'
                    WHEN EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400 <= 30 THEN '8-30d'
                    WHEN EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400 <= 60 THEN '31-60d'
                    ELSE '60d+'
                END AS bucket,
                COUNT(*)::TEXT AS count
             FROM listings l
             WHERE l."sellerId" = $1
               AND l."deletedAt" IS NULL
               AND l.status = 'ACTIVE'
             GROUP BY bucket
             ORDER BY MIN(EXTRACT(EPOCH FROM (NOW() - l."createdAt")) / 86400) ASC`,
            ownerUserId,
        );

        const agingBuckets: Record<string, number> = { '0-7d': 0, '8-30d': 0, '31-60d': 0, '60d+': 0 };
        agingBucketsRaw.forEach(b => { agingBuckets[b.bucket] = Number(b.count); });

        // ─── Top Performing Vehicles ─────────────────────────────────

        const topVehiclesRaw = await this.prisma.listing.findMany({
            where: { sellerId: ownerUserId, deletedAt: null },
            orderBy: { viewCount: 'desc' },
            take: 10,
            select: {
                id: true,
                title: true,
                images: true,
                viewCount: true,
                price: true,
                status: true,
                createdAt: true,
                _count: { select: { offers: true } },
            },
        });

        const topVehicles = topVehiclesRaw.map(v => ({
            id: v.id,
            title: v.title,
            image: v.images?.[0] || null,
            views: v.viewCount,
            offerCount: v._count.offers,
            price: Number(v.price),
            status: v.status,
            daysListed: Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86400000),
        }));

        // ─── Avg Days to Sell ────────────────────────────────────────

        const avgDaysRaw = await this.prisma.$queryRawUnsafe<Array<{ avg_days: string }>>(
            `SELECT AVG(EXTRACT(EPOCH FROM (s."createdAt" - l."createdAt")) / 86400)::TEXT AS avg_days
             FROM sales s
             JOIN listings l ON s."listingId" = l.id
             WHERE s."sellerId" = $1
               AND s."createdAt" >= $2`,
            ownerUserId,
            dateFilter.gte,
        );

        const prevAvgDaysRaw = await this.prisma.$queryRawUnsafe<Array<{ avg_days: string }>>(
            `SELECT AVG(EXTRACT(EPOCH FROM (s."createdAt" - l."createdAt")) / 86400)::TEXT AS avg_days
             FROM sales s
             JOIN listings l ON s."listingId" = l.id
             WHERE s."sellerId" = $1
               AND s."createdAt" >= $2
               AND s."createdAt" < $3`,
            ownerUserId,
            prevFilter.gte,
            prevFilter.lte,
        );

        const avgDaysToSell = Math.round(Number(avgDaysRaw?.[0]?.avg_days || 0));
        const prevAvgDaysToSell = Math.round(Number(prevAvgDaysRaw?.[0]?.avg_days || 0));

        return {
            kpis: {
                totalRevenue: totalRev,
                totalRevenueTrend: this.calcTrend(totalRev, prevTotalRev),
                totalUnitsSold: currentUnitsSold,
                totalUnitsSoldTrend: this.calcTrend(currentUnitsSold, prevUnitsSold),
                avgDaysToSell,
                avgDaysToSellTrend: this.calcTrend(prevAvgDaysToSell, avgDaysToSell), // inverted — lower is better
                offerConversionRate: offerConvRate,
                offerConversionRateTrend: this.calcTrend(offerConvRate, prevOfferConvRate),
                leadConversionRate: leadConvRate,
                leadConversionRateTrend: this.calcTrend(leadConvRate, prevLeadConvRate),
                avgViewsPerListing: avgViews,
                avgViewsPerListingTrend: this.calcTrend(avgViews, prevAvgViewsVal),
            },
            revenueTrend,
            leadFunnel,
            offerBreakdown: {
                ...offerBreakdown,
                avgAcceptedAmount: Number(avgAccepted._avg.amount || 0),
                avgTimeToRespond: Math.round(Number(avgResponseRaw?.[0]?.avg_hours || 0) * 10) / 10,
            },
            inventoryHealth: {
                ...inventoryHealth,
                avgAge: Math.round(Number(agingRaw?.[0]?.avg_days || 0)),
                staleCount: Number(agingRaw?.[0]?.stale_count || 0),
                agingBuckets,
            },
            topVehicles,
        };
    }

    // ─── Leads (CRM) ───────────────────────────────────────────────

    async getLeads(userId: string, status?: string, page = 1, limit = 20) {
        const profile = await this.getDealerProfile(userId);

        const where: any = { dealerProfileId: profile.id };
        if (status) where.status = status;

        const [data, total] = await Promise.all([
            this.prisma.lead.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    listing: { select: { id: true, title: true, slug: true, images: true, price: true } },
                    assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            }),
            this.prisma.lead.count({ where }),
        ]);

        return { data, total };
    }

    async createLead(userId: string, dto: CreateLeadDto) {
        const profile = await this.getDealerProfile(userId);

        return this.prisma.lead.create({
            data: {
                dealerProfileId: profile.id,
                buyerName: dto.buyerName,
                buyerEmail: dto.buyerEmail,
                buyerPhone: dto.buyerPhone,
                listingId: dto.listingId,
                assignedToId: dto.assignedToId,
                source: dto.source,
                notes: dto.notes,
            },
            include: {
                listing: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    async updateLead(userId: string, leadId: string, dto: UpdateLeadDto) {
        const profile = await this.getDealerProfile(userId);

        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, dealerProfileId: profile.id },
        });
        if (!lead) throw new NotFoundException('Lead not found');

        return this.prisma.lead.update({
            where: { id: leadId },
            data: {
                ...(dto.status && { status: dto.status as any }),
                ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
            },
            include: {
                listing: { select: { id: true, title: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } },
            },
        });
    }

    // ─── Staff (RBAC) ───────────────────────────────────────────────

    async getStaff(userId: string) {
        const profile = await this.getDealerProfile(userId);
        
        const [activeStaff, pendingInvites] = await Promise.all([
            this.prisma.dealerStaff.findMany({
                where: { dealerProfileId: profile.id, isActive: true },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true, profileImage: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.dealerInvite.findMany({
                where: { dealerProfileId: profile.id },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        return {
            active: activeStaff,
            pending: pendingInvites.map(i => ({
                id: i.id,
                email: i.email,
                role: i.role,
                status: 'PENDING',
                createdAt: i.createdAt,
            })),
        };
    }

    async inviteStaff(userId: string, dto: InviteStaffDto) {
        const profile = await this.getDealerProfile(userId);
        const email = dto.email.toLowerCase().trim();

        // 1. If user exists, add them directly
        const targetUser = await this.prisma.user.findUnique({ where: { email } });
        if (targetUser) {
            const existing = await this.prisma.dealerStaff.findUnique({
                where: { userId_dealerProfileId: { userId: targetUser.id, dealerProfileId: profile.id } },
            });
            if (existing) throw new BadRequestException('User is already a staff member of this dealership');

            return this.prisma.dealerStaff.create({
                data: {
                    userId: targetUser.id,
                    dealerProfileId: profile.id,
                    role: dto.role as any,
                },
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
            });
        }

        // 2. If user doesn't exist, create a pending invitation
        const existingInvite = await this.prisma.dealerInvite.findUnique({
            where: { email_dealerProfileId: { email, dealerProfileId: profile.id } },
        });
        if (existingInvite) throw new BadRequestException('An invitation has already been sent to this email');

        return this.prisma.dealerInvite.create({
            data: {
                email,
                dealerProfileId: profile.id,
                role: dto.role as any,
                token: Math.random().toString(36).substring(2, 15), // Placeholder token
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });
    }

    async removeStaff(userId: string, staffId: string) {
        const profile = await this.getDealerProfile(userId);

        const staff = await this.prisma.dealerStaff.findFirst({
            where: { id: staffId, dealerProfileId: profile.id },
        });
        if (!staff) throw new NotFoundException('Staff member not found');

        // Prevent removing yourself if you're the only admin
        if (staff.userId === userId) {
            const adminCount = await this.prisma.dealerStaff.count({
                where: { dealerProfileId: profile.id, role: 'ADMIN', isActive: true },
            });
            if (adminCount <= 1) throw new ForbiddenException('Cannot remove the last admin');
        }

        return this.prisma.dealerStaff.update({
            where: { id: staffId },
            data: { isActive: false },
        });
    }
}
