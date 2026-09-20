/**
 * Mirrors the web app's single source of truth for pricing, src/lib/pricingConfig.ts
 * (repo root, sibling of backend/ and carmazium app/). Must stay in sync with that
 * file and with backend/src/payments/payments.service.ts (LISTING_FEES, HPI_REPORT_PRICE)
 * and backend/src/featured-boost/featured-boost.service.ts (BOOST_AMOUNT).
 */

export const PRICING = {
  listing: {
    basic: { price: 1, label: 'Basic' },
    standard: { price: 10, label: 'Standard' },
    premium: { price: 25, label: 'Premium' },
  },
  hpiReport: {
    price: 9.99,
    label: 'HPI Check',
  },
  featuredBoost: {
    price: 25,
    durationDays: 28,
    label: 'Featured Boost',
  },
} as const;
