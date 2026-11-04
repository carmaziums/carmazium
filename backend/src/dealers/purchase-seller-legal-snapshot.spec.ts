import {
    capturePurchaseSellerLegalSnapshot,
    purchaseSellerLegalSnapshotsEnabled,
    readPurchaseSellerLegalSnapshot,
} from './purchase-seller-legal-snapshot';

describe('private seller evidence for collected purchase', () => {
    const previous = process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED;
    let prisma: any;

    beforeEach(() => {
        process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED = 'true';
        prisma = {
            sale: { findUnique: jest.fn().mockResolvedValue({
                id: 'sale-1', listingId: 'original-seller-auction-1',
                buyerId: 'actual-buyer', sellerId: 'original-seller',
                createdAt: new Date('2026-11-04T12:00:00Z'),
                listing: { price: { toString: () => '6500' } },
            }) },
            user: { findUnique: jest.fn().mockResolvedValue({
                id: 'original-seller',
                firstName: 'Original', lastName: 'Seller',
                email: 'seller@example.test',
                phone: '07000000000',
                isAddressVerified: true,
                dealerProfile: null,
                addressVerifications: [{ address: '10 Example Road, Birmingham' }],
            }) },
            purchaseSellerLegalSnapshot: {
                upsert: jest.fn().mockResolvedValue({ id: 'snap-1' }),
                findFirst: jest.fn().mockResolvedValue(null),
            },
        };
    });

    afterAll(() => {
        if (previous === undefined) delete process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED;
        else process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED = previous;
    });

    it('is disabled until migration, privacy and retention approval', async () => {
        delete process.env.PURCHASE_SELLER_LEGAL_SNAPSHOTS_ENABLED;
        expect(purchaseSellerLegalSnapshotsEnabled()).toBe(false);
        await capturePurchaseSellerLegalSnapshot(prisma, { listingId: 'l-1', buyerId: 'actual-buyer' });
        expect(prisma.sale.findUnique).not.toHaveBeenCalled();
        expect(await readPurchaseSellerLegalSnapshot(prisma, 'sale-1', 'actual-buyer')).toBeNull();
        expect(prisma.purchaseSellerLegalSnapshot.findFirst).not.toHaveBeenCalled();
    });

    it('captures seller account details and asking price, never bank or KYC files', async () => {
        await capturePurchaseSellerLegalSnapshot(prisma, {
            listingId: 'original-seller-auction-1', buyerId: 'actual-buyer',
        });
        const args = prisma.purchaseSellerLegalSnapshot.upsert.mock.calls[0][0];
        expect(args).toMatchObject({
            where: { saleId: 'sale-1' },
            update: {},
            create: {
                saleId: 'sale-1', buyerId: 'actual-buyer',
                sellerId: 'original-seller',
                listingId: 'original-seller-auction-1',
                data: {
                    sellerName: 'Original Seller',
                    sellerAddressSource: 'ACCOUNT_CONFIRMED_POSTAL',
                    sellerAddress: '10 Example Road, Birmingham',
                    advertisedPriceAtCapture: 6500,
                },
            },
        });
        expect(JSON.stringify(args)).not.toMatch(
            /bankAccount|sortCode|directorIdProof|proofOfAddress|passwordHash|idDocument/,
        );
        expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'original-seller' },
        }));
    });

    it('never captures a Sale that belongs to a different buyer', async () => {
        await capturePurchaseSellerLegalSnapshot(prisma, {
            listingId: 'original-seller-auction-1', buyerId: 'intruder',
        });
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.purchaseSellerLegalSnapshot.upsert).not.toHaveBeenCalled();
    });

    it('uses a business address with correct source, without calling it a residence check', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'original-seller', firstName: null, lastName: null,
            email: 'business@example.test', phone: null, isAddressVerified: false,
            addressVerifications: [],
            dealerProfile: {
                companyName: 'Example Cars Ltd', businessAddress: '4 Trading Park, London',
                phone: '02070000000', registrationNumber: '12345678', vatNumber: 'GB123456789',
            },
        });
        await capturePurchaseSellerLegalSnapshot(prisma, { listingId: 'original', buyerId: 'actual-buyer' });
        const data = prisma.purchaseSellerLegalSnapshot.upsert.mock.calls[0][0].create.data;
        expect(data).toMatchObject({
            sellerCompany: 'Example Cars Ltd',
            sellerAddressSource: 'BUSINESS',
            sellerAddress: '4 Trading Park, London',
            sellerPhone: '02070000000',
            sellerCompanyRegistrationNumber: '12345678',
            sellerVatNumber: 'GB123456789',
        });
    });

    it('refuses to read a snapshot belonging to another buyer', async () => {
        await readPurchaseSellerLegalSnapshot(prisma, 'sale-1', 'intruder');
        expect(prisma.purchaseSellerLegalSnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { saleId: 'sale-1', buyerId: 'intruder' },
        }));
    });

    it('preserves historical capture time and distinguishes late captures', async () => {
        prisma.purchaseSellerLegalSnapshot.findFirst.mockResolvedValue({
            capturedAt: new Date('2026-11-04T16:00:00Z'),
            saleRecordedAt: new Date('2026-11-04T12:00:00Z'),
            data: { sellerName: 'Original Seller', sellerAccountReference: 'original-seller',
                sellerEmail: 'seller@example.test', advertisedPriceAtCapture: 6500 },
        });
        const found = await readPurchaseSellerLegalSnapshot(prisma, 'sale-1', 'actual-buyer');
        expect(found).toMatchObject({
            sellerName: 'Original Seller', advertisedPriceAtCapture: 6500,
            capturedAtSource: 'CAPTURED_AFTER_SALE',
        });
    });
});
