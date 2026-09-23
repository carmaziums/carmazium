import { UserRole } from '@prisma/client';

/**
 * Account roles a user may choose for themselves without staff approval.
 *
 * Privileged roles are intentionally absent:
 * - ADMIN
 * - FINANCE_PARTNER
 * - INSURANCE_PARTNER
 *
 * DEALER and CONTRACTOR are self-service entry roles only. Access to protected
 * trade/service capabilities still requires the relevant KYC/capability
 * approval gates.
 */
export const SELF_SERVICE_USER_ROLES: readonly UserRole[] = [
    UserRole.BUYER,
    UserRole.SELLER,
    UserRole.DEALER,
    UserRole.CONTRACTOR,
];

export function isSelfServiceUserRole(value: unknown): value is UserRole {
    return (
        typeof value === 'string' &&
        SELF_SERVICE_USER_ROLES.includes(value as UserRole)
    );
}
