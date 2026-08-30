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
 * Conversions already reported this session, keyed by
 * `${event}:${transaction_id}`.
 *
 * Google Ads does dedupe server-side on the transaction/order id, but only
 * for events that actually carry one. The checkout success page can re-run
 * its effect or be refreshed outright, and an in-memory guard there is lost
 * on reload — sessionStorage survives it. Belt and braces on the one event
 * where a duplicate would misreport revenue.
 */
const DEDUPE_KEY = 'cm_ads_conversions'

function alreadyReported(key: string): boolean {
    try {
        const raw = sessionStorage.getItem(DEDUPE_KEY)
        const seen: string[] = raw ? JSON.parse(raw) : []
        if (seen.includes(key)) return true
        seen.push(key)
        // Bounded — a long session shouldn't grow this without limit.
        sessionStorage.setItem(DEDUPE_KEY, JSON.stringify(seen.slice(-50)))
        return false
    } catch {
        // Private mode / storage disabled — fall through and report. A
        // possible duplicate is better than silently dropping a conversion.
        return false
    }
}

/**
 * Reports a conversion to Google Ads, if one is configured for this event.
 *
 * Safe to call for every analytics event: no-ops when Ads isn't configured,
 * when the event has no conversion label, when gtag never loaded (consent
 * declined, script blocked), or when this exact conversion was already
 * reported this session.
 */
export function trackAdsConversion(event: string, params: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return
    if (!GOOGLE_ADS_ID) return

    const label = CONVERSION_LABELS[event]
    if (!label) return

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
 * Accounts already reported, so a conversion can never be sent twice for the
 * same person.
 *
 * localStorage, not sessionStorage: the guarantee needed is "never again",
 * which has to survive a refresh, a logout/login, and a visit next week — all
 * of which start a new session. Keyed by account id so a shared browser can
 * still report a genuine second person's registration.
 *
 * This is the second line of defence. The first is the backend's `isNewUser`,
 * which can only be true on the request that actually inserted the row; this
 * guard exists for the case where that one request's handler runs twice
 * (React StrictMode double-invocation, a retried fetch).
 */
const SIGNUP_DEDUPE_KEY = 'cm_ads_signup_reported'

function alreadyReportedSignup(userId: string): boolean {
    try {
        const raw = localStorage.getItem(SIGNUP_DEDUPE_KEY)
        const seen: string[] = raw ? JSON.parse(raw) : []
        if (seen.includes(userId)) return true
        seen.push(userId)
        localStorage.setItem(SIGNUP_DEDUPE_KEY, JSON.stringify(seen.slice(-20)))
        return false
    } catch {
        // Storage unavailable (private mode, blocked). Report rather than drop
        // a genuine registration — the backend flag has already established
        // this is a real one-off.
        return false
    }
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
