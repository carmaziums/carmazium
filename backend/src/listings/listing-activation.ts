const PREMIUM_FEATURED_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Field changes that take a listing live.
 *
 * Premium is the best-value retail package: it includes the Standard benefits,
 * HPI, and a 28-day Featured Boost. The included boost begins when the listing
 * actually goes live, so customers receive the full 28 days.
 *
 * Basic and Standard are not automatically featured. They can buy Featured
 * Boost separately for £25 / 28 days.
 */
export function buildListingActivationData(badgeTier: string | null | undefined) {
    const premium = badgeTier === 'PREMIUM';

    return {
        status: 'ACTIVE' as const,
        rejectionReason: null,
        reviewedAt: new Date(),
        isFeatured: premium,
        featuredUntil: premium
            ? new Date(Date.now() + PREMIUM_FEATURED_DAYS * DAY_MS)
            : null,
    };
}
