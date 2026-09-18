"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
    AlertCircle,
    Ban,
    Clock3,
    Gavel,
    Loader2,
    Radio,
    RefreshCw,
    Trophy,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import {
    formatPrice,
    getMyActiveAuctionBids,
    type ActiveAuctionBidPosition,
} from "@/lib/listingApi"
import { cancelBid } from "@/lib/auctionApi"

function formatTimeLeft(endTime: string, now: number) {
    const ms = new Date(endTime).getTime() - now
    if (ms <= 0) return "Ending"
    const totalSeconds = Math.floor(ms / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m ${seconds}s`
}

function formatCancelTime(deadline: string, now: number) {
    const ms = new Date(deadline).getTime() - now
    if (ms <= 0) return "Cancel window ended"
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return hours > 0 ? `${hours}h ${minutes}m left to cancel` : `${minutes}m left to cancel`
}

export default function DealerAuctionBidsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [positions, setPositions] = React.useState<ActiveAuctionBidPosition[]>([])
    const [loading, setLoading] = React.useState(true)
    const [refreshing, setRefreshing] = React.useState(false)
    const [cancelling, setCancelling] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [now, setNow] = React.useState(Date.now())

    const load = React.useCallback(async (quiet = false) => {
        try {
            if (quiet) setRefreshing(true)
            else setLoading(true)
            setError(null)
            const data = await getMyActiveAuctionBids()
            setPositions(data)
        } catch (err: any) {
            setError(err?.message || "Could not load your current auction bids.")
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    React.useEffect(() => {
        if (!authLoading && user) void load()
    }, [authLoading, user, load])

    React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(timer)
    }, [])

    React.useEffect(() => {
        if (!user) return
        const timer = window.setInterval(() => void load(true), 20000)
        return () => window.clearInterval(timer)
    }, [user, load])

    const handleCancel = async (position: ActiveAuctionBidPosition) => {
        const warning = position.isLeading
            ? "Cancel your current highest bid? If you placed an earlier lower bid on this auction, that earlier bid may become your active position."
            : "Cancel your current highest bid on this auction? Earlier lower bids you placed may remain active."
        if (!window.confirm(warning)) return

        setCancelling(position.myBidId)
        try {
            await cancelBid(position.myBidId)
            await load(true)
        } catch (err: any) {
            window.alert(err?.message || "Failed to cancel bid.")
        } finally {
            setCancelling(null)
        }
    }

    const leadingCount = positions.filter(p => p.isLeading).length
    const outbidCount = positions.length - leadingCount
    const endingSoonCount = positions.filter(p => new Date(p.endTime).getTime() - now <= 60 * 60 * 1000).length

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 min-w-0 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <PageHeader
                            title="My Auction Bids"
                            subHeader="One live position per vehicle you're currently bidding on"
                        />
                        <Button
                            variant="outline"
                            className="gap-2 self-start"
                            disabled={refreshing || loading}
                            onClick={() => void load(true)}
                        >
                            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
                            Refresh
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <MetricCard
                            label="Live Auction Positions"
                            value={positions.length}
                            icon={Gavel}
                            color="text-violet-400"
                            bg="bg-violet-500/10"
                            border="border-violet-500/20"
                            statusLabel="Current"
                            loading={loading}
                        />
                        <MetricCard
                            label="Currently Leading"
                            value={leadingCount}
                            icon={Trophy}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Winning"
                            loading={loading}
                        />
                        <MetricCard
                            label="Outbid / Action Needed"
                            value={outbidCount}
                            icon={AlertCircle}
                            color="text-amber-400"
                            bg="bg-amber-500/10"
                            border="border-amber-500/20"
                            statusLabel={endingSoonCount > 0 ? `${endingSoonCount} ending soon` : "Live"}
                            loading={loading}
                        />
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 flex items-start gap-3">
                            <AlertCircle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Could not load auction bids</p>
                                <p className="text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="dealer-glass-card py-20 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : positions.length === 0 ? (
                        <div className="dealer-glass-card p-10 sm:p-16 text-center">
                            <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
                                <Gavel size={28} className="text-violet-400" />
                            </div>
                            <h2 className="text-xl font-black mt-5">No Current Auction Bids</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-lg mx-auto">
                                When you place a bid on a live auction, that vehicle will appear here until the auction ends.
                            </p>
                            <Link href="/auctions/browse" className="inline-block mt-6">
                                <Button>Browse Live Auctions</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {positions.map(position => {
                                const image = position.listing.images?.[0]
                                const cancelStillOpen = position.canCancelCurrentBid && new Date(position.cancelDeadline).getTime() > now
                                const isEndingSoon = new Date(position.endTime).getTime() - now <= 60 * 60 * 1000

                                return (
                                    <article
                                        key={position.listingId}
                                        className="dealer-glass-card overflow-hidden border border-[var(--border-default)]"
                                    >
                                        <div className="relative h-44 sm:h-52 bg-[var(--bg-input)]">
                                            {image ? (
                                                <Image
                                                    src={image}
                                                    alt={position.listing.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                                                    <Gavel size={34} />
                                                </div>
                                            )}

                                            <div className="absolute top-3 left-3">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border backdrop-blur-md ${position.isLeading
                                                    ? "bg-emerald-500/85 border-emerald-300/30 text-white"
                                                    : "bg-amber-500/90 border-amber-300/30 text-black"}`}>
                                                    {position.isLeading ? <Trophy size={12} /> : <AlertCircle size={12} />}
                                                    {position.isLeading ? "Leading" : "Outbid"}
                                                </span>
                                            </div>

                                            <div className="absolute top-3 right-3">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black border backdrop-blur-md ${isEndingSoon
                                                    ? "bg-red-500/90 border-red-300/30 text-white"
                                                    : "bg-black/70 border-white/15 text-white"}`}>
                                                    <Clock3 size={12} />
                                                    {formatTimeLeft(position.endTime, now)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-5">
                                            <div>
                                                <h2 className="text-lg font-black leading-tight">{position.listing.title}</h2>
                                                <p className="text-sm text-[var(--text-muted)] mt-1">
                                                    {[position.listing.year, position.listing.make, position.listing.model]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                    {position.listing.mileage != null
                                                        ? ` · ${Number(position.listing.mileage).toLocaleString("en-GB")} miles`
                                                        : ""}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-5">
                                                <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3">
                                                    <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Your Highest Bid</p>
                                                    <p className="text-xl font-black mt-1">{formatPrice(position.myHighestBid)}</p>
                                                </div>
                                                <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3">
                                                    <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Current Highest</p>
                                                    <p className={`text-xl font-black mt-1 ${position.isLeading ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {formatPrice(position.currentHighestBid)}
                                                    </p>
                                                </div>
                                            </div>

                                            {!position.isLeading && (
                                                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-widest font-black text-amber-300">Next minimum bid</p>
                                                        <p className="font-black text-lg">{formatPrice(position.nextMinimumBid)}</p>
                                                    </div>
                                                    <Radio size={20} className="text-amber-400 animate-pulse shrink-0" />
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
                                                <span>{position.bidCount} total bid{position.bidCount === 1 ? "" : "s"} on this auction</span>
                                                {cancelStillOpen && (
                                                    <span className="text-red-300">{formatCancelTime(position.cancelDeadline, now)}</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
                                                <Link href={`/auctions/live/${position.auctionId}`} className="block">
                                                    <Button className="w-full gap-2">
                                                        <Radio size={15} className="animate-pulse" />
                                                        {position.isLeading ? "View Live Auction" : "Bid Again"}
                                                    </Button>
                                                </Link>
                                                {cancelStillOpen ? (
                                                    <Button
                                                        variant="outline"
                                                        className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                        disabled={cancelling === position.myBidId}
                                                        onClick={() => void handleCancel(position)}
                                                    >
                                                        {cancelling === position.myBidId
                                                            ? <Loader2 size={14} className="animate-spin" />
                                                            : <Ban size={14} />}
                                                        Cancel Current Bid
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" className="w-full" disabled>
                                                        24h Cancel Window Ended
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
