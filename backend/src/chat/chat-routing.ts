import { UserRole } from '@prisma/client';

/**
 * Canonical web inbox destination for a role. Keep all chat-created
 * notification links here so normal messages and admin broadcasts never drift.
 */
export function messageInboxLink(role: UserRole, roomId: string): string {
    switch (role) {
        case UserRole.ADMIN:
            return `/dashboard/admin/messages?room=${roomId}`;
        case UserRole.DEALER:
            return `/dashboard/dealer/messages?room=${roomId}`;
        case UserRole.CONTRACTOR:
            return `/dashboard/service/messages?room=${roomId}`;
        case UserRole.FINANCE_PARTNER:
            return `/dashboard/finance/messages?room=${roomId}`;
        case UserRole.INSURANCE_PARTNER:
            return `/dashboard/insurance/messages?room=${roomId}`;
        case UserRole.SELLER:
            return `/dashboard/seller/messages?room=${roomId}`;
        case UserRole.BUYER:
        default:
            return `/dashboard/buyer/messages?room=${roomId}`;
    }
}
