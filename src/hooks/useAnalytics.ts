"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { useConsent } from "@/context/ConsentContext"
import { pushToDataLayer, SELLER_FUNNEL } from "@/lib/gtm"
import { trackAdsConversion, type AdsEnhancedUserData } from "@/lib/googleAds"
import { trackGa4Event } from "@/components/analytics/GoogleAnalytics"
import { trackMetaEvent } from "@/components/analytics/MetaPixel"
import { hasTrackingConsent } from "@/lib/trackingConsent"
import { getAccessToken } from "@/lib/supabase"
import { isSessionTokenForUser } from "@/lib/supabaseSessionIdentity"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://carmazium-hjoh9w.fly.dev"

function getSessionId(): string {
    const KEY = "cm_session_id"
    let id = sessionStorage.getItem(KEY)
    if (!id) {
        id = crypto.randomUUID()
        sessionStorage.setItem(KEY, id)
    }
    return id
}

function getDeviceType(): string {
    if (typeof navigator === "undefined") return "unknown"
    const ua = navigator.userAgent.toLowerCase()
    if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet"
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile"
    return "desktop"
}

const MARKETING_ATTRIBUTION_KEY = "cm_marketing_attribution_v1"

type FirstTouchAttribution = {
    first_touch_source: string
    first_touch_medium: string
    first_touch_campaign?: string
    first_touch_landing_path: string
    first_touch_referrer_host?: string
    google_ads_click: boolean
}

function referrerHost(): string {
    if (typeof document === "undefined" || !document.referrer) return ""
    try {
        return new URL(document.referrer).hostname.toLowerCase()
    } catch {
        return ""
    }
}

function hasCookie(name: string): boolean {
    if (typeof document === "undefined") return false
    return document.cookie.split(";").some((part) => part.trim().startsWith(`${name}=`))
}

/**
 * First-party attribution used only by CarMazium's own analytics store.
 *
 * Capture once per browser tab after tracking consent is granted, then keep it
 * through SPA navigation and external payment round-trips such as Stripe.
 * Deliberately store only source classification/UTMs and whether a Google Ads
 * click marker exists — never the gclid/gbraid/wbraid value itself.
 */
function getFirstTouchAttribution(): FirstTouchAttribution | null {
    if (typeof window === "undefined" || !hasTrackingConsent()) return null

    try {
        const existing = window.sessionStorage.getItem(MARKETING_ATTRIBUTION_KEY)
        if (existing) {
            const parsed = JSON.parse(existing) as FirstTouchAttribution
            if (parsed?.first_touch_source && parsed?.first_touch_medium) return parsed
        }

        const params = new URLSearchParams(window.location.search)
        const googleAdsClick =
            params.has("gclid") ||
            params.has("gbraid") ||
            params.has("wbraid") ||
            hasCookie("_gcl_aw")

        const host = referrerHost()
        const utmSource = params.get("utm_source")?.trim().toLowerCase() || ""
        const utmMedium = params.get("utm_medium")?.trim().toLowerCase() || ""
        const utmCampaign = params.get("utm_campaign")?.trim() || ""

        let source = utmSource
        let medium = utmMedium

        if (!source) {
            if (googleAdsClick) {
                source = "google_ads"
                medium = medium || "cpc"
            } else if (host.includes("google.")) {
                source = "google_organic"
                medium = medium || "organic"
            } else if (host.includes("facebook.") || host.includes("fb.")) {
                source = "facebook"
                medium = medium || "social"
            } else if (host.includes("instagram.")) {
                source = "instagram"
                medium = medium || "social"
            } else if (host.includes("tiktok.")) {
                source = "tiktok"
                medium = medium || "social"
            } else if (host) {
                source = host
                medium = medium || "referral"
            } else {
                source = "direct"
                medium = medium || "none"
            }
        }

        const attribution: FirstTouchAttribution = {
            first_touch_source: source,
            first_touch_medium: medium || "unknown",
            first_touch_campaign: utmCampaign || undefined,
            first_touch_landing_path: window.location.pathname,
            first_touch_referrer_host: host || undefined,
            google_ads_click: googleAdsClick,
        }

        window.sessionStorage.setItem(MARKETING_ATTRIBUTION_KEY, JSON.stringify(attribution))
        return attribution
    } catch {
        return null
    }
}

function compact(params: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    )
}

function googleEventParams(type: string, payload: Record<string, unknown>): Record<string, unknown> {
    if (type !== "search") return payload
    const searchTerm = String(payload.search_term ?? payload.query ?? "").trim()
    return compact({ ...payload, query: undefined, search_term: searchTerm || undefined })
}

