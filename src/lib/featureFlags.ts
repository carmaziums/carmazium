/**
 * Build-time feature flags.
 *
 * WHY FLAGS AND NOT A BRANCH: the obvious way to keep Delivery & Recovery live
 * on staging but "Coming soon" on production is to let the two branches differ.
 * That breaks the first time staging is merged into main — the merge silently
 * re-enables the feature on production, and the only thing standing between an
 * untested feature and real customers is whoever remembers to revert the card
 * again. A flag keeps ONE codebase on both branches; the difference lives in
 * Vercel's environment variables, where turning a feature on is a deliberate
 * act rather than a side effect of a merge.
 *
 * These read NEXT_PUBLIC_* vars, which Next inlines at build time. Changing one
 * in Vercel therefore needs a redeploy to take effect — which is correct: a
 * feature going live should be a deployment you can see and roll back, not a
 * setting that changes under a running build.
 *
 * DEFAULT IS OFF. An unset variable means disabled, so production is safe by
 * default and an environment has to opt in. A typo disables a feature; it never
 * accidentally ships one.
 */

const on = (v?: string) => v?.trim().toLowerCase() === 'true'

/**
 * Delivery & Recovery — the first Trade Exchange service marketplace.
 *
 * Off on production until the whole loop (post → quote → accept → pay →
 * complete → payout) has been walked end to end on staging. Set
 * NEXT_PUBLIC_FEATURE_DELIVERY=true on the Preview environment to test it.
 *
 * Gates the customer-facing surfaces only: the card on /auctions, the
 * /services/* pages, and the "arrange delivery" entry points after a purchase.
 * The contractor and admin dashboards stay reachable on purpose — staging and
 * production share one database, so a provider application or job created on
 * staging is a real row that an admin needs to be able to review from either
 * place.
 */
export const deliveryServiceEnabled = on(process.env.NEXT_PUBLIC_FEATURE_DELIVERY)

/** True on a Vercel preview deployment — drives the staging banner. */
export const isPreviewEnvironment =
    process.env.NEXT_PUBLIC_VERCEL_ENV?.trim() === 'preview'
