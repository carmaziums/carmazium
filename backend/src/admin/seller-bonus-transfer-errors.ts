/**
 * Errors returned to the admin dashboard must identify who needs to act.
 * A zero-balance Stripe platform cannot pay a seller even when the seller's
 * Connect account is fully onboarded. Do NOT blame the seller in this case.
 */
export function sellerBonusTransferFailureMessage(error: unknown): string {
    const e = error as { code?: string; raw?: { code?: string }; message?: string } | null;
    const message = typeof e?.message === 'string' ? e.message : '';
    const code = String(e?.code || e?.raw?.code || '').toLowerCase();
    if (
        code === 'balance_insufficient'
        || /insufficient funds|insufficient available balance|balance is insufficient/i.test(message)
    ) {
        return "CarMazium's Stripe balance has insufficient available funds for the £100 seller bonus. Top up the platform balance, then retry using the existing idempotent transfer, or pay manually after verifying the seller's bank details. The bonus remains unpaid.";
    }
    if (/does not have access to account|account does not exist|no such account|invalid destination/i.test(message)) {
        return "The seller's Stripe Connect destination is unavailable to CarMazium's configured platform account. Review the connected account; request the seller's bank details for manual payment if Stripe cannot be used. The bonus remains unpaid.";
    }
    return "Stripe could not complete the £100 seller bonus transfer. Review the Stripe error, then retry safely or request the seller's bank details for manual payment. The bonus remains unpaid.";
}
