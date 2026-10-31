import { sellerBonusTransferFailureMessage } from './seller-bonus-transfer-errors';

describe('seller bonus Stripe payout failure classification', () => {
    it('identifies insufficient funds as a CarMazium PLATFORM balance issue', () => {
        const message = sellerBonusTransferFailureMessage(new Error(
            'You have insufficient funds in your Stripe account. One likely reason is automatic payouts.',
        ));
        expect(message).toContain("CarMazium's Stripe balance");
        expect(message).toContain('£100');
        expect(message).toContain('unpaid');
        expect(message).not.toContain("seller's Stripe payout setup");
    });

    it('detects Stripe balance_insufficient error code even when no message is supplied', () => {
        expect(sellerBonusTransferFailureMessage({ code: 'balance_insufficient' })).toContain('Top up');
        expect(sellerBonusTransferFailureMessage({ raw: { code: 'balance_insufficient' } })).toContain('Top up');
    });

    it('identifies an unreachable Connect destination without claiming it is paid', () => {
        const message = sellerBonusTransferFailureMessage(
            new Error("The provided key does not have access to account 'acct_example'"),
        );
        expect(message).toContain('Connect destination');
        expect(message).toContain('unpaid');
    });

    it('keeps unknown Stripe failures pending and refers to safe fallback', () => {
        const message = sellerBonusTransferFailureMessage(new Error('Stripe gateway timeout'));
        expect(message).toContain('request');
        expect(message).toContain('unpaid');
    });
});
