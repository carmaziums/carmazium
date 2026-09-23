import { UserRole } from '@prisma/client';
import { SELF_SERVICE_USER_ROLES, isSelfServiceUserRole } from './account-roles';

describe('self-service account roles', () => {
    it('allows only the public self-service roles', () => {
        expect(SELF_SERVICE_USER_ROLES).toEqual([
            UserRole.BUYER,
            UserRole.SELLER,
            UserRole.DEALER,
            UserRole.CONTRACTOR,
        ]);

        expect(isSelfServiceUserRole(UserRole.BUYER)).toBe(true);
        expect(isSelfServiceUserRole(UserRole.SELLER)).toBe(true);
        expect(isSelfServiceUserRole(UserRole.DEALER)).toBe(true);
        expect(isSelfServiceUserRole(UserRole.CONTRACTOR)).toBe(true);
    });

    it('never allows privileged roles to be self-granted', () => {
        expect(isSelfServiceUserRole(UserRole.ADMIN)).toBe(false);
        expect(isSelfServiceUserRole(UserRole.FINANCE_PARTNER)).toBe(false);
        expect(isSelfServiceUserRole(UserRole.INSURANCE_PARTNER)).toBe(false);
        expect(isSelfServiceUserRole('UNKNOWN')).toBe(false);
        expect(isSelfServiceUserRole(undefined)).toBe(false);
    });
});
