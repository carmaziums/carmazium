"use client"

import * as React from "react"
import dynamic from "next/dynamic"

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
    const [ready, setReady] = React.useState(false)

    React.useEffect(() => {
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
    }, [])

    return ready ? <MaziumWidget /> : null
}
