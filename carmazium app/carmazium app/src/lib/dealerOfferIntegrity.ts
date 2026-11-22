/**
 * Received dealer offers must use the same authoritative response as the
 * website (/offers/received). Never infer PENDING from a missing/unknown
 * status or allow a stale card to submit an offer mutation.
 */
export type DealerOfferStatus =
  | 'PENDING' | 'ACCEPTED' | 'REJECTED'
  | 'COUNTERED' | 'WITHDRAWN' | 'CANCELLED';

export interface DealerOfferSnapshot {
  id: string;
  status: DealerOfferStatus;
  updatedAt?: string;
  lastCounteredBy?: 'BUYER' | 'SELLER' | null;
  listing?: { status?: string } | null;
}

const KNOWN_STATUSES: ReadonlySet<string> = new Set<DealerOfferStatus>([
  'PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN', 'CANCELLED',
]);

export function decodeReceivedDealerOffers<T extends DealerOfferSnapshot>(response: unknown): T[] {
  if (!response || typeof response !== 'object') throw Error('Offers unavailable');
  const payload = response as { success?: unknown; data?: unknown };
  if (payload.success !== true || !Array.isArray(payload.data)) throw Error('Offers unavailable');
  for (const row of payload.data) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string'
      || !row.id || !KNOWN_STATUSES.has(row.status)) {
      throw Error('Invalid offer status received. Refresh to try again.');
    }
  }
  return payload.data as T[];
}

export function isDealerOfferRespondable(offer: DealerOfferSnapshot): boolean {
  return (offer.status === 'PENDING'
    || (offer.status === 'COUNTERED' && offer.lastCounteredBy === 'BUYER'))
    && (!offer.listing?.status || offer.listing.status === 'ACTIVE');
}

/** Called after a fresh server read immediately before an offer mutation. */
export function requireCurrentRespondableOffer<T extends DealerOfferSnapshot>(
  displayed: T, currentOffers: readonly T[],
): T {
  const current = currentOffers.find(offer => offer.id === displayed.id);
  if (!current) throw Error('This offer is no longer available. The list has been refreshed.');
  if (current.status !== displayed.status || current.lastCounteredBy !== displayed.lastCounteredBy
      || (current.updatedAt && displayed.updatedAt && current.updatedAt !== displayed.updatedAt)) {
    throw Error(`This offer changed to ${current.status.toLowerCase()}. Review the refreshed offer before responding.`);
  }
  if (!isDealerOfferRespondable(current)) {
    throw Error(`This offer is ${current.status.toLowerCase()} or its vehicle is no longer available. No action was taken.`);
  }
  return current;
}
