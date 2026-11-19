import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceType, UserRole } from '@prisma/client';
import { verifiedCapabilityWhere } from '../services/capability-verification';
import { DELETED_EMAIL_DOMAIN } from '../users/account-deletion';

export interface AdminUserFilters {
    accountType?: string;
    dealerVerification?: string;
    serviceType?: string;
    providerStatus?: string;
    accountStatus?: string;
    emailVerification?: string;
}

export function adminUserWhere(search?: string, filters: AdminUserFilters = {}, now = new Date()): Prisma.UserWhereInput {
    const choices: Record<keyof AdminUserFilters, readonly string[]> = {
        accountType: [...Object.values(UserRole), 'SERVICE_PROVIDER'],
        dealerVerification: ['VERIFIED', 'UNVERIFIED', 'PENDING', 'REJECTED', 'NOT_SUBMITTED'],
        serviceType: Object.values(ServiceType),
        providerStatus: ['VERIFIED', 'UNVERIFIED', 'PENDING', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'NOT_SUBMITTED'],
        accountStatus: ['ACTIVE', 'LOCKED', 'BANNED', 'DELETED'],
        emailVerification: ['VERIFIED', 'UNVERIFIED'],
    };
    for (const key of Object.keys(choices) as (keyof AdminUserFilters)[]) {
        const value = filters[key];
        if (value && (typeof value !== 'string' || !choices[key].includes(value))) {
            throw new BadRequestException(`Unknown ${key} filter.`);
        }
    }
    const AND: Prisma.UserWhereInput[] = [];
    const provider: Prisma.UserWhereInput = { OR: [
        { role: { in: ['CONTRACTOR', 'FINANCE_PARTNER', 'INSURANCE_PARTNER'] } },
        { contractorProfile: { is: { deletedAt: null } } },
    ] };
    if (filters.accountType === 'SERVICE_PROVIDER') AND.push(provider);
    else if (filters.accountType) AND.push({ role: filters.accountType as UserRole });

    const dealer = filters.dealerVerification;
    if (dealer) {
        AND.push({ role: 'DEALER' });
        if (dealer === 'VERIFIED') AND.push({ dealerProfile: { is: { isVerified: true } } });
        else {
            AND.push({ OR: [{ dealerProfile: { is: null } }, { dealerProfile: { is: { isVerified: false } } }] });
            if (dealer === 'NOT_SUBMITTED') AND.push({ OR: [
                { dealerProfile: { is: null } }, { dealerProfile: { is: { kyc: { is: null } } } },
            ] });
            else if (dealer !== 'UNVERIFIED') AND.push({ dealerProfile: { is: { kyc: { is: { status: dealer as 'PENDING' | 'REJECTED' } } } } });
        }
    }

    const serviceType = filters.serviceType as ServiceType | undefined;
    const status = filters.providerStatus;
    const scope: Prisma.ContractorCapabilityWhereInput = serviceType ? { serviceType } : {};
    const category: Prisma.UserWhereInput = { OR: [
        { contractorProfile: { is: { deletedAt: null, capabilities: { some: scope } } } },
        ...(serviceType === 'FINANCE' ? [{ role: UserRole.FINANCE_PARTNER }] : []),
    ] };
    if (serviceType || status) {
        if (status === 'UNVERIFIED') {
            // No current approval for the selected service; include accounts with
            // no capabilities when filtering all providers, but never other users.
            AND.push(provider);
            if (serviceType) AND.push(category);
            AND.push({ NOT: { contractorProfile: { is: { deletedAt: null, capabilities: { some: { ...scope, ...verifiedCapabilityWhere(now) } } } } } });
        } else {
            const capability: Prisma.ContractorCapabilityWhereInput = { ...scope };
            if (status === 'VERIFIED') Object.assign(capability, verifiedCapabilityWhere(now));
            else if (status === 'EXPIRED') capability.OR = [
                { verificationStatus: 'REVERIFICATION_REQUIRED' },
                { verificationStatus: 'VERIFIED', verificationExpiresAt: { lte: now } },
            ];
            else if (status === 'NOT_SUBMITTED') capability.verificationStatus = 'NOT_SUBMITTED';
            else if (status) capability.status = status as 'PENDING' | 'REJECTED' | 'SUSPENDED';
            const matching: Prisma.UserWhereInput = { contractorProfile: { is: { deletedAt: null, capabilities: { some: capability } } } };
            if (status === 'NOT_SUBMITTED' && !serviceType) AND.push({ AND: [provider, { OR: [matching,
                { contractorProfile: { is: null } },
                { contractorProfile: { is: { deletedAt: null, capabilities: { none: {} } } } },
            ] }] });
            else AND.push(!status && serviceType ? category : matching);
        }
    }

    const deletedEmail: Prisma.UserWhereInput = { email: { endsWith: `@${DELETED_EMAIL_DOMAIN}`, mode: 'insensitive' } };
    if (filters.accountStatus === 'DELETED') AND.push(deletedEmail);
    if (filters.accountStatus === 'BANNED') AND.push({ deletedAt: { not: null }, NOT: deletedEmail });
    if (filters.accountStatus === 'LOCKED') AND.push({ deletedAt: null, NOT: deletedEmail, lockoutUntil: { gt: now } });
    if (filters.accountStatus === 'ACTIVE') AND.push({ deletedAt: null, NOT: deletedEmail, OR: [{ lockoutUntil: null }, { lockoutUntil: { lte: now } }] });
    if (filters.emailVerification) AND.push({ isEmailVerified: filters.emailVerification === 'VERIFIED' });

    const q = search?.trim().slice(0, 200);
    if (q) AND.push({ OR: [
        ...['email', 'firstName', 'lastName'].map(key => ({ [key]: { contains: q, mode: 'insensitive' as const } })),
        { dealerProfile: { is: { companyName: { contains: q, mode: 'insensitive' } } } },
        { contractorProfile: { is: { businessName: { contains: q, mode: 'insensitive' } } } },
        { financePartnerProfile: { is: { companyName: { contains: q, mode: 'insensitive' } } } },
        { insurancePartnerProfile: { is: { companyName: { contains: q, mode: 'insensitive' } } } },
    ] });
    return AND.length ? { AND } : {};
}
