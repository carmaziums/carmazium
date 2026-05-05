/**
 * Single source of truth for all CarMazium pricing.
 * Must stay in sync with backend:
 *   - backend/src/payments/payments.service.ts  (HPI_REPORT_PRICE, LISTING_FEES)
 *   - backend/src/featured-boost/featured-boost.service.ts  (BOOST_AMOUNT)
 */

export const PRICING = {
    listing: {
        basic: { price: 0, label: 'Basic', description: 'Free forever' },
        standard: { price: 10, label: 'Standard', description: '£10 one-off' },
        premium: { price: 25, label: 'Premium', description: '£25 one-off' },
    },
    hpiReport: {
        price: 9.99,
        label: 'HPI Check',
        description: 'One per listing',
    },
    featuredBoost: {
        price: 25,
        durationDays: 28,
        label: 'Featured Boost',
        description: '£25 for 28 days',
    },
} as const
