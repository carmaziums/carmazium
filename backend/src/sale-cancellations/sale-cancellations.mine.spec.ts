import { ForbiddenException } from '@nestjs/common';
import { SaleCancellationsService } from './sale-cancellations.service';

// Purchase History lists approved cancellations where the dealership was the
// buyer. Staff resolve to their dealership owner, so the server says whether
// the viewer was the buyer (viewer.isBuyer) rather than clients comparing ids.
describe('SaleCancellationsService.mine', () => {
    const row = (over: Record<string, unknown>) => ({
        id: 'r', listingId: 'l1', auctionId: null, offerId: null,
        sellerId: 'seller', buyerId: 'owner-1', requestedById: 'seller', requestedByRole: 'SELLER',
        status: 'APPROVED', evidence: [], createdAt: new Date(), ...over,
    });

    function setup(role = 'SALES_AGENT') {
        const prisma: any = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            // Staff member of owner-1's dealership.
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role, isActive: true,
                    dealerProfile: { id: 'dp', userId: 'owner-1', isVerified: true },
                }),
            },
            saleCancellationRequest: { findMany: jest.fn().mockResolvedValue([row({ id: 'a' }), row({ id: 'b', buyerId: 'other', sellerId: 'owner-1' })]) },
            listing: { findUnique: jest.fn().mockResolvedValue(null) },
            serviceJob: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const evidence: any = { hydrateEvidence: jest.fn().mockResolvedValue([]) };
        const service = new SaleCancellationsService(prisma, {} as any, {} as any, {} as any, evidence);
        (service as any).blockingServiceJobs = jest.fn().mockResolvedValue([]);
        return { prisma, service };
    }

    it('flags rows where the dealership (not the staff member) was the buyer', async () => {
        const { service } = setup();
        const rows: any[] = await service.mine('staff-user');
        expect(rows.find(r => r.id === 'a').viewer.isBuyer).toBe(true);
        expect(rows.find(r => r.id === 'b').viewer.isBuyer).toBe(false);
    });

    it('purchase-history scope asks only for approved buyer-side requests', async () => {
        const { prisma, service } = setup();
        await service.mine('staff-user', 'purchase-history');
        const args = prisma.saleCancellationRequest.findMany.mock.calls[0][0];
        expect(args.where).toEqual({ buyerId: 'owner-1', status: 'APPROVED' });
        expect(args.take).toBe(500);
    });

    it('default scope: staff with both permissions see buying and selling sides, as before', async () => {
        const { prisma, service } = setup();
        await service.mine('staff-user');
        const args = prisma.saleCancellationRequest.findMany.mock.calls[0][0];
        expect(args.where.OR).toEqual([{ sellerId: 'owner-1' }, { buyerId: 'owner-1' }]);
        expect(args.take).toBe(100);
    });

    it('default scope: owners keep all three conditions', async () => {
        const { prisma, service } = setup();
        prisma.dealerStaff.findFirst.mockResolvedValue(null);
        prisma.dealerProfile.findUnique.mockResolvedValue({ id: 'dp', userId: 'owner-1', isVerified: true });
        await service.mine('owner-1');
        expect(prisma.saleCancellationRequest.findMany.mock.calls[0][0].where.OR).toHaveLength(3);
    });

    it('revoked access: staff whose role has neither permission get nothing, without a query', async () => {
        const { prisma, service } = setup('NO_PURCHASE_ACCESS');
        await expect(service.mine('staff-user')).resolves.toEqual([]);
        expect(prisma.saleCancellationRequest.findMany).not.toHaveBeenCalled();
    });

    it('removed staff member: resolves to their own id, never the dealership\'s', async () => {
        const { prisma, service } = setup();
        prisma.dealerStaff.findFirst.mockResolvedValue(null); // isActive=false is filtered out
        await service.mine('former-staff');
        const where = prisma.saleCancellationRequest.findMany.mock.calls[0][0].where;
        expect(JSON.stringify(where)).not.toContain('owner-1');
        expect(where.OR).toEqual([{ sellerId: 'former-staff' }, { buyerId: 'former-staff' }, { requestedById: 'former-staff' }]);
    });

    it('findOne refuses staff without a permission for that side, and isolates other dealerships', async () => {
        const { prisma, service } = setup('NO_PURCHASE_ACCESS');
        prisma.saleCancellationRequest.findUnique = jest.fn().mockResolvedValue(row({ id: 'a' }));
        await expect(service.findOne('a', 'staff-user')).rejects.toBeInstanceOf(ForbiddenException);
        const allowed = setup();
        allowed.prisma.saleCancellationRequest.findUnique = jest.fn().mockResolvedValue(row({ id: 'a' }));
        await expect(allowed.service.findOne('a', 'staff-user')).resolves.toMatchObject({ id: 'a' });
        allowed.prisma.saleCancellationRequest.findUnique = jest.fn().mockResolvedValue(
            row({ id: 'x', buyerId: 'another-dealer', sellerId: 'someone', requestedById: 'someone' }));
        await expect(allowed.service.findOne('x', 'staff-user')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('purchase-history scope needs VIEW_PURCHASES for staff (all built-in roles have it)', async () => {
        for (const role of ['ADMIN', 'SALES_AGENT', 'FINANCE_MANAGER']) {
            const { service } = setup(role);
            await expect(service.mine('staff-user', 'purchase-history')).resolves.toBeDefined();
        }
    });

    it('refuses the purchase-history scope to staff without VIEW_PURCHASES', async () => {
        // A role with no permission set (e.g. a future restricted role).
        const { prisma, service } = setup('NO_PURCHASE_ACCESS');
        await expect(service.mine('staff-user', 'purchase-history')).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.saleCancellationRequest.findMany).not.toHaveBeenCalled();
    });

    it('owners and private buyers are not blocked', async () => {
        const { prisma, service } = setup();
        prisma.dealerStaff.findFirst.mockResolvedValue(null);
        prisma.dealerProfile.findUnique.mockResolvedValue({ id: 'dp', userId: 'owner-1', isVerified: true });
        await expect(service.mine('owner-1', 'purchase-history')).resolves.toBeDefined();
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await expect(service.mine('private-buyer', 'purchase-history')).resolves.toBeDefined();
    });
});
