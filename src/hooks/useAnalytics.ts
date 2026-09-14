"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { useConsent } from "@/context/ConsentContext"
import { pushToDataLayer, SELLER_FUNNEL } from "@/lib/gtm"
import { trackAdsConversion } from "@/lib/googleAds"
import { trackGa4Event } from "@/components/analytics/GoogleAnalytics"
import { trackMetaEvent } from "@/components/analytics/MetaPixel"

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
            // Buyer vehicle enquiries are automatically normalised by
            // trackMetaEvent() to the custom VehicleEnquiry event. This keeps
            // Meta's standard Lead signal reserved for seller acquisition.
            trackMetaEvent("Lead", compact({
                content_type: "vehicle",
                content_ids: payload.content_id ? [String(payload.content_id)] : undefined,
                content_name: payload.content_name,
                content_category: payload.lead_type,
            }))
            return
        case SELLER_FUNNEL.LISTING_STARTED:
            if (!isAdmin) {
                // The live seller TOFU campaign already optimises for Meta's
                // standard Lead event. Make a genuine seller listing-start the
                // canonical Lead signal, while retaining the custom event for
                // funnel reporting and future campaign options.
                trackMetaEvent("Lead", compact({ ...payload, content_category: "seller_listing_start" }))
                trackMetaEvent("SellerStartListing", compact(payload))
            }
            return
        case SELLER_FUNNEL.LISTING_SUBMITTED:
            if (!isAdmin) trackMetaEvent("SellerCompleteListing", compact(payload))
            return
        case SELLER_FUNNEL.AUCTION_SUBMITTED:
            if (!isAdmin) trackMetaEvent("AuctionListingCreated", compact(payload))
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
        (type: string, payload: Record<string, unknown> = {}) => {
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
                trackAdsConversion(type, payload)

                // Our own analytics uses sessionStorage, so unlike Google's
                // Consent Mode requests it must wait for explicit consent.
                if (granted) {
                    fetch(`${API_URL}/analytics/event`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type,
                            payload: enriched,
                            sessionId: sessionId.current,
                            userId: user?.id ?? undefined,
                        }),
                        keepalive: true,
                    }).catch((err) => {
                        if (process.env.NODE_ENV === "development") {
                            console.warn("[analytics] event failed:", err)
                        }
                    })
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
