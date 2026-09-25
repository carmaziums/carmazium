import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinanceApplicationDto } from './dto/create-finance-application.dto';
import { UpdateFinanceStatusDto } from './dto/update-finance-status.dto';
import { UpdateFinancePartnerSettingsDto } from './dto/update-partner-settings.dto';

@Injectable()
export class FinanceService {
    constructor(private readonly prisma: PrismaService) { }

    private generateApiKey() {
        return `cmz_fin_${randomBytes(32).toString('base64url')}`;
    }

    private maskApiKey(value?: string | null) {
        return value ? `••••••••••••${value.slice(-4)}` : null;
    }

    private async getActivePartnerProfile(userId: string) {
        return this.prisma.partnerProfile.findFirst({
            where: {
                financeUserId: userId,
                partnerType: 'FINANCE_PARTNER',
                isActive: true,
                deletedAt: null,
            },
        });
    }

    async create(userId: string, dto: CreateFinanceApplicationDto) {
        const [partner, listing] = await Promise.all([
            this.prisma.partnerProfile.findFirst({
                where: {
                    id: dto.partnerId,
                    partnerType: 'FINANCE_PARTNER',
                    isActive: true,
                    deletedAt: null,
                    financeUser: { deletedAt: null },
                },
            }),
            this.prisma.listing.findUnique({
                where: { id: dto.listingId },
                select: { id: true, price: true, deletedAt: true },
            }),
        ]);

        if (!partner) throw new BadRequestException('Finance partner is not available');
        if (!listing || listing.deletedAt) throw new BadRequestException('Vehicle listing is not available');

        const listingPrice = Number(listing.price ?? 0);
        if (listingPrice > 0 && dto.depositAmount >= listingPrice) {
            throw new BadRequestException('Deposit must be lower than the vehicle price');
        }

        return this.prisma.financeApplication.create({
            data: {
                userId,
                listingId: dto.listingId,
                partnerId: partner.id,
                depositAmount: dto.depositAmount,
                termMonths: dto.termMonths,
            },
        });
    }

