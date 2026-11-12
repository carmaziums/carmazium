"use client"

import Script from "next/script"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useConsent } from "@/context/ConsentContext"
import { analyticsEnabled } from "@/lib/analyticsEnv"

/**
 * Auto ads are configured in AdSense, including transactional-page exclusions.
 * Google's published European regulations message collects TCF consent separately
 * from our analytics banner. Never treat our banner as a certified AdSense CMP.
 * Site ownership is verified by the server-rendered meta tag, so verification
 * does not depend on a visitor accepting optional technologies.
 */
export function GoogleAdSense() {
    const { granted } = useConsent()
    const pathname = usePathname()
    const publicContent = pathname === "/" || pathname === "/sell" ||
        /^\/(blog|buy-cars|used-cars|used-car-types|search|compare|about|how-it-works|pricing|reviews)(\/|$)/.test(pathname)

    if (!analyticsEnabled || !granted || !publicContent) return null

    return (
        <Script
            id="carmazium-adsense"
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4507155809658636"
            crossOrigin="anonymous"
            strategy="afterInteractive"
        />
    )
}

/** Explicit responsive placement on valuation and public retail detail pages. */
export function GoogleAdBanner() {
    const { granted } = useConsent()
    const pathname = usePathname()
    if (!analyticsEnabled || !granted) return null
    // A different vehicle needs a fresh ins node, including client-side navigation.
    return <ResponsiveBanner key={pathname} />
}

function ResponsiveBanner() {
    const ad = useRef<HTMLModElement>(null)

    useEffect(() => {
        const element = ad.current
        if (!element) return
        let queued = false
        const requestAd = () => {
            if (queued || element.hasAttribute("data-adsbygoogle-status") || element.getBoundingClientRect().width === 0) return
            queued = true
            try {
                const adWindow = window as Window & { adsbygoogle?: object[] }
                ;(adWindow.adsbygoogle = adWindow.adsbygoogle || []).push({})
            } catch {
                // Ad blocking or unavailable inventory must never break the page.
            }
        }
        const observer = new ResizeObserver(requestAd)
        observer.observe(element)
        requestAd()
        return () => observer.disconnect()
    }, [])

    return (
        <aside aria-label="Advertisement" className="my-8 w-full min-w-0 overflow-hidden text-center [&:has(ins[data-ad-status=unfilled])]:hidden">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Advertisement</p>
            <ins
                ref={ad}
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client="ca-pub-4507155809658636"
                data-ad-slot="7894745304"
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
        </aside>
    )
}
