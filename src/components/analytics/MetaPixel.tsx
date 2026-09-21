"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"
import { useConsent } from "@/context/ConsentContext"
import { analyticsEnabled } from "@/lib/analyticsEnv"
import { hasTrackingConsent } from "@/lib/trackingConsent"

// .trim() guards against stray whitespace from a copy-pasted env var value —
// an untrimmed ID silently breaks the noscript pixel URL's query string and
// Meta's own Event Setup Tool then reports "pixel wasn't detected".
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()

const META_STANDARD_EVENTS = new Set([
    "PageView",
    "ViewContent",
    "Search",
    "Lead",
    "CompleteRegistration",
    "Purchase",
])

// The historic implementation used Meta's generic Lead event for buyer vehicle
// enquiries as well as seller acquisition. The live seller campaign optimises
// for Lead, so that mixed buyer and seller intent into one optimisation signal.
// Keep existing call sites backwards-compatible while separating buyer actions
// into a custom event. Seller listing-start can then be the canonical Lead.
const VEHICLE_ENQUIRY_CATEGORIES = new Set([
    "vehicle_enquiry",
    "vehicle_chat_enquiry",
])

declare global {
    interface Window {
        fbq: ((...args: unknown[]) => void) & { loaded?: boolean }
        _fbq: unknown
    }
}

/**
 * Fire a Meta Pixel event from anywhere in the app.
 *
 * Meta standard events use `track`; CarMazium-specific lifecycle events use
 * `trackCustom`. Historic buyer-enquiry Lead calls are normalised to the
 * VehicleEnquiry custom event so seller campaigns are not trained on buyer
 * behaviour. The helper also re-checks the persisted consent decision on every
 * call. That matters when a visitor accepts cookies, loads the Pixel, and later
 * changes their preference to Reject All without a full page reload.
 */
export function trackMetaEvent(eventName: string, params?: Record<string, unknown>) {
    if (!hasTrackingConsent()) return
    if (typeof window === "undefined" || typeof window.fbq !== "function") return

    const contentCategory = String(params?.content_category ?? "")
    const normalisedEventName =
        eventName === "Lead" && VEHICLE_ENQUIRY_CATEGORIES.has(contentCategory)
            ? "VehicleEnquiry"
            : eventName

    const command = META_STANDARD_EVENTS.has(normalisedEventName) ? "track" : "trackCustom"
    if (params && Object.keys(params).length > 0) {
        window.fbq(command, normalisedEventName, params)
    } else {
        window.fbq(command, normalisedEventName)
    }
}

function MetaPixelPageViewTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const lastUrl = useRef<string | null>(null)

    useEffect(() => {
        if (!META_PIXEL_ID || typeof window.fbq !== "function") return
        const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
        // Skip the very first render — the init script below already fires the
        // initial PageView, same as GoogleAnalytics's send_page_view: false split.
        if (lastUrl.current === null) {
            lastUrl.current = url
            return
        }
        if (url === lastUrl.current) return
        lastUrl.current = url
        window.fbq("track", "PageView")
    }, [pathname, searchParams])

    return null
}

/**
 * Loads the Meta (Facebook) Pixel base code and tracks App Router
 * client-side navigations as PageView events, since Next.js SPA routing
 * doesn't reload the page for fbq's own view to pick up automatically.
 * No-op (renders nothing, loads no script) when NEXT_PUBLIC_META_PIXEL_ID
 * is unset, or until the visitor has accepted analytics/marketing cookies —
 * see ConsentContext.
 */
export function MetaPixel() {
    const { granted } = useConsent()
    if (!analyticsEnabled || !META_PIXEL_ID || !granted) return null

    return (
        <>
            <Script id="meta-pixel-init" strategy="afterInteractive">
                {`
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    // CarMazium sends deliberate Meta events from useAnalytics.
                    // Disable Meta's automatic event classification so ordinary
                    // clicks/forms cannot be inferred as Lead and pollute seller
                    // campaign optimisation. This must run before fbq('init').
                    fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
                    fbq('init', '${META_PIXEL_ID}');
                    fbq('track', 'PageView');
                `}
            </Script>
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
            <Suspense fallback={null}>
                <MetaPixelPageViewTracker />
            </Suspense>
        </>
    )
}
