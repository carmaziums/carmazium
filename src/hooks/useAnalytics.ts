"use client"

import { useCallback, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { pushToDataLayer } from "@/lib/gtm"
import { trackAdsConversion } from "@/lib/googleAds"
import { trackGa4Event } from "@/components/analytics/GoogleAnalytics"

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

// GTM's own GA4 config tag fires pageviews natively, and GoogleAnalytics.tsx
// already tracks them too — mirroring our first-party page_view into the
// dataLayer as well would triple-count. First-party keeps recording it.
const DATALAYER_EXCLUDED = new Set(["page_view"])

/**
 * Fire-and-forget analytics hook.
 * Every call is non-blocking — failures are silently swallowed.
 * Each event is automatically enriched with url, referrer, and device type.
 *
 * Events fan out to three places from this single call: CarMazium's own
 * /analytics/event store (which powers the admin analytics dashboard), the
 * GTM dataLayer (which lets GA4/Meta/TikTok tags be attached per-event from
 * the GTM console without a redeploy), and Google Ads conversion tracking
 * for the subset of events that have a conversion label configured.
 * See lib/gtm.ts and lib/googleAds.ts.
 */
export function useAnalytics() {
    const { user } = useAuth()
    const sessionId = useRef<string | null>(null)

    useEffect(() => {
        sessionId.current = getSessionId()
    }, [])

    const trackEvent = useCallback(
        (type: string, payload: Record<string, unknown> = {}) => {
            try {
                const enriched: Record<string, unknown> = {
                    url: typeof window !== "undefined" ? window.location.pathname : "",
                    referrer: typeof window !== "undefined" ? (document.referrer || "direct") : "",
                    device: getDeviceType(),
                    ...payload, // caller-supplied fields take precedence
                }

                // Mirror to GTM. Only the caller-supplied fields go out — url
                // and referrer are things GTM/GA4 already collect themselves,
                // and device is derivable there too.
                if (!DATALAYER_EXCLUDED.has(type)) {
                    pushToDataLayer(type, payload)

                    // Straight to GA4 as well. A dataLayer push alone never
                    // reached GA4 — that needs a GA4 Event tag built per event
                    // in the GTM console, which was never done, so none of
                    // these funnel events showed up in GA4 at all. Excluded
                    // for page_view for the same reason as the dataLayer:
                    // GAPageViewTracker already sends it.
                    trackGa4Event(type, payload)
                }

                // Google Ads conversions. No-ops unless this event has a
                // conversion label configured — see lib/googleAds.ts.
                trackAdsConversion(type, payload)

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
            } catch {
                // swallow
            }
        },
        [user],
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
