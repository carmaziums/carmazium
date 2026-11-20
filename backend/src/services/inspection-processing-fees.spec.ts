import { ConflictException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { ServicesService } from './services.service';

describe('TradeXchange cosmetic inspection fee pass-through', () => {
    const service = new ServicesService({} as any, {} as any, {} as any, {} as any, {} as any);
    const internal = service as any;

    it('applies extra Stripe fees only to new cosmetic and combined inspection jobs', () => {
        expect(internal.passesProcessingCosts({ serviceType: ServiceType.INSPECTION, inspectionScope: 'COSMETIC' })).toBe(true);
        expect(internal.passesProcessingCosts({ serviceType: ServiceType.INSPECTION, inspectionScope: 'BOTH' })).toBe(true);
        expect(internal.passesProcessingCosts({ serviceType: ServiceType.INSPECTION, inspectionScope: 'VEHICLE' })).toBe(false);
        expect(internal.passesProcessingCosts({ serviceType: ServiceType.INSPECTION, inspectionScope: null })).toBe(false);
        expect(internal.passesProcessingCosts({ serviceType: ServiceType.DELIVERY, inspectionScope: null })).toBe(false);
    });

    it('deducts the actual GBP Stripe fee, rather than a made-up flat rate', async () => {
        const retrieve = jest.fn().mockResolvedValue({
            paid: true, currency: 'gbp', amount: 10000, balance_transaction: { fee: 175 },
        });
        const actual = await internal.actualStripeProcessingFee({ charges: { retrieve } }, 'ch_test', 10000);
        expect(actual).toBe(175);
        expect(retrieve).toHaveBeenCalledWith('ch_test', { expand: ['balance_transaction'] });
        expect(internal.split(10000)).toEqual({ rate: 0.09, platformFeePence: 900, contractorPence: 9100 });
        expect(10000 - 900 - actual).toBe(8925);
    });

    it('retrieves the balance transaction separately if Stripe returns a reference', async () => {
        const balance = jest.fn().mockResolvedValue({ fee: 211 });
        const stripe = { charges: { retrieve: jest.fn().mockResolvedValue({ paid: true, amount: 12000, currency: 'gbp', balance_transaction: 'txn_1' }) }, balanceTransactions: { retrieve: balance } };
        await expect(internal.actualStripeProcessingFee(stripe, 'ch_1', 12000)).resolves.toBe(211);
        expect(balance).toHaveBeenCalledWith('txn_1');
    });

    it('blocks release rather than guessing missing or mismatched fees', async () => {
        const missing = { charges: { retrieve: jest.fn().mockResolvedValue({ paid: true, currency: 'gbp', amount: 10000 }) } };
        await expect(internal.actualStripeProcessingFee(missing, 'ch_1', 10000)).rejects.toBeInstanceOf(ConflictException);
        const mismatched = { charges: { retrieve: jest.fn().mockResolvedValue({ paid: true, currency: 'gbp', amount: 10100, balance_transaction: { fee: 180 } }) } };
        await expect(internal.actualStripeProcessingFee(mismatched, 'ch_1', 10000)).rejects.toBeInstanceOf(ConflictException);
    });
});
