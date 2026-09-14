"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

declare global {
    interface Window {
        dataLayer: unknown[]
        gtag: (...args: unknown[]) => void
    }
}

/**
 * Send a custom event to the CarMazium GA4 property.
 *
 * The Google base tags themselves are owned by GTM. GoogleConsentMode creates
 * the gtag/dataLayer interface before GTM loads, so application events can be
 * queued safely and are processed by the Google tag once the GTM container is
 * available.
 *
 * IMPORTANT: do not also create GTM GA4 Event tags for these same event names,
 * because that would double-count the application's funnel events.
 */
export function trackGa4Event(eventName: string, params: Record<string, unknown> = {}) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return
    if (!GA_MEASUREMENT_ID) return
    try {
        window.gtag("event", eventName, { ...params, send_to: GA_MEASUREMENT_ID })
    } catch {
        // Never let analytics break a user flow.
    }
}

function GAPageViewTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const lastUrl = useRef<string | null>(null)

    useEffect(() => {
        if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return
        const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
        if (url === lastUrl.current) return
        lastUrl.current = url
        window.gtag("event", "page_view", {
            page_path: url,
            send_to: GA_MEASUREMENT_ID,
        })
    }, [pathname, searchParams])

    return null
}

/**
 * Application-side Google analytics bridge.
 *
 * This component deliberately DOES NOT load gtag.js and DOES NOT call
 * gtag('config'). The CarMazium-owned GTM container is the sole owner of the
 * GA4 and Google Ads base tags. Keeping the manual App Router page-view
 * tracker here preserves SPA navigation tracking; the GA4 Google Tag in GTM
 * must keep send_page_view=false so each navigation produces exactly one
 * page_view.
 */
export function GoogleAnalytics() {
    if (!GA_MEASUREMENT_ID) return null

    return (
        <Suspense fallback={null}>
            <GAPageViewTracker />
        </Suspense>
    )
}
