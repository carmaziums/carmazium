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
        // The retail stock record is intentionally absent from API results.
        stockListing: { title: 'Dealer retail advert (must NEVER display)' },
        sourceListing: {
            id: 'old-auction-1',
            price: 6500,
            updatedAt: new Date('2026-10-07T12:00:00.000Z'),
            title: 'Nissan Qashqai 2016 - original seller advert',
            images: ['https://example.test/original-auction-seller-photo.jpg'],
            make: 'Nissan', model: 'Qashqai', year: 2016,
            mileage: 92000, color: 'Red', vrm: 'AB66XYZ',
            createdAt: new Date('2026-09-18T16:00:00.000Z'),
            seller: { firstName: 'Original', lastName: 'Seller' },
            auction: { id: 'auction-1', status: 'CANCELLED' },
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
                findFirst: jest.fn().mockResolvedValue({
                    sourceListing: {
                        seller: {
                            id: 'seller-original-1',
                            firstName: 'Original', lastName: 'Seller',
                            email: 'original@example.test',
                            phone: '07123456789',
                            isAddressVerified: true,
                            dealerProfile: null,
                            addressVerifications: [{ address: 'Original 44 Street, Manchester, M3 3AA' }],
                        },
                    },
                }),
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
            listingId: 'old-auction-1',
            sourceListingId: 'old-auction-1',
            sellerName: 'Original Seller',
            originalListedAt: '2026-09-18',
            vehicleTitle: 'Nissan Qashqai 2016 - original seller advert',
            imageUrl: 'https://example.test/original-auction-seller-photo.jpg',
            status: 'CHECKS_COMPLETE',
            purchaseChannel: 'RECONCILED',
            collectedAt: '2026-09-26',
            buyerCollectedAt: '2026-09-26',
            purchasePrice: null,
            advertisedPrice: 6500,
            advertisedPriceSource: 'CURRENT_ORIGINAL_LISTING',
            provenance: 'OWNER_CONFIRMED',
        });
        expect(rows[0].vehicleSubtitle).toContain('92,000 mi');
        expect(JSON.stringify(rows[0])).not.toContain('Dealer retail advert');
        expect(prisma.dealerPurchaseReconciliation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { buyerId: 'owner-1', status: 'COMPLETED' } }),
        );
        for (const model of ['sale','auction','listing']) {
            if (prisma[model].create) expect(prisma[model].create).not.toHaveBeenCalled();
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
        expect(doc.getPageCount()).toBe(2);
        expect(doc.getTitle()).toContain('owner-confirmed');
        expect(prisma.sale.create).not.toHaveBeenCalled();
    });
});
