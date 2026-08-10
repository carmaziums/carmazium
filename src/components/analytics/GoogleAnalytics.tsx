"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

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
 * Loads gtag.js and tracks App Router client-side navigations as page_view events.
 * No-op (renders nothing, loads no script) when NEXT_PUBLIC_GA_MEASUREMENT_ID is unset.
 */
export function GoogleAnalytics() {
    if (!GA_MEASUREMENT_ID) return null

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
                    window.gtag = gtag;
                `}
            </Script>
            <Suspense fallback={null}>
                <GAPageViewTracker />
            </Suspense>
        </>
    )
}
