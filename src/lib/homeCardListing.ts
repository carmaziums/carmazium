import type { Listing } from "@/lib/listingApi"

/**
 * The listing fields the homepage cards render. Kept in a plain (non-client)
 * module so the server page can use the list to trim what it sends.
 */
export const HOME_CARD_FIELDS = [
    "id", "slug", "status", "title", "make", "model", "price", "images", "year",
    "mileage", "fuelType", "transmission", "bodyType", "badgeTier", "bannerLabel",
    "linkedListingId", "isDepartedSale", "deliveryAvailable", "exteriorGrade",
    "writeOffCategory", "isImported",
] as const satisfies readonly (keyof Listing)[]

export type HomeCardListing = Pick<Listing, (typeof HOME_CARD_FIELDS)[number]>

/**
 * Full listing records include MOT history, official DVLA data, VIN,
 * registration, the feature list and seller details. Passing them to the
 * homepage client component embedded roughly 330 KB of unused data in every
 * homepage response.
 */
export function toHomeCard(listing: Listing): HomeCardListing {
    const card: Record<string, unknown> = {}
    for (const key of HOME_CARD_FIELDS) card[key] = listing[key]
    return card as HomeCardListing
}
