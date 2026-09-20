/**
 * Field changes that take a listing live.
 *
 * Retail package tier and Featured Boost are separate products. BASIC,
 * STANDARD and PREMIUM can all go live without featured placement; only the
 * dedicated Featured Boost purchase should set isFeatured/featuredUntil.
 *
 * The badgeTier parameter is retained for call-site compatibility.
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
