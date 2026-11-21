import { BadRequestException } from '@nestjs/common';
import { CapabilityStatus, ServiceType } from '@prisma/client';
import {
    CAPABILITY_VERIFICATION_MAX_DAYS,
    assertCapabilityVerificationReady,
    capabilityRequirements,
    getCapabilityVerificationSummary,
    pendingVerificationStatus,
} from './capability-verification';

describe('TradeXchange provider verification standard', () => {
    const now = new Date('2026-09-19T12:00:00Z');
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(now); });
    afterEach(() => jest.useRealTimers());

    const prismaFor = (serviceType: ServiceType, evidence: any[], capability: Record<string, any> = {}) => ({
        contractorCapability: {
            findUnique: jest.fn().mockResolvedValue({
                id: 'cap-1',
                serviceType,
                status: CapabilityStatus.PENDING,
                verificationStatus: 'IN_REVIEW',
                verificationCompletedAt: null,
                verificationExpiresAt: null,
                providerDeclaration: { version: 1, registeredBusiness: true, acceptedAt: now.toISOString() },
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
        evidenceCoverAmountGbp: evidenceType === 'PUBLIC_LIABILITY_INSURANCE' || evidenceType === 'DELIVERY_BUSINESS_INSURANCE' ? 2000000 : null,
        evidenceReviewedAt: now,
        evidenceReviewedById: 'admin-1',
        evidenceReviewNote: null,
        createdAt: now,
    });

    it('requires public liability plus motor trade for delivery and public liability only for inspection', () => {
        expect(capabilityRequirements(ServiceType.DELIVERY).map(r => r.type)).toEqual(['PUBLIC_LIABILITY_INSURANCE', 'DELIVERY_BUSINESS_INSURANCE']);
        expect(capabilityRequirements(ServiceType.INSPECTION).map(r => r.type)).toEqual(['PUBLIC_LIABILITY_INSURANCE']);
        expect(capabilityRequirements(ServiceType.FINANCE).map(r => r.type)).toEqual(['BUSINESS_IDENTITY', 'FINANCE_REGULATORY_AUTHORITY']);
        expect(capabilityRequirements(ServiceType.WARRANTY).map(r => r.type)).toEqual(['BUSINESS_IDENTITY', 'WARRANTY_REGULATORY_AUTHORITY', 'WARRANTY_PRODUCT_AUTHORITY']);
    });

    it('blocks inspection without approved public liability and permits it once verified', async () => {
        await expect(assertCapabilityVerificationReady(prismaFor(ServiceType.INSPECTION, []), 'cap-1', ServiceType.INSPECTION))
            .rejects.toThrow(/Public liability insurance/);
        const ready = await assertCapabilityVerificationReady(prismaFor(ServiceType.INSPECTION, [approved('PUBLIC_LIABILITY_INSURANCE', new Date('2027-01-01'))]), 'cap-1', ServiceType.INSPECTION);
        expect(ready.ready).toBe(true);
    });

    it.each([null, { version: 1, registeredBusiness: false, acceptedAt: now.toISOString() }, { version: 1, registeredBusiness: true, acceptedAt: '2025-01-01' }])('blocks missing, unregistered or expired declarations (%j)', async providerDeclaration => {
        await expect(assertCapabilityVerificationReady(prismaFor(ServiceType.INSPECTION, [], { providerDeclaration }), 'cap-1', ServiceType.INSPECTION)).rejects.toThrow(/business details and declaration/);
    });

    it('does not allow approved insurance to replace a delivery declaration', async () => {
        const summary = await getCapabilityVerificationSummary(prismaFor(ServiceType.DELIVERY, [approved('DELIVERY_BUSINESS_INSURANCE', new Date('2027-01-01'))], { providerDeclaration: null }), 'cap-1', now);
        expect(summary.ready).toBe(false);
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
        const prisma = prismaFor(ServiceType.DELIVERY, [
            approved('BUSINESS_IDENTITY'),
            approved('DELIVERY_BUSINESS_INSURANCE', new Date('2026-09-18T00:00:00Z')),
            approved('INSPECTION_QUALIFICATION'),
        ]);

        const summary = await getCapabilityVerificationSummary(prisma, 'cap-1', now);

        expect(summary.ready).toBe(false);
        expect(summary.requirements.find(r => r.type === 'DELIVERY_BUSINESS_INSURANCE')?.state).toBe('MISSING');
    });

    it('caps approval at the earliest evidence expiry when it is under 12 months', async () => {
        const earliest = new Date('2027-01-15T00:00:00Z');
        const prisma = prismaFor(ServiceType.DELIVERY, [
            approved('BUSINESS_IDENTITY'),
            approved('PUBLIC_LIABILITY_INSURANCE', new Date('2027-05-01T00:00:00Z')),
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
