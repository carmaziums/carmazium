/**
 * The field changes that take a listing live.
 *
 * Shared by AdminService.approveListing (an admin approving someone else's
 * listing) and ListingsService.publishListing (an admin publishing their own,
 * which skips review entirely).
 *
 * It exists because going ACTIVE is more than setting a status: PREMIUM
 * listings also get `isFeatured` and a 28-day `featuredUntil` window, which is
 * the entire benefit of that tier. A second activation path that set only
 * `status: 'ACTIVE'` would silently publish PREMIUM listings without the
 * feature placement their tier is supposed to buy — a bug nobody would notice
 * until someone asked why an admin's premium listing wasn't showing up
 * featured. One definition, so the two paths cannot disagree.
 */
export const FEATURED_WINDOW_DAYS = 28;

export function buildListingActivationData(badgeTier: string | null | undefined) {
    const isPremium = badgeTier === 'PREMIUM';
    return {
        status: 'ACTIVE' as const,
        rejectionReason: null,
        reviewedAt: new Date(),
        isFeatured: isPremium,
        featuredUntil: isPremium
            ? new Date(Date.now() + FEATURED_WINDOW_DAYS * 24 * 60 * 60 * 1000)
            : null,
    };
}