const META_SELLER_CONVERSION_STORAGE_PREFIX = "cm_meta_verified_seller_v2:"
const metaSellerConversionSessionDedupe = new Set<string>()

/**
 * Only two business outcomes are Meta seller conversions:
 * - Lead: an auction successfully submitted to the real review queue
 * - Purchase: a verified £1 Retail listing fee payment
 *
 * De-duplicate by event type + listing ID across React effects, refreshes,
 * Stripe returns and later resubmissions in this browser. Event IDs are also
 * stable for a future browser/server Conversions API pairing. PageView or a
 * general wizard submission must never substitute for either conversion.
 */
function trackMetaSellerConversionOnce(
    eventName: "Lead" | "Purchase",
    listingId: unknown,
    params: Record<string, unknown>,
): void {
    if (typeof listingId !== "string" || !/^[A-Za-z0-9_-]{1,48}$/.test(listingId)) return
    if (typeof window === "undefined" || !hasTrackingConsent() || typeof window.fbq !== "function") return

    const dedupeKey = `${META_SELLER_CONVERSION_STORAGE_PREFIX}${eventName}:${listingId}`
    if (metaSellerConversionSessionDedupe.has(dedupeKey)) return
    try {
        if (window.localStorage.getItem(dedupeKey) === "1") {
            metaSellerConversionSessionDedupe.add(dedupeKey)
            return
        }
    } catch {
        // Private browsing can deny localStorage; in-memory deduplication remains.
    }

    const sent = trackMetaEvent(eventName, params, {
        eventID: `seller_${eventName.toLowerCase()}:${listingId}`,
    })
    if (!sent) return // Never consume a conversion when consent/pixel is missing.

    metaSellerConversionSessionDedupe.add(dedupeKey)
    try {
        window.localStorage.setItem(dedupeKey, "1")
    } catch {
        // The conversion has already been dispatched.
    }
}

function mirrorToMeta(type: string, payload: Record<string, unknown>): void {
    const isAdmin = String(payload.seller_role ?? "").toUpperCase() === "ADMIN"

    switch (type) {
        case "search": {
            const searchString = String(payload.search_term ?? payload.query ?? "").trim()
            if (searchString) trackMetaEvent("Search", { search_string: searchString })
            return
        }
        case "view_item": {
            const itemId = payload.item_id
            trackMetaEvent("ViewContent", compact({
                content_type: "product",
                content_category: "vehicle",
                content_ids: itemId ? [String(itemId)] : undefined,
                content_name: payload.item_name,
                value: payload.value,
                currency: payload.currency,
            }))
            return
        }
        case "generate_lead":
            // Browser-side buyer enquiries are not seller acquisition leads.
            // Always use a dedicated custom event, regardless of lead_type,
            // so an unrecognised category can never contaminate the seller
            // Lead conversion that active ad sets optimise for.
            trackMetaEvent("VehicleEnquiry", compact({
                content_type: "vehicle",
                content_ids: payload.content_id ? [String(payload.content_id)] : undefined,
                content_name: payload.content_name,
                content_category: payload.lead_type,
            }))
            return
        case SELLER_FUNNEL.LISTING_STARTED:
            if (!isAdmin) {
                // Listing start is useful funnel telemetry, but it is too early
                // to be Meta's optimisation conversion. Keep it as a custom
                // event so reporting can measure drop-off without training the
                // seller campaign on people who merely open the wizard.
                trackMetaEvent("SellerStartListing", compact(payload))
            }
            return
        case SELLER_FUNNEL.LISTING_SUBMITTED:
        case SELLER_FUNNEL.AUCTION_SUBMITTED:
            // Funnel reporting continues in GA4/first-party analytics. These
            // intermediate events are NOT Meta seller conversions: Retail has
            // not paid, and auction submission has not been verified here.
            return
        case SELLER_FUNNEL.QUALIFIED_SELLER_LISTING:
            if (!isAdmin
                && payload.listing_type === "auction"
                && payload.qualification === "auction_review"
                && payload.outcome === "pending_review") {
                trackMetaSellerConversionOnce("Lead", payload.listing_id, {
                    content_type: "vehicle",
                    content_category: "auction_listing_submitted",
                    content_ids: [payload.listing_id],
                })
            }
            return
        case SELLER_FUNNEL.LISTING_FEE_PAID:
            // Stripe's server-verified payment status, not a success-page
            // PageView, must be the source. Only the £1 BASIC Retail listing
            // fee is counted; other paid services are not seller conversions.
            if (!isAdmin && payload.listing_type === "retail"
                && payload.currency === "GBP" && Number(payload.value) === 1) {
                trackMetaSellerConversionOnce("Purchase", payload.listing_id, {
                    value: 1,
                    currency: "GBP",
                    content_type: "product",
                    content_category: "retail_listing_fee_paid",
                    content_name: "LISTING_FEE",
                    content_ids: [payload.listing_id],
                })
            }
            return
        default:
            return
    }
}

