/** Deadline starts when a winning buyer is recorded; never from scheduled endTime. */
export const BUYER_FEE_GRACE_MS = 72 * 60 * 60 * 1000;
export function buyerFeeDeadlineAt(a: { status?: string | null; winnerId?: string | null;
  buyerFeePaid?: boolean | null; wonAt?: Date | string | null }): string | null {
  if (a.status !== 'ENDED' || !a.winnerId || a.buyerFeePaid || !a.wonAt) return null;
  const won = new Date(a.wonAt).getTime();
  return Number.isFinite(won) ? new Date(won + BUYER_FEE_GRACE_MS).toISOString() : null;
}
