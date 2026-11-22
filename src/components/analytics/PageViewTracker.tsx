"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useAnalytics } from "@/hooks/useAnalytics"
import { useConsent } from "@/context/ConsentContext"

export function PageViewTracker() {
    const pathname = usePathname()
    const { trackEvent } = useAnalytics()
    const { granted } = useConsent()
    const lastPath = useRef<string | null>(null)

    useEffect(() => {
        // A pre-consent page view must not consume the first-touch slot.
        // If consent is accepted on this page, capture its original URL and
        // Google click marker before an auth redirect or seller wizard step.
        if (!granted || pathname === lastPath.current) return
        lastPath.current = pathname
        trackEvent("page_view", { url: pathname })
    }, [pathname, granted, trackEvent])

    return null
}
