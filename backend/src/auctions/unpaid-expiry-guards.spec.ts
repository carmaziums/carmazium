import { hasCompletedBuyerFee, hasUnresolvedCheckout, isUnpaidExpiryEligible } from './unpaid-expiry-guards';

const win = {
  status: 'ENDED', deletedAt: null, winnerId: 'dealer-1',
  wonAt: new Date('2026-10-01T00:00:00Z'),
  buyerFeePaid: false, buyerFeeTransactionId: null,
  sellerBonusReleased: false,
};
const cutoff = new Date('2026-10-05T00:00:00Z');

describe('auction expiry race guards', () => {
  it('recognises a genuinely overdue, unpaid, untouched win', () => {
    expect(isUnpaidExpiryEligible(win, cutoff)).toBe(true);
  });

  it.each([
    { status: 'CANCELLED' }, { status: 'ACTIVE' }, { deletedAt: new Date() },
    { winnerId: null }, { wonAt: null },
    { wonAt: new Date('2026-10-05T00:00:00Z') },
    { buyerFeePaid: true }, { buyerFeeTransactionId: 'fee-1' },
    { sellerFundsConfirmedAt: new Date() }, { handoverSubmittedAt: new Date() },
    { handoverProofPath: 'private/file' }, { handoverProofUrl: 'legacy-proof' },
    { sellerBonusReleased: true }, { sellerBonusReleasedAt: new Date() },
    { stripePayoutTransferId: 'tr_recorded' }, { manualPayoutConfirmedAt: new Date() },
    { buyerRefusedAt: new Date() },
  ])('does not expire an auction after an intervening state change (%j)', patch => {
    expect(isUnpaidExpiryEligible({ ...win, ...patch }, cutoff)).toBe(false);
  });

  it('excludes all valid legacy wins with a missing wonAt', () => {
    expect(isUnpaidExpiryEligible({ ...win, wonAt: null }, cutoff)).toBe(false);
  });

  it('recognises only a COMPLETED £125 payment or documented completed £0 grant', () => {
    expect(hasCompletedBuyerFee([{status:'PENDING',amount:125}])).toBe(false);
    expect(hasCompletedBuyerFee([{status:'FAILED',amount:125}])).toBe(false);
    expect(hasCompletedBuyerFee([{status:'COMPLETED',amount:99}])).toBe(false);
    expect(hasCompletedBuyerFee([{status:'COMPLETED',amount:125}])).toBe(true);
    expect(hasCompletedBuyerFee([{status:'COMPLETED',amount:0,
      description:'Admin-granted free auction purchase (reviewed)'}])).toBe(true);
    expect(hasCompletedBuyerFee([{status:'COMPLETED',amount:0,description:'Other discount'}])).toBe(false);
  });

  it('treats pending checkout as unresolved rather than captured or safe to cancel', () => {
    expect(hasUnresolvedCheckout([{status:'PENDING',amount:125}])).toBe(true);
    expect(hasUnresolvedCheckout([{status:'FAILED',amount:125}])).toBe(false);
  });
});
