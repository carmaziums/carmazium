import type { Offer } from "@/lib/listingApi"

/**
 * Retail acceptance reserves a vehicle (OFFER_ACCEPTED) but is not a completed
 * sale. It must appear in a dealer's purchase workflow before a Sale row exists.
 * Do not duplicate it after the seller records the completed sale.
 *
 * Only feed this helper offers returned by the authenticated buyer's /offers/my
 * endpoint. It must never be used to expose other buyers' offers.
 */
export function pendingRetailPurchases(
    offers: readonly Offer[],
    recordedSaleListingIds: Iterable<string>,
): Offer[] {
    const recorded = new Set(recordedSaleListingIds)
    return offers
        .filter(offer =>
            offer.status === "ACCEPTED"
            && offer.listing?.status === "OFFER_ACCEPTED"
            && !recorded.has(offer.listingId)
        )
        .sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
}