    async findMyApplications(userId: string, page = 1, limit = 20) {
        const safePage = Math.max(1, Math.floor(page || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.prisma.financeApplication.findMany({
                where: { userId, deletedAt: null },
                include: {
                    partner: {
                        select: { id: true, companyName: true, isActive: true },
                    },
                    listing: { select: { title: true, make: true, model: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeLimit,
            }),
            this.prisma.financeApplication.count({ where: { userId, deletedAt: null } }),
        ]);
        return { data, total, page: safePage, limit: safeLimit };
    }

    async findByPartner(partnerId: string, page = 1, limit = 20) {
        const safePage = Math.max(1, Math.floor(page || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.prisma.financeApplication.findMany({
                where: { partnerId, deletedAt: null },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                    listing: {
                        select: {
                            id: true,
                            title: true,
                            price: true,
                            slug: true,
                            images: true,
                            make: true,
                            model: true,
                            year: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeLimit,
            }),
            this.prisma.financeApplication.count({ where: { partnerId, deletedAt: null } }),
        ]);
        return { data, total, page: safePage, limit: safeLimit };
    }

    async getPartnerStats(userId: string) {
        const partner = await this.getActivePartnerProfile(userId);
        if (!partner) {
            return { pending: 0, approved: 0, rejected: 0, completed: 0, totalValue: 0 };
        }

        const [grouped, value] = await Promise.all([
            this.prisma.financeApplication.groupBy({
                by: ['status'],
                where: { partnerId: partner.id, deletedAt: null },
                _count: { _all: true },
            }),
            this.prisma.financeApplication.findMany({
                where: {
                    partnerId: partner.id,
                    deletedAt: null,
                    status: { in: ['APPROVED', 'COMPLETED'] },
                    monthlyPayment: { not: null },
                },
                select: { monthlyPayment: true, termMonths: true },
            }),
        ]);

        const count = (status: string) =>
            grouped.find(row => String(row.status) === status)?._count._all ?? 0;

        return {
            pending: count('PENDING'),
            approved: count('APPROVED'),
            rejected: count('REJECTED'),
            completed: count('COMPLETED'),
            totalValue: value.reduce(
                (sum, row) => sum + Number(row.monthlyPayment ?? 0) * row.termMonths,
                0,
            ),
        };
    }

    async updateStatus(applicationId: string, partnerProfileId: string, dto: UpdateFinanceStatusDto) {
        const app = await this.prisma.financeApplication.findUnique({
            where: { id: applicationId },
        });

        if (!app || app.deletedAt) throw new NotFoundException('Application not found');
        if (app.partnerId !== partnerProfileId) {
            throw new ForbiddenException('You do not have permission to update this application');
        }

        const allowed =
            (app.status === 'PENDING' && ['APPROVED', 'REJECTED'].includes(dto.status))
            || (app.status === 'APPROVED' && dto.status === 'COMPLETED')
            || app.status === dto.status;

        if (!allowed) {
            throw new BadRequestException(`Finance application cannot move from ${app.status} to ${dto.status}`);
        }
        if (dto.status === 'APPROVED' && (!dto.monthlyPayment || dto.monthlyPayment <= 0)) {
            throw new BadRequestException('Monthly payment is required before approving finance');
        }

        const updateData: any = { status: dto.status };
        if (dto.status === 'APPROVED') {
            updateData.monthlyPayment = dto.monthlyPayment;
            updateData.approvalDate = new Date();
        }

        return this.prisma.financeApplication.update({
            where: { id: applicationId },
            data: updateData,
        });
    }

    async getPartnerProfileId(userId: string): Promise<string | null> {
        const profile = await this.getActivePartnerProfile(userId);
        return profile?.id || null;
    }

    async getPartnerSettings(userId: string) {
        const profile = await this.prisma.partnerProfile.findFirst({
            where: {
                financeUserId: userId,
                partnerType: 'FINANCE_PARTNER',
                deletedAt: null,
            },
        });

        return {
            companyName: profile?.companyName ?? '',
            callbackUrl: profile?.callbackUrl ?? '',
            isActive: profile?.isActive ?? false,
            isConfigured: Boolean(profile),
            apiKeyHint: this.maskApiKey(profile?.apiKey),
            integrationEnabled: false,
        };
    }

    async updatePartnerSettings(userId: string, dto: UpdateFinancePartnerSettingsDto) {
        const existing = await this.prisma.partnerProfile.findUnique({
            where: { financeUserId: userId },
        });
        if (existing?.deletedAt) {
            throw new ForbiddenException('This finance partner profile is inactive. Contact CarMazium support.');
        }

        const companyName = dto.companyName.trim();
        const callbackUrl = dto.callbackUrl?.trim() || null;
        const profile = existing
            ? await this.prisma.partnerProfile.update({
                where: { id: existing.id },
                data: { companyName, callbackUrl },
            })
            : await this.prisma.partnerProfile.create({
                data: {
                    financeUserId: userId,
                    partnerType: 'FINANCE_PARTNER',
                    companyName,
                    callbackUrl,
                    apiKey: this.generateApiKey(),
                },
            });

        return {
            companyName: profile.companyName,
            callbackUrl: profile.callbackUrl ?? '',
            isActive: profile.isActive,
            isConfigured: true,
            apiKeyHint: this.maskApiKey(profile.apiKey),
            integrationEnabled: false,
        };
    }

    async regenerateApiKey(userId: string) {
        const profile = await this.getActivePartnerProfile(userId);
        if (!profile) {
            throw new NotFoundException('Save your finance partner settings before creating an API key');
        }

        const apiKey = this.generateApiKey();
        await this.prisma.partnerProfile.update({
            where: { id: profile.id },
            data: { apiKey },
        });
        return {
            apiKey,
            apiKeyHint: this.maskApiKey(apiKey),
        };
    }
}
