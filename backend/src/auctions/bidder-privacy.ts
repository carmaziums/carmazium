/**
 * Public bid history exposes only initials and an opaque bidder ID.
 * Never forward user fields returned by future Prisma include changes.
 */
export function initialOnly(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? Array.from(trimmed)[0].toUpperCase() : null;
}
export function redactBidderIdentity<T extends { id?: unknown; firstName?: unknown; lastName?: unknown } | null | undefined>(
    bidder: T,
): T {
    if (!bidder || typeof bidder !== 'object') return bidder;
    return {
        id: bidder.id,
        firstName: initialOnly(bidder.firstName),
        lastName: initialOnly(bidder.lastName),
    } as T;
}
export function redactBidListIdentities<B extends { bidder?: any }>(bids: B[] | null | undefined): B[] {
    if (!Array.isArray(bids)) return [];
    return bids.map(bid => bid && bid.bidder
        ? { ...bid, bidder: redactBidderIdentity(bid.bidder) }
        : bid);
}
