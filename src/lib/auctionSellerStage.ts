/**
 * Seller-facing status for a WON auction. This is presentation state only:
 * server-side eligibility, refunds and payout rules remain authoritative.
 * Keep the web and native copies byte-for-byte identical.
 */
export interface SellerAuctionProgressInput {
    status: string;
    winnerId?: string | null;
    buyerRefusedAt?: string | null;
    buyerFeePaid?: boolean | null;
    sellerFundsConfirmedAt?: string | null;
    handoverSubmittedAt?: string | null;
    handoverRejectedAt?: string | null;
    sellerBonusReleased?: boolean | null;
    stripePayoutTransferId?: string | null;
    manualPayoutConfirmedAt?: string | null;
}

export type SellerAuctionStage =
    | 'NOT_APPLICABLE'
    | 'INSPECTION_REFUSED'
    | 'WAITING_BUYER_FEE'
    | 'ARRANGE_INSPECTION_PAYMENT'
    | 'READY_FOR_HANDOVER'
    | 'CORRECT_PROOF'
    | 'PROOF_UNDER_REVIEW'
    | 'PAYOUT_PROCESSING'
    | 'BONUS_PAID';

export function getSellerAuctionStage(auction: SellerAuctionProgressInput): SellerAuctionStage {
    if (auction.status !== 'ENDED' || !auction.winnerId) return 'NOT_APPLICABLE';
    if (auction.buyerRefusedAt) return 'INSPECTION_REFUSED';
    if (auction.sellerBonusReleased) {
        const payoutId = auction.stripePayoutTransferId;
        const transferred = Boolean(payoutId && !payoutId.startsWith('claim:'));
        return transferred || Boolean(auction.manualPayoutConfirmedAt) ? 'BONUS_PAID' : 'PAYOUT_PROCESSING';
    }
    // A submitted proof is under review, including grandfathered legacy proofs:
    // do not incorrectly demand a new funds attestation while one is pending.
    if (auction.handoverSubmittedAt) return 'PROOF_UNDER_REVIEW';
    if (!auction.buyerFeePaid) return 'WAITING_BUYER_FEE';
    // Block 1 applies to every NEW upload, including a rejected legacy proof.
    if (!auction.sellerFundsConfirmedAt) return 'ARRANGE_INSPECTION_PAYMENT';
    if (auction.handoverRejectedAt) return 'CORRECT_PROOF';
    return 'READY_FOR_HANDOVER';
}

export function getSellerStageLabel(stage: SellerAuctionStage): string {
    switch (stage) {
        case 'INSPECTION_REFUSED': return 'Inspection refused';
        case 'WAITING_BUYER_FEE': return 'Waiting for buyer fee';
        case 'ARRANGE_INSPECTION_PAYMENT': return 'Arrange inspection and payment';
        case 'READY_FOR_HANDOVER': return 'Ready for handover';
        case 'CORRECT_PROOF': return 'Correct handover proof';
        case 'PROOF_UNDER_REVIEW': return 'Proof under review';
        case 'PAYOUT_PROCESSING': return 'Bonus processing';
        case 'BONUS_PAID': return '£100 bonus paid';
        default: return 'Auction status';
    }
}

export function getSellerStageHint(stage: SellerAuctionStage): string {
    switch (stage) {
        case 'INSPECTION_REFUSED':
            return 'The buyer declined after inspection. No handover proof should be submitted for this sale.';
        case 'WAITING_BUYER_FEE':
            return 'The winner must pay or have their £125 platform fee covered first. You do not need to upload handover proof yet.';
        case 'ARRANGE_INSPECTION_PAYMENT':
            return 'Arrange the vehicle inspection with the buyer. The buyer pays you directly; confirm receipt only after the full vehicle payment has cleared.';
        case 'READY_FOR_HANDOVER':
            return 'Vehicle funds have been confirmed. Once the vehicle has actually been handed over, upload your handover evidence.';
        case 'CORRECT_PROOF':
            return 'Your previous evidence was rejected. Follow the reviewer’s instructions and upload corrected proof; the buyer fee and sale are unchanged.';
        case 'PROOF_UNDER_REVIEW':
            return 'Your handover evidence is with the admin team. No further upload is needed unless corrections are requested.';
        case 'PAYOUT_PROCESSING':
            return 'Handover has been approved. Your £100 seller bonus is being processed; payment is not yet confirmed.';
        case 'BONUS_PAID':
            return 'Handover is approved and the £100 seller bonus payment has been recorded.';
        default:
            return '';
    }
}
