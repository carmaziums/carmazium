"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, Flame, Calendar, Zap, Users, Search, RefreshCw,
    Clock, Shield, MessageSquare, Trophy, CheckCircle,
    ChevronRight, Timer, Gauge, Fuel, Car, MapPin,
    BadgeCheck, ShieldCheck, Star, Truck,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { CardImageCarousel } from "@/components/features/CardImageCarousel"
import { WishlistButton } from "@/components/features/WishlistButton"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { BODY_TYPE_LABELS, FUEL_TYPE_LABELS } from "@/lib/vehicleLabels"
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
    const l = auction.listing
    const hasSpecs = l.year || l.mileage != null || l.fuelType || l.bodyType || l.location || l.deliveryAvailable
    const grade = auction.listing.exteriorGrade
    const gradeStyle: { dot: string; text: string; border: string; bg: string; label: string } | null =
        grade === 1 ? { dot: 'bg-emerald-500', text: 'text-emerald-300', border: 'border-emerald-500/40', bg: 'bg-emerald-500/15', label: 'Excellent — minimal/no wear' } :
        grade === 2 ? { dot: 'bg-lime-500',    text: 'text-lime-300',    border: 'border-lime-500/40',    bg: 'bg-lime-500/15',    label: 'Very good — light wear' } :
        grade === 3 ? { dot: 'bg-amber-500',   text: 'text-amber-300',   border: 'border-amber-500/40',   bg: 'bg-amber-500/15',   label: 'Good — moderate damage' } :
        grade === 4 ? { dot: 'bg-orange-500',  text: 'text-orange-300',  border: 'border-orange-500/40',  bg: 'bg-orange-500/15',  label: 'Fair — noticeable damage' } :
        grade === 5 ? { dot: 'bg-red-500',     text: 'text-red-300',     border: 'border-red-500/40',     bg: 'bg-red-500/15',     label: 'Poor — heavy damage' } :
        null

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.4 }}
        >
            <Link
                href={`/auctions/live/${auction.id}`}
                className="group block bg-[var(--bg-card)] rounded-2xl overflow-hidden border border-[var(--border-default)] hover:border-red-500/30 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(220,38,38,0.12)] hover:-translate-y-1"
            >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                    {auction.listing.images && auction.listing.images.length > 1 ? (
                        <CardImageCarousel
                            images={auction.listing.images}
                            alt={auction.listing.title}
                            sizes="(max-width: 768px) 100vw, 33vw"
                            imageClassName="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <Image
                            src={image}
                            alt={auction.listing.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent pointer-events-none z-10" />

                    {/* Featured Badge — matches Buy Cars card treatment */}
                    {auction.listing.isFeatured && <FeaturedBadge />}

                    {/* Status badge + trust badges stack */}
                    <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
                        <div className="flex items-center gap-2">
                            {isActive ? (
                                <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-[var(--border-default)]">
                                    <Clock size={9} /> {formatStartsIn(auction.startTime)}
                                </span>
                            )}
                            {antiSnipe && (
                                <span className="flex items-center gap-1 bg-amber-500/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                    <Zap size={8} /> SNIPE
                                </span>
                            )}
                        </div>
                        {(l.badgeTier === 'STANDARD' || l.badgeTier === 'PREMIUM') && (
                            <div className="flex flex-col gap-1.5 drop-shadow-md">
                                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md text-emerald-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-emerald-500/30">
                                    <ShieldCheck size={12} className="text-emerald-500" /> Verified
                                </div>
                                <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md text-blue-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-blue-500/30">
                                    <BadgeCheck size={12} className="text-blue-500" /> VIN Report
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Top-right stack: wishlist, bid count, grade */}
                    <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
                        <WishlistButton listingId={auction.listing.id} />
                        <div className="flex items-center gap-1 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full border border-[var(--border-default)] text-white text-[10px] font-bold">
                            <Users size={10} className="text-slate-400" /> {bidCount}
                        </div>
                        {gradeStyle && (
                            <span
                                title={gradeStyle.label}
                                className={`inline-flex items-center gap-1.5 backdrop-blur ${gradeStyle.bg} ${gradeStyle.text} border ${gradeStyle.border} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${gradeStyle.dot}`} />
                                Grade {grade}
                            </span>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="px-4 pt-3 pb-4">
                    {/* Vehicle label — moved out of the image so it can't collide with the carousel counter */}
                    <div className="mb-3">
                        <p className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-bold mb-0.5">{vehicle}</p>
                        <h3 className="text-[var(--text-primary)] font-bold text-base leading-tight line-clamp-1">{auction.listing.title}</h3>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
                                {bidCount > 0 ? "Current Bid" : "Starting Bid"}
                            </p>
                            <p className="text-2xl font-black text-[var(--text-primary)] font-mono mt-0.5">
                                £{currentBid.toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right">
                            {isActive ? (
                                <>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Ends In</p>
                                    <div className="text-red-400 font-mono font-bold text-sm mt-0.5">
                                        <CountdownTimer targetDate={new Date(auction.endTime)} minimal />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Starts In</p>
                                    <p className="text-[var(--text-secondary)] font-mono font-bold text-sm mt-0.5">{formatStartsIn(auction.startTime)}</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Badge Tier Label — mirrors the Buy Cars card treatment */}
                    {l.badgeTier && l.badgeTier !== 'FREE' && (
                        <div className="flex items-center gap-2 mb-2">
                            {l.badgeTier === 'PREMIUM' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                    <Star size={10} className="fill-amber-400" /> Premium
                                </span>
                            )}
                            {l.badgeTier === 'STANDARD' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                    <ShieldCheck size={10} /> Standard
                                </span>
                            )}
                        </div>
                    )}

                    {/* Estate chip — mirrors the Buy Cars card treatment */}
                    {l.isDepartedSale && (
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-slate-500/10 dark:bg-[var(--bg-card)] text-slate-600 dark:text-[var(--text-muted)] border border-slate-500/20 dark:border-[var(--border-default)] px-2 py-0.5 rounded-full">
                                Estate
                            </span>
                        </div>
                    )}

                    {/* Specs Tags — mirrors the Buy Cars card treatment */}
                    {hasSpecs && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {l.year && (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                    <Calendar size={10} /> {l.year}
                                </span>
                            )}
                            {l.mileage != null && (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                    <Gauge size={10} /> {l.mileage.toLocaleString()} mi
                                </span>
                            )}
                            {l.fuelType && FUEL_TYPE_LABELS[l.fuelType] && (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                    <Fuel size={10} /> {FUEL_TYPE_LABELS[l.fuelType]}
                                </span>
                            )}
                            {l.bodyType && BODY_TYPE_LABELS[l.bodyType] && (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                    <Car size={10} /> {BODY_TYPE_LABELS[l.bodyType]}
                                </span>
                            )}
                            {l.location && (
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                    <MapPin size={10} /> {l.location.split(',')[0].trim()}
                                </span>
                            )}
                            {l.deliveryAvailable && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    <Truck size={11} /> Delivery
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
                        {auction.buyItNowPrice ? (
                            <span className="text-[10px] text-[var(--text-muted)]">Buy it now: £{Number(auction.buyItNowPrice).toLocaleString()}</span>
                        ) : (
                            <span />
                        )}
                        <span className={`flex items-center gap-1 text-xs font-bold transition-colors ${isActive ? "text-primary group-hover:text-red-400" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`}>
                            {isActive ? "Bid Now" : "View"} <ChevronRight size={12} />
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
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden animate-pulse">
            <div className="h-52 bg-[var(--bg-input)]" />
            <div className="p-4 space-y-3">
                <div className="h-3 bg-[var(--bg-input)] rounded w-1/3" />
                <div className="h-6 bg-[var(--bg-input)] rounded w-1/2" />
                <div className="h-px bg-[var(--bg-card)]" />
                <div className="flex justify-between">
                    <div className="h-3 bg-[var(--bg-input)] rounded w-1/4" />
                    <div className="h-3 bg-[var(--bg-input)] rounded w-1/5" />
                </div>
            </div>
        </div>
    )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: "live" | "upcoming" }) {
    return (
        <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center mb-4 shadow-lg">
                {tab === "live" ? <Flame size={24} className="text-[var(--text-muted)]" /> : <Calendar size={24} className="text-[var(--text-muted)]" />}
            </div>
            <p className="text-[var(--text-secondary)] font-bold text-sm">
                {tab === "live" ? "No live auctions right now" : "No upcoming auctions"}
            </p>
            <p className="text-[var(--text-muted)] text-xs mt-1.5 max-w-xs leading-relaxed">
                {tab === "live"
                    ? "Auctions go live automatically at their scheduled time. Check back soon."
                    : "New auctions are added regularly — check back to catch the next one."}
            </p>
            <Link href="/sell" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-red-400 transition-colors">
                List your car for auction <ChevronRight size={13} />
            </Link>
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
        <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden text-white" style={{ marginTop: '-80px', paddingTop: '80px' }}>
                {/* Hero image */}
                <Image
                    src="/assets/images/live-auction-hero.jpg"
                    alt="Live car auction"
                    fill
                    priority
                    className="object-cover object-center"
                />
                {/* Overlays keep text readable: a lighter left-anchored scrim in light mode (so the photo still shows through on the right), a fuller dark wash in dark mode */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent dark:bg-gradient-to-b dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top_left,rgba(237,28,36,0.18)_0%,transparent_55%)]" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.85)_0%,transparent_60%)]" />

                <div className="container mx-auto px-6 py-20 md:py-28 relative z-10">
                    <div className="max-w-4xl">
                        {/* Live pill */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2.5 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6"
                        >
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                                {liveAuctions.length > 0 ? `${liveAuctions.length} Auction${liveAuctions.length !== 1 ? "s" : ""} Live Now` : "Carmazium Live Auctions"}
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, duration: 0.6 }}
                            className="text-5xl md:text-7xl font-black font-heading tracking-tight leading-[0.92] mb-5"
                        >
                            The Gavel<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-700">
                                Drops Here.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 }}
                            className="text-slate-400 text-lg max-w-lg leading-relaxed mb-8"
                        >
                            Real-time bidding on verified vehicles. Compete live, win fairly, connect with sellers instantly.
                        </motion.p>

                        {/* Stats row */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex flex-wrap items-center gap-x-8 gap-y-3"
                        >
                            {[
                                { icon: Flame, label: `${liveAuctions.length} Live`, color: "text-red-400" },
                                { icon: Calendar, label: `${scheduledAuctions.length} Upcoming`, color: "text-slate-400" },
                                { icon: Timer, label: "6-Hour Sprints", color: "text-slate-400" },
                                { icon: Zap, label: "Anti-Snipe Rule", color: "text-amber-400" },
                                { icon: CheckCircle, label: "Free to List", color: "text-emerald-400" },
                            ].map(({ icon: Icon, label, color }) => (
                                <div key={label} className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                                    <Icon size={13} /> {label}
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </section>

            {/* ── Filter bar ───────────────────────────────────────────────── */}
            <div className="sticky top-[80px] z-30 backdrop-blur-xl border-b" style={{ background: 'var(--bg-header)', borderColor: 'var(--border-default)' }}>
                <div className="container mx-auto px-4 md:px-6 py-3 md:py-0 md:h-14 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-1 self-start md:self-auto">
                        {(["live", "upcoming"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-3 md:px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                    activeTab === tab ? "text-primary" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                                }`}
                            >
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="tab-bg"
                                        className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-lg"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-1.5 md:gap-2">
                                    {tab === "live" ? <Flame size={11} className={activeTab === tab ? "text-red-400" : ""} /> : <Calendar size={11} />}
                                    {tab}
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab ? "bg-primary/30 text-red-300" : "bg-[var(--bg-card)] text-[var(--text-muted)]"}`}>
                                        {tab === "live" ? liveAuctions.length : scheduledAuctions.length}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search + refresh — full width on mobile, capped on md+ */}
                    <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 md:max-w-xs">
                        <div className="relative flex-1 min-w-0">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search make, model…"
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl pl-9 pr-3 py-1.5 text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-primary/40 transition-colors"
                            />
                        </div>
                        <button
                            onClick={load}
                            disabled={loading}
                            className="shrink-0 p-2 rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] hover:text-primary dark:hover:text-white hover:border-primary/30 transition-all"
                            title="Refresh"
                        >
                            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Auction Grid ──────────────────────────────────────────────── */}
            <div className="container mx-auto px-6 py-10">
                {error && (
                    <div className="text-center py-16 space-y-3">
                        <p className="text-red-400 text-sm">{error}</p>
                        <button onClick={load} className="text-primary underline text-xs">Try again</button>
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
                    <p className="text-center text-[var(--text-muted)] text-[10px] mt-8 font-mono">
                        Updated {new Date(lastRefresh).toLocaleTimeString("en-GB")}
                    </p>
                )}
            </div>

            {/* ── How It Works ─────────────────────────────────────────────── */}
            <section className="border-t border-[var(--border-default)] bg-[var(--bg-card)] mt-8">
                <div className="container mx-auto px-6 py-20">
                    <div className="text-center mb-12">
                        <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">How It Works</p>
                        <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] font-heading">Bid. Win. Connect.</h2>
                        <p className="text-[var(--text-muted)] text-sm mt-3 max-w-md mx-auto">Three simple steps from browsing to owning your next car.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
                        {[
                            { icon: Gavel, step: "01", title: "Place a Bid", desc: "Outbid the current leader in minimum increment steps. Every bid is broadcast live to all watchers in real time.", color: "red" as const },
                            { icon: Zap, step: "02", title: "Anti-Snipe Rule", desc: "Any bid in the final 3 minutes automatically extends the auction by 3 minutes — no last-second sniping.", color: "amber" as const },
                            { icon: MessageSquare, step: "03", title: "Win & Connect", desc: "Highest bid above reserve wins. A private chat with the seller opens instantly to arrange the deal.", color: "emerald" as const },
                        ].map(({ icon: Icon, step, title, desc, color }) => {
                            const styles = {
                                red: "bg-red-500/10 border-red-500/20 text-primary",
                                amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                                emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            }
                            return (
                                <div key={step} className="group bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-6 hover:border-[var(--border-default)] transition-all hover:bg-[var(--bg-input)]">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${styles[color]}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-[var(--text-muted)] tracking-widest mb-1">{step}</p>
                                            <h3 className="text-[var(--text-primary)] font-bold mb-2">{title}</h3>
                                            <p className="text-[var(--text-muted)] text-sm leading-relaxed">{desc}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Trust pills */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
                        {[
                            { icon: Shield, title: "Reserve Protection", desc: "Set the minimum you'll accept. No obligation if reserve isn't met.", color: "text-blue-400" },
                            { icon: Trophy, title: "Exclusive Vehicles", desc: "Access rare and sought-after cars that rarely appear in standard listings.", color: "text-amber-400" },
                            { icon: Users, title: "Live Audience", desc: "Real-time watcher counts show genuine demand as it happens.", color: "text-primary" },
                        ].map(({ icon: Icon, title, desc, color }) => (
                            <div key={title} className="flex gap-4 p-5 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl hover:border-[var(--border-default)] transition-all">
                                <div className={`w-10 h-10 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center shrink-0 ${color}`}>
                                    <Icon size={17} />
                                </div>
                                <div>
                                    <p className="text-[var(--text-primary)] font-bold text-sm mb-1">{title}</p>
                                    <p className="text-[var(--text-muted)] text-xs leading-relaxed">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CTA banner */}
                    <div className="relative rounded-3xl overflow-hidden border border-[var(--border-default)] p-10 md:p-14 text-center bg-[var(--bg-card)] shadow-2xl">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(237,28,36,0.1)_0%,transparent_55%)]" />
                        <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
                        <div className="relative z-10">
                            <p className="text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-3">Ready to sell?</p>
                            <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] font-heading mb-3">
                                Put your car under the gavel
                            </h2>
                            <p className="text-[var(--text-muted)] text-sm max-w-md mx-auto mb-6 leading-relaxed">
                                Free to list. 6-hour sprint. Set your reserve, schedule your time, and let buyers compete for your car.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
                                {["Free to list", "Set your reserve", "Anti-snipe protection", "Auto-connect with winner"].map(f => (
                                    <span key={f} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border-default)] px-3 py-1.5 rounded-full">
                                        <CheckCircle size={11} className="text-emerald-500" /> {f}
                                    </span>
                                ))}
                            </div>
                            <Link href="/sell">
                                <button className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-red-700 hover:from-red-500 hover:to-primary text-white font-black text-sm px-8 py-3.5 rounded-full transition-all hover:shadow-[0_0_30px_rgba(237,28,36,0.4)] uppercase tracking-wider shadow-neon">
                                    List for Auction <Gavel size={16} />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
