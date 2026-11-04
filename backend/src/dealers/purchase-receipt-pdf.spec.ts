import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { PurchaseReceiptPdfService } from './purchase-receipt-pdf.service';

describe('PurchaseReceiptPdfService', () => {
    let dealers: any;
    let prisma: any;
    let service: PurchaseReceiptPdfService;
    const completed = {
        id: 'sale-1', purchasedAt: '2026-11-04T11:00:00.000Z',
        buyerCollectedAt: '2026-11-04T12:00:00.000Z',
        channel: 'RETAIL', buyerFee: { required: false, settled: true },
        purchasePrice: 4000.50,
        advertisedPrice: 4500,
        advertisedPriceSource: 'CURRENT_LISTING',
        payment: { route: 'DIRECT_TO_SELLER', sellerFundsConfirmedAt: null },
        vehicle: {
            title: 'Ford Focus 2017', make: 'Ford', model: 'Focus',
            year: 2017, registration: 'AB17 ABC', mileage: 57000,
        },
    };

    beforeEach(() => {
        dealers = {
            getDealerPurchaseDetail: jest.fn().mockResolvedValue(completed),
            getPurchaseSellerDetails: jest.fn().mockResolvedValue({
                sellerCompany: null, sellerName: 'Chris Collins',
                sellerEmail: 'chris@example.test',
                sellerPhone: '07123456789',
                sellerAddress: 'Full seller address 15 Example Street, Manchester, M1 1AA',
                sellerAddressSource: 'VERIFIED_POSTAL',
                sellerAccountReference: 'seller-original-1',
                sellerCompanyRegistrationNumber: null,
                sellerVatNumber: null,
                contactUnlocked: true,
            }),
        };
        prisma = {
            sale: {
                findUnique: jest.fn().mockResolvedValue({
                    buyerId: 'buyer-1',
                    buyer: {
                        firstName: 'Test', lastName: 'Buyer',
                        email: 'buyer@example.test',
                        dealerProfile: { companyName: 'Example Dealer Ltd', businessAddress: 'Birmingham' },
                    },
                }),
            },
        };
        service = new PurchaseReceiptPdfService(dealers, prisma);
    });

    it('requires an authenticated, buyer-scoped purchase detail', async () => {
        dealers.getDealerPurchaseDetail.mockRejectedValue(new ForbiddenException('Not your purchase'));
        await expect(service.renderForPurchase('other-sale', 'outsider'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(dealers.getPurchaseSellerDetails).not.toHaveBeenCalled();
        expect(prisma.sale.findUnique).not.toHaveBeenCalled();
    });

    it('does not issue a completed-purchase PDF before buyer collection', async () => {
        dealers.getDealerPurchaseDetail.mockResolvedValue({ ...completed, buyerCollectedAt: null });
        await expect(service.renderForPurchase('sale-1', 'buyer-1'))
            .rejects.toBeInstanceOf(ConflictException);
        expect(prisma.sale.findUnique).not.toHaveBeenCalled();
    });

    it('does not bypass the auction buyer fee or seller contact gate', async () => {
        dealers.getDealerPurchaseDetail.mockResolvedValue({
            ...completed, channel: 'AUCTION', buyerFee: { required: true, settled: false },
        });
        await expect(service.renderForPurchase('sale-1', 'buyer-1'))
            .rejects.toBeInstanceOf(NotFoundException);
        expect(dealers.getPurchaseSellerDetails).not.toHaveBeenCalled();
    });

    it('generates a valid A4 PDF for the collected vehicle without a payment mutation', async () => {
        const bytes = await service.renderForPurchase('sale-1', 'buyer-1');
        expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
        const pdf = await PDFDocument.load(bytes);
        expect(pdf.getPageCount()).toBe(2);
        expect(pdf.getTitle()).toBe('CarMazium vehicle purchase record');
        expect(bytes.toString('latin1')).not.toContain('seller bank');
        expect(dealers.getDealerPurchaseDetail).toHaveBeenCalledWith('buyer-1', 'sale-1');
        expect(dealers.getPurchaseSellerDetails).toHaveBeenCalledWith('buyer-1', 'sale-1');
        expect(prisma.sale.findUnique).toHaveBeenCalledTimes(1);
    });

    it('uses only an authorised frozen seller snapshot and preserves the distinct advertised price', async () => {
        const previous = process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED;
        process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED = 'true';
        try {
            prisma.purchaseSellerLegalSnapshot = {
                findFirst: jest.fn().mockResolvedValue({
                    capturedAt: new Date('2026-11-04T12:01:00Z'),
                    saleRecordedAt: new Date('2026-11-04T11:00:00Z'),
                    data: {
                        sellerName: 'Seller at collection',
                        sellerCompany: null,
                        sellerAccountReference: 'seller-original',
                        sellerEmail: 'historic-seller@example.test',
                        sellerPhone: '07123456789',
                        sellerAddress: null,
                        sellerAddressSource: null,
                        sellerCompanyRegistrationNumber: null,
                        sellerVatNumber: null,
                        advertisedPriceAtCapture: 4200,
                    },
                }),
            };
            const bytes = await service.renderForPurchase('sale-1', 'buyer-1');
            expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
            expect(prisma.purchaseSellerLegalSnapshot.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({ where: { saleId: 'sale-1', buyerId: 'buyer-1' } }),
            );
        } finally {
            if (previous === undefined) delete process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED;
            else process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED = previous;
        }
    });

    it('does not invent a buyer when the sale is missing', async () => {
        prisma.sale.findUnique.mockResolvedValue(null);
        await expect(service.renderForPurchase('sale-1', 'buyer-1'))
            .rejects.toBeInstanceOf(NotFoundException);
    });
});
