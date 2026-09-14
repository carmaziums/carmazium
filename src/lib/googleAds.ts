/**
 * Google Ads conversion tracking.
 *
 * The Ads tag (AW-…) was already being loaded and configured by
 * components/analytics/GoogleAnalytics.tsx, but nothing ever fired a
 * conversion against it — so Ads was collecting pageviews and remarketing
 * audiences while reporting zero conversions, which means smart bidding had
 * nothing to optimise towards. This module is the missing half.
 *
 * HOW IT'S WIRED: conversions piggy-back on the existing analytics call sites
 * rather than adding new ones. `useAnalytics().trackEvent(...)` already fans
 * out to the first-party store and the GTM dataLayer; it now also calls
 * `trackAdsConversion` with the same event name and payload. So a conversion
 * is enabled purely by having a label for it — no call-site changes.
 *
 * CONVERSION LABELS come from the Google Ads UI, one per conversion action
 * (Goals → Conversions → the action → "Tag setup" → the value shown as
 * `send_to: AW-XXXXXXX/AbCdEfG…`); only the part AFTER the slash is the label.
 * An event with no label is silently skipped, so adding one later is a
 * one-line change and removing one cleanly disables it.
 *
 * PRIVACY: same rule as lib/gtm.ts — no VRM, email, phone or postcode is ever
 * sent. Only internal IDs, vehicle make/model/year and transaction values.
 * Enhanced Conversions (which would send a hashed email) is deliberately NOT
 * implemented here; it needs a legal/consent review first, since it means
 * transmitting user-identifying data to Google.
 */

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

/**
 * Event name → conversion label env var.
 *
 * Deliberately excludes the subset events, mirroring the double-count
 * warnings already documented in lib/gtm.ts:
 *
 *   - `listing_fee_paid` is a subset of `purchase` (a LISTING_FEE checkout
 *     fires both). Counting both would double-count the same money.
 *   - `auction_submitted_for_review` and `listing_checkout_started` are
 *     subsets of `listing_submitted`, fired alongside it for convenience.
 *
 * If you genuinely want a separate Ads conversion action for one of those
 * subsets, add it here AND make sure the overlapping parent is either removed
 * or set to "Secondary" in the Ads UI so it doesn't feed bidding twice.
 *
 * Labels are NOT secrets — they ship in the client bundle and are visible to
 * anyone who views source, exactly like the AW-/G- IDs themselves. They're
 * committed as defaults so a deploy doesn't depend on an env var being set in
 * whichever Vercel account currently owns the project, while still allowing a
 * per-environment override (e.g. pointing a staging build at a test action).
 */
const CONVERSION_LABELS: Record<string, string | undefined> = {
    // Primary money event — every cleared Stripe checkout, split by `fee_type`.
    // Ads conversion action "Purchase" (Primary, value-based, count Every).
    purchase: process.env.NEXT_PUBLIC_GADS_LABEL_PURCHASE?.trim() || 'KyfHCLLQ1eocEN6N4qNE',
    // Lead: seller completed the wizard, on either the retail or auction path.
    // Ads conversion action "Submit lead form (1)" (Primary).
    listing_submitted: process.env.NEXT_PUBLIC_GADS_LABEL_LISTING_SUBMITTED?.trim()
        || 'uD94CLXQ1eocEN6N4qNE',
    // Top-of-funnel micro-conversion: reg entered and real vehicle data returned.
    // No Ads conversion action exists for this yet — deliberately left unset so
    // it stays a no-op rather than firing against the wrong action. If one is
    // created later it should be Secondary: making a cheap top-funnel action
    // Primary pushes smart bidding towards low-intent traffic.
    valuation_requested: process.env.NEXT_PUBLIC_GADS_LABEL_VALUATION?.trim(),
}

/**
 * In-memory protection against duplicate React/effect execution in one page
 * lifetime. We deliberately do not use sessionStorage/localStorage here:
 * those are browser storage and must not be created before cookie consent.
 *
 * Purchase conversions carry `transaction_id`, so Google Ads can deduplicate
 * the same order across a full page reload on its side as well.
 */
const reportedConversions = new Set<string>()

function alreadyReported(key: string): boolean {
    if (reportedConversions.has(key)) return true
    reportedConversions.add(key)
    return false
}

