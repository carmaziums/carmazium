import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';

// Owner rule: either the seller or the buyer can complete an accepted retail
// sale, so a deal is never stuck at "Sale Pending" when a seller stops using
// CarMazium. The buyer path uses the accepted offer's price and buyer, like
// the seller's Mark as Sold, and notifies the seller.

const pending = {
    id: 'retail-1', sellerId: 'seller-1', linkedListingId: null,
    type: 'CLASSIFIED', status: 'OFFER_ACCEPTED', title: 'Ford Focus 2017',
};

function setup(options: { listing?: any; offerBuyerId?: string | null; acceptedOfferCount?: number; actors?: Record<string, any> } = {}) {
    const listing = options.listing ?? pending;
    const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        auction: { findFirst: jest.fn().mockResolvedValue(null) },
        listing: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValueOnce(listing)
                .mockResolvedValue({ ...listing, status: 'SOLD' }),
        },
        offer: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            count: jest.fn().mockResolvedValue(options.acceptedOfferCount ?? 1),
        },
        sale: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const actors = options.actors ?? {};
    const prisma: any = {
        $transaction: jest.fn(async (fn: any) => fn(tx)),
        offer: {
            findFirst: jest.fn().mockImplementation(async (args: any) => {
                const buyerId = options.offerBuyerId === undefined ? 'buyer-1' : options.offerBuyerId;
                if (!buyerId) return null;
                // The completion re-reads the accepted offer with buyer details.
                return args?.include
                    ? { buyerId, finalAmount: 4000, amount: 3800, buyer: { firstName: 'Bea', lastName: 'Buyer', email: 'bea@example.test' } }
                    : { buyerId };
            }),
        },
        // resolveDealerActor: owners via dealerProfile, staff via dealerStaff.
        dealerProfile: { findUnique: jest.fn(async ({ where }: any) => actors[where.userId]?.owner ?? null) },
        dealerStaff: { findFirst: jest.fn(async ({ where }: any) => actors[where.userId]?.staff ?? null) },
    };
    const sellers: any = { incrementSales: jest.fn().mockResolvedValue(null) };
    const dealers: any = { markRetailLeadWon: jest.fn().mockResolvedValue(null) };
    const notifications: any = { create: jest.fn().mockResolvedValue({}) };
    const service = new ListingsService(prisma, sellers, {} as any, {} as any, notifications, dealers);
    jest.spyOn(service as any, 'findById').mockResolvedValue(listing);
    const manage = jest.spyOn(service as any, 'assertListingManagement').mockResolvedValue(undefined);
    return { service, tx, prisma, notifications, manage };
}

describe('buyer completes an accepted retail purchase', () => {
    it('records the sale at the accepted price for the buyer and notifies the seller', async () => {
        const { service, tx, notifications, manage } = setup();
        await service.completeRetailSaleAsBuyer('retail-1', 'buyer-1');
        // The buyer path never uses the seller's management check...
        expect(manage).not.toHaveBeenCalled();
        // ...but the same guarded completion: compare-and-set from Sale Pending.
        expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: 'retail-1', status: 'OFFER_ACCEPTED' }),
            data: { status: 'SOLD' },
        }));
        expect(tx.sale.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ sellerId: 'seller-1', buyerId: 'buyer-1', soldPrice: 4000 }),
        }));
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'seller-1', type: 'SALE_COMPLETED_BY_BUYER',
        }));
    });

    it('refuses anyone who is not the accepted offer\'s buyer', async () => {
        const { service, tx } = setup();
        await expect(service.completeRetailSaleAsBuyer('retail-1', 'stranger'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(tx.sale.upsert).not.toHaveBeenCalled();
    });

    it('only works from Sale Pending on a retail listing with an accepted offer', async () => {
        for (const listing of [
            { ...pending, status: 'ACTIVE' },
            { ...pending, status: 'SOLD' },
            { ...pending, type: 'AUCTION' },
        ]) {
            const { service, tx } = setup({ listing });
            await expect(service.completeRetailSaleAsBuyer('retail-1', 'buyer-1'))
                .rejects.toBeInstanceOf(BadRequestException);
            expect(tx.sale.upsert).not.toHaveBeenCalled();
        }
        const noOffer = setup({ offerBuyerId: null });
        await expect(noOffer.service.completeRetailSaleAsBuyer('retail-1', 'buyer-1'))
            .rejects.toBeInstanceOf(BadRequestException);
    });

    it('dealership staff with offer permission can complete for their dealership; others cannot', async () => {
        const dealership = { id: 'dp-1', userId: 'dealer-owner', isVerified: true };
        const actors = {
            'dealer-owner': { owner: dealership },
            'sales-agent': { staff: { role: 'SALES_AGENT', dealerProfile: dealership } },
            'finance': { staff: { role: 'FINANCE_MANAGER', dealerProfile: dealership } },
        };
        const ok = setup({ offerBuyerId: 'dealer-owner', actors });
        await ok.service.completeRetailSaleAsBuyer('retail-1', 'sales-agent');
        expect(ok.tx.sale.upsert).toHaveBeenCalled();

        const noPermission = setup({ offerBuyerId: 'dealer-owner', actors });
        await expect(noPermission.service.completeRetailSaleAsBuyer('retail-1', 'finance'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(noPermission.tx.sale.upsert).not.toHaveBeenCalled();
    });

    it('refuses conflicting or removed accepted offers for BOTH buyer and seller before recording a sale', async () => {
        for (const acceptedOfferCount of [0, 2]) {
            const buyer = setup({ acceptedOfferCount });
            await expect(buyer.service.completeRetailSaleAsBuyer('retail-1', 'buyer-1'))
                .rejects.toBeInstanceOf(ConflictException);
            expect(buyer.tx.listing.updateMany).not.toHaveBeenCalled();
            expect(buyer.tx.sale.upsert).not.toHaveBeenCalled();
            expect(buyer.notifications.create).not.toHaveBeenCalled();

            const seller = setup({ acceptedOfferCount });
            await expect(seller.service.recordSale('retail-1', 'seller-1', { soldPrice: 1 }))
                .rejects.toBeInstanceOf(ConflictException);
            expect(seller.tx.listing.updateMany).not.toHaveBeenCalled();
            expect(seller.tx.sale.upsert).not.toHaveBeenCalled();
        }
    });

    it('never records the buyer as the seller when the listing has no seller', async () => {
        const { service, tx } = setup({ listing: { ...pending, sellerId: null } });
        await expect(service.completeRetailSaleAsBuyer('retail-1', 'buyer-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(tx.sale.upsert).not.toHaveBeenCalled();
    });

    it('the seller\'s Mark as Sold still works as before', async () => {
        const { service, tx, manage } = setup();
        await service.recordSale('retail-1', 'seller-1', { soldPrice: 1 });
        expect(manage).toHaveBeenCalled();
        expect(tx.sale.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({ buyerId: 'buyer-1', soldPrice: 4000 }),
        }));
    });
});
