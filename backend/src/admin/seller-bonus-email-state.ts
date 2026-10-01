/** Stage of the £100 seller bonus as evidenced by durable payout records.
 * "Approved" does not itself mean payment has been sent. A transient
 * claim:seller-bonus:* token is not a completed Stripe transfer.
 * A recorded Stripe transfer does NOT prove bank settlement.
 */
export type SellerBonusEmailState =
  | 'APPROVED_PAYOUT_PENDING'
  | 'APPROVED_SETUP_NEEDED'
  | 'STRIPE_TRANSFER_RECORDED'
  | 'MANUAL_PAYMENT_RECORDED';

export function sellerBonusEmailState(
    row: {
      sellerBonusReleased?: boolean | null;
      stripePayoutTransferId?: string | null;
      manualPayoutConfirmedAt?: Date | string | null;
    },
    payoutIssue?: 'not_connected' | 'transfer_failed' | 'test_mode' | null,
): SellerBonusEmailState {
    if (row.manualPayoutConfirmedAt) return 'MANUAL_PAYMENT_RECORDED';
    if (row.sellerBonusReleased &&
        typeof row.stripePayoutTransferId === 'string' &&
        /^tr_[A-Za-z0-9_]+$/.test(row.stripePayoutTransferId)) {
        return 'STRIPE_TRANSFER_RECORDED';
    }
    return payoutIssue === 'not_connected'
        ? 'APPROVED_SETUP_NEEDED' : 'APPROVED_PAYOUT_PENDING';
}
