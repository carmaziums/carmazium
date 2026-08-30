/**
 * Whether analytics/advertising tags may load in this environment.
 *
 * WHY: Google's tag diagnostics detected the live measurement IDs firing from
 * Vercel preview deployments (carmazium-<hash>-airaffs-projects.vercel.app).
 * Every preview build ships the same NEXT_PUBLIC_* IDs as production, so
 * internal testing was writing pageviews into the production GA4 property and
 * could fire real Google Ads conversions during development — polluting
 * exactly the conversion data smart bidding now depends on.
 *
 * The rule is written as a denylist rather than `=== 'production'` on purpose:
 * NEXT_PUBLIC_VERCEL_ENV only exists on Vercel, so an allowlist would silently
 * disable analytics if the frontend is ever moved off Vercel (which has been
 * discussed). This blocks the two environments we know are wrong and lets
 * anything else through.
 *
 * NODE_ENV covers `next dev`, so a developer running the site locally with a
 * populated .env.local doesn't report into production either.
 */
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV?.trim()

export const analyticsEnabled =
    process.env.NODE_ENV === 'production' &&
    vercelEnv !== 'preview' &&
    vercelEnv !== 'development'
