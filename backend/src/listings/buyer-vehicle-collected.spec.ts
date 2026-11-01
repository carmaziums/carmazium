import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingsService } from './listings.service';

const baseSale: any = {
    id: 'sale-1', listingId: 'listing-1', buyerId: 'buyer-1',
    purchaseStatus: 'AWAITING_CONFIRMATION',
    listing: { status: 'SOLD', type: 'AUCTION', auction: {
        status: 'ENDED', winnerId: 'buyer-1', buyerFeePaid: true, buyerFeeTransactionId: 'fee-1',
    } },
};

function setup(sale: any = baseSale, options: { staff?: boolean; cancellation?: boolean; updateCount?: number; existingEvent?: boolean } = {}) {
    const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        saleCancellationRequest: { findFirst: jest.fn().mockResolvedValue(options.cancellation ? { id: 'cancel-1' } : null) },
        sale: { updateMany: jest.fn().mockResolvedValue({ count: options.updateCount ?? 1 }) },
        analyticsEvent: { create: jest.fn().mockResolvedValue({ createdAt: new Date('2026-11-01T15:00:00Z') }) },
    };
    const prisma: any = {
        sale: { findUnique: jest.fn().mockResolvedValue(sale) },
        saleCancellationRequest: { findFirst: jest.fn().mockResolvedValue(options.cancellation ? { id: 'cancel-1' } : null) },
        analyticsEvent: { findFirst: jest.fn().mockResolvedValue(options.existingEvent ? { createdAt: new Date() } : null) },
        dealerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
        dealerStaff: { findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
            options.staff && where.userId === 'staff-1'
                ? { role: 'SALES_AGENT', dealerProfile: { id: 'dealer-1', userId: 'buyer-1', isVerified: true } }
                : null) },
        $transaction: jest.fn((fn: any) => fn(tx)),
    };
    return { service: new ListingsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any), prisma, tx };
}

describe('Buyer physical collection confirmation', () => {
    it('moves a paid Ford Focus auction to completed with one atomic buyer audit, without payouts', async () => {
        const { service, tx } = setup();
        const result = await service.confirmVehicleCollectedByBuyer('sale-1','buyer-1');
        expect(result.purchaseStatus).toBe('CHECKS_COMPLETE');
        expect(tx.sale.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: 'sale-1', buyerId: 'buyer-1' }),
            data: { purchaseStatus: 'CHECKS_COMPLETE' },
        }));
        expect(tx.analyticsEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                type: 'buyer_vehicle_collected', userId: 'buyer-1',
                payload: expect.objectContaining({ saleId: 'sale-1', attestation: 'buyer_paid_seller_and_physically_collected' }),
            }),
        }));
        expect((tx as any).auction).toBeUndefined();
        expect((tx as any).transaction).toBeUndefined();
    });

    it('allows direct private retail buyers and delegated sales agents, but not outsiders', async () => {
        const retail = { ...baseSale, listing: { status: 'SOLD', type: 'CLASSIFIED', auction: null } };
        await expect(setup(retail).service.confirmVehicleCollectedByBuyer('sale-1','buyer-1'))
            .resolves.toMatchObject({ purchaseStatus:'CHECKS_COMPLETE' });
        await expect(setup(baseSale,{ staff:true }).service.confirmVehicleCollectedByBuyer('sale-1','staff-1'))
            .resolves.toMatchObject({ purchaseStatus:'CHECKS_COMPLETE' });
        const stranger=setup();
        await expect(stranger.service.confirmVehicleCollectedByBuyer('sale-1','stranger'))
            .rejects.toBeInstanceOf(NotFoundException);
        expect(stranger.tx.sale.updateMany).not.toHaveBeenCalled();
    });

    it('blocks unpaid auction fees, non-winners, and unsold vehicles', async () => {
        for (const purchase of [
            { ...baseSale, listing:{ ...baseSale.listing, auction:{ ...baseSale.listing.auction, buyerFeePaid:false } } },
            { ...baseSale, listing:{ ...baseSale.listing, auction:{ ...baseSale.listing.auction, winnerId:'wrong-buyer' } } },
            { ...baseSale, listing:{ ...baseSale.listing, status:'ACTIVE' } },
        ]) {
            const x=setup(purchase);
            await expect(x.service.confirmVehicleCollectedByBuyer('sale-1','buyer-1'))
                .rejects.toBeInstanceOf(BadRequestException);
            expect(x.tx.sale.updateMany).not.toHaveBeenCalled();
        }
    });

    it('blocks pending cancellations, double submissions and unrelated completed histories', async () => {
        const cancelled=setup(baseSale,{cancellation:true});
        await expect(cancelled.service.confirmVehicleCollectedByBuyer('sale-1','buyer-1'))
            .rejects.toBeInstanceOf(BadRequestException);
        const racing=setup(baseSale,{updateCount:0});
        await expect(racing.service.confirmVehicleCollectedByBuyer('sale-1','buyer-1'))
            .rejects.toBeInstanceOf(ConflictException);
        expect(racing.tx.analyticsEvent.create).not.toHaveBeenCalled();
        const already=setup({ ...baseSale,purchaseStatus:'CHECKS_COMPLETE' },{existingEvent:true});
        await expect(already.service.confirmVehicleCollectedByBuyer('sale-1','buyer-1'))
            .resolves.toMatchObject({purchaseStatus:'CHECKS_COMPLETE'});
        expect(already.tx.sale.updateMany).not.toHaveBeenCalled();
    });
});
