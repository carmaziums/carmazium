import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DealersService } from './dealers.service';

describe('DealersService purchase seller details', () => {
    let prisma: any;
    let service: DealersService;

    beforeEach(() => {
        prisma = {
            dealerProfile: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'dealership-1', userId: 'dealer-owner', isVerified: true,
                }),
            },
            dealerStaff: { findFirst: jest.fn().mockResolvedValue(null) },
            sale: {
                findFirst: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
            },
            auction: { findMany: jest.fn().mockResolvedValue([]) },
        };
        service = new DealersService(prisma, {} as any, {} as any, {} as any);
    });

    const sale = (auction: any, listingType: 'AUCTION' | 'CLASSIFIED' = 'AUCTION') => ({
        id: 'sale-1',
        listing: {
            title: 'Ford Focus ST-Line Auto',
            location: 'Manchester',
            type: listingType,
            auction,
        },
        seller: {
            firstName: 'Vehicle',
            lastName: 'Owner',
            email: 'seller@example.test',
            phone: '07123456789',
            isAddressVerified: true,
            dealerProfile: null,
            addressVerifications: [
                { address: '1 Example Street, Manchester, M1 1AA' },
            ],
        },
    });

    it('rejects users without dealership purchase permission before reading a sale', async () => {
        prisma.dealerProfile.findUnique.mockResolvedValue(null);
        await expect(service.getPurchaseSellerDetails('unknown-user', 'sale-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.sale.findFirst).not.toHaveBeenCalled();
    });

    it('does not reveal purchases belonging to another buyer', async () => {
        prisma.sale.findFirst.mockResolvedValue(null);
        await expect(service.getPurchaseSellerDetails('dealer-owner', 'other-sale'))
            .rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.sale.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'other-sale', buyerId: 'dealer-owner' },
        }));
    });

    it('hides all seller contact details before the auction fee is paid', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale({
            winnerId: 'dealer-owner',
            buyerFeePaid: false,
            buyerFeeTransactionId: null,
        }));
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');

        expect(details).toMatchObject({
            contactUnlocked: false,
            sellerEmail: null,
            sellerPhone: null,
            sellerAddress: null,
            sellerAddressSource: null,
        });
    });

    it('shows verified seller address, email and telephone only to the paid winner', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale({
            winnerId: 'dealer-owner',
            buyerFeePaid: true,
            buyerFeeTransactionId: 'fee-1',
        }));
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');

        expect(details).toMatchObject({
            contactUnlocked: true,
            sellerEmail: 'seller@example.test',
            sellerPhone: '07123456789',
            sellerAddress: '1 Example Street, Manchester, M1 1AA',
            sellerAddressSource: 'VERIFIED_POSTAL',
        });
    });

    it('does not expose a paid auction winner contact to the wrong buyer', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale({
            winnerId: 'a-different-dealer',
            buyerFeePaid: true,
            buyerFeeTransactionId: 'fee-1',
        }));
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');
        expect(details.contactUnlocked).toBe(false);
        expect(details.sellerAddress).toBeNull();
    });

    it('uses a dealership business address rather than an unverified postal address', async () => {
        const record = sale(null, 'CLASSIFIED');
        record.seller.isAddressVerified = false;
        record.seller.dealerProfile = {
            companyName: 'Example Autos',
            businessAddress: '2 Trade Road, Manchester, M2 2BB',
            phone: '01612000000',
        } as any;
        record.seller.phone = '' as any;
        prisma.sale.findFirst.mockResolvedValue(record);
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');

        expect(details).toMatchObject({
            contactUnlocked: true,
            sellerAddress: '2 Trade Road, Manchester, M2 2BB',
            sellerAddressSource: 'BUSINESS',
            sellerPhone: '01612000000',
        });
    });

    it('does not treat an unverified postal address as a collection address', async () => {
        const record = sale(null, 'CLASSIFIED');
        record.seller.isAddressVerified = false;
        prisma.sale.findFirst.mockResolvedValue(record);
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');

        expect(details.sellerAddress).toBeNull();
        expect(details.sellerAddressSource).toBeNull();
    });

    it('unlocks a sold retail purchase despite an old ended auction on the same listing', async () => {
        prisma.sale.findFirst.mockResolvedValue(sale({
            winnerId: null,
            buyerFeePaid: false,
            buyerFeeTransactionId: null,
        }, 'CLASSIFIED'));
        const details = await service.getPurchaseSellerDetails('dealer-owner', 'sale-1');

        expect(details).toMatchObject({
            contactUnlocked: true,
            buyerFeeRequired: false,
            sellerEmail: 'seller@example.test',
            sellerPhone: '07123456789',
            sellerAddressSource: 'VERIFIED_POSTAL',
        });
    });

    it('does not impose an auction buyer fee on a recorded retail sale', async () => {
        prisma.sale.findMany.mockResolvedValue([{
            id: 'retail-sale',
            listingId: 'retail-listing',
            listing: {
                id: 'retail-listing', title: 'Volvo XC60 2017',
                type: 'CLASSIFIED', status: 'SOLD',
                images: [], make: 'Volvo', model: 'XC60', year: 2017,
                mileage: 87230, color: 'SILVER', engineSize: 2000,
            },
            seller: {
                firstName: 'Scott', lastName: 'Example',
                email: 'seller@example.test', phone: '07123456789',
            },
            soldPrice: 7500,
            createdAt: new Date('2026-10-30T16:46:35Z'),
            purchaseStatus: 'AWAITING_CONFIRMATION',
        }]);
        prisma.sale.count.mockResolvedValue(1);
        // This is historical auction metadata, not a winning-bid purchase.
        prisma.auction.findMany.mockResolvedValue([{
            listingId: 'retail-listing', winnerId: null,
            buyerFeePaid: false, buyerFeeTransactionId: null,
        }]);

        const result = await service.getDealerPurchases('dealer-owner');

        expect(result.data[0]).toMatchObject({
            retailSold: true,
            offerAccepted: false,
            buyerFeeSettled: false,
            sellerEmail: 'seller@example.test',
            sellerPhone: '07123456789',
        });
    });

    it('keeps seller phone and email out of unpaid auction purchase-history results', async () => {
        prisma.sale.findMany.mockResolvedValue([{
            id: 'sale-1',
            listingId: 'listing-1',
            listing: {
                id: 'listing-1', title: 'Vehicle', type: 'AUCTION',
                images: [], make: 'Ford', model: 'Focus', year: 2019,
                mileage: 35000, color: 'silver', engineSize: 1000,
            },
            seller: {
                firstName: 'Vehicle', lastName: 'Owner',
                email: 'seller@example.test', phone: '07123456789',
            },
            soldPrice: 8000,
            createdAt: new Date('2026-10-01T10:00:00Z'),
            purchaseStatus: 'AWAITING_CONFIRMATION',
        }]);
        prisma.sale.count.mockResolvedValue(1);
        prisma.auction.findMany.mockResolvedValue([{
            listingId: 'listing-1',
            winnerId: 'dealer-owner',
            buyerFeePaid: false,
            buyerFeeTransactionId: null,
        }]);
        const result = await service.getDealerPurchases('dealer-owner');
        expect(result.data[0].sellerName).toBe('Vehicle Owner');
        expect(result.data[0].sellerEmail).toBeUndefined();
        expect(result.data[0].sellerPhone).toBeUndefined();
    });
});
