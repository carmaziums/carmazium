"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"
import { useConsent } from "@/context/ConsentContext"

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
 * NEXT_PUBLIC_GOOGLE_ADS_ID are unset, or until the visitor has accepted
 * analytics/marketing cookies — see ConsentContext.
 */
export function GoogleAnalytics() {
    const { granted } = useConsent()
    if ((!GA_MEASUREMENT_ID && !GOOGLE_ADS_ID) || !granted) return null

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
