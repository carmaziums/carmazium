import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealersService } from './dealers.service';

describe('DealersService purchased vehicle detail', () => {
    let prisma: any;
    let service: DealersService;

    const sale = (type: 'CLASSIFIED' | 'AUCTION', auction: any) => ({
        id: 'sale-1',
        listingId: 'listing-1',
        soldPrice: 7500,
        createdAt: new Date('2026-10-30T16:46:00Z'),
        purchaseStatus: 'AWAITING_CONFIRMATION',
        listing: {
            id: 'listing-1',
            slug: 'volvo-xc60-2017',
            type,
            status: 'SOLD',
            title: 'Volvo XC60 2017',
            images: ['https://example.test/volvo.jpg'],
            year: 2017, make: 'Volvo', model: 'XC60',
            mileage: 84000, vrm: 'EX17 ABC',
            location: 'Birmingham',
            auction,
        },
    });

    beforeEach(() => {
        prisma = {
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'dealer-1', userId: 'owner-1', isVerified: true,
                }),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            sale: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
            serviceJob: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        service = new DealersService(prisma, {} as any, {} as any, {} as any);
    });

    it('requires VIEW_PURCHASES and returns no sales to strangers', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await expect(service.getDealerPurchaseDetail('stranger', 'sale-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.sale.findFirst).not.toHaveBeenCalled();
    });

    it('scopes the Sale ID to the purchasing dealership and hides foreign sales', async () => {
        prisma.sale.findFirst.mockResolvedValue(null);
        await expect(service.getDealerPurchaseDetail('owner-1', 'foreign-sale'))
            .rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'foreign-sale', buyerId: 'owner-1' },
        }));
    });

    it('does not charge a retail purchase for a historical auction without a winner', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale('CLASSIFIED', {
            id: 'old-auction', winnerId: null,
            buyerFeePaid: false, buyerFeeTransactionId: null,
        }));
        const result = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result).toMatchObject({
            id: 'sale-1',
            channel: 'RETAIL',
            retailSold: true,
            purchaseStatus: 'AWAITING_CONFIRMATION',
            buyerFee: { required: false, settled: true },
            payment: { route: 'DIRECT_TO_SELLER', sellerFundsConfirmedAt: null },
            delivery: null,
        });
        expect(result).not.toHaveProperty('sellerEmail');
        expect(result).not.toHaveProperty('sellerPhone');
        expect(result).not.toHaveProperty('sellerAddress');
        expect(prisma.serviceJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                customerId: 'owner-1',
                serviceType: 'DELIVERY',
                vehicles: { some: { listingId: 'listing-1' } },
            }),
        }));
    });

    it('preserves unpaid auction fee and missing handover evidence', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale('AUCTION', {
            id: 'auction-1', winnerId: 'owner-1',
            buyerFeePaid: false, buyerFeeTransactionId: null,
            sellerFundsConfirmedAt: null, handoverSubmittedAt: null,
            handoverRejectedAt: null, sellerBonusReleased: false,
        }));
        const result = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result.channel).toBe('AUCTION');
        expect(result.buyerFee).toEqual({ required: true, settled: false });
        expect(result.documents.handoverSubmittedAt).toBeNull();
        expect(result.payment.sellerFundsConfirmedAt).toBeNull();
    });

    it('reports confirmed auction funds and actual recorded delivery job only', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale('AUCTION', {
            id: 'auction-1', winnerId: 'owner-1',
            buyerFeePaid: true, buyerFeeTransactionId: 'transaction-1',
            sellerFundsConfirmedAt: new Date('2026-10-31T10:00:00Z'),
            handoverSubmittedAt: new Date('2026-10-31T12:00:00Z'),
            handoverRejectedAt: null, sellerBonusReleased: false,
        }));
        prisma.serviceJob.findFirst.mockResolvedValue({
            id: 'job-1', status: 'OPEN', createdAt: new Date('2026-10-31T13:00:00Z'),
            requestedFor: null,
        });
        const result = await service.getDealerPurchaseDetail('owner-1', 'sale-1');
        expect(result.buyerFee).toEqual({ required: true, settled: true });
        expect(result.delivery).toMatchObject({ jobId: 'job-1', status: 'OPEN' });
        expect(result.payment.sellerFundsConfirmedAt).toContain('2026-10-31');
        expect(result.documents.handoverSubmittedAt).toContain('2026-10-31');
    });
    it('lookup returns only dealer-owned purchases for validated auction listing UUIDs', async () => {
        const listingId = '11111111-2222-3333-4444-555555555555';
        prisma.sale.findMany.mockResolvedValue([{ id: 'sale-1', listingId }]);
        const data = await service.getDealerPurchaseLookup('owner-1', [listingId]);
        expect(data).toEqual([{ id: 'sale-1', listingId }]);
        expect(prisma.sale.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                buyerId: 'owner-1',
                listingId: { in: [listingId] },
            },
            select: { id: true, listingId: true },
        }));
    });

    it('purchase lookup rejects bad identifiers and foreign actors', async () => {
        await expect(service.getDealerPurchaseLookup('owner-1', ['../someone-else']))
            .rejects.toThrow('Provide 1 to 50 valid listing IDs');
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await expect(service.getDealerPurchaseLookup('outsider',
            ['11111111-2222-3333-4444-555555555555']))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.sale.findMany).not.toHaveBeenCalled();
    });

});
