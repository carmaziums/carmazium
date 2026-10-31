"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Gavel, Loader2, RefreshCw } from "lucide-react"
import { getMyAuctions, type Auction } from "@/lib/auctionApi"

type StatusFilter = "ALL" | "ACTIVE" | "SCHEDULED" | "ENDED" | "CANCELLED"

/**
 * Auction portion of the unified private "My cars" dashboard. Seller tools
 * remain in the existing manager using ?manage=1; never silently remove
 * bidding, reserve edits, handover proof, fee or auction controls.
 */
export function MyCarsAuctionPanel() {
    const [auctions, setAuctions] = React.useState<Auction[]>([])
    const [status, setStatus] = React.useState<StatusFilter>("ALL")
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [version, setVersion] = React.useState(0)

    React.useEffect(() => {
        let active = true
        setLoading(true)
        setError(null)
        getMyAuctions()
            .then(data => { if (active) setAuctions(data) })
            .catch((err: Error) => { if (active) setError(err.message || "Auction history unavailable") })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [version])

    const visible = status === "ALL" ? auctions : auctions.filter(a => a.status === status)
    return (
        <section aria-label="My car auctions" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black">My car auctions</h2>
                    <p className="text-sm text-[var(--text-muted)]">
                        Your scheduled, active and completed auctions, alongside your retail listings.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setVersion(v => v + 1)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-sm font-semibold">
                        <RefreshCw size={15}/> Refresh
                    </button>
                    <Link href="/dashboard/seller/auctions?manage=1"
                        className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white">
                        Manage auctions
                    </Link>
                </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter auction status">
                {(["ALL", "ACTIVE", "SCHEDULED", "ENDED", "CANCELLED"] as const).map(value => (
                    <button key={value} type="button" onClick={() => setStatus(value)}
                        aria-pressed={status === value}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold ${status === value
                            ? "bg-primary border-primary text-white" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                        {value === "ALL" ? "All" : value === "ACTIVE" ? "Live"
                            : value.charAt(0) + value.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>
            {loading && <p className="flex gap-2 items-center text-sm text-[var(--text-muted)]"><Loader2 size={16} className="animate-spin" /> Loading auctions…</p>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            {!loading && !error && visible.length === 0 && (
                <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-sm text-[var(--text-muted)]">
                    No {status === "ALL" ? "" : status.toLowerCase() + " "}auctions found.
                </p>
            )}
            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visible.map(auction => (
                        <article key={auction.id} className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-input)]">
                                {auction.listing.images?.[0]
                                    ? <Image src={auction.listing.images[0]} alt="" fill sizes="96px" className="object-cover"/>
                                    : <span className="flex h-full items-center justify-center"><Gavel size={22}/></span>}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="truncate text-sm font-bold">{auction.listing.title}</p>
                                <p className="text-xs text-[var(--text-muted)]">Status: {auction.status}</p>
                                <Link href={`/dashboard/seller/auctions?manage=1&listingId=${encodeURIComponent(auction.listingId)}`}
                                    className="inline-flex min-h-8 items-center text-xs font-bold text-primary hover:underline">
                                    Manage auction and handover
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )
}
