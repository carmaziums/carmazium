import { isAdminGrantedFreePurchaseTransaction } from '../free-listings/free-purchase-grant.constants';

export interface ExpiryCandidate {
  status: string;
  deletedAt?: Date | null;
  winnerId?: string | null;
  wonAt?: Date | null;
  buyerFeePaid: boolean;
  buyerFeeTransactionId?: string | null;
  sellerFundsConfirmedAt?: Date | null;
  handoverSubmittedAt?: Date | null;
  handoverProofPath?: string | null;
  handoverProofUrl?: string | null;
  sellerBonusReleased: boolean;
  sellerBonusReleasedAt?: Date | null;
  stripePayoutTransferId?: string | null;
  manualPayoutConfirmedAt?: Date | null;
  buyerRefusedAt?: Date | null;
}

/** Invoke again under an auction-row lock, never rely on a cron snapshot. */
export function isUnpaidExpiryEligible(a: ExpiryCandidate, cutoff: Date): boolean {
  return a.status === 'ENDED' &&
    !a.deletedAt && Boolean(a.winnerId) &&
    a.wonAt instanceof Date && Number.isFinite(a.wonAt.getTime()) &&
    a.wonAt.getTime() < cutoff.getTime() &&
    !a.buyerFeePaid && !a.buyerFeeTransactionId &&
    !a.sellerFundsConfirmedAt && !a.handoverSubmittedAt &&
    !a.handoverProofPath && !a.handoverProofUrl &&
    !a.sellerBonusReleased && !a.sellerBonusReleasedAt &&
    !a.stripePayoutTransferId && !a.manualPayoutConfirmedAt &&
    !a.buyerRefusedAt;
}

export interface RecordedFee {
  status: string;
  amount: unknown;
  createdAt?: Date | null;
  description?: string | null;
}

/**
 * A listing can be re-auctioned and the same dealer can win again.
 * Only fee records created for the current wonAt or later may protect that win.
 * Treat missing/invalid timestamps as unverified rather than reusing historic
 * payment evidence. Valid historical wins with no wonAt never enter expiry.
 */
function belongsToCurrentWin(fee: RecordedFee, wonAt: Date): boolean {
  return fee.createdAt instanceof Date &&
    Number.isFinite(fee.createdAt.getTime()) &&
    fee.createdAt.getTime() >= wonAt.getTime();
}

/** Completed £125 or valid completed £0 grant for this win prevents expiry. */
export function hasCompletedBuyerFee(rows: RecordedFee[], wonAt: Date): boolean {
  return rows.some(t => belongsToCurrentWin(t, wonAt) &&
    t.status === 'COMPLETED' &&
    (Number(t.amount) === 125 || isAdminGrantedFreePurchaseTransaction(t)));
}

/** A pending checkout for this win may still capture and must hold expiry. */
export function hasUnresolvedCheckout(rows: RecordedFee[], wonAt: Date): boolean {
  return rows.some(t => belongsToCurrentWin(t, wonAt) &&
    t.status === 'PENDING' && Number(t.amount) === 125);
}
