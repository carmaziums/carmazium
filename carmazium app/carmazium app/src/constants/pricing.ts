/**
 * Mobile pricing constants. Keep aligned with:
 *   - src/lib/pricingConfig.ts
 *   - backend/src/payments/payments.service.ts
 *   - backend/src/featured-boost/featured-boost.service.ts
 *
 * Public marketplace pricing:
 *   - Auction seller listing fee: £0
 *   - Auction winning buyer fee: £125
 *   - Successful auction seller reward: £100 after approved handover
 *   - Retail seller listing fee: £1 one-off, until sold
 *   - Retail buyer fee: £0
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
  // Legacy aliases retained while older app surfaces are migrated.
  listing: {
    basic: { price: 1, label: 'Retail' },
    standard: { price: 1, label: 'Retail' },
    premium: { price: 1, label: 'Retail' },
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
