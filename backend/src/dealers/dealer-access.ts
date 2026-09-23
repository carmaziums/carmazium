import { ForbiddenException } from '@nestjs/common';
import { DealerRole, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DealerPermission =
    | 'VIEW_TRADE'
    | 'PLACE_BID'
    | 'PAY_AUCTION_FEE'
    | 'PAY_LISTING_FEE'
    | 'MANAGE_CRM'
    | 'MANAGE_OFFERS'
    | 'VIEW_INVENTORY'
    | 'MANAGE_INVENTORY'
    | 'MANAGE_FINANCE'
    | 'VIEW_PURCHASES'
    | 'VIEW_ANALYTICS'
    | 'MANAGE_TEAM'
    | 'MANAGE_KYC';

export interface DealerActor {
    userId: string;
    ownerUserId: string;
    dealerProfileId: string;
    isOwner: boolean;
    role: 'OWNER' | DealerRole;
    isVerified: boolean;
}

const ROLE_PERMISSIONS: Record<DealerRole, ReadonlySet<DealerPermission>> = {
    ADMIN: new Set<DealerPermission>([
        'VIEW_TRADE',
        'PLACE_BID',
        'PAY_AUCTION_FEE',
        'PAY_LISTING_FEE',
        'MANAGE_CRM',
        'MANAGE_OFFERS',
        'VIEW_INVENTORY',
        'MANAGE_INVENTORY',
        'MANAGE_FINANCE',
        'VIEW_PURCHASES',
        'VIEW_ANALYTICS',
        'MANAGE_TEAM',
    ]),
    SALES_AGENT: new Set<DealerPermission>([
        'VIEW_TRADE',
        'PLACE_BID',
        'MANAGE_CRM',
        'MANAGE_OFFERS',
        'VIEW_INVENTORY',
        'MANAGE_INVENTORY',
        'VIEW_PURCHASES',
        'VIEW_ANALYTICS',
    ]),
    FINANCE_MANAGER: new Set<DealerPermission>([
        'VIEW_TRADE',
        'PAY_AUCTION_FEE',
        'PAY_LISTING_FEE',
        'MANAGE_FINANCE',
        'VIEW_INVENTORY',
        'VIEW_PURCHASES',
        'VIEW_ANALYTICS',
    ]),
};

/**
 * Resolve the authenticated user to the dealership they represent.
 *
 * DealerProfile.userId is the canonical business identity. Active staff act on
 * behalf of that owner instead of creating a second pseudo-dealership under
 * their own user id.
 */
export async function resolveDealerActor(
    prisma: PrismaService,
    userId: string,
): Promise<DealerActor | null> {
    const ownerProfile = await prisma.dealerProfile.findUnique({
        where: { userId },
        select: { id: true, userId: true, isVerified: true },
    });

    if (ownerProfile) {
        return {
            userId,
            ownerUserId: ownerProfile.userId,
            dealerProfileId: ownerProfile.id,
            isOwner: true,
            role: 'OWNER',
            isVerified: ownerProfile.isVerified,
        };
    }

    const membership = await prisma.dealerStaff.findFirst({
        where: { userId, isActive: true },
        select: {
            role: true,
            dealerProfile: {
                select: {
                    id: true,
                    userId: true,
                    isVerified: true,
                },
            },
        },
    });

    if (!membership) return null;

    return {
        userId,
        ownerUserId: membership.dealerProfile.userId,
        dealerProfileId: membership.dealerProfile.id,
        isOwner: false,
        role: membership.role,
        isVerified: membership.dealerProfile.isVerified,
    };
}

export function hasDealerPermission(
    actor: DealerActor,
    permission: DealerPermission,
): boolean {
    if (actor.isOwner) return true;
    if (permission === 'MANAGE_KYC') return false;
    return ROLE_PERMISSIONS[actor.role as DealerRole]?.has(permission) ?? false;
}

export function assertDealerPermission(
    actor: DealerActor | null,
    permission: DealerPermission,
    message = 'You do not have permission to perform this dealership action.',
): asserts actor is DealerActor {
    if (!actor || !hasDealerPermission(actor, permission)) {
        throw new ForbiddenException(message);
    }
}

/**
 * Resolve the canonical buyer id for dealership-owned trade activity.
 * Non-dealer users keep their own id.
 */
export async function resolveBusinessBuyerId(
    prisma: PrismaService,
    userId: string,
): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (user?.role !== UserRole.DEALER) return userId;

    const actor = await resolveDealerActor(prisma, userId);
    return actor?.ownerUserId ?? userId;
}
