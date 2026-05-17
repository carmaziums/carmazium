"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, Flame, Calendar, ArrowRight, Zap, Users, TrendingUp,
    Search, RefreshCw, Clock, Shield, MessageSquare, Trophy,
    CheckCircle, ChevronRight, Timer,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import {
    getActiveAuctions, getScheduledAuctions, getCurrentBid,
    getBidCount, isAntiSnipeActive, type Auction,
} from "@/lib/auctionApi"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStartsIn(startTime: string): string {
    const diff = new Date(startTime).getTime() - Date.now()
    if (diff <= 0) return "Starting…"
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

// ─── Auction Card ─────────────────────────────────────────────────────────────

function AuctionCard({ auction, index }: { auction: Auction; index: number }) {
    const currentBid = getCurrentBid(auction)
    const bidCount = getBidCount(auction)
    const antiSnipe = isAntiSnipeActive(auction)
    const isActive = auction.status === "ACTIVE"
    const image = auction.listing.images?.[0] ?? "/assets/images/hero-bg.png"
    const vehicle = `${auction.listing.year ?? ""} ${auction.listing.make ?? ""} ${auction.listing.model ?? ""}`.trim()

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
            className="group"
        >
            <Link
                href={`/auctions/live/${auction.id}`}
                className="block bg-[#0d0d0f] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
            >
                {/* Image */}
                <div className="relative h-56 overflow-hidden">
                    <Image
                        src={image}
                        alt={auction.listing.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0f] via-[#0d0d0f]/30 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                        {isActive ? (
                            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider shadow-[0_0_16px_rgba(220,38,38,0.6)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10">
                                <Clock size={9} /> {formatStartsIn(auction.startTime)}
                            </span>
                        )}
                        {antiSnipe && (
                            <span className="flex items-center gap-1 bg-amber-500/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                <Zap size={8} /> SNIPE
                            </span>
                        )}
                    </div>

                    {/* Bid count top-right */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full border border-white/10 text-white text-[10px] font-bold">
                        <Users size={10} className="text-slate-400" /> {bidCount}
                    </div>

                    {/* Bottom overlay — price prominent */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                        <p className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mb-0.5">{vehicle}</p>
                        <h3 className="text-white font-bold text-base leading-tight line-clamp-1">{auction.listing.title}</h3>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 pt-3 pb-4 space-y-3">
                    {/* Bid row */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                                {bidCount > 0 ? "Current Bid" : "Starting Bid"}
                            </p>
                            <p className="text-xl font-black text-white font-mono mt-0.5">
                                £{currentBid.toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right">
                            {isActive ? (
                                <>
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Ends In</p>
                                    <div className="text-red-400 font-mono font-bold text-sm mt-0.5">
                                        <CountdownTimer targetDate={new Date(auction.endTime)} minimal />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Starts In</p>
                                    <p className="text-slate-300 font-mono font-bold text-sm mt-0.5">{formatStartsIn(auction.startTime)}</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Divider + CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <span className="text-[10px] text-slate-600">Reserve: £{Number(auction.reservePrice).toLocaleString()}</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-red-500 group-hover:text-red-400 transition-colors">
                            {isActive ? "Bid Now" : "View"} <ChevronRight size={13} />
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
    return (
        <div className="bg-[#0d0d0f] border border-white/[0.07] rounded-2xl overflow-hidden animate-pulse">
            <div className="h-56 bg-white/[0.04]" />
            <div className="p-4 space-y-3">
                <div className="h-3 bg-white/[0.04] rounded w-1/3" />
                <div className="h-5 bg-white/[0.04] rounded w-2/3" />
                <div className="h-px bg-white/[0.04]" />
                <div className="flex justify-between">
                    <div className="h-4 bg-white/[0.04] rounded w-1/4" />
                    <div className="h-4 bg-white/[0.04] rounded w-1/4" />
                </div>
            </div>
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: "live" | "upcoming" }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                {tab === "live" ? <Flame size={22} className="text-slate-600" /> : <Calendar size={22} className="text-slate-600" />}
            </div>
            <p className="text-slate-400 font-bold text-sm">
                {tab === "live" ? "No live auctions right now" : "No upcoming auctions"}
            </p>
            <p className="text-slate-700 text-xs mt-1 max-w-xs">
                {tab === "live"
                    ? "Auctions go live automatically at their scheduled time. Check back soon."
                    : "New auctions are added regularly."}
            </p>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
            setError("Failed to load auctions.")
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
        <div className="bg-[#080809] min-h-screen text-white">

            {/* ── Hero ──────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden pt-20">
                {/* Subtle background texture */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.08)_0%,transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(30,30,40,0.8)_0%,transparent_60%)]" />

                <div className="container mx-auto px-6 py-16 md:py-24 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-3xl"
                    >
                        {/* Status pill */}
                        <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] rounded-full px-4 py-1.5 mb-6">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                {liveAuctions.length > 0 ? `${liveAuctions.length} Active Now` : "Live Auctions"}
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black font-heading tracking-tight text-white leading-[0.95] mb-5">
                            The Gavel<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-700">
                                Drops Here.
                            </span>
                        </h1>
                        <p className="text-slate-400 text-lg max-w-lg leading-relaxed mb-8">
                            Real-time bidding on verified vehicles. Compete live, win fairly, connect instantly.
                        </p>

                        {/* Stat chips */}
                        <div className="flex flex-wrap items-center gap-3">
                            {[
                                { icon: Flame, value: `${liveAuctions.length} Live`, color: "text-red-400" },
                                { icon: Calendar, value: `${scheduledAuctions.length} Upcoming`, color: "text-slate-400" },
                                { icon: Timer, value: "6hr Duration", color: "text-slate-400" },
                                { icon: Zap, value: "Anti-Snipe", color: "text-amber-400" },
                            ].map(({ icon: Icon, value, color }) => (
                                <div key={value} className={`flex items-center gap-1.5 text-sm font-bold ${color}`}>
                                    <Icon size={13} /> {value}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Bottom fade */}
                <div className="h-px bg-white/[0.06]" />
            </div>

            {/* ── Filter bar ────────────────────────────────────────────────── */}
            <div className="sticky top-[80px] z-30 bg-[#080809]/90 backdrop-blur-xl border-b border-white/[0.06]">
                <div className="container mx-auto px-6 h-14 flex items-center justify-between gap-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-0 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
                        {(["live", "upcoming"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                    activeTab === tab ? "text-white" : "text-slate-600 hover:text-slate-400"
                                }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="tab-bg"
                                        className="absolute inset-0 bg-white/[0.08] rounded-lg"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {tab === "live" ? <Flame size={11} /> : <Calendar size={11} />}
                                    {tab}
                                    <span className="bg-white/[0.08] text-slate-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                        {tab === "live" ? liveAuctions.length : scheduledAuctions.length}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search + refresh */}
                    <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <div className="relative flex-1">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search…"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                            />
                        </div>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="p-2 rounded-xl border border-white/[0.08] text-slate-600 hover:text-white hover:border-white/20 transition-all"
                        >
                            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Grid ──────────────────────────────────────────────────────── */}
            <div className="container mx-auto px-6 py-10">
                {error && (
                    <div className="text-center py-16">
                        <p className="text-red-400 text-sm mb-3">{error}</p>
                        <button onClick={load} className="text-red-500 underline text-xs">Try again</button>
                    </div>
                )}

                {loading && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                    </div>
                )}

                {!loading && !error && (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                        >
                            {displayed.length === 0 ? (
                                <EmptyState tab={activeTab} />
                            ) : (
                                displayed.map((auction, i) => (
                                    <AuctionCard key={auction.id} auction={auction} index={i} />
                                ))
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}

                {!loading && (
                    <p className="text-center text-slate-800 text-[10px] mt-10 font-mono">
                        Updated {new Date(lastRefresh).toLocaleTimeString("en-GB")}
                    </p>
                )}
            </div>

            {/* ── How it works ──────────────────────────────────────────────── */}
            <div className="border-t border-white/[0.06] mt-8">
                <div className="container mx-auto px-6 py-20">
                    <div className="text-center mb-12">
                        <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.2em] mb-3">How It Works</p>
                        <h2 className="text-3xl md:text-4xl font-black text-white font-heading">Bid. Win. Connect.</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
                        {[
                            { icon: Gavel, step: "01", title: "Place a Bid", desc: "Outbid the current leader in minimum increment steps. Every bid is broadcast live to all watchers.", color: "red" },
                            { icon: Zap, step: "02", title: "Anti-Snipe Rule", desc: "Any bid in the final 3 minutes automatically extends the auction by 3 minutes — no last-second grabs.", color: "amber" },
                            { icon: MessageSquare, step: "03", title: "Win & Connect", desc: "Highest bid above reserve wins. A private chat with the seller is created instantly to arrange the deal.", color: "emerald" },
                        ].map(({ icon: Icon, step, title, desc, color }) => {
                            const c: Record<string, string> = {
                                red: "bg-red-500/10 border-red-500/20 text-red-500",
                                amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            }
                            return (
                                <div key={step} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-white/[0.12] transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${c[color]}`}>
                                            <Icon size={17} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-700 tracking-widest mb-1">{step}</p>
                                            <h3 className="text-white font-bold mb-1.5 text-sm">{title}</h3>
                                            <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Feature pills */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
                        {[
                            { icon: Shield, title: "Reserve Protection", desc: "Set the minimum you'll accept. No obligation if reserve isn't met.", color: "text-blue-400" },
                            { icon: Trophy, title: "Premium Vehicles", desc: "Access rare and sought-after cars that rarely hit standard listings.", color: "text-amber-400" },
                            { icon: Users, title: "Live Audience", desc: "Real-time watcher counts show genuine demand as it happens.", color: "text-red-400" },
                        ].map(({ icon: Icon, title, desc, color }) => (
                            <div key={title} className="flex gap-4 p-5 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                                <Icon size={18} className={`${color} shrink-0 mt-0.5`} />
                                <div>
                                    <p className="text-white font-bold text-sm mb-1">{title}</p>
                                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10 md:p-14 text-center overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.06)_0%,transparent_60%)]" />
                        <div className="relative z-10">
                            <h2 className="text-2xl md:text-3xl font-black text-white font-heading mb-3">
                                Ready to put your car under the gavel?
                            </h2>
                            <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                Free to list. 6-hour sprint. Set your reserve, schedule your time, and let buyers compete.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
                                {["Free to list", "Set your own reserve", "Anti-snipe protection", "Auto-connect with winner"].map(f => (
                                    <span key={f} className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-full">
                                        <CheckCircle size={11} className="text-emerald-500" /> {f}
                                    </span>
                                ))}
                            </div>
                            <Link href="/sell">
                                <button className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black text-sm px-8 py-3.5 rounded-full transition-all hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] uppercase tracking-wider">
                                    List for Auction <Gavel size={16} />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
