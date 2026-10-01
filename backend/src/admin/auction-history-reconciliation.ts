import { isAdminGrantedFreePurchaseTransaction } from '../free-listings/free-purchase-grant.constants';

/**
 * READ-ONLY audit classification: never alter historic financial or auction
 * timestamps. A Stripe payment-intent reference (or a manual bonus marker)
 * does NOT prove that the buyer's £125 cleared.
 */
export const LEGACY_WON_AT_CUTOFF = new Date('2026-08-06T00:00:00.000Z');

export type AuctionHistoryReviewReason =
    | 'CANCELLED_OR_UNWON_APPROVAL'
    | 'SALE_MISMATCH'
    | 'BUYER_FEE_NOT_VERIFIED'
    | 'BUYER_FEE_FLAG_MISMATCH'
    | 'UNSAFE_MISSING_WIN_TIMESTAMP';

export interface AuctionHistoryTransaction {
    id: string;
    userId: string;
    type: string;
    status: string;
    amount: unknown;
    description?: string | null;
    stripePaymentId?: string | null;
}

export interface AuctionHistoryRecord {
    id: string;
    listingId: string;
    createdAt: Date | string;
    status: string;
    winnerId?: string | null;
    wonAt?: Date | string | null;
    winningBidAmount?: unknown;
    buyerFeePaid: boolean;
    buyerFeeTransactionId?: string | null;
    handoverSubmittedAt?: Date | string | null;
    sellerBonusReleased: boolean;
    manualPayoutConfirmedAt?: Date | string | null;
    stripePayoutTransferId?: string | null;
    listing: {
        title: string;
        sale?: { buyerId?: string | null; soldPrice?: unknown } | null;
        transactions?: AuctionHistoryTransaction[];
    };
}

export interface AuctionHistoryClassification {
    legacyWinNoTimestamp: boolean;
    legacyWinProtected: boolean;
    requiresManualReview: boolean;
    reviewReasons: AuctionHistoryReviewReason[];
    saleMatchesWinningRecord: boolean;
    transactionEvidence: {
        completedValidBuyerFee: number;
        completedOtherCommission: number;
        pendingCommission: number;
        failedCommission: number;
        refundedCommission: number;
        stripeReferencePresent: boolean;
        records: { id: string; status: string; amount: string; matchesWinner: boolean; hasStripeReference: boolean }[];
    };
}

/** This function is deliberately pure and cannot create a Sale, update wonAt or
 * set buyerFeePaid. It is safe to rerun after an operator checks payment history.
 */
export function classifyHistoricalAuction(row: AuctionHistoryRecord): AuctionHistoryClassification {
    const winningAmount = row.winningBidAmount;
    const sale = row.listing.sale;
    const saleMatchesWinningRecord = Boolean(
        row.winnerId && sale?.buyerId === row.winnerId &&
        winningAmount !== null && winningAmount !== undefined &&
        sale?.soldPrice !== null && sale?.soldPrice !== undefined &&
        Number(sale?.soldPrice) === Number(winningAmount)
    );
    const created = new Date(row.createdAt).getTime();
    const legacyWinNoTimestamp = row.status === 'ENDED' &&
        Boolean(row.winnerId) && !row.wonAt && Number.isFinite(created) &&
        created < LEGACY_WON_AT_CUTOFF.getTime();
    const legacyWinProtected = legacyWinNoTimestamp && saleMatchesWinningRecord;
    const txn = (row.listing.transactions ?? []).filter(t => t.type === 'COMMISSION');
    const eligible = (t: AuctionHistoryTransaction) =>
        t.status === 'COMPLETED' && t.userId === row.winnerId &&
        (Number(t.amount) === 125 || isAdminGrantedFreePurchaseTransaction(t));
    const records = txn.map(t => ({
        id: t.id,
        status: t.status,
        amount: String(t.amount),
        matchesWinner: Boolean(row.winnerId && t.userId === row.winnerId),
        hasStripeReference: Boolean(t.stripePaymentId),
    }));
    const evidence = {
        completedValidBuyerFee: txn.filter(eligible).length,
        completedOtherCommission: txn.filter(t => t.status === 'COMPLETED' && !eligible(t)).length,
        pendingCommission: txn.filter(t => t.status === 'PENDING').length,
        failedCommission: txn.filter(t => t.status === 'FAILED').length,
        refundedCommission: txn.filter(t => t.status === 'REFUNDED').length,
        stripeReferencePresent: txn.some(t => Boolean(t.stripePaymentId)),
        records,
    };
    const reviews: AuctionHistoryReviewReason[] = [];
    const incompleteFee = (row.sellerBonusReleased || Boolean(row.handoverSubmittedAt))
        && !row.buyerFeePaid;
    if (incompleteFee) {
        if (row.status !== 'ENDED' || !row.winnerId) {
            reviews.push('CANCELLED_OR_UNWON_APPROVAL');
        } else {
            if (!saleMatchesWinningRecord) reviews.push('SALE_MISMATCH');
            reviews.push(evidence.completedValidBuyerFee > 0
                ? 'BUYER_FEE_FLAG_MISMATCH' : 'BUYER_FEE_NOT_VERIFIED');
        }
    }
    if (row.winnerId && !row.wonAt && !legacyWinProtected) {
        reviews.push('UNSAFE_MISSING_WIN_TIMESTAMP');
    }
    return {
        legacyWinNoTimestamp,
        legacyWinProtected,
        requiresManualReview: reviews.length > 0,
        reviewReasons: reviews,
        saleMatchesWinningRecord,
        transactionEvidence: evidence,
    };
}
