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

    function setup() {
        const prisma: any = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
            // Staff member of owner-1's dealership.
            dealerStaff: {
                findFirst: jest.fn().mockResolvedValue({
                    role: 'SALES_AGENT', isActive: true,
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

    it('default scope is unchanged', async () => {
        const { prisma, service } = setup();
        await service.mine('staff-user');
        const args = prisma.saleCancellationRequest.findMany.mock.calls[0][0];
        expect(args.where.OR).toHaveLength(3);
        expect(args.take).toBe(100);
    });
});
