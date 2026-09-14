import { FreeListingGrantsService } from './free-listing-grants.service';

describe('FreeListingGrantsService', () => {
    let prisma: any;
    let service: FreeListingGrantsService;

    const activeGrantRow = (overrides: Record<string, any> = {}) => ({
        id: 'grant-1',
        userId: 'user-1',
        grantedById: 'admin-1',
        expiresAt: new Date('2099-09-14T07:00:00.000Z'),
        usedAt: null,
        usedListingId: null,
        revokedAt: null,
        createdAt: new Date('2026-09-13T07:00:00.000Z'),
        updatedAt: new Date('2026-09-13T07:00:00.000Z'),
        ...overrides,
    });

    const basicDraft = (id = 'listing-1') => ({
        id,
        sellerId: 'user-1',
        type: 'CLASSIFIED',
        badgeTier: 'BASIC',
        status: 'DRAFT',
        images: Array.from({ length: 10 }, (_, i) => `image-${i}`),
    });

    beforeEach(() => {
        prisma = {
            user: {
                findMany: jest.fn(),
                count: jest.fn(),
                findUnique: jest.fn(),
            },
            listing: {
                findUnique: jest.fn(),
            },
            transaction: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn(),
            $transaction: jest.fn(async (callback: any) => callback(prisma)),
        };
        service = new FreeListingGrantsService(prisma);
    });

    it('grants a reusable forever entitlement in the backend-only grant store', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'user-1', deletedAt: null });
        prisma.$executeRaw.mockResolvedValue(1);
        prisma.$queryRaw.mockResolvedValue([
            activeGrantRow({ id: 'grant-new', expiresAt: null }),
        ]);

        const result = await service.grant('user-1', 'admin-1', 'FOREVER');

        expect(result.status).toBe('ACTIVE');
        expect(result.expiresAt).toBeNull();
        expect(result.usedAt).toBeNull();
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('consumes a timed grant only for one BASIC CLASSIFIED draft and records a £0 completed listing fee', async () => {
        prisma.listing.findUnique.mockResolvedValue(basicDraft());
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.$queryRaw.mockResolvedValue([activeGrantRow()]);
        prisma.$executeRaw.mockResolvedValue(1);
        prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(true);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
        expect(prisma.transaction.create).toHaveBeenCalledWith({
            data: {
                userId: 'user-1',
                listingId: 'listing-1',
                amount: 0,
                type: 'LISTING_FEE',
                status: 'COMPLETED',
                description: 'Admin-granted free BASIC listing (grant-1)',
            },
        });
    });

    it('keeps a FOREVER grant active and reusable for multiple BASIC retail listings', async () => {
        prisma.listing.findUnique
            .mockResolvedValueOnce(basicDraft('listing-1'))
            .mockResolvedValueOnce(basicDraft('listing-2'));
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.$queryRaw.mockResolvedValue([
            activeGrantRow({
                expiresAt: null,
                usedAt: new Date('2026-09-13T08:00:00.000Z'),
                usedListingId: 'old-listing',
            }),
        ]);
        prisma.transaction.create.mockResolvedValue({ id: 'tx' });

        const first = await service.applyToListingIfEligible('listing-1', 'user-1');
        const second = await service.applyToListingIfEligible('listing-2', 'user-1');

        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
        expect(prisma.transaction.create).toHaveBeenNthCalledWith(1, {
            data: {
                userId: 'user-1',
                listingId: 'listing-1',
                amount: 0,
                type: 'LISTING_FEE',
                status: 'COMPLETED',
                description: 'Admin-granted free BASIC listing (grant-1)',
            },
        });
        expect(prisma.transaction.create).toHaveBeenNthCalledWith(2, {
            data: {
                userId: 'user-1',
                listingId: 'listing-2',
                amount: 0,
                type: 'LISTING_FEE',
                status: 'COMPLETED',
                description: 'Admin-granted free BASIC listing (grant-1)',
            },
        });
    });

    it('allows an admin to revoke a FOREVER grant that was used before this fix', async () => {
        const legacyUsedForever = activeGrantRow({
            expiresAt: null,
            usedAt: new Date('2026-09-13T08:00:00.000Z'),
            usedListingId: 'old-listing',
        });
        const revoked = activeGrantRow({
            expiresAt: null,
            usedAt: legacyUsedForever.usedAt,
            usedListingId: legacyUsedForever.usedListingId,
            revokedAt: new Date('2026-09-14T12:00:00.000Z'),
        });
        prisma.$queryRaw
            .mockResolvedValueOnce([legacyUsedForever])
            .mockResolvedValueOnce([revoked]);
        prisma.$executeRaw.mockResolvedValue(1);

        const result = await service.revoke('user-1');

        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
        expect(result?.status).toBe('REVOKED');
    });

    it('does not consume an expired grant', async () => {
        prisma.listing.findUnique.mockResolvedValue(basicDraft());
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.$queryRaw.mockResolvedValue([
            activeGrantRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
        ]);

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('never waives STANDARD or PREMIUM upgrade fees', async () => {
        prisma.listing.findUnique.mockResolvedValue({
            ...basicDraft(),
            badgeTier: 'PREMIUM',
        });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not create a duplicate fee transaction when a concurrent request already claimed a timed grant', async () => {
        prisma.listing.findUnique.mockResolvedValue(basicDraft());
        prisma.transaction.findFirst.mockResolvedValue(null);
        prisma.$queryRaw.mockResolvedValue([activeGrantRow()]);
        prisma.$executeRaw.mockResolvedValue(0);

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('does not create a duplicate fee transaction for a FOREVER grant after the row lock', async () => {
        prisma.listing.findUnique.mockResolvedValue(basicDraft());
        prisma.transaction.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'concurrent-fee' });
        prisma.$queryRaw.mockResolvedValue([activeGrantRow({ expiresAt: null })]);

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('does not consume the grant twice when the listing already has a completed fee transaction', async () => {
        prisma.listing.findUnique.mockResolvedValue(basicDraft());
        prisma.transaction.findFirst.mockResolvedValue({ id: 'existing-fee' });

        const applied = await service.applyToListingIfEligible('listing-1', 'user-1');

        expect(applied).toBe(false);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
});
