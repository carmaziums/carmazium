import { sellerBonusEmailState } from './seller-bonus-email-state';
describe('£100 seller bonus email state', () => {
    const approved = { sellerBonusReleased: true };
    it('does not mistake handover approval or a transient claim for payment', () => {
        expect(sellerBonusEmailState(approved)).toBe('APPROVED_PAYOUT_PENDING');
        expect(sellerBonusEmailState({ ...approved, stripePayoutTransferId: 'claim:seller-bonus:auction-1' }))
            .toBe('APPROVED_PAYOUT_PENDING');
        expect(sellerBonusEmailState({ ...approved, stripePayoutTransferId: 'unknown' }))
            .toBe('APPROVED_PAYOUT_PENDING');
    });
    it('shows setup needed only for missing Connect setup', () => {
        expect(sellerBonusEmailState(approved, 'not_connected')).toBe('APPROVED_SETUP_NEEDED');
        expect(sellerBonusEmailState(approved, 'transfer_failed')).toBe('APPROVED_PAYOUT_PENDING');
        expect(sellerBonusEmailState(approved, 'test_mode')).toBe('APPROVED_PAYOUT_PENDING');
    });
    it('recognises a persisted Stripe transfer but does not assert bank settlement', () => {
        expect(sellerBonusEmailState({ ...approved, stripePayoutTransferId: 'tr_123' }))
            .toBe('STRIPE_TRANSFER_RECORDED');
    });
    it('marks an admin-confirmed manual payment separately', () => {
        expect(sellerBonusEmailState({ ...approved, manualPayoutConfirmedAt: new Date() }))
            .toBe('MANUAL_PAYMENT_RECORDED');
    });
});