// The direct GA4 component owns page_view. Mirroring the first-party page_view
// into the dataLayer/GA4 event path as well would duplicate it.
const DATALAYER_EXCLUDED = new Set(["page_view"])

/**
 * Fire-and-forget analytics hook.
 *
 * Google receives events through gtag.js even when storage consent is denied;
 * Google Consent Mode v2 decides whether the hit is consented or cookieless.
 * Meta, GTM and CarMazium's own session-based analytics are consent-gated.
 * This keeps the cookie banner truthful and prevents non-essential browser
 * storage from being created before the visitor accepts.
 */
type TrackEventOptions = {
    googleAdsUserData?: AdsEnhancedUserData
}

export function useAnalytics() {
    const { user } = useAuth()
    const { granted } = useConsent()
    const sessionId = useRef<string | null>(null)
    const recentEvents = useRef<Map<string, number>>(new Map())

    useEffect(() => {
        if (granted) {
            sessionId.current = getSessionId()
            return
        }

        sessionId.current = null
        try {
            sessionStorage.removeItem("cm_session_id")
        } catch {
            // Storage may be unavailable; there is nothing else to clean up.
        }
    }, [granted])

    const trackEvent = useCallback(
        (type: string, payload: Record<string, unknown> = {}, options: TrackEventOptions = {}) => {
            try {
                // The search page can report the same user action once from its
                // submit handler and again when the URL synchronises. Suppress
                // only that immediate identical duplicate; repeated searches
                // later in the session still count normally.
                if (type === "search") {
                    const term = String(payload.search_term ?? payload.query ?? "").trim().toLowerCase()
                    if (term) {
                        const key = `search:${term}`
                        const now = Date.now()
                        const previous = recentEvents.current.get(key) ?? 0
                        if (now - previous < 1500) return
                        recentEvents.current.set(key, now)
                    }
                }

                const enriched: Record<string, unknown> = {
                    url: typeof window !== "undefined" ? window.location.pathname : "",
                    referrer: typeof window !== "undefined" ? (document.referrer || "direct") : "",
                    device: getDeviceType(),
                    ...payload,
                }

                if (!DATALAYER_EXCLUDED.has(type)) {
                    const googleParams = googleEventParams(type, payload)
                    pushToDataLayer(type, googleParams)
                    trackGa4Event(type, googleParams)
                    mirrorToMeta(type, payload)
                }

                // Google Ads conversions use the same Consent Mode state as
                // gtag.js and no-op when the event has no conversion label.
                trackAdsConversion(
                    type,
                    payload,
                    hasTrackingConsent() ? options.googleAdsUserData : undefined,
                )

                // Storage consent is authoritative even before React's
                // ConsentProvider has completed hydration. Stripe may return
                // quickly enough that this callback still closes over the
                // initial "granted=false" render; don't lose that paid event.
                // Read the stored explicit choice synchronously and lazily
                // initialize a session only after the user has opted in.
                if (hasTrackingConsent()) {
                    if (!sessionId.current) sessionId.current = getSessionId()
                    const firstTouch = getFirstTouchAttribution()
                    const eventBody = JSON.stringify({
                        type,
                        payload: firstTouch ? { ...enriched, ...firstTouch } : enriched,
                        sessionId: sessionId.current,
                    })
                    // The backend derives userId from a VERIFIED cookie or
                    // Bearer token. Never assert a browser-provided identity.
                    const sendEvent = (token: string | null) => fetch(`${API_URL}/analytics/event`, {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: eventBody,
                        keepalive: true,
                    }).catch((err) => {
                        if (process.env.NODE_ENV === "development") {
                            console.warn("[analytics] event failed:", err)
                        }
                    })
                    if (user) {
                        void getAccessToken()
                            .then(token => sendEvent(token && isSessionTokenForUser(token, user.id) ? token : null))
                            .catch(() => sendEvent(null))
                    } else {
                        void sendEvent(null)
                    }
                }
            } catch {
                // Analytics must never break a user flow.
            }
        },
        [user, granted],
    )

    const captureEmail = useCallback(
        (email: string, source: string) => {
            return fetch(`${API_URL}/analytics/email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, source }),
            }).then((r) => r.json())
        },
        [],
    )

    return { trackEvent, captureEmail }
}
