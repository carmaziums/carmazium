import { ConflictException } from '@nestjs/common';
import { FreeListingGrantsService } from '../free-listings/free-listing-grants.service';
import { PaymentsService } from './payments.service';

describe('Auction buyer fee waiver before checkout', () => {
    const grantService = { applyPurchaseGrantToAuctionIfEligible: jest.fn() };
    const moduleRef = { get: jest.fn().mockReturnValue(grantService) };
    const service = new PaymentsService(
        {} as any, {} as any, {} as any, {} as any, {} as any, moduleRef as any,
    );

    beforeEach(() => jest.clearAllMocks());

    it('stops Stripe checkout when an eligible grant waives the buyer fee', async () => {
        grantService.applyPurchaseGrantToAuctionIfEligible.mockResolvedValue(true);
        await expect((service as any).applyEligibleBuyerFeeWaiver('auction-1', 'dealer-owner'))
            .rejects.toThrow(ConflictException);
        expect(moduleRef.get).toHaveBeenCalledWith(FreeListingGrantsService, { strict: false });
        expect(grantService.applyPurchaseGrantToAuctionIfEligible)
            .toHaveBeenCalledWith('auction-1', 'dealer-owner');
    });

    it('allows normal checkout to proceed when no eligible grant exists', async () => {
        grantService.applyPurchaseGrantToAuctionIfEligible.mockResolvedValue(false);
        await expect((service as any).applyEligibleBuyerFeeWaiver('auction-2', 'dealer-owner'))
            .resolves.toBeUndefined();
    });

    it('propagates grant or payment reconciliation failures instead of charging', async () => {
        grantService.applyPurchaseGrantToAuctionIfEligible.mockRejectedValue(new Error('database unavailable'));
        await expect((service as any).applyEligibleBuyerFeeWaiver('auction-3', 'dealer-owner'))
            .rejects.toThrow('database unavailable');
    });
});
