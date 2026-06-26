"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useAnalytics } from "@/hooks/useAnalytics"

export function PageViewTracker() {
    const pathname = usePathname()
    const { trackEvent } = useAnalytics()
    const lastPath = useRef<string | null>(null)

    useEffect(() => {
        if (pathname === lastPath.current) return
        lastPath.current = pathname
        trackEvent("page_view", { url: pathname })
    }, [pathname, trackEvent])

    return null
}
