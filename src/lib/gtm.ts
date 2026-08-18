/**
 * Google Tag Manager dataLayer bridge.
 *
 * Everything the app wants GTM to see goes through `pushToDataLayer`, which
 * is a no-op when GTM isn't configured (or on the server), so call sites
 * never need to guard.
 *
 * In GTM these arrive as Custom Events — create a trigger on the event name
 * below, then attach whichever tags should fire (GA4 event, Meta, TikTok…).
 * That's the point of routing through GTM: the events are declared once here
 * in code, and which platforms consume them becomes a GTM-side decision that
 * doesn't need a redeploy.
 *
 * PRIVACY: deliberately no VRM/registration, email, phone, or postcode is
 * ever pushed. A registration plate is personal data under UK GDPR (it maps
 * to a keeper), and Google's own terms forbid sending PII to GA4. Vehicle
 * make/model/year and internal IDs are safe and are what the funnel actually
 * needs.
 */

export type DataLayerEvent = Record<string, unknown> & { event: string }

// NOTE: `dataLayer` is declared as `unknown[]` in
// components/analytics/GoogleAnalytics.tsx (gtag.js shares the same queue).
// Interface merging requires the type to match exactly, so don't "improve"
// this to Record<string, unknown>[] without changing it there too.
declare global {
    interface Window {
        dataLayer: unknown[]
    }
}

/** Push a Custom Event to GTM. Safe to call anywhere, any time. */
export function pushToDataLayer(event: string, params: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined') return
    try {
        window.dataLayer = window.dataLayer || []
        // Undefined values are dropped — GTM/GA4 show them as the literal
        // string "undefined" otherwise, which pollutes the reports.
        const clean: Record<string, unknown> = { event }
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') clean[k] = v
        }
        window.dataLayer.push(clean)
    } catch {
        // Never let analytics break a user flow
    }
}

// ─── Seller funnel ───────────────────────────────────────────────────────────
// One named constant per event so the wizard, the checkout-success page and
// GTM can't drift apart on spelling.

export const SELLER_FUNNEL = {
    /** Reg entered and DVLA/valuation data returned — top of the funnel */
    VALUATION_REQUESTED: 'valuation_requested',
    /** Seller picked Retail or Auction and entered the wizard */
    LISTING_STARTED: 'listing_started',
    /** A wizard step validated and advanced — this is the drop-off signal */
    LISTING_STEP_COMPLETED: 'listing_step_completed',
    /**
     * Wizard finished, on either path. Carries `listing_type` (retail|auction)
     * and `outcome` (pending_review|awaiting_payment). Use THIS as the final
     * step of a GTM/GA4 funnel — it's the single "seller got to the end" event.
     */
    LISTING_SUBMITTED: 'listing_submitted',
    /**
     * Auction path only: went straight to review, no payment step.
     * NOTE: this is a SUBSET of LISTING_SUBMITTED, fired alongside it for
     * convenience. Don't map both to the same GA4 conversion or you'll
     * double-count.
     */
    AUCTION_SUBMITTED: 'auction_submitted_for_review',
    /** Retail path only: redirected to Stripe. Also a subset — see above. */
    LISTING_CHECKOUT_STARTED: 'listing_checkout_started',
    /**
     * Retail path: listing fee actually cleared. This is the real money event
     * — map it to Purchase / a GA4 conversion. Fires on the checkout-success
     * page, not in the wizard, because the seller leaves the site for Stripe.
     */
    LISTING_FEE_PAID: 'listing_fee_paid',
} as const

/** Normalises the internal listingType enum for reporting. */
export function listingTypeLabel(listingType: string | undefined): 'auction' | 'retail' {
    return listingType === 'AUCTION' ? 'auction' : 'retail'
}
