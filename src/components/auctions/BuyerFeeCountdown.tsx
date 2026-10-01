"use client"

import * as React from "react"

/** Server-provided win timestamp is authoritative; never infer the deadline
 * from auction endTime or the instant this page happened to open. */
export function BuyerFeeCountdown({ deadline }: { deadline?: string | null }) {
    const [now, setNow] = React.useState<number | null>(null)
    React.useEffect(() => {
        if (!deadline) return
        const refresh = () => setNow(Date.now())
        refresh()
        const interval = setInterval(refresh, 1_000)
        return () => clearInterval(interval)
    }, [deadline])

    if (!deadline) {
        return <span className="text-xs font-semibold text-amber-400">Payment due within 72 hours of your recorded win. Refresh for the exact deadline.</span>
    }
    const at = Date.parse(deadline)
    if (!Number.isFinite(at) || now === null) {
        return <span className="text-xs text-amber-400">Checking your payment deadline…</span>
    }
    const remaining = Math.max(0, Math.ceil((at - now) / 1000))
    const h = Math.floor(remaining / 3600)
    const m = Math.floor((remaining % 3600) / 60)
    const s = remaining % 60
    const ukTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    }).format(at)
    return (
        <span className={`block text-xs font-semibold ${remaining <= 6 * 3600 ? "text-red-400" : "text-amber-400"}`}>
            {remaining === 0 ? "Deadline reached — refresh to check your win before paying."
                : `Time left: ${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`}
            <span className="block text-[11px] font-normal">Due {ukTime} (UK time)</span>
        </span>
    )
}
