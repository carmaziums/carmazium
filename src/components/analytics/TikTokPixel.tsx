"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Script from "next/script"
import { useConsent } from "@/context/ConsentContext"
import { analyticsEnabled } from "@/lib/analyticsEnv"

const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID?.trim()

declare global {
    interface Window {
        ttq: {
            (...args: unknown[]): void
            push: (...args: unknown[]) => void
            methods: string[]
            instance: (id: string) => unknown
            load: (id: string, options?: Record<string, unknown>) => void
            page: () => void
            track: (...args: unknown[]) => void
        }
    }
}

function TikTokPageViewTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const lastUrl = useRef<string | null>(null)

    useEffect(() => {
        if (!TIKTOK_PIXEL_ID || typeof window.ttq?.page !== "function") return
        const url = searchParams.toString() ? `${pathname}?${searchParams}` : pathname
        // Skip the very first render — the init script below already fires the
        // initial page() call, same split used by GoogleAnalytics/MetaPixel.
        if (lastUrl.current === null) {
            lastUrl.current = url
            return
        }
        if (url === lastUrl.current) return
        lastUrl.current = url
        window.ttq.page()
    }, [pathname, searchParams])

    return null
}

/**
 * Loads the TikTok Pixel base code and tracks App Router client-side
 * navigations as page views, since Next.js SPA routing doesn't reload the
 * page for ttq's own view to pick up automatically.
 * No-op (renders nothing, loads no script) when NEXT_PUBLIC_TIKTOK_PIXEL_ID
 * is unset, or until the visitor has accepted analytics/marketing cookies —
 * see ConsentContext.
 */
export function TikTokPixel() {
    const { granted } = useConsent()
    if (!analyticsEnabled || !TIKTOK_PIXEL_ID || !granted) return null

    return (
        <>
            <Script id="tiktok-pixel-init" strategy="afterInteractive">
                {`
                    !function (w, d, t) {
                      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
                    var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
                    ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

                      ttq.load('${TIKTOK_PIXEL_ID}');
                      ttq.page();
                    }(window, document, 'ttq');
                `}
            </Script>
            <Suspense fallback={null}>
                <TikTokPageViewTracker />
            </Suspense>
        </>
    )
}
