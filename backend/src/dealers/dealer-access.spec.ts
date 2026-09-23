import { ForbiddenException } from '@nestjs/common';
import {
    assertDealerPermission,
    hasDealerPermission,
    resolveBusinessBuyerId,
    resolveDealerActor,
} from './dealer-access';

function prismaMock(overrides: any = {}) {
    return {
        dealerProfile: {
            findUnique: jest.fn().mockResolvedValue(null),
            ...(overrides.dealerProfile ?? {}),
        },
        dealerStaff: {
            findFirst: jest.fn().mockResolvedValue(null),
            ...(overrides.dealerStaff ?? {}),
        },
        user: {
            findUnique: jest.fn().mockResolvedValue({ role: 'DEALER' }),
            ...(overrides.user ?? {}),
        },
    } as any;
}

describe('dealer-access', () => {
    it('uses DealerProfile.userId as the canonical owner identity', async () => {
        const prisma = prismaMock({
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'dealer-1',
                    userId: 'owner-1',
                    isVerified: true,
                }),
            },
        });

        const actor = await resolveDealerActor(prisma, 'owner-1');

        expect(actor).toEqual({
            userId: 'owner-1',
            ownerUserId: 'owner-1',
            dealerProfileId: 'dealer-1',
            isOwner: true,
            role: 'OWNER',
            isVerified: true,
        });
        expect(hasDealerPermission(actor!, 'MANAGE_TEAM')).toBe(true);
        expect(hasDealerPermission(actor!, 'MANAGE_KYC')).toBe(true);
    });

    it('lets sales staff operate trade, CRM, offers and inventory but not business payments or team admin', async () => {
        const prisma = prismaMock({
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role: 'SALES_AGENT',
                    dealerProfile: {
                        id: 'dealer-1',
                        userId: 'owner-1',
                        isVerified: true,
                    },
                }),
            },
        });

        const actor = await resolveDealerActor(prisma, 'sales-1');

        expect(actor?.ownerUserId).toBe('owner-1');
        expect(hasDealerPermission(actor!, 'VIEW_TRADE')).toBe(true);
        expect(hasDealerPermission(actor!, 'PLACE_BID')).toBe(true);
        expect(hasDealerPermission(actor!, 'MANAGE_CRM')).toBe(true);
        expect(hasDealerPermission(actor!, 'MANAGE_OFFERS')).toBe(true);
        expect(hasDealerPermission(actor!, 'VIEW_INVENTORY')).toBe(true);
        expect(hasDealerPermission(actor!, 'MANAGE_INVENTORY')).toBe(true);
        expect(hasDealerPermission(actor!, 'PAY_AUCTION_FEE')).toBe(false);
        expect(hasDealerPermission(actor!, 'PAY_LISTING_FEE')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_FINANCE')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_TEAM')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_KYC')).toBe(false);
    });

    it('lets finance staff view business data and pay fees without bidding or changing inventory/CRM', async () => {
        const prisma = prismaMock({
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role: 'FINANCE_MANAGER',
                    dealerProfile: {
                        id: 'dealer-1',
                        userId: 'owner-1',
                        isVerified: true,
                    },
                }),
            },
        });

        const actor = await resolveDealerActor(prisma, 'finance-1');

        expect(hasDealerPermission(actor!, 'VIEW_TRADE')).toBe(true);
        expect(hasDealerPermission(actor!, 'PAY_AUCTION_FEE')).toBe(true);
        expect(hasDealerPermission(actor!, 'PAY_LISTING_FEE')).toBe(true);
        expect(hasDealerPermission(actor!, 'MANAGE_FINANCE')).toBe(true);
        expect(hasDealerPermission(actor!, 'VIEW_INVENTORY')).toBe(true);
        expect(hasDealerPermission(actor!, 'VIEW_PURCHASES')).toBe(true);
        expect(hasDealerPermission(actor!, 'VIEW_ANALYTICS')).toBe(true);
        expect(hasDealerPermission(actor!, 'PLACE_BID')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_INVENTORY')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_CRM')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_OFFERS')).toBe(false);
        expect(hasDealerPermission(actor!, 'MANAGE_TEAM')).toBe(false);
    });

    it('rejects a permission outside the staff role', async () => {
        const prisma = prismaMock({
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role: 'FINANCE_MANAGER',
                    dealerProfile: {
                        id: 'dealer-1',
                        userId: 'owner-1',
                        isVerified: true,
                    },
                }),
            },
        });
        const actor = await resolveDealerActor(prisma, 'finance-1');

        expect(() => assertDealerPermission(actor, 'PLACE_BID'))
            .toThrow(ForbiddenException);
    });

    it('returns the dealership owner for a DEALER staff buyer identity', async () => {
        const prisma = prismaMock({
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role: 'SALES_AGENT',
                    dealerProfile: {
                        id: 'dealer-1',
                        userId: 'owner-1',
                        isVerified: true,
                    },
                }),
            },
        });

        await expect(resolveBusinessBuyerId(prisma, 'sales-1')).resolves.toBe('owner-1');
    });

    it('keeps a non-dealer buyer personal', async () => {
        const prisma = prismaMock({
            user: {
                findUnique: jest.fn().mockResolvedValue({ role: 'BUYER' }),
            },
        });

        await expect(resolveBusinessBuyerId(prisma, 'buyer-1')).resolves.toBe('buyer-1');
        expect(prisma.dealerStaff.findFirst).not.toHaveBeenCalled();
    });
});
