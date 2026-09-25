import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInsuranceQuoteDto } from './dto/create-insurance-quote.dto';
import { UpdateInsuranceStatusDto } from './dto/update-insurance-status.dto';
import { UpdateInsurancePartnerSettingsDto } from './dto/update-partner-settings.dto';

@Injectable()
export class InsuranceService {
    constructor(private readonly prisma: PrismaService) { }

    private generateApiKey() {
        return `cmz_ins_${randomBytes(32).toString('base64url')}`;
    }

    private maskApiKey(value?: string | null) {
        return value ? `••••••••••••${value.slice(-4)}` : null;
    }

    private async getActivePartnerProfile(userId: string) {
        return this.prisma.partnerProfile.findFirst({
            where: {
                insuranceUserId: userId,
                partnerType: 'INSURANCE_PARTNER',
                isActive: true,
                deletedAt: null,
            },
        });
    }

    async create(userId: string, dto: CreateInsuranceQuoteDto) {
        const [partner, listing] = await Promise.all([
            this.prisma.partnerProfile.findFirst({
                where: {
                    id: dto.partnerId,
                    partnerType: 'INSURANCE_PARTNER',
                    isActive: true,
                    deletedAt: null,
                    insuranceUser: { deletedAt: null },
                },
            }),
            this.prisma.listing.findUnique({
                where: { id: dto.listingId },
                select: { id: true, deletedAt: true },
            }),
        ]);

        if (!partner) throw new BadRequestException('Insurance partner is not available');
        if (!listing || listing.deletedAt) throw new BadRequestException('Vehicle listing is not available');

        return this.prisma.insuranceQuote.create({
            data: {
                userId,
                listingId: dto.listingId,
                partnerId: partner.id,
                driverAge: dto.driverAge,
                ncbYears: dto.ncbYears,
                hasConvictions: dto.hasConvictions,
            },
        });
    }

    async findMyQuotes(userId: string, page = 1, limit = 20) {
        const safePage = Math.max(1, Math.floor(page || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.prisma.insuranceQuote.findMany({
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
            this.prisma.insuranceQuote.count({ where: { userId, deletedAt: null } }),
        ]);
        return { data, total, page: safePage, limit: safeLimit };
    }

    async findByPartner(partnerId: string, page = 1, limit = 20) {
        const safePage = Math.max(1, Math.floor(page || 1));
        const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.prisma.insuranceQuote.findMany({
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
            this.prisma.insuranceQuote.count({ where: { partnerId, deletedAt: null } }),
        ]);
        return { data, total, page: safePage, limit: safeLimit };
    }

    async getPartnerStats(userId: string) {
        const partner = await this.getActivePartnerProfile(userId);
        if (!partner) {
            return { pending: 0, approved: 0, rejected: 0, completed: 0, totalValue: 0 };
        }

        const [grouped, acceptedValue] = await Promise.all([
            this.prisma.insuranceQuote.groupBy({
                by: ['status'],
                where: { partnerId: partner.id, deletedAt: null },
                _count: { _all: true },
            }),
            this.prisma.insuranceQuote.aggregate({
                where: {
                    partnerId: partner.id,
                    deletedAt: null,
                    status: 'ACCEPTED',
                    quotedPrice: { not: null },
                },
                _sum: { quotedPrice: true },
            }),
        ]);

        const count = (status: string) =>
            grouped.find(row => String(row.status) === status)?._count._all ?? 0;

        return {
            pending: count('PENDING'),
            approved: count('QUOTED') + count('ACCEPTED'),
            rejected: count('REJECTED'),
            completed: count('ACCEPTED'),
            totalValue: Number(acceptedValue._sum.quotedPrice ?? 0),
        };
    }

    async updateStatus(quoteId: string, partnerProfileId: string, dto: UpdateInsuranceStatusDto) {
        const quote = await this.prisma.insuranceQuote.findUnique({
            where: { id: quoteId },
        });

        if (!quote || quote.deletedAt) throw new NotFoundException('Quote not found');
        if (quote.partnerId !== partnerProfileId) {
            throw new ForbiddenException('You do not have permission to update this quote');
        }

        const allowed =
            (quote.status === 'PENDING' && ['QUOTED', 'REJECTED'].includes(dto.status))
            || (quote.status === 'QUOTED' && dto.status === 'EXPIRED')
            || quote.status === dto.status;

        if (!allowed) {
            throw new BadRequestException(`Insurance quote cannot move from ${quote.status} to ${dto.status}`);
        }
        if (dto.status === 'QUOTED' && (!dto.quotedPrice || dto.quotedPrice <= 0)) {
            throw new BadRequestException('Quoted annual price is required before sending a quote');
        }

        const updateData: any = { status: dto.status };
        if (dto.status === 'QUOTED') {
            updateData.quotedPrice = dto.quotedPrice;
            updateData.coverageType = dto.coverageType?.trim() || null;
            updateData.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        return this.prisma.insuranceQuote.update({
            where: { id: quoteId },
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
                insuranceUserId: userId,
                partnerType: 'INSURANCE_PARTNER',
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

    async updatePartnerSettings(userId: string, dto: UpdateInsurancePartnerSettingsDto) {
        const existing = await this.prisma.partnerProfile.findUnique({
            where: { insuranceUserId: userId },
        });
        if (existing?.deletedAt) {
            throw new ForbiddenException('This insurance partner profile is inactive. Contact CarMazium support.');
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
                    insuranceUserId: userId,
                    partnerType: 'INSURANCE_PARTNER',
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
            throw new NotFoundException('Save your insurance partner settings before creating an API key');
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
