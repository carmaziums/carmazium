import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CapabilityStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const CAPABILITY_VERIFICATION_MAX_DAYS = 365;

export type CapabilityEvidenceType =
    | 'BUSINESS_IDENTITY'
    | 'DELIVERY_BUSINESS_INSURANCE'
    | 'DELIVERY_GOODS_IN_TRANSIT'
    | 'INSPECTION_BUSINESS_INSURANCE'
    | 'INSPECTION_QUALIFICATION'
    | 'FINANCE_REGULATORY_AUTHORITY'
    | 'WARRANTY_REGULATORY_AUTHORITY'
    | 'WARRANTY_PRODUCT_AUTHORITY';

export type CapabilityEvidenceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export type CapabilityVerificationStatus =
    | 'NOT_SUBMITTED'
    | 'IN_REVIEW'
    | 'READY'
    | 'VERIFIED'
    | 'REVERIFICATION_REQUIRED'
    | 'REJECTED';

/**
 * Authoritative runtime gate for taking NEW TradeXchange work.
 *
 * Admin approval alone is not enough: the evidence-backed verification must
 * still be VERIFIED and inside its validity window. Existing job lifecycle
 * access is intentionally handled separately so an expiry cannot strand work
 * that was already accepted and paid.
 */
export function verifiedCapabilityWhere(now = new Date()): Prisma.ContractorCapabilityWhereInput {
    return {
        status: CapabilityStatus.APPROVED,
        verificationStatus: 'VERIFIED',
        verificationExpiresAt: { gt: now },
    };
}

