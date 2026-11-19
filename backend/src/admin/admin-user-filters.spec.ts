import { AdminService } from './admin.service';
import { adminUserWhere } from './admin-user-filters';
import { ServiceType, UserRole } from '@prisma/client';
const now = new Date('2026-11-19T13:00:00Z');

describe('Account management filters', () => {
    it('supports every stored role and category and rejects invalid filters', () => {
        for (const accountType of [...Object.values(UserRole), 'SERVICE_PROVIDER']) expect(() => adminUserWhere('', { accountType }, now)).not.toThrow();
        for (const serviceType of Object.values(ServiceType)) expect(() => adminUserWhere('', { serviceType }, now)).not.toThrow();
        for (const key of ['accountType', 'dealerVerification', 'serviceType', 'providerStatus', 'accountStatus', 'emailVerification']) {
            expect(() => adminUserWhere('', { [key]: 'INVALID' }, now)).toThrow(/Unknown/);
        }
    });
    it('includes dealers without profiles in unverified results', () => {
        expect(adminUserWhere('', { dealerVerification: 'UNVERIFIED' }, now)).toEqual({ AND: [
            { role: 'DEALER' }, { OR: [{ dealerProfile: { is: null } }, { dealerProfile: { is: { isVerified: false } } }] },
        ] });
    });
    it('requires current approval on the SAME capability as the selected category', () => {
        const where = adminUserWhere('North', { accountType: 'DEALER', serviceType: 'WARRANTY', providerStatus: 'VERIFIED' }, now);
        expect(where.AND).toEqual(expect.arrayContaining([
            { role: 'DEALER' }, { contractorProfile: { is: { deletedAt: null, capabilities: { some: {
                serviceType: 'WARRANTY', status: 'APPROVED', verificationStatus: 'VERIFIED', verificationExpiresAt: { gt: now },
            } } } } },
        ]));
        expect(JSON.stringify(where)).toContain('businessName');
        expect(JSON.stringify(where)).toContain('companyName');
    });
    it('unverified inspection results cannot be hidden by an approved warranty capability', () => {
        const where = adminUserWhere('', { serviceType: 'INSPECTION', providerStatus: 'UNVERIFIED' }, now);
        expect(where.AND).toEqual(expect.arrayContaining([
            { OR: [{ contractorProfile: { is: { deletedAt: null, capabilities: { some: { serviceType: 'INSPECTION' } } } } }] },
            { NOT: { contractorProfile: { is: { deletedAt: null, capabilities: { some: {
                serviceType: 'INSPECTION', status: 'APPROVED', verificationStatus: 'VERIFIED', verificationExpiresAt: { gt: now },
            } } } } } },
        ]));
    });
    it('includes finance partner accounts when filtering the finance category', () => {
        expect(adminUserWhere('', { serviceType: 'FINANCE' }, now)).toMatchObject({ AND: [{ OR: expect.arrayContaining([{ role: 'FINANCE_PARTNER' }]) }] });
    });
    it('separates bans from self-deletion and active accounts from unexpired locks', () => {
        expect(adminUserWhere('', { accountStatus: 'BANNED' }, now)).toMatchObject({ AND: [{ deletedAt: { not: null }, NOT: { email: { endsWith: '@deleted.carmazium.com' } } }] });
        expect(adminUserWhere('', { accountStatus: 'LOCKED' }, now)).toMatchObject({ AND: [{ deletedAt: null, lockoutUntil: { gt: now } }] });
        expect(adminUserWhere('', { accountStatus: 'ACTIVE' }, now)).toMatchObject({ AND: [{ OR: [{ lockoutUntil: null }, { lockoutUntil: { lte: now } }] }] });
    });
    it('does not confuse email verification with dealer KYC', () => {
        expect(adminUserWhere('', { dealerVerification: 'UNVERIFIED', emailVerification: 'VERIFIED' }, now).AND)
            .toEqual(expect.arrayContaining([{ isEmailVerified: true }, { role: 'DEALER' }]));
    });
    it('covers every dealer and provider lifecycle state, including expired approval', () => {
        for (const dealerVerification of ['VERIFIED','UNVERIFIED','PENDING','REJECTED','NOT_SUBMITTED']) expect(() => adminUserWhere('', { dealerVerification }, now)).not.toThrow();
        for (const providerStatus of ['VERIFIED','UNVERIFIED','PENDING','REJECTED','SUSPENDED','EXPIRED','NOT_SUBMITTED']) {
            expect(() => adminUserWhere('', { providerStatus }, now)).not.toThrow();
            expect(() => adminUserWhere('', { serviceType: 'WARRANTY', providerStatus }, now)).not.toThrow();
        }
        expect(adminUserWhere('', { providerStatus: 'EXPIRED' }, now)).toMatchObject({ AND: [{ contractorProfile: { is: { capabilities: { some: { OR: [
            { verificationStatus: 'REVERIFICATION_REQUIRED' }, { verificationStatus: 'VERIFIED', verificationExpiresAt: { lte: now } },
        ] } } } } }] });
    });
    it('filters the count and records before pagination and validates page bounds', async () => {
        const prisma = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'match-21' }]), count: jest.fn().mockResolvedValue(21) } };
        const service = new AdminService(prisma as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any);
        const result = await service.getAllUsers(2, 20, 'North', { accountType: 'SERVICE_PROVIDER', serviceType: 'WARRANTY', providerStatus: 'PENDING' });
        const query = prisma.user.findMany.mock.calls[0][0];
        expect(query).toMatchObject({ skip: 20, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
        expect(prisma.user.count).toHaveBeenCalledWith({ where: query.where });
        expect(result).toEqual({ data: [{ id: 'match-21' }], total: 21 });
        for (const [page, limit] of [[0,20],[1,0],[1,101],[1.5,20],[NaN,20]]) await expect(service.getAllUsers(page, limit)).rejects.toThrow(/Page/);
    });
});
