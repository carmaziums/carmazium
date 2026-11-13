import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveFinanceProviderDto, SetListingFinanceRouteDto } from './finance-routing.dto';

export const INITIAL_FINANCE_PROVIDER_ID = 'jigsaw-finance';

export function validateFinanceApplicationUrl(value: string): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException('Enter a complete HTTPS application URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || !url.hostname.includes('.') ||
        /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.startsWith('[')) {
        throw new BadRequestException('Use the finance provider’s public HTTPS application URL, without login credentials or a fragment.');
    }
    return url.href;
}

@Injectable()
export class FinanceRoutingService {
    constructor(private readonly prisma: PrismaService) {}

    /** Explicit disabled/unavailable overrides never fall back to another provider. */
    async forListing(listingId: string) {
        const override = await this.prisma.financeListingRoute.findUnique({ where: { listingId }, include: { provider: true } });
        const provider = override ? override.provider : await this.prisma.financeProvider.findFirst({ where: { isDefault: true, enabled: true } });
        if (!provider?.enabled) return null;
        return { id: provider.id, name: provider.name, applicationUrl: validateFinanceApplicationUrl(provider.applicationUrl), disclosure: provider.disclosure, version: provider.updatedAt.toISOString() };
    }

    async list() {
        return this.prisma.financeProvider.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
    }

    async referrals() {
        return this.prisma.financeReferral.findMany({
            select: { id: true, fullName: true, email: true, phone: true, listingTitle: true, providerName: true, createdAt: true, adminNotifiedAt: true },
            orderBy: { createdAt: 'desc' }, take: 50,
        });
    }

    async save(adminId: string, dto: SaveFinanceProviderDto, id?: string) {
        const applicationUrl = validateFinanceApplicationUrl(dto.applicationUrl);
        if (dto.isDefault && !dto.enabled) throw new BadRequestException('The default provider must be enabled.');
        if (id && !await this.prisma.financeProvider.findUnique({ where: { id } })) throw new NotFoundException('Finance provider not found.');
        return this.prisma.$transaction(async tx => {
            if (dto.isDefault) await tx.financeProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false, updatedById: adminId } });
            const data = { name: dto.name, applicationUrl, disclosure: dto.disclosure, enabled: dto.enabled, isDefault: dto.isDefault, updatedById: adminId };
            return id ? tx.financeProvider.update({ where: { id }, data }) : tx.financeProvider.create({ data: { ...data, createdById: adminId } });
        }, { isolationLevel: 'Serializable' });
    }

    async listings(query?: string) {
        const q = query?.trim().slice(0, 100);
        return this.prisma.listing.findMany({
            where: { type: 'CLASSIFIED', deletedAt: null, ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' as const } }, { vrm: { contains: q.replace(/\s/g, ''), mode: 'insensitive' as const } }] } : {}) },
            select: { id: true, title: true, vrm: true, status: true, financeRouting: { select: { providerId: true } } },
            orderBy: { createdAt: 'desc' }, take: 30,
        });
    }

    async setListing(adminId: string, listingId: string, dto: SetListingFinanceRouteDto) {
        if (!await this.prisma.listing.findFirst({ where: { id: listingId, type: 'CLASSIFIED', deletedAt: null }, select: { id: true } })) throw new NotFoundException('Retail listing not found.');
        if (dto.mode === 'DEFAULT') {
            await this.prisma.financeListingRoute.deleteMany({ where: { listingId } });
            return { mode: 'DEFAULT' };
        }
        if (dto.mode === 'PROVIDER' && (!dto.providerId || !await this.prisma.financeProvider.findFirst({ where: { id: dto.providerId, enabled: true } }))) throw new BadRequestException('Select an enabled finance provider.');
        const data = { providerId: dto.mode === 'PROVIDER' ? dto.providerId! : null, updatedById: adminId };
        return this.prisma.financeListingRoute.upsert({ where: { listingId }, create: { listingId, ...data }, update: data });
    }
}
