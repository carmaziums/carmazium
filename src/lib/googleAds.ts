/**
 * Google Ads conversion tracking.
 *
 * IMPORTANT OWNERSHIP RULE:
 * CarMazium must never ship conversion labels that belong to a programmer,
 * agency, or other third party. All Google Ads IDs and conversion labels are
 * supplied explicitly through CarMazium-owned environment variables.
 *
 * PRIVACY: no VRM, email, phone or postcode is sent. Only internal IDs,
 * vehicle make/model/year and transaction values. Enhanced Conversions are
 * deliberately not implemented here; sending hashed user-identifying data
 * requires a separate consent/legal review and an explicit CarMazium decision.
 */

const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

/**
 * Event name -> CarMazium-owned Google Ads conversion label.
 *
 * There are intentionally NO hard-coded fallback labels. If a label is not
 * configured, the event is a no-op. This prevents an old programmer-owned
 * Google Ads action from receiving CarMazium conversion data after migration.
 *
 * Keep overlapping funnel steps out of Primary bidding goals. For example,
 * `listing_fee_paid` is a subset of `purchase`, and
 * `auction_submitted_for_review` is a subset of `listing_submitted`.
 */
const CONVERSION_LABELS: Record<string, string | undefined> = {
    purchase: process.env.NEXT_PUBLIC_GADS_LABEL_PURCHASE?.trim(),
    listing_submitted: process.env.NEXT_PUBLIC_GADS_LABEL_LISTING_SUBMITTED?.trim(),
    valuation_requested: process.env.NEXT_PUBLIC_GADS_LABEL_VALUATION?.trim(),
}

/**
 * Completed-registration conversion label. This must also belong to the
 * CarMazium Google Ads account and is configured only through environment.
 */
const SIGNUP_CONVERSION_LABEL = process.env.NEXT_PUBLIC_GADS_LABEL_SIGNUP?.trim()

/**
 * In-memory protection against duplicate React/effect execution in one page
 * lifetime. Browser storage is deliberately avoided so ad tracking does not
 * create local/session storage before consent.
 *
 * Purchase conversions carry `transaction_id`, allowing Google Ads to
 * deduplicate the same order across a full page reload on its side as well.
 */
const reportedConversions = new Set<string>()

function alreadyReported(key: string): boolean {
    if (reportedConversions.has(key)) return true
    reportedConversions.add(key)
    return false
}

/**
 * Reports a conversion to Google Ads if a CarMazium-owned action is configured.
 */
export function trackAdsConversion(event: string, params: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return
    if (!GOOGLE_ADS_ID) return

    const label = CONVERSION_LABELS[event]
    if (!label) return

    // Staff-created listings are not marketing outcomes.
    if (params.seller_role === 'ADMIN') return

    // Google Consent Mode v2 is configured separately. The presence of gtag is
    // only a script-readiness check, not a consent check.
    if (typeof window.gtag !== 'function') return

    try {
        const transactionId = params.transaction_id
        if (typeof transactionId === 'string' && transactionId) {
            if (alreadyReported(`${event}:${transactionId}`)) return
        }

        const payload: Record<string, unknown> = {
            send_to: `${GOOGLE_ADS_ID}/${label}`,
        }

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
 * Reports a completed registration to the CarMazium-owned Google Ads action.
 * Call this ONLY where the backend confirms a brand-new account was created.
 */
const reportedSignupIds = new Set<string>()

function alreadyReportedSignup(userId: string): boolean {
    if (reportedSignupIds.has(userId)) return true
    reportedSignupIds.add(userId)
    return false
}

export function trackSignupConversion(userId: string): boolean {
    if (typeof window === 'undefined') return false
    if (!GOOGLE_ADS_ID || !SIGNUP_CONVERSION_LABEL) return false
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

/** Exposed for setup docs/debugging — only explicitly configured actions. */
export function configuredAdsConversions(): string[] {
    if (!GOOGLE_ADS_ID) return []

    const configured = Object.entries(CONVERSION_LABELS)
        .filter(([, label]) => !!label)
        .map(([event]) => event)

    if (SIGNUP_CONVERSION_LABEL) configured.push('sign_up')
    return configured
}
