import { BadRequestException } from '@nestjs/common';
import { ListingsService } from './listings.service';

const retail = {
    id: 'retail-1',
    sellerId: 'seller-1',
    linkedListingId: 'auction-2',
    type: 'CLASSIFIED',
    status: 'ACTIVE',
    price: 5000,
};

function setup(auction: any) {
    const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        auction: { findFirst: jest.fn().mockResolvedValue(auction) },
        listing: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUnique: jest.fn().mockResolvedValue({ ...retail, status: 'SOLD' }),
        },
        offer: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        sale: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
        $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const sellers: any = { incrementSales: jest.fn().mockResolvedValue(null) };
    const dealers: any = { markRetailLeadWon: jest.fn().mockResolvedValue(null) };
    const service = new ListingsService(
        prisma, sellers, {} as any, {} as any, {} as any, dealers,
    );
    jest.spyOn(service as any, 'findById').mockResolvedValue(retail);
    jest.spyOn(service as any, 'assertListingManagement').mockResolvedValue(undefined);
    return { service, tx, sellers };
}

describe('manual retail sale while linked to an auction', () => {
    it('does not mark retail sold while the linked auction is active', async () => {
        const { service, tx } = setup({ status: 'ACTIVE', winnerId: null });
        await expect(service.recordSale('retail-1', 'seller-1', { soldPrice: 5000 }))
            .rejects.toThrow(/still in a linked auction/i);
        expect(tx.$queryRaw).toHaveBeenCalled();
        expect(tx.listing.updateMany).not.toHaveBeenCalled();
        expect(tx.sale.upsert).not.toHaveBeenCalled();
    });

    it('rejects a linked auction with an existing winner even after it ended', async () => {
        const { service, tx } = setup({ status: 'ENDED', winnerId: 'dealer-1' });
        await expect(service.recordSale('retail-1', 'seller-1', { soldPrice: 5000 }))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(tx.sale.upsert).not.toHaveBeenCalled();
    });

    it('allows a completed manual sale after its linked auction was cancelled', async () => {
        const { service, tx } = setup({ status: 'CANCELLED', winnerId: null, wonAt: null });
        await service.recordSale('retail-1', 'seller-1', { soldPrice: 5000 });
        expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ status: 'ACTIVE' }),
            data: { status: 'SOLD' },
        }));
        expect(tx.sale.upsert).toHaveBeenCalledTimes(1);
    });
});
