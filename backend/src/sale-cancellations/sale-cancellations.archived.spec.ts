import { ConflictException, NotFoundException } from '@nestjs/common';
import { SaleCancellationsService } from './sale-cancellations.service';

describe('Archived sale cancellation review', () => {
    function setup(deletedAt: Date | null = new Date('2026-11-14T11:54:55Z')) {
        let request: any = {
            id: 'cancellation-1',
            listingId: 'listing-1',
            saleId: 'sale-1',
            auctionId: null,
            offerId: null,
            buyerId: null,
            sellerId: 'seller-1',
            requestedById: 'seller-1',
            requestedByRole: 'SELLER',
            status: 'PENDING_ADMIN',
            reason: 'MUTUAL_AGREEMENT',
            evidence: [],
        };
        const listing: any = {
            id: 'listing-1',
            sellerId: 'seller-1',
            title: 'Toyota Corolla 2021',
            vrm: 'WL21JSZ',
            status: 'SOLD',
            type: 'CLASSIFIED',
            deletedAt,
            linkedListingId: null,
            sale: { id: 'sale-1', buyerId: null },
            auction: null,
            offers: [],
        };
        const tx: any = {
            sale: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            offer: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            deliveryRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            listing: { update: jest.fn().mockResolvedValue({}) },
            sellerProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
            saleCancellationRequest: {
                update: jest.fn().mockImplementation(async ({ data }: any) => {
                    request = { ...request, ...data };
                    return request;
                }),
            },
        };
        const prisma: any = {
            listing: { findUnique: jest.fn().mockImplementation(async () => listing) },
            saleCancellationRequest: {
                findUnique: jest.fn().mockImplementation(async () => request),
            },
            $transaction: jest.fn().mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(tx)),
        };
        const notifications: any = { create: jest.fn().mockResolvedValue({}) };
        const evidence: any = { hydrateEvidence: jest.fn().mockResolvedValue([]) };
        const service = new SaleCancellationsService(prisma, notifications, {} as any, {} as any, evidence);
        return { service, listing, prisma, tx, notifications };
    }

    it('still prevents ordinary cancellation creation against an archived listing', async () => {
        const { service } = setup();
        await expect((service as any).context('listing-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows an admin to reverse the existing sale without unarchiving or publishing the advert', async () => {
        const { service, prisma, tx, listing, notifications } = setup();
        const result = await service.adminReview('cancellation-1', 'admin-1', 'APPROVE', 'Verified the original sale');

        expect(result.status).toBe('APPROVED');
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.sale.deleteMany).toHaveBeenCalledWith({ where: { listingId: 'listing-1' } });
        expect(tx.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: { status: 'DRAFT' },
        });
        expect(tx.saleCancellationRequest.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'APPROVED', adminReviewedById: 'admin-1' }),
        }));
        expect(listing.deletedAt).toEqual(new Date('2026-11-14T11:54:55Z'));
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'seller-1' }));
    });

    it('does not change the existing active-listing restoration policy', async () => {
        const { service, tx } = setup(null);
        await service.adminReview('cancellation-1', 'admin-1', 'APPROVE', 'Mutual agreement');
        expect(tx.listing.update).toHaveBeenCalledWith({
            where: { id: 'listing-1' },
            data: { status: 'ACTIVE' },
        });
    });

    it('blocks an old request from reversing a replacement sale', async () => {
        const { service, listing, prisma, tx } = setup();
        listing.sale = { id: 'different-sale', buyerId: null };
        await expect(
            service.adminReview('cancellation-1', 'admin-1', 'APPROVE', 'Reviewed'),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(tx.sale.deleteMany).not.toHaveBeenCalled();
    });

    it('does not grant automatic counterpart responses access to archived listings', async () => {
        const { service, prisma } = setup();
        await expect((service as any).finalize('cancellation-1')).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});
