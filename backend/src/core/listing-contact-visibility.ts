export interface ListingContactVisibilityInput {
    viewerAuthenticated: boolean;
    listingType?: string | null;
    listingStatus?: string | null;
    badgeTier?: string | null;
}

/**
 * One product rule for seller contact visibility.
 *
 * - Authenticated viewers may see the seller's contact number on an eligible
 *   public seller/listing surface.
 * - Anonymous viewers may see it on any ACTIVE retail
 *   (CLASSIFIED) listing.
 * - Auction contact never becomes public through the public retail rule.
 */
export function canRevealListingContact(input: ListingContactVisibilityInput): boolean {
    if (input.viewerAuthenticated) return true;

    return (
        input.listingType === 'CLASSIFIED' &&
        input.listingStatus === 'ACTIVE'
    );
}
