/** Calendar-strict local scheduled start validation (no UTC reinterpretation). */
export function parseNativeAuctionLocalStart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (!Number.isFinite(result.getTime()) || result.getFullYear() !== year
    || result.getMonth() !== month - 1 || result.getDate() !== day
    || result.getHours() !== hour || result.getMinutes() !== minute) return null;
  return result;
}

export function nativeScheduledStartIsValid(value: string, now = Date.now()): boolean {
  const date = parseNativeAuctionLocalStart(value);
  return !!date && date.getTime() > now + 60_000;
}

export interface NativeAuctionDraft {
  auctionStartMode: 'NOW' | 'SCHEDULED'
  auctionStartDate: string
  reservePrice: string
  startingBid: string
  minIncrement: string
  buyItNowPrice: string
}

export function nativeAuctionDraftReady(value: NativeAuctionDraft, now = Date.now()): boolean {
  if (value.auctionStartMode !== 'NOW'
      && !(value.auctionStartMode === 'SCHEDULED'
        && nativeScheduledStartIsValid(value.auctionStartDate, now))) return false;
  for (const key of ['reservePrice', 'startingBid', 'minIncrement'] as const) {
    if (!value[key]?.trim() || !Number.isFinite(Number(value[key])) || Number(value[key]) <= 0) return false;
  }
  if (value.buyItNowPrice && (!Number.isFinite(Number(value.buyItNowPrice))
    || Number(value.buyItNowPrice) <= 0)) return false;
  return true;
}
