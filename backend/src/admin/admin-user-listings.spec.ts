import { AdminService } from './admin.service';

describe('Admin chat user detail vehicle history', () => {
    const accountId = 'account-a';
    const listing = {
        id: 'vehicle-1',
        title: 'Example vehicle',
        vrm: 'AA21ABC',
        type: 'CLASSIFIED',
        status: 'SOLD',
        deletedAt: new Date('2026-11-14T00:00:00Z'),
        price: 4200,
        images: [],
    };

    function setup(listings = [listing]) {
        const prisma: any = {
            user: { findUnique: jest.fn().mockResolvedValue({
                id: accountId,
                firstName: 'Example',
                lastName: 'Customer',
                email: 'example@example.test',
                role: 'BUYER',
                _count: { listings: listings.length },
            }) },
            listing: { findMany: jest.fn().mockResolvedValue(listings) },
            transaction: { findMany: jest.fn().mockResolvedValue([]) },
            $queryRaw: jest.fn().mockResolvedValue([]),
        };
        const service = new AdminService(
            prisma, {} as any, {} as any, {} as any, {} as any,
            {} as any, {} as any, {} as any,
        );
        return { service, prisma };
    }

    it('returns recent sold/archived vehicles for the exact account, including registration and photographs', async () => {
        const { service, prisma } = setup();
        const result = await service.getUserDetail(accountId);
        expect(result.recentListings).toEqual([listing]);
        expect(prisma.listing.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { sellerId: accountId },
            take: 20,
            select: expect.objectContaining({
                vrm: true, deletedAt: true, images: true, type: true, status: true,
            }),
        }));
        expect(prisma.listing.findMany.mock.calls[0][0].where).not.toHaveProperty('deletedAt');
    });

    it('does not borrow another account’s vehicle just because the account names match', async () => {
        const { service, prisma } = setup([]);
        const result = await service.getUserDetail(accountId);
        expect(result.recentListings).toEqual([]);
        expect(prisma.listing.findMany.mock.calls[0][0].where).toEqual({ sellerId: accountId });
    });
});
