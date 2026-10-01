/** Show a countdown only when an authoritative backend deadline is present. */
export function formatBuyerFeeRemaining(deadline: string | null | undefined, nowMs: number): string | null {
  if (!deadline) return null;
  const at = Date.parse(deadline);
  if (!Number.isFinite(at)) return null;
  const seconds = Math.max(0, Math.ceil((at - nowMs) / 1000));
  if (seconds === 0) return 'Deadline reached — refresh your auction status';
  return Math.floor(seconds / 3600) + 'h ' + String(Math.floor((seconds % 3600) / 60)).padStart(2, '0') + 'm left';
}