/**
 * Reports a conversion to Google Ads, if one is configured for this event.
 *
 * Safe to call for every analytics event: no-ops when Ads isn't configured,
 * when the event has no conversion label, when gtag never loaded, or when this
 * exact conversion was already reported in the current page lifetime.
 */
export function trackAdsConversion(event: string, params: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return
    if (!GOOGLE_ADS_ID) return

    const label = CONVERSION_LABELS[event]
    if (!label) return

    // Staff listings are not marketing outcomes. Admins can now create
    // listings from the admin dashboard, and those fire `listing_submitted`
    // exactly like a real seller's would — which would quietly inflate the
    // Ads conversion the Search campaign reports against. GA4 still records
    // the event (it carries seller_role, so it can be segmented there); only
    // the paid-media conversion is suppressed.
    if (params.seller_role === 'ADMIN') return

    // Presence of gtag is NOT a consent check — under Consent Mode v2 the tag
    // loads for everyone. Consent is enforced by Google itself from the
    // consent state set in GoogleConsentMode.tsx / ConsentContext: with
    // ad_storage denied the conversion is reported without advertising
    // identifiers and can only ever be modelled, never tied to a person.
    // This guard is purely "did the script load at all".
    if (typeof window.gtag !== 'function') return

    try {
        const transactionId = params.transaction_id
        if (typeof transactionId === 'string' && transactionId) {
            if (alreadyReported(`${event}:${transactionId}`)) return
        }

        const payload: Record<string, unknown> = {
            send_to: `${GOOGLE_ADS_ID}/${label}`,
        }

        // Value/currency only belong on monetary conversions. Sending
        // value: undefined makes Ads record the conversion at 0, which drags
        // down ROAS reporting, so omit rather than pass through empty.
        if (typeof params.value === 'number' && !Number.isNaN(params.value)) {
            payload.value = params.value
            payload.currency = typeof params.currency === 'string' ? params.currency : 'GBP'
        }
        if (typeof transactionId === 'string' && transactionId) {
            payload.transaction_id = transactionId
        }

        window.gtag('event', 'conversion', payload)
    } catch {
        // Never let ad tracking break a user flow.
    }
}

/**
 * Google Ads conversion action "Completed Seller Registration".
 *
 * Separate from the CONVERSION_LABELS map above because it is not driven by an
 * analytics event — it fires from one specific point in the auth flow, the
 * moment the backend confirms it has just created a brand-new account.
 *
 * Supplied by the client from the Ads UI; do not substitute another label.
 * The Ads action is: category "Submit lead form", source Website / Google tag,
 * manual event, Primary, count One, data-driven attribution. "Count: One" means
 * Ads would collapse repeats per click anyway, but that is not a substitute for
 * only firing it once — a duplicate from a different click would still count.
 */
const SIGNUP_CONVERSION_LABEL = 'LTNTCIuK4-ocEN6N4qNE'

/**
 * A second in-memory line of defence for duplicate callback execution. The
 * authoritative guarantee is the backend's `isNewUser` flag, which can only
 * be true for the request that actually inserted the account. Avoiding
 * localStorage here keeps the conversion path compatible with denied consent.
 */
const reportedSignupIds = new Set<string>()

function alreadyReportedSignup(userId: string): boolean {
    if (reportedSignupIds.has(userId)) return true
    reportedSignupIds.add(userId)
    return false
}

/**
 * Reports a completed seller registration to Google Ads. Call this ONLY where
 * the backend has confirmed a new account was created — never on a dashboard
 * render, a login, or any page load, all of which would inflate the number the
 * Search campaign's Maximise Conversions bidding is learning from.
 *
 * Returns true only if a conversion was actually sent, so callers can log it.
 */
export function trackSignupConversion(userId: string): boolean {
    if (typeof window === 'undefined') return false
    if (!GOOGLE_ADS_ID) return false
    if (typeof window.gtag !== 'function') return false
    if (!userId || alreadyReportedSignup(userId)) return false

    try {
        window.gtag('event', 'conversion', {
            send_to: `${GOOGLE_ADS_ID}/${SIGNUP_CONVERSION_LABEL}`,
        })
        return true
    } catch {
        return false
    }
}

/** Exposed for the setup docs / debugging — which conversions are live. */
export function configuredAdsConversions(): string[] {
    if (!GOOGLE_ADS_ID) return []
    return Object.entries(CONVERSION_LABELS)
        .filter(([, label]) => !!label)
        .map(([event]) => event)
}
