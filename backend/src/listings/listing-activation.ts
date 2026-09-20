/**
 * Field changes that take a listing live.
 *
 * Public listing pricing no longer grants featured placement. Retail is £1
 * one-off and Auction is free; Featured Boost is a separate optional add-on.
 *
 * Keep the badgeTier parameter for call-site compatibility while legacy rows
 * are being normalized, but never derive featured status from it.
 */
export function buildListingActivationData(_badgeTier: string | null | undefined) {
    return {
        status: 'ACTIVE' as const,
        rejectionReason: null,
        reviewedAt: new Date(),
        isFeatured: false,
        featuredUntil: null,
    };
}
