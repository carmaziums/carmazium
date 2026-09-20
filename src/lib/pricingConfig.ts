/**
 * Shared frontend pricing constants.
 *
 * Public customer pricing:
 *   - Auction seller listing: FREE
 *   - Successful auction seller reward: £100 after approved handover
 *   - Retail packages: Basic £1 / Standard £10 / Premium £25
 *   - Standard includes an HPI vehicle-history report
 *   - Premium includes Standard benefits, HPI, and a 28-day Featured Boost
 *   - Retail buyer fee: £0
 *   - HPI remains optional: sellers can choose Basic without HPI or add one separately
 *   - Featured Boost is £25 / 28 days separately for non-Premium listings and renewals
 *
 * Trader auction-buyer pricing is deliberately shown on the separate
 * /pricing/traders page rather than the customer pricing page.
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
} as const