export function capabilityVerificationIsCurrent(
    capability: {
        status: CapabilityStatus;
        verificationStatus?: string | null;
        verificationExpiresAt?: Date | string | null;
    } | null | undefined,
    now = new Date(),
): boolean {
    if (!capability || capability.status !== CapabilityStatus.APPROVED) return false;
    if (capability.verificationStatus !== 'VERIFIED' || !capability.verificationExpiresAt) return false;
    const expiresAt = capability.verificationExpiresAt instanceof Date
        ? capability.verificationExpiresAt
        : new Date(capability.verificationExpiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

export interface CapabilityVerificationRequirement {
    type: CapabilityEvidenceType;
    title: string;
    description: string;
    expiryRequired: boolean;
}

const BUSINESS_IDENTITY: CapabilityVerificationRequirement = {
    type: 'BUSINESS_IDENTITY',
    title: 'Business identity',
    description: 'Business registration or equivalent trading evidence showing who is providing this service.',
    expiryRequired: false,
};

export const CAPABILITY_VERIFICATION_REQUIREMENTS: Record<ServiceType, CapabilityVerificationRequirement[]> = {
    [ServiceType.DELIVERY]: [
        BUSINESS_IDENTITY,
        {
            type: 'DELIVERY_BUSINESS_INSURANCE',
            title: 'Delivery / transport insurance',
            description: 'Current business, motor-trade or vehicle-transport insurance covering the delivery activity.',
            expiryRequired: true,
        },
        {
            type: 'DELIVERY_GOODS_IN_TRANSIT',
            title: 'Goods-in-transit cover',
            description: 'Current goods-in-transit or vehicle-in-custody cover appropriate to transported vehicles.',
            expiryRequired: true,
        },
    ],
    [ServiceType.INSPECTION]: [
        BUSINESS_IDENTITY,
        {
            type: 'INSPECTION_BUSINESS_INSURANCE',
            title: 'Inspection liability insurance',
            description: 'Current business, public or professional liability insurance covering vehicle inspection work.',
            expiryRequired: true,
        },
        {
            type: 'INSPECTION_QUALIFICATION',
            title: 'Inspection qualification / competence',
            description: 'Relevant vehicle inspection, mechanical qualification or other evidence of professional competence.',
            expiryRequired: false,
        },
    ],
    [ServiceType.FINANCE]: [
        BUSINESS_IDENTITY,
        {
            type: 'FINANCE_REGULATORY_AUTHORITY',
            title: 'Finance regulatory authority',
            description: 'Evidence of FCA authorisation/permissions or an appointed-representative/principal relationship covering the finance activity offered.',
            expiryRequired: false,
        },
    ],
    [ServiceType.WARRANTY]: [
        BUSINESS_IDENTITY,
        {
            type: 'WARRANTY_REGULATORY_AUTHORITY',
            title: 'Warranty regulatory authority',
            description: 'Evidence of FCA authorisation or an appointed-representative/principal relationship covering the warranty/insurance activity offered.',
            expiryRequired: false,
        },
        {
            type: 'WARRANTY_PRODUCT_AUTHORITY',
            title: 'Warranty product authority',
            description: 'Current evidence that the business may offer the warranty product, including administrator or underwriter authority where applicable.',
            expiryRequired: false,
        },
    ],
};

export function capabilityRequirements(serviceType: ServiceType): CapabilityVerificationRequirement[] {
    return CAPABILITY_VERIFICATION_REQUIREMENTS[serviceType] ?? [];
}

export function capabilityEvidenceRequirement(
    serviceType: ServiceType,
    evidenceType: string,
): CapabilityVerificationRequirement | null {
    return capabilityRequirements(serviceType).find((r) => r.type === evidenceType) ?? null;
}

function validApprovedEvidence(row: any, requirement: CapabilityVerificationRequirement, now: Date): boolean {
    if (row.evidenceStatus !== 'APPROVED') return false;
    if (requirement.expiryRequired && !row.evidenceExpiresAt) return false;
    if (row.evidenceExpiresAt && new Date(row.evidenceExpiresAt) <= now) return false;
    return true;
}

export async function getCapabilityVerificationSummary(
    prisma: PrismaService,
    capabilityId: string,
    now = new Date(),
) {
    const capability = await prisma.contractorCapability.findUnique({
        where: { id: capabilityId },
        select: {
            id: true,
            serviceType: true,
            status: true,
            verificationStatus: true,
            verificationCompletedAt: true,
            verificationExpiresAt: true,
        },
    });
    if (!capability) throw new NotFoundException('Provider application not found.');

    const evidence = await prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
            e."id", e."evidenceType", e."evidenceStatus", e."evidenceIssuer",
            e."evidenceReference", e."evidenceValidFrom", e."evidenceExpiresAt",
            e."evidenceReviewedAt", e."evidenceReviewedById", e."evidenceReviewNote",
            e."createdAt"
        FROM "service_case_entries" e
        WHERE e."scope" = 'CAPABILITY'
          AND e."entityId" = ${capabilityId}
          AND e."kind" IN ('DOCUMENT', 'PHOTO')
        ORDER BY e."createdAt" DESC
    `);

    const requirements = capabilityRequirements(capability.serviceType).map((requirement) => {
        const rows = evidence.filter((row) => row.evidenceType === requirement.type);
        const approved = rows.find((row) => validApprovedEvidence(row, requirement, now)) ?? null;
        const pending = rows.find((row) => row.evidenceStatus === 'PENDING') ?? null;
        const rejected = rows.find((row) => row.evidenceStatus === 'REJECTED') ?? null;
        const state = approved
            ? 'SATISFIED'
            : pending
                ? 'PENDING'
                : rejected
                    ? 'REJECTED'
                    : 'MISSING';
        return {
            ...requirement,
            state,
            currentEvidenceId: approved?.id ?? pending?.id ?? rejected?.id ?? null,
            approvedEvidenceId: approved?.id ?? null,
            evidenceExpiresAt: approved?.evidenceExpiresAt ?? null,
        };
    });

    const ready = requirements.length > 0 && requirements.every((requirement) => requirement.state === 'SATISFIED');
    const approvedExpiries = requirements
        .map((requirement) => requirement.evidenceExpiresAt ? new Date(requirement.evidenceExpiresAt) : null)
        .filter((value): value is Date => !!value && !Number.isNaN(value.getTime()));
    const annualReview = new Date(now.getTime() + CAPABILITY_VERIFICATION_MAX_DAYS * 86_400_000);
    const recommendedExpiresAt = approvedExpiries.reduce(
        (earliest, value) => value < earliest ? value : earliest,
        annualReview,
    );

    return {
        capabilityId,
        serviceType: capability.serviceType,
        capabilityStatus: capability.status,
        verificationStatus: capability.verificationStatus as CapabilityVerificationStatus,
        verificationCompletedAt: capability.verificationCompletedAt,
        verificationExpiresAt: capability.verificationExpiresAt,
        ready,
        recommendedExpiresAt: ready ? recommendedExpiresAt : null,
        requirements,
    };
}

export async function assertCapabilityVerificationReady(
    prisma: PrismaService,
    capabilityId: string,
    serviceType: ServiceType,
) {
    const summary = await getCapabilityVerificationSummary(prisma, capabilityId);
    if (summary.serviceType !== serviceType) {
        throw new BadRequestException('Verification evidence does not match this service application.');
    }
    if (!summary.ready || !summary.recommendedExpiresAt) {
        const missing = summary.requirements
            .filter((requirement) => requirement.state !== 'SATISFIED')
            .map((requirement) => requirement.title);
        throw new BadRequestException(
            `Provider verification is incomplete. Complete and approve: ${missing.join(', ') || 'required evidence'}.`,
        );
    }
    return summary;
}

export function pendingVerificationStatus(
    requirements: Array<{ state: string }>,
): CapabilityVerificationStatus {
    if (requirements.length && requirements.every((requirement) => requirement.state === 'SATISFIED')) {
        return 'READY';
    }
    if (requirements.some((requirement) => requirement.state === 'PENDING' || requirement.state === 'SATISFIED')) {
        return 'IN_REVIEW';
    }
    if (requirements.some((requirement) => requirement.state === 'REJECTED')) {
        return 'IN_REVIEW';
    }
    return 'NOT_SUBMITTED';
}

export const APPROVABLE_EVIDENCE_STATUSES = ['APPROVED', 'REJECTED'] as const;
