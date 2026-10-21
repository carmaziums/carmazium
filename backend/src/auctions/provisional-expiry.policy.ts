/** Provisional below-reserve auction offers are valid for at most 72 hours.
 * The deadline is measured from the persisted provisionalOfferedAt timestamp,
 * not from delivery of a reminder or a seller's first page view. */
export const PROVISIONAL_OFFER_VALIDITY_MS = 72 * 60 * 60 * 1000;

export function provisionalOfferExpired(
    offeredAt: Date | null | undefined,
    now: Date = new Date(),
): boolean {
    return !offeredAt
        || !Number.isFinite(offeredAt.getTime())
        || now.getTime() >= offeredAt.getTime() + PROVISIONAL_OFFER_VALIDITY_MS;
}
