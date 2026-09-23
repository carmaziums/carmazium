/**
 * Mobile mirror of the canonical public marketplace pricing contract.
 *
 * IMPORTANT: this file is guarded by scripts/check-product-parity.mjs.
 * Any pricing change must update backend enforcement, web display and this
 * mobile contract together in the same pull request. CI fails if they drift.
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

  listing: {
    basic: {
      price: 1,
      label: 'Basic',
      description: '£1 one-off · advertised until sold',
      includesHpi: false,
    },
    standard: {
      price: 10,
      label: 'Standard',
      description: '£10 one-off · HPI report included',
      includesHpi: true,
    },
    premium: {
      price: 25,
      label: 'Premium',
      description: '£25 one-off · HPI + 28-day Featured Boost included',
      includesHpi: true,
      includesFeaturedBoost: true,
    },
  },

  hpiReport: {
    price: 9.99,
    label: 'HPI Check',
    description: 'Optional add-on for eligible listings',
  },

  featuredBoost: {
    price: 25,
    durationDays: 28,
    label: 'Featured Boost',
    description: '£25 for 28 days · included with Premium',
  },
} as const;
