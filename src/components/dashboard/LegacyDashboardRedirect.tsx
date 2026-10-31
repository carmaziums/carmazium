"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Compatibility wrapper for deep links to old private buyer/seller screens.
 * Normal links go to the unified dashboard. Specialist controls that have not
 * been reimplemented (auction reserve/handover, legacy delivery requests,
 * payment receipts, etc.) remain reachable with ?legacy=1.
 *
 * A direct /messages?room=<id> link preserves the intended conversation.
 */
export function LegacyDashboardRedirect({
    target,
    children,
    preserveWhen = [],
}: {
    target: string
    children: React.ReactNode
    preserveWhen?: string[]
}) {
    const router = useRouter()
    const search = useSearchParams()
    const legacy = search.get("legacy") === "1"
        || preserveWhen.some(key => search.has(key))
    const room = search.get("room")
    const destination = room && target.includes("tab=messages")
        ? `${target}&room=${encodeURIComponent(room)}` : target

    React.useEffect(() => {
        if (!legacy) router.replace(destination)
    }, [legacy, destination, router])

    if (legacy) return <>{children}</>
    return (
        <div role="status" className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 pt-24 text-center">
            <p className="text-sm text-[var(--text-muted)]">Opening your unified dashboard…</p>
            <Link href={destination} className="text-sm font-bold text-primary hover:underline">
                Continue to dashboard
            </Link>
        </div>
    )
}
