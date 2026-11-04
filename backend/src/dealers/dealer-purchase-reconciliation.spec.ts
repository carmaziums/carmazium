import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { DealersService } from './dealers.service';
import { PurchaseReceiptPdfService } from './purchase-receipt-pdf.service';

describe('Owner-confirmed recovered purchases', () => {
    let prisma: any;
    let service: DealersService;
    const record = {
        id: 'recovered-1',
        buyerId: 'owner-1',
        stockListingId: 'new-stock-1',
        sourceListingId: 'old-auction-1',
        vehicleVrm: 'AB66XYZ',
        purchasePrice: null,
        status: 'COMPLETED',
        provenance: 'OWNER_CONFIRMED',
        notes: null,
        collectedAt: new Date('2026-09-26T00:00:00.000Z'),
        createdAt: new Date('2026-11-04T13:00:00.000Z'),
        stockListing: {
            title: 'Nissan Qashqai 2016', images: [], make: 'Nissan',
            model: 'Qashqai', year: 2016, mileage: 58000, color: 'Grey',
            vrm: 'AB66XYZ',
        },
    };

    beforeEach(() => {
        prisma = {
            dealerProfile: { findUnique: jest.fn().mockResolvedValue({
                id: 'dealer-1', userId: 'owner-1', isVerified: true,
            }) },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            dealerPurchaseReconciliation: {
                findMany: jest.fn().mockResolvedValue([record]),
                create: jest.fn(),
                update: jest.fn(),
            },
            sale: { create: jest.fn(), update: jest.fn() },
            auction: { update: jest.fn() },
            listing: { update: jest.fn() },
        };
        service = new DealersService(prisma, {} as any, {} as any, {} as any);
    });

    it('shows an owner-attested completed collection without inventing an agreed price', async () => {
        const rows = await service.getDealerReconciledPurchases('owner-1');
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: 'recovered-1',
            registration: 'AB66XYZ',
            status: 'CHECKS_COMPLETE',
            purchaseChannel: 'RECONCILED',
            collectedAt: '2026-09-26',
            buyerCollectedAt: '2026-09-26',
            purchasePrice: null,
            provenance: 'OWNER_CONFIRMED',
        });
        expect(prisma.dealerPurchaseReconciliation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { buyerId: 'owner-1', status: 'COMPLETED' } }),
        );
        for (const model of ['sale','auction','listing']) {
            expect(prisma[model].create || jest.fn()).not.toHaveBeenCalled();
            expect(prisma[model].update).not.toHaveBeenCalled();
        }
    });

    it('prevents another buyer from seeing recovered records', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await expect(service.getDealerReconciledPurchases('outsider'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.dealerPurchaseReconciliation.findMany).not.toHaveBeenCalled();
    });

    it('returns 404 for an ID outside the buyer account', async () => {
        await expect(service.getDealerReconciledPurchaseDetail('owner-1', 'other-recovered'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('generates a usable accounting record, not an unverified VAT invoice', async () => {
        const pdf = new PurchaseReceiptPdfService(service, prisma);
        const bytes = await pdf.renderForReconciled('recovered-1', 'owner-1');
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getTitle()).toContain('owner-confirmed');
        expect(prisma.sale.create).not.toHaveBeenCalled();
    });
});
