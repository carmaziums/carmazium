import { hasTrackingConsent } from "@/lib/trackingConsent"

/**
 * Google Ads conversion tracking.
 *
 * Keep the existing paid-retail conversion while introducing a separately
 * labelled qualified seller listing (auction reviewed or retail payment
 * confirmed). Do not send the new event to Ads until its action has been
 * configured and verified; later make the paid-only action secondary.
 */
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

const LISTING_FEE_CONVERSION_LABEL =
    process.env.NEXT_PUBLIC_GADS_LABEL_LISTING_FEE_PAID?.trim()
    || process.env.NEXT_PUBLIC_GADS_LABEL_PURCHASE?.trim()
    || 'KyfHCLLQ1eocEN6N4qNE'

// Must point at a newly verified Google Ads action, never a removed action.
// Until configured, GA4 receives the new event but Ads bidding is unchanged.
const QUALIFIED_SELLER_CONVERSION_LABEL =
    process.env.NEXT_PUBLIC_GADS_LABEL_QUALIFIED_SELLER?.trim()
const QUALIFIED_EVENT = 'qualified_seller_listing'

export type AdsEnhancedUserData = {
    email?: string
}

// Ads transaction IDs must be at most 64 characters. Stripe session IDs can
// exceed this. Since the listing fee is paid once per vehicle until sold, the
// stable server listing ID gives one short, deduplicated transaction identity.
export function listingFeeTrackingId(listingId: unknown): string | null {
    if (typeof listingId !== 'string') return null
    const id = listingId.trim()
    if (!/^[A-Za-z0-9_-]{1,48}$/.test(id)) return null
    return 'listing_fee:' + id
}

const CONVERSION_LABELS: Record<string, string | undefined> = {
    listing_fee_paid: LISTING_FEE_CONVERSION_LABEL,
    [QUALIFIED_EVENT]: QUALIFIED_SELLER_CONVERSION_LABEL,
}

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
 * Reports a Google Ads conversion when the Ads destination is configured.
 *
 * `userData` is intentionally separate from `params` so first-party identifiers
 * never leak into GA4, GTM dataLayer events or CarMazium's generic analytics store.
 * Enhanced-conversion data is only attached after explicit tracking consent;
 * Google hashes the normalised email before transmission.
 */
export function trackAdsConversion(
    event: string,
    params: Record<string, unknown> = {},
    userData: AdsEnhancedUserData = {},
): void {
    if (typeof window === 'undefined') return
    if (!GOOGLE_ADS_ID) return

    const label = CONVERSION_LABELS[event]
    if (!label) return

    // Staff-created listings are not marketing outcomes.
    if (String(params.seller_role || '').toUpperCase() === 'ADMIN') return

    // Enforce actual qualification at the conversion boundary as well as
    // at the calling UI. A draft, an unpaid checkout or a generic form submit
    // must never train the new bidding goal.
    if (event === QUALIFIED_EVENT) {
        const validAuction = params.listing_type === 'auction'
            && params.qualification === 'auction_review'
            && params.outcome === 'pending_review'
        const validRetail = params.listing_type === 'retail'
            && params.qualification === 'retail_payment'
            && params.payment_status === 'paid'
        if (typeof params.listing_id !== 'string' || !params.listing_id
            || (!validAuction && !validRetail)) return
        // Also guard against oversized IDs for the new conversion action.
        if (('qualified_listing:' + params.listing_id).length > 64) return
    }

    // Google Consent Mode v2 is configured separately. The presence of gtag is
    // only a script-readiness check, not a consent check.
    if (typeof window.gtag !== 'function') return

    try {
        // The same vehicle cannot generate another qualified conversion when
        // resubmitted, refreshed or converted from auction to retail.
        const transactionId = event === QUALIFIED_EVENT
            ? `qualified_listing:${params.listing_id}`
            : event === 'listing_fee_paid'
                ? listingFeeTrackingId(params.listing_id)
                : null
        // Fail closed if server listing metadata is unavailable or malformed,
        // rather than sending Google's invalid IDs or undeduplicated hits.
        if (!transactionId || transactionId.length > 64) return
        if (alreadyReported(`${event}:${transactionId}`)) return

        const payload: Record<string, unknown> = {
            send_to: `${GOOGLE_ADS_ID}/${label}`,
        }

        // A qualified listing is a counted outcome, not reported revenue.
        if (event !== QUALIFIED_EVENT && typeof params.value === 'number' && !Number.isNaN(params.value)) {
            payload.value = params.value
            payload.currency = typeof params.currency === 'string' ? params.currency : 'GBP'
        }
        if (typeof transactionId === 'string' && transactionId) {
            payload.transaction_id = transactionId
        }

        const normalizedEmail = typeof userData.email === 'string'
            ? userData.email.trim().toLowerCase()
            : ''
        if (normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
            && hasTrackingConsent()) {
            window.gtag('set', 'user_data', { email: normalizedEmail })
        }

        window.gtag('event', 'conversion', payload)
    } catch {
        // Never let ad tracking break a user flow.
    }
}

/** Exposed for setup/debugging. */
export function configuredAdsConversions(): string[] {
    if (!GOOGLE_ADS_ID) return []

    return Object.entries(CONVERSION_LABELS)
        .filter(([, label]) => !!label)
        .map(([event]) => event)
}
