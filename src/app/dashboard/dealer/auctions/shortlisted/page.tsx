"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { AlertCircle, Clock3, Flame, Gavel, Loader2, RefreshCw, Star, Trash2 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { useAuth } from "@/context/AuthContext"
import { TRADE_EXCHANGE_ROLES } from "@/lib/tradeAccess"
import { getAuctionShortlist, type ShortlistedAuction } from "@/lib/auctionShortlistApi"
import { removeFromWatchlist } from "@/lib/listingApi"

const PAGE_SIZE = 12

function money(amount: number | string): string {
    return "£" + Number(amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })
}

function timeRemaining(iso: string, now: number): string {
    const remaining = new Date(iso).getTime() - now
    if (remaining <= 0) return "Ended"
    const mins = Math.ceil(remaining / 60000)
    if (mins < 60) return mins + "m left"
    const hours = Math.floor(mins / 60)
    if (hours < 24) return hours + "h " + (mins % 60) + "m left"
    return Math.floor(hours / 24) + "d " + (hours % 24) + "h left"
}

export default function DealerAuctionShortlistPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [view, setView] = React.useState<"live" | "all">("live")
    const [page, setPage] = React.useState(1)
    const [items, setItems] = React.useState<ShortlistedAuction[]>([])
    const [totalPages, setTotalPages] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [removing, setRemoving] = React.useState<string | null>(null)
    const [now, setNow] = React.useState(() => Date.now())
    const requestNumber = React.useRef(0)

    const load = React.useCallback(async (quiet = false) => {
        const request = ++requestNumber.current
        if (quiet) setRefreshing(true)
        else setLoading(true)
        setError(null)
        try {
            const result = await getAuctionShortlist(page, PAGE_SIZE, view)
            if (request !== requestNumber.current) return
            setItems(result.data)
            setTotal(result.pagination.total)
            setTotalPages(Math.max(1, result.pagination.totalPages))
            // Removing the final card on a later page may leave an empty page.
            if (page > 1 && page > result.pagination.totalPages) setPage(result.pagination.totalPages || 1)
        } catch (err) {
            if (request === requestNumber.current) {
                setError(err instanceof Error ? err.message : "Unable to load shortlisted auctions.")
            }
        } finally {
            if (request === requestNumber.current) {
                setLoading(false)
                setRefreshing(false)
            }
        }
    }, [page, view])

    React.useEffect(() => {
        if (!authLoading && user) void load()
    }, [authLoading, user, load])

    React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    React.useEffect(() => {
        if (!user || authLoading) return
        // Refresh authoritative prices and auction status while this page is open.
        const timer = window.setInterval(() => {
            if (document.visibilityState === "visible") void load(true)
        }, 20000)
        return () => window.clearInterval(timer)
    }, [user, authLoading, load])

    const changeView = (next: "live" | "all") => {
        if (next === view) return
        setItems([])
        setPage(1)
        setView(next)
    }

    const remove = async (listingId: string) => {
        setRemoving(listingId)
        setError(null)
        try {
            await removeFromWatchlist(listingId)
            setItems(previous => previous.filter(item => item.listingId !== listingId))
            await load(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not remove this vehicle. Please retry.")
        } finally {
            setRemoving(null)
        }
    }

    const userName = profile?.firstName
        ? (profile.firstName + " " + (profile.lastName || "")).trim()
        : user?.email?.split("@")[0] || "Dealer"

    return (
        <RequireAuth
            title="Sign in to view your auction shortlist"
            signupRole="DEALER"
            allowedRoles={TRADE_EXCHANGE_ROLES}
            requireVerifiedDealer
            message="Only verified dealer accounts may view Trade Exchange auctions."
        >
            <div className="min-h-screen pt-20 pb-12">
                <div className="container mx-auto px-4 sm:px-5 flex flex-col lg:flex-row gap-8">
                    <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />
                    <main className="flex-1 min-w-0 space-y-5">
                        <PageHeader
                            title="Shortlisted Auctions"
                            subHeader="Save several live vehicles and come back to bid when you are ready."
                        >
                            <Link
                                href="/auctions/browse"
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
                            >
                                <Flame size={16} /> Browse Live Auctions
                            </Link>
                        </PageHeader>

                        <nav
                            aria-label="Auction and buying navigation"
                            className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1.5"
                        >
                            <Link href="/dashboard/dealer/auctions" className="min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary">
                                <Gavel size={16} /> My Auctions
                            </Link>
                            <Link href="/auctions/browse" className="min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary">
                                <Flame size={16} /> Live Auctions
                            </Link>
                            <span aria-current="page" className="min-h-11 shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                                <Star size={16} /> Shortlisted
                            </span>
                            <Link href="/dashboard/dealer/bids" className="min-h-11 shrink-0 inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary">
                                My Bids
                            </Link>
                            <Link href="/dashboard/dealer/auctions/won" className="min-h-11 shrink-0 inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold text-[var(--text-muted)] hover:text-primary">
                                Purchases
                            </Link>
                        </nav>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
                                <button
                                    type="button"
                                    aria-pressed={view === "live"}
                                    onClick={() => changeView("live")}
                                    className={view === "live" ? "min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white" : "min-h-11 rounded-lg px-4 text-sm font-bold text-[var(--text-muted)]"}
                                >
                                    Live to Bid
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={view === "all"}
                                    onClick={() => changeView("all")}
                                    className={view === "all" ? "min-h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white" : "min-h-11 rounded-lg px-4 text-sm font-bold text-[var(--text-muted)]"}
                                >
                                    All Saved
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                <span>{total} saved {view === "live" ? "live" : "in total"}</span>
                                <button
                                    type="button"
                                    aria-label="Refresh shortlisted auctions"
                                    onClick={() => void load(true)}
                                    disabled={refreshing}
                                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-default)] hover:text-primary disabled:opacity-60"
                                >
                                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                <span>{error}</span>
                                <button type="button" onClick={() => void load()} className="ml-auto font-bold underline">Retry</button>
                            </div>
                        )}

                        {loading ? (
                            <div role="status" className="flex items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
                                <Loader2 size={22} className="animate-spin" /> Loading shortlisted auctions...
                            </div>
                        ) : !error && items.length === 0 ? (
                            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-10 text-center">
                                <Star size={34} className="mx-auto mb-3 text-primary" />
                                <h2 className="text-lg font-bold">No {view === "live" ? "live" : ""} shortlisted auctions</h2>
                                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
                                    {view === "live"
                                        ? "Save live vehicles from the auction listings. Ended auctions remain visible under All Saved."
                                        : "Tap Shortlist on any auction card to save it for later."}
                                </p>
                                <Link href="/auctions/browse" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-white">
                                    Browse Live Auctions
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {items.map(item => {
                                    const a = item.listing.auction
                                    if (!a) return null
                                    const live = a.status === "ACTIVE" && item.listing.status === "ACTIVE" && new Date(a.endTime).getTime() > now
                                    const scheduled = a.status === "SCHEDULED" && new Date(a.startTime).getTime() > now
                                    const bidCount = item.listing._count.bids
                                    const amount = bidCount && item.listing.bids[0]
                                        ? item.listing.bids[0].amount
                                        : a.startingBid
                                    const state = live ? "LIVE" : scheduled ? "UPCOMING"
                                        : a.status === "CANCELLED" ? "CANCELLED" : "ENDED / UNAVAILABLE"
                                    return (
                                        <article key={item.id} className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                                            <div className="flex flex-col sm:flex-row">
                                                <Link href={"/auctions/live/" + a.id} className="relative block h-44 shrink-0 sm:h-auto sm:w-44">
                                                    <Image
                                                        src={item.listing.images[0] || "/assets/images/hero-bg.png"}
                                                        alt={item.listing.title}
                                                        fill
                                                        sizes="(max-width: 640px) 100vw, 176px"
                                                        className="object-cover"
                                                    />
                                                </Link>
                                                <div className="min-w-0 flex-1 p-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                                        <span className={live ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-500" : "rounded-full bg-[var(--bg-input)] px-2 py-1 text-xs font-bold text-[var(--text-muted)]"}>
                                                            {state}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            aria-label={"Remove " + item.listing.title + " from shortlist"}
                                                            onClick={() => void remove(item.listingId)}
                                                            disabled={removing === item.listingId}
                                                            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-red-500 disabled:opacity-50"
                                                        >
                                                            {removing === item.listingId ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                                            Remove
                                                        </button>
                                                    </div>
                                                    <Link href={"/auctions/live/" + a.id} className="mt-1 block font-bold text-[var(--text-primary)] hover:text-primary">
                                                        {item.listing.title}
                                                    </Link>
                                                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                        {item.listing.year || "Year N/A"} · {item.listing.mileage == null ? "Mileage N/A" : Number(item.listing.mileage).toLocaleString("en-GB") + " mi"}
                                                    </p>
                                                    <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-[var(--border-default)] pt-3">
                                                        <div>
                                                            <div className="text-xs text-[var(--text-muted)]">{bidCount ? "Current bid" : "Starting bid"}</div>
                                                            <div className="text-lg font-black text-[var(--text-primary)]">{money(amount)}</div>
                                                            <div className="text-xs text-[var(--text-muted)]">{bidCount} {bidCount === 1 ? "bid" : "bids"}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="flex items-center justify-end gap-1 text-xs text-[var(--text-muted)]">
                                                                <Clock3 size={13} /> {live ? "Ends in" : scheduled ? "Starts in" : "Auction status"}
                                                            </div>
                                                            <div className="mt-1 text-sm font-bold">
                                                                {live ? timeRemaining(a.endTime, now) : scheduled ? timeRemaining(a.startTime, now) : state}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Link
                                                        href={"/auctions/live/" + a.id}
                                                        className={live ? "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white" : "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-sm font-bold"}
                                                    >
                                                        <Gavel size={16} /> {live ? "Open Auction to Bid" : "View Auction"}
                                                    </Link>
                                                </div>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}

                        {totalPages > 1 && !loading && (
                            <div className="flex flex-wrap items-center justify-center gap-4 py-3">
                                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-sm font-bold disabled:opacity-40">
                                    Previous
                                </button>
                                <span className="text-sm text-[var(--text-muted)]">Page {page} of {totalPages}</span>
                                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="min-h-11 rounded-xl border border-[var(--border-default)] px-4 text-sm font-bold disabled:opacity-40">
                                    Next
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </RequireAuth>
    )
}
