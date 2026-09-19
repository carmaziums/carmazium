import { BadRequestException } from '@nestjs/common';
import { CapabilityStatus, ServiceType } from '@prisma/client';
import {
    CAPABILITY_VERIFICATION_MAX_DAYS,
    assertCapabilityVerificationReady,
    capabilityRequirements,
    getCapabilityVerificationSummary,
} from './capability-verification';

describe('TradeXchange provider verification standard', () => {
    const now = new Date('2026-09-19T12:00:00Z');

    const prismaFor = (serviceType: ServiceType, evidence: any[], capability: Record<string, any> = {}) => ({
        contractorCapability: {
            findUnique: jest.fn().mockResolvedValue({
                id: 'cap-1',
                serviceType,
                status: CapabilityStatus.PENDING,
                verificationStatus: 'IN_REVIEW',
                verificationCompletedAt: null,
                verificationExpiresAt: null,
                ...capability,
            }),
        },
        $queryRaw: jest.fn().mockResolvedValue(evidence),
    }) as any;

    const approved = (evidenceType: string, expiresAt: Date | null = null) => ({
        id: 'e-' + evidenceType,
        evidenceType,
        evidenceStatus: 'APPROVED',
        evidenceIssuer: 'Issuer',
        evidenceReference: 'REF',
        evidenceValidFrom: null,
        evidenceExpiresAt: expiresAt,
        evidenceReviewedAt: now,
        evidenceReviewedById: 'admin-1',
        evidenceReviewNote: null,
        createdAt: now,
    });

    it('defines separate evidence requirements for all four services', () => {
        expect(capabilityRequirements(ServiceType.DELIVERY).map(r => r.type)).toEqual([
            'BUSINESS_IDENTITY',
            'DELIVERY_BUSINESS_INSURANCE',
            'DELIVERY_GOODS_IN_TRANSIT',
        ]);
        expect(capabilityRequirements(ServiceType.INSPECTION).map(r => r.type)).toEqual([
            'BUSINESS_IDENTITY',
            'INSPECTION_BUSINESS_INSURANCE',
            'INSPECTION_QUALIFICATION',
        ]);
        expect(capabilityRequirements(ServiceType.FINANCE).map(r => r.type)).toEqual([
            'BUSINESS_IDENTITY',
            'FINANCE_REGULATORY_AUTHORITY',
        ]);
        expect(capabilityRequirements(ServiceType.WARRANTY).map(r => r.type)).toEqual([
            'BUSINESS_IDENTITY',
            'WARRANTY_REGULATORY_AUTHORITY',
            'WARRANTY_PRODUCT_AUTHORITY',
        ]);
    });

    it('does not satisfy expiry-required Delivery evidence without a current expiry date', async () => {
        const prisma = prismaFor(ServiceType.DELIVERY, [
            approved('BUSINESS_IDENTITY'),
            approved('DELIVERY_BUSINESS_INSURANCE'),
            approved('DELIVERY_GOODS_IN_TRANSIT', new Date('2027-01-01T00:00:00Z')),
        ]);

        const summary = await getCapabilityVerificationSummary(prisma, 'cap-1', now);

        expect(summary.ready).toBe(false);
        expect(summary.requirements.find(r => r.type === 'DELIVERY_BUSINESS_INSURANCE')?.state).toBe('MISSING');
    });

    it('treats expired evidence as missing even when an admin previously approved it', async () => {
        const prisma = prismaFor(ServiceType.INSPECTION, [
            approved('BUSINESS_IDENTITY'),
            approved('INSPECTION_BUSINESS_INSURANCE', new Date('2026-09-18T00:00:00Z')),
            approved('INSPECTION_QUALIFICATION'),
        ]);

        const summary = await getCapabilityVerificationSummary(prisma, 'cap-1', now);

        expect(summary.ready).toBe(false);
        expect(summary.requirements.find(r => r.type === 'INSPECTION_BUSINESS_INSURANCE')?.state).toBe('MISSING');
    });

    it('caps approval at the earliest evidence expiry when it is under 12 months', async () => {
        const earliest = new Date('2027-01-15T00:00:00Z');
        const prisma = prismaFor(ServiceType.DELIVERY, [
            approved('BUSINESS_IDENTITY'),
            approved('DELIVERY_BUSINESS_INSURANCE', earliest),
            approved('DELIVERY_GOODS_IN_TRANSIT', new Date('2027-05-01T00:00:00Z')),
        ]);

        const summary = await getCapabilityVerificationSummary(prisma, 'cap-1', now);

        expect(summary.ready).toBe(true);
        expect(summary.recommendedExpiresAt?.toISOString()).toBe(earliest.toISOString());
    });

    it('caps non-expiring Finance evidence at the annual re-verification window', async () => {
        const prisma = prismaFor(ServiceType.FINANCE, [
            approved('BUSINESS_IDENTITY'),
            approved('FINANCE_REGULATORY_AUTHORITY'),
        ]);

        const summary = await getCapabilityVerificationSummary(prisma, 'cap-1', now);
        const expected = new Date(now.getTime() + CAPABILITY_VERIFICATION_MAX_DAYS * 86_400_000);

        expect(summary.ready).toBe(true);
        expect(summary.recommendedExpiresAt?.toISOString()).toBe(expected.toISOString());
    });

    it('requires both regulatory authority and product authority for Warranty', async () => {
        const prisma = prismaFor(ServiceType.WARRANTY, [
            approved('BUSINESS_IDENTITY'),
            approved('WARRANTY_REGULATORY_AUTHORITY'),
        ]);

        await expect(
            assertCapabilityVerificationReady(prisma, 'cap-1', ServiceType.WARRANTY),
        ).rejects.toThrow(BadRequestException);
    });
});
