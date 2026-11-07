import { BadRequestException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

export interface LedgerFilters { q?: string; status?: string; type?: string; from?: string; to?: string }
export interface DealerArchiveFilters { q?: string; status?: string }

export function ledgerWhere(filters: LedgerFilters = {}): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {};
    if (filters.status) {
        if (!Object.values(TransactionStatus).includes(filters.status as TransactionStatus)) throw new BadRequestException('Unknown payment status.');
        where.status = filters.status as TransactionStatus;
    }
    if (filters.type) {
        if (!Object.values(TransactionType).includes(filters.type as TransactionType)) throw new BadRequestException('Unknown payment type.');
        where.type = filters.type as TransactionType;
    }
    const date = (value: string) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Use YYYY-MM-DD dates.');
        const parsed = new Date(`${value}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new BadRequestException('Invalid date.');
        return parsed;
    };
    const from = filters.from ? date(filters.from) : undefined;
    const to = filters.to ? date(filters.to) : undefined;
    if (from && to && from > to) throw new BadRequestException('From date must not follow To date.');
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime()+86400000) } : {}) };
    const q = filters.q?.trim().slice(0,100);
    if (q) where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { stripePaymentId: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { user: { is: { OR: ['email','firstName','lastName'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) } } },
        { listing: { is: { OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { vrm: { contains: q.replace(/\s/g,''), mode: 'insensitive' } },
        ] } } },
    ];
    return where;
}

export const KYC_PAYMENT_EVIDENCE: Prisma.DealerKycWhereInput = { OR: [
    { stripeChargedAt: { not: null } },
    { paymentReference: { not: null } },
    { paymentScreenshot: { not: null } },
    { paymentScreenshotPath: { not: null } },
] };

export function dealerArchiveWhere(filters: DealerArchiveFilters = {}): Prisma.DealerKycWhereInput {
    const AND: Prisma.DealerKycWhereInput[] = [];
    if (filters.status === 'DRAFT') AND.push({ status: 'PENDING', NOT: KYC_PAYMENT_EVIDENCE });
    else if (filters.status === 'READY') AND.push({ status: 'PENDING', ...KYC_PAYMENT_EVIDENCE });
    else if (filters.status) {
        if (!['PENDING','APPROVED','REJECTED'].includes(filters.status)) throw new BadRequestException('Unknown KYC status.');
        AND.push({ status: filters.status as 'PENDING'|'APPROVED'|'REJECTED' });
    }
    const q = filters.q?.trim().slice(0,100);
    if (q) AND.push({ OR: [
        { companyHouseName: { contains: q, mode: 'insensitive' } },
        { dealerProfile: { is: { OR: [
            { companyName: { contains: q, mode: 'insensitive' } },
            { user: { is: { OR: ['email','firstName','lastName'].map(key => ({ [key]: { contains: q, mode: 'insensitive' } })) } } },
        ] } } },
    ] });
    return AND.length ? { AND } : {};
}
