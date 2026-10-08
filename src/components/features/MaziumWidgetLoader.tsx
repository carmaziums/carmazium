"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

const MaziumWidget = dynamic(
    () => import("@/components/features/MaziumWidget").then(mod => mod.MaziumWidget),
    { ssr: false }
)

type IdleWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
    cancelIdleCallback?: (id: number) => void
}

/**
 * Mazium is useful but not first-paint critical. Waiting for browser idle keeps
 * its chat/framer-motion chunk from competing with the marketplace shell,
 * fonts and above-the-fold vehicle content during initial navigation.
 */
export function MaziumWidgetLoader() {
    const pathname = usePathname()
    const [ready, setReady] = React.useState(false)

    React.useEffect(() => {
        setReady(false)

        // /sell is a paid-search landing page. Keep MaziuM available, but do
        // not let its larger chat chunk compete with the valuation form,
        // fonts or first meaningful paint. Five seconds is short enough for
        // normal browsing and comfortably outside the initial render window.
        if (pathname?.startsWith("/sell")) {
            const id = window.setTimeout(() => setReady(true), 5000)
            return () => window.clearTimeout(id)
        }

        const idleWindow = window as IdleWindow
        if (idleWindow.requestIdleCallback) {
            const id = idleWindow.requestIdleCallback(
                () => setReady(true),
                { timeout: 2000 },
            )
            return () => idleWindow.cancelIdleCallback?.(id)
        }

        const id = window.setTimeout(() => setReady(true), 1200)
        return () => window.clearTimeout(id)
    }, [pathname])

    return ready ? <MaziumWidget /> : null
}
