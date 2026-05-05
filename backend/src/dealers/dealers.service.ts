import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';

@Injectable()
export class DealersService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Profile helpers ────────────────────────────────────────────

    /** Get the DealerProfile for a user, or throw */
    async getDealerProfile(userId: string) {
        const profile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, profileImage: true } } } } },
        });
        if (!profile) throw new NotFoundException('Dealer profile not found');
        return profile;
    }

    // ─── Dashboard KPIs ─────────────────────────────────────────────

    async getStats(userId: string) {
        const profile = await this.getDealerProfile(userId);

        const [activeListings, totalViews, soldListings, activeLeads, totalLeads, recentLeads] = await Promise.all([
            this.prisma.listing.count({ where: { sellerId: userId, status: 'ACTIVE', deletedAt: null } }),
            this.prisma.listing.aggregate({ where: { sellerId: userId, deletedAt: null }, _sum: { viewCount: true } }),
            this.prisma.listing.count({ where: { sellerId: userId, status: 'SOLD', deletedAt: null } }),
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
        ]);

        const totalRevenue = await this.prisma.transaction.aggregate({
            where: { userId, status: 'COMPLETED' },
            _sum: { amount: true },
        });

        return {
            companyName: profile.companyName,
            isVerified: profile.isVerified,
            activeListings,
            totalViews: totalViews._sum.viewCount || 0,
            soldListings,
            activeLeads,
            totalLeads,
            totalRevenue: totalRevenue._sum.amount || 0,
            recentLeads,
            staffCount: profile.staff.length,
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
