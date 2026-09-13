import { FreeListingGrantsService } from './free-listing-grants.service';

describe('FreeListingGrantsService', () => {
    let prisma: any;
    let service: FreeListingGrantsService;

    beforeEach(() => {
        prisma = {
            user: {
                findMany: jest.fn(),
                count: jest.fn(),
                findUnique: jest.fn(),
                updateMany: jest.fn(),
            },
            listing: {
                findUnique: jest.fn(),
            },
            transaction: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            $transaction: jest.fn(async (callback: any) => callback(prisma)),
        };
        service = new FreeListingGrantsService(prisma);
    });

    it('grants one entitlement forever without overwriting unrelated preferences', async () => {
        const updatedAt = new Date('2026-09-13T08:00:00.000Z');
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            deletedAt: null,
            updatedAt,
            preferences: { theme: 'dark' },
        });
        prisma.user.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.grant('user-1', 'admin-1', 'FOREVER');

        expect(result.status).toBe('ACTIVE');
        expect(result.expiresAt).toBeNull();
        expect(result.usedAt).toBeNull();
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { id: 'user-1', updatedAt },
            data: {
                preferences: expect.objectContaining({
                    theme: 'dark',
                    adminFreeListingGrant: expect.objectContaining({
                        grantedById: 'admin-1',
                        expiresAt: null,
                        usedAt: null,
                    }),
                }),
            },
        });
    });

    it('consumes an active grant only for one BASIC CLASSIFIED draft and records a £0 completed listing fee', async () => {
        const updatedAt = new Date('2026-09-13T08:00:00.000Z');
        const grant = {
            id: 'grant-1',
            grantedAt: '2026-09-13T07:00:00.000Z',
            grantedById: 'admin-1',
            expiresAt: '2026-09-14T07:00:00.000Z',
            usedAt: null,
            usedListingId: null,
            revokedAt: null,
        };

        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'user-1',
            type: 'CLASSIFIED',
            badgeTier: 'BASIC',
            status: 'DRAFT',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        });
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({
            updatedAt,
            preferences: { language: 'en', adminFreeListingGrant: grant },
        });
        prisma.user.updateMany.mockResolvedValue({ count: 1 });
        prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(true);
        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { id: 'user-1', updatedAt },
            data: {
                preferences: expect.objectContaining({
                    language: 'en',
                    adminFreeListingGrant: expect.objectContaining({
                        id: 'grant-1',
                        usedListingId: 'listing-1',
                        usedAt: expect.any(String),
                    }),
                }),
            },
        });
        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-1',
                listingId: 'listing-1',
                amount: 0,
                type: 'LISTING_FEE',
                status: 'COMPLETED',
                description: 'Admin-granted free BASIC listing',
            },
        });
    });

    it('does not consume an expired grant', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'user-1',
            type: 'CLASSIFIED',
            badgeTier: 'BASIC',
            status: 'DRAFT',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        });
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({
            updatedAt: new Date(),
            preferences: {
                adminFreeListingGrant: {
                    id: 'grant-1',
                    grantedAt: '2026-09-10T00:00:00.000Z',
                    grantedById: 'admin-1',
                    expiresAt: '2026-09-11T00:00:00.000Z',
                    usedAt: null,
                    usedListingId: null,
                    revokedAt: null,
                },
            },
        });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('never waives STANDARD or PREMIUM upgrade fees', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'user-1',
            type: 'CLASSIFIED',
            badgeTier: 'PREMIUM',
            status: 'DRAFT',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('does not create a duplicate fee transaction when a concurrent request already claimed the grant', async () => {
        const updatedAt = new Date('2026-09-13T08:00:00.000Z');
        prisma.listing.findUnique.mockResolvedValue({
            id: 'listing-1',
            sellerId: 'user-1',
            type: 'CLASSIFIED',
            badgeTier: 'BASIC',
            status: 'DRAFT',
            images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
        });
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.user.findUnique.mockResolvedValue({
            updatedAt,
            preferences: {
                adminFreeListingGrant: {
                    id: 'grant-1',
                    grantedAt: '2026-09-13T07:00:00.000Z',
                    grantedById: 'admin-1',
                    expiresAt: null,
                    usedAt: null,
                    usedListingId: null,
                    revokedAt: null,
                },
            },
        });
        prisma.user.updateMany.mockResolvedValue({ count: 0 });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
});
