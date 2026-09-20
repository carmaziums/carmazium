/**
 * Shared frontend pricing constants.
 *
 * Keep these values aligned with the backend payment services:
 *   - backend/src/payments/payments.service.ts
 *   - backend/src/featured-boost/featured-boost.service.ts
 *
 * The public pricing proposition is:
 *   - Auction seller listing fee: £0
 *   - Auction winning buyer fee: £125
 *   - Successful auction seller reward: £100 after approved handover
 *   - Retail seller listing fee: £1 one-off, until sold
 *   - Retail buyer fee: £0
 *   - HPI and Featured Boost are optional add-ons
 */
export const PRICING = {
    marketplace: {
        auction: {
            sellerListingFee: 0,
            buyerFee: 125,
            sellerReward: 100,
            durationHours: 24,
        },
        retail: {
            sellerListingFee: 1,
            buyerFee: 0,
            durationLabel: 'Until sold',
        },
    },

    /**
     * Compatibility values still referenced by the current listing checkout flow.
     * Do not use Standard/Premium as public pricing-page packages.
     */
    listing: {
        basic: { price: 1, label: 'Basic', description: '£1 one-off' },
        standard: { price: 10, label: 'Standard', description: '£10 one-off' },
        premium: { price: 25, label: 'Premium', description: '£25 one-off' },
    },

    hpiReport: {
        price: 9.99,
        label: 'HPI Check',
        description: 'Optional — one per listing',
    },
    featuredBoost: {
        price: 25,
        durationDays: 28,
        label: 'Featured Boost',
        description: 'Optional — £25 for 28 days',
    },
} as const
