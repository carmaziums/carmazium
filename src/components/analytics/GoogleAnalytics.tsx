"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"
import { analyticsEnabled } from "@/lib/analyticsEnv"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
// Google Ads conversion tag (AW-...), separate product from GA4 (G-...) but
// shares the same gtag.js library + dataLayer — configured independently so
// either can be toggled without the other.
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

declare global {
    interface Window {
        dataLayer: unknown[]
        gtag: (...args: unknown[]) => void
    }
}

/**
 * Send a custom event straight to GA4.
 *
 * WHY THIS EXISTS: the app's events are pushed to the GTM dataLayer
 * (lib/gtm.ts), but a dataLayer push only reaches GA4 if someone has built a
 * matching GA4 Event tag + Custom Event trigger inside the GTM console. That
 * had never been done, so GA4 was only ever showing its own Enhanced
 * Measurement automatics (page_view, scroll, click, form_start, form_submit,
 * session_start, first_visit, user_engagement, view_search_results) plus the
 * ads_conversion_* actions Google Ads creates by itself — and not one of
 * CarMazium's own funnel events.
 *
 * Sending directly here means the funnel works with zero GTM configuration.
 *
 * IMPORTANT: because of that, do NOT also create GA4 Event tags in GTM for
 * these same event names. The dataLayer push still happens (it's what lets
 * Meta/TikTok tags be attached per-event from the GTM console), so a GA4 tag
 * on the same custom event would double-count every one of them.
 */
export function trackGa4Event(eventName: string, params: Record<string, unknown> = {}) {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return
    if (!GA_MEASUREMENT_ID) return
    try {
        // send_to pins this to the GA4 property — without it the event would
        // also be delivered to the Google Ads tag sharing this gtag instance,
        // which pollutes Ads with non-conversion traffic.
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
 * Loads gtag.js, configures GA4 (send_page_view: false — page views tracked
 * manually below to survive App Router client-side navigation) and/or Google
 * Ads conversion tracking, whichever env vars are set. No-op (renders
 * nothing, loads no script) when both NEXT_PUBLIC_GA_MEASUREMENT_ID and
 * NEXT_PUBLIC_GOOGLE_ADS_ID are unset.
 *
 * CONSENT: this deliberately does NOT wait for the cookie banner. Under
 * Consent Mode v2 the tag loads for everyone with every storage type denied
 * (see GoogleConsentMode.tsx, which must render before this), stores nothing,
 * and is upgraded by ConsentContext's `consent: update` if the visitor
 * accepts. Gating the script load instead — which is what this used to do —
 * sends Google no consent signal at all, which is what produced "0% consent
 * rate detected" in Ads diagnostics and left the conversion goals
 * misconfigured. Meta and TikTok are still hard-gated; they have no
 * equivalent mechanism.
 */
export function GoogleAnalytics() {
    if (!analyticsEnabled) return null
    if (!GA_MEASUREMENT_ID && !GOOGLE_ADS_ID) return null

    // Either ID works to load the shared gtag.js library — prefer GA4's if
    // both are set, purely for a stable script src across renders.
    const scriptSrcId = GA_MEASUREMENT_ID ?? GOOGLE_ADS_ID

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${scriptSrcId}`}
                strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });` : ''}
                    ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
                    window.gtag = gtag;
                `}
            </Script>
            {GA_MEASUREMENT_ID && (
                <Suspense fallback={null}>
                    <GAPageViewTracker />
                </Suspense>
            )}
        </>
    )
}
