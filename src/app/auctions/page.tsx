"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel,
    Flame,
    Calendar,
    ArrowRight,
    Zap,
    Users,
    TrendingUp,
    AlertTriangle,
    Search,
    RefreshCw,
    Clock,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import {
    getActiveAuctions,
    getScheduledAuctions,
    getCurrentBid,
    getBidCount,
    isAntiSnipeActive,
    type Auction,
} from "@/lib/auctionApi"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStartsIn(startTime: string): string {
    const diff = new Date(startTime).getTime() - Date.now()
    if (diff <= 0) return "Starting…"
    const hours = Math.floor(diff / 3_600_000)
    const mins = Math.floor((diff % 3_600_000) / 60_000)
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
}

// ─── Auction Card ─────────────────────────────────────────────────────────────

function AuctionCard({ auction }: { auction: Auction }) {
    const currentBid = getCurrentBid(auction)
    const bidCount = getBidCount(auction)
    const antiSnipe = isAntiSnipeActive(auction)
    const isActive = auction.status === "ACTIVE"
    const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"
    const vehicle = `${auction.listing.year ?? ""} ${auction.listing.make ?? ""} ${auction.listing.model ?? ""}`.trim()

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative"
        >
            {/* Glow border on hover */}
            <div className="absolute -inset-px bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl opacity-0 group-hover:opacity-60 blur transition-all duration-500 pointer-events-none" />

            <Link href={`/auctions/live/${auction.id}`} className="relative block bg-slate-900 rounded-2xl overflow-hidden border border-white/8 hover:border-red-500/30 transition-all duration-300">

                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                    <Image
                        src={image}
                        alt={auction.listing.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />

                    {/* Status badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                        {isActive ? (
                            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-[0_0_12px_rgba(220,38,38,0.5)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                LIVE
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 bg-slate-800/90 backdrop-blur text-slate-300 text-[11px] font-bold px-3 py-1 rounded-full border border-white/10">
                                <Clock size={10} />
                                STARTS IN {formatStartsIn(auction.startTime)}
                            </span>
                        )}

                        {antiSnipe && (
                            <span className="flex items-center gap-1 bg-orange-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse">
                                <Zap size={9} />
                                ANTI-SNIPE
                            </span>
                        )}
                    </div>

                    {/* Bid count */}
                    <div className="absolute top-3 right-3 z-10">
                        <span className="flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/10">
                            <Users size={10} />
                            {bidCount}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    <div>
                        <p className="text-slate-500 text-[11px] uppercase tracking-widest font-bold">{vehicle}</p>
                        <h3 className="text-white font-bold text-base leading-tight mt-0.5 line-clamp-1">{auction.listing.title}</h3>
                    </div>

                    {/* Bid / timer row */}
                    <div className="flex items-center justify-between bg-slate-800/60 border border-white/5 rounded-xl px-3 py-2.5">
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                {bidCount > 0 ? "Current Bid" : "Starting Bid"}
                            </p>
                            <p className="text-white font-mono font-bold text-lg leading-none mt-0.5">
                                £{currentBid.toLocaleString()}
                            </p>
                        </div>

                        {isActive ? (
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Ends In</p>
                                <div className="text-red-400">
                                    <CountdownTimer targetDate={new Date(auction.endTime)} minimal />
                                </div>
                            </div>
                        ) : (
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Starts In</p>
                                <div className="text-slate-300 font-mono font-bold text-sm">
                                    {formatStartsIn(auction.startTime)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                            Reserve: £{Number(auction.reservePrice).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 text-red-500 text-xs font-bold group-hover:gap-2 transition-all">
                            {isActive ? "Bid Now" : "View Details"} <ArrowRight size={12} />
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: "live" | "upcoming" }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center mb-4">
                {tab === "live" ? (
                    <Flame size={24} className="text-slate-600" />
                ) : (
                    <Calendar size={24} className="text-slate-600" />
                )}
            </div>
            <p className="text-slate-400 font-bold">
                {tab === "live" ? "No live auctions right now" : "No upcoming auctions scheduled"}
            </p>
            <p className="text-slate-600 text-sm mt-1">
                {tab === "live"
                    ? "Check back soon — auctions activate automatically at their scheduled time."
                    : "New auctions are added regularly. Check back soon."}
            </p>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AuctionsPage() {
    const [activeTab, setActiveTab] = React.useState<"live" | "upcoming">("live")
    const [liveAuctions, setLiveAuctions] = React.useState<Auction[]>([])
    const [scheduledAuctions, setScheduledAuctions] = React.useState<Auction[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [lastRefresh, setLastRefresh] = React.useState(Date.now())

    const load = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const [live, scheduled] = await Promise.all([getActiveAuctions(), getScheduledAuctions()])
            setLiveAuctions(live)
            setScheduledAuctions(scheduled)
            setLastRefresh(Date.now())
        } catch {
            setError("Failed to load auctions. Please try again.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => { load() }, [load])

    const displayed = (activeTab === "live" ? liveAuctions : scheduledAuctions).filter(a => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            a.listing.title.toLowerCase().includes(q) ||
            (a.listing.make ?? "").toLowerCase().includes(q) ||
            (a.listing.model ?? "").toLowerCase().includes(q)
        )
    })

    return (
        <div className="bg-slate-950 min-h-screen pb-20">

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="relative min-h-[55vh] overflow-hidden flex items-center pt-20">
                <Image
                    src="/assets/images/hero-bg.png"
                    alt="Auctions Hero"
                    fill
                    sizes="100vw"
                    priority
                    className="object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />

                {/* Animated glow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-red-600/10 blur-3xl pointer-events-none" />

                <div className="container mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6"
                    >
                        {/* Live pill */}
                        <div className="flex items-center gap-2 text-red-500 font-bold tracking-widest uppercase text-xs">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            {liveAuctions.length > 0 ? `${liveAuctions.length} Auctions Live Now` : "Live Auctions"}
                        </div>

                        <h1 className="text-5xl md:text-6xl font-bold font-heading text-white leading-tight">
                            The Gavel{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                                Drops Here.
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                            Real-time bidding on verified vehicles. Place your bid, watch the action live,
                            and connect with the seller when you win.
                        </p>

                        {/* Stats bar */}
                        <div className="flex items-center gap-6 pt-2">
                            {[
                                { icon: Flame, value: liveAuctions.length, label: "Live" },
                                { icon: Calendar, value: scheduledAuctions.length, label: "Upcoming" },
                                { icon: TrendingUp, value: "5hr", label: "Duration" },
                            ].map(({ icon: Icon, value, label }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <Icon size={14} className="text-red-500" />
                                    <span className="text-white font-bold text-sm">{value}</span>
                                    <span className="text-slate-500 text-xs">{label}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Anti-Snipe Info Banner ────────────────────────────────────── */}
            {liveAuctions.some(isAntiSnipeActive) && (
                <div className="bg-orange-500/10 border-y border-orange-500/20 py-2.5">
                    <div className="container mx-auto px-6 flex items-center justify-center gap-2 text-orange-400 text-xs font-bold">
                        <AlertTriangle size={13} />
                        Anti-Snipe Active on some auctions — bids in the final 3 minutes extend the auction by 3 minutes
                    </div>
                </div>
            )}

            {/* ── Sticky Filter Bar ─────────────────────────────────────────── */}
            <div className="sticky top-[64px] z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5 py-3">
                <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center gap-3 justify-between">

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
                        {(["live", "upcoming"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                                    activeTab === tab
                                        ? "text-white"
                                        : "text-slate-500 hover:text-slate-300"
                                }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="tab-pill"
                                        className="absolute inset-0 bg-red-600 rounded-lg"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {tab === "live" ? <Flame size={13} /> : <Calendar size={13} />}
                                    {tab}
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab ? "bg-white/20 text-white" : "bg-slate-700 text-slate-400"}`}>
                                        {tab === "live" ? liveAuctions.length : scheduledAuctions.length}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search + Refresh */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative group flex-1 sm:w-56">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search make or model…"
                                className="w-full bg-slate-800/60 border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/40 transition-colors"
                            />
                        </div>
                        <button
                            onClick={load}
                            disabled={loading}
                            title="Refresh"
                            className="p-2 rounded-xl border border-white/8 bg-slate-800/60 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Auction Grid ──────────────────────────────────────────────── */}
            <div className="container mx-auto px-6 pt-10">

                {error && (
                    <div className="text-center py-10">
                        <p className="text-red-400 text-sm mb-3">{error}</p>
                        <button onClick={load} className="text-red-500 underline text-sm">Try again</button>
                    </div>
                )}

                {loading && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden animate-pulse">
                                <div className="h-52 bg-slate-800" />
                                <div className="p-4 space-y-3">
                                    <div className="h-3 bg-slate-800 rounded w-1/3" />
                                    <div className="h-5 bg-slate-800 rounded w-2/3" />
                                    <div className="h-14 bg-slate-800 rounded-xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && !error && (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {displayed.length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : (
                                displayed.map(auction => (
                                    <AuctionCard key={auction.id} auction={auction} />
                                ))
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}

                {/* Last updated */}
                {!loading && (
                    <p className="text-center text-slate-700 text-xs mt-8">
                        Last updated {new Date(lastRefresh).toLocaleTimeString("en-GB")}
                    </p>
                )}
            </div>

            {/* ── How Auctions Work ─────────────────────────────────────────── */}
            <div className="container mx-auto px-6 pt-20 max-w-4xl">
                <div className="text-center mb-10">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">How It Works</p>
                    <h2 className="text-2xl font-bold text-white">Bid. Win. Connect.</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        {
                            icon: Gavel,
                            step: "01",
                            title: "Place a Bid",
                            desc: "Bid above the current highest in minimum increment steps. Every bid is real-time.",
                        },
                        {
                            icon: Zap,
                            step: "02",
                            title: "Anti-Snipe Rule",
                            desc: "Any bid in the final 3 minutes extends the auction by 3 minutes — no last-second grabs.",
                        },
                        {
                            icon: TrendingUp,
                            step: "03",
                            title: "Win & Connect",
                            desc: "Highest bid above reserve wins. A chat with the seller is auto-created to arrange collection.",
                        },
                    ].map(({ icon: Icon, step, title, desc }) => (
                        <div key={step} className="relative bg-slate-900/60 border border-white/5 rounded-2xl p-5 hover:border-red-500/20 transition-all group">
                            <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
                                    <Icon size={18} className="text-red-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-600 tracking-widest mb-1">{step}</p>
                                    <h3 className="text-white font-bold mb-1">{title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
