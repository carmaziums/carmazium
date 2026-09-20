/**
 * Google Ads conversion tracking.
 *
 * CarMazium paid acquisition has one bidding outcome: a confirmed £1 retail
 * listing-fee payment. Earlier funnel events (registration, valuation, listing
 * started/submitted) remain available to GA4/GTM/CarMazium analytics, but are
 * deliberately NOT sent as Google Ads conversions so Maximize Conversions is
 * trained on paying listing customers rather than cheap micro-conversions.
 */
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

const LISTING_FEE_CONVERSION_LABEL =
    process.env.NEXT_PUBLIC_GADS_LABEL_LISTING_FEE_PAID?.trim()
    || process.env.NEXT_PUBLIC_GADS_LABEL_PURCHASE?.trim()
    || 'KyfHCLLQ1eocEN6N4qNE'

const CONVERSION_LABELS: Record<string, string | undefined> = {
    listing_fee_paid: LISTING_FEE_CONVERSION_LABEL,
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

/** Reports a Google Ads conversion when the Ads destination is configured. */
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

/** Exposed for setup/debugging. */
export function configuredAdsConversions(): string[] {
    if (!GOOGLE_ADS_ID) return []

    return Object.entries(CONVERSION_LABELS)
        .filter(([, label]) => !!label)
        .map(([event]) => event)
}
