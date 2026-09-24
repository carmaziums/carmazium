"use client"

import * as React from "react"
import { WifiOff } from "lucide-react"

export function OfflineBanner() {
    const [offline, setOffline] = React.useState(false)

    React.useEffect(() => {
        const sync = () => setOffline(!navigator.onLine)
        sync()
        window.addEventListener("online", sync)
        window.addEventListener("offline", sync)
        return () => {
            window.removeEventListener("online", sync)
            window.removeEventListener("offline", sync)
        }
    }, [])

    if (!offline) return null

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label="No internet connection"
            className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex min-h-9 items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-bold text-amber-300 backdrop-blur-md"
        >
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span>No internet connection — some actions may not work until you reconnect.</span>
        </div>
    )
}
