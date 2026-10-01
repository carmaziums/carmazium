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
  description?: string | null;
}

/** Completed £125 or valid completed £0 grant protects the win from expiry. */
export function hasCompletedBuyerFee(rows: RecordedFee[]): boolean {
  return rows.some(t => t.status === 'COMPLETED' &&
    (Number(t.amount) === 125 || isAdminGrantedFreePurchaseTransaction(t)));
}

/** A pending checkout is not proof of payment, but can still capture. */
export function hasUnresolvedCheckout(rows: RecordedFee[]): boolean {
  return rows.some(t => t.status === 'PENDING');
}
