"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, Flame, Calendar, Zap, Users, Search, RefreshCw,
    Clock, Trophy, CheckCircle,
    ChevronRight, Timer, Gauge, Fuel, Car, MapPin,
    BadgeCheck, ShieldCheck, Star, Truck,
    ArrowRight, ChevronDown, FileText, Lock, Handshake, Banknote,
    Eye, TrendingUp, CreditCard, Box, Filter,
} from "lucide-react"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { CardImageCarousel } from "@/components/features/CardImageCarousel"
import { WishlistButton } from "@/components/features/WishlistButton"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { Button } from "@/components/ui/Button"
import { BODY_TYPE_LABELS, FUEL_TYPE_LABELS } from "@/lib/vehicleLabels"
import {
    getActiveAuctions, getScheduledAuctions, getCurrentBid,
    getBidCount, isAntiSnipeActive, type Auction,
} from "@/lib/auctionApi"

// ─── Filters ──────────────────────────────────────────────────────────────────

type SortOption = "ending_soon" | "newest" | "price_low" | "price_high"

const SORT_LABELS: Record<SortOption, string> = {
    ending_soon: "Ending Soonest",
    newest: "Newest Listed",
    price_low: "Price: Low to High",
    price_high: "Price: High to Low",
}

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

// ─── How It Works content (moved from the standalone /auctions/how-it-works page,
// which now just redirects here — approved copy, do not paraphrase) ───────────

const SELLER_STEPS = [
    {
        icon: FileText,
        title: "List for free.",
        desc: "Add your car's details (DVLA-assisted), photos, and mark any known damage — Carmazium automatically grades your vehicle's condition from what you report, so there's nothing to fill in manually.",
    },
    {
        icon: Lock,
        title: "Set your reserve.",
        desc: "This is the minimum you're willing to accept. It's never shown to bidders — only you know it.",
    },
    {
        icon: Clock,
        title: "Go live for 24 hours.",
        desc: "Your auction runs for a full 24-hour window, with real-time bidding from verified trade dealers.",
    },
    {
        icon: Zap,
        title: "Anti-snipe protection.",
        desc: "Any bid placed in the final 3 minutes automatically extends the auction by 3 more minutes — so a last-second bid can't end things before you've had a fair chance to respond.",
    },
    {
        icon: Gavel,
        title: "Auction ends.",
        desc: "If your reserve is met, you're automatically connected with the winning bidder through an in-app chat.",
    },
    {
        icon: Handshake,
        title: "Arrange handover.",
        desc: "Agree the final details and handover directly with the buyer, then submit proof once it's done.",
    },
    {
        icon: Banknote,
        title: "Get paid — plus £100.",
        desc: "Once your handover proof is approved, Carmazium pays your £100 seller bonus directly to your account.",
    },
]

const BUYER_STEPS = [
    {
        icon: ShieldCheck,
        title: "Get verified.",
        desc: "Apply for a Dealer account and complete our KYC check.",
    },
    {
        icon: Search,
        title: "Browse live and upcoming auctions.",
        desc: "Filter by make, model, condition grade, and more.",
    },
    {
        icon: Eye,
        title: "Check the vehicle.",
        desc: "Every listing has a 3D condition viewer showing any seller-reported damage, an automatic 1–5 grade, and DVLA/MOT history.",
    },
    {
        icon: TrendingUp,
        title: "Bid in real time,",
        desc: "or use Buy It Now if the seller has set one for an instant win.",
    },
    {
        icon: Trophy,
        title: "Win the auction.",
        desc: "Highest bid wins, provided the seller's reserve is met.",
    },
    {
        icon: CreditCard,
        title: "Pay the £125 buyer fee.",
        desc: "A one-off £125 fee unlocks direct in-app chat with the seller so you can arrange handover — this is Carmazium's fee for the connection, not part of the vehicle price.",
    },
    {
        icon: Users,
        title: "Complete the purchase",
        desc: "directly with the seller.",
    },
]

const RULES = [
    { icon: Clock, term: "24-Hour Auctions", def: "Every live auction runs for exactly 24 hours." },
    { icon: Zap, term: "Anti-Snipe Rule", def: "A bid in the last 3 minutes extends the auction by 3 minutes — repeats until bidding settles." },
    { icon: Lock, term: "Reserve Price", def: "Set privately by the seller. If it isn't met, there's no sale and nothing is owed by anyone." },
    { icon: Trophy, term: "Buy It Now", def: "Optional — sellers can set an instant-buy price. Buyers can request it; the seller has 24 hours to confirm or decline." },
    { icon: FileText, term: "Free to List", def: "Listing a car for auction costs nothing." },
    { icon: Banknote, term: "£100 Seller Bonus", def: "Paid once Carmazium approves your submitted handover proof." },
    { icon: CreditCard, term: "£125 Buyer Fee", def: "Charged only when you win an auction — unlocks direct chat with the seller to arrange handover." },
    { icon: ShieldCheck, term: "Verified Bidders Only", def: "Every bidder is a KYC-verified trade dealer." },
]

const TRUST = [
    { icon: Gauge, title: "Automatic condition grading (1–5)", desc: "Computed from the damage you report, not self-selected." },
    { icon: Box, title: "3D Condition & Damage viewer", desc: "Included on every listing, so buyers can inspect before bidding." },
    { icon: BadgeCheck, title: "DVLA-verified history", desc: "MOT, tax, and registration status pulled directly from official records." },
]

const FAQS = [
    {
        q: "Do I need to be a dealer to bid?",
        a: "Yes — bidding is limited to verified dealer accounts. Anyone can list and sell a car, though.",
    },
    {
        q: "What happens if my reserve isn't met?",
        a: "No sale happens, no fees are charged, and you're free to relist.",
    },
    {
        q: "When do I actually get my £100?",
        a: "After you submit proof of handover and Carmazium's team approves it.",
    },
    {
        q: "What's the £125 buyer fee for?",
        a: "It's charged once you win an auction, and it's what unlocks direct in-app chat with the seller so you can arrange handover. It's a connection fee, not part of the price you pay for the car — that's negotiated and settled directly with the seller.",
    },
    {
        q: "Does Carmazium handle payment for the car itself?",
        a: "No. The vehicle sale is agreed and completed directly between you and the buyer — Carmazium isn't a party to that payment. Carmazium's role covers the auction, verification, the seller bonus, and the buyer connection fee.",
    },
]

function StepTimeline({ steps }: { steps: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; desc: string }[] }) {
    return (
        <ol className="relative">
            {steps.map((step, i) => (
                <li key={step.title} className="relative pl-16 pb-8 last:pb-0">
                    {i < steps.length - 1 && (
                        <span className="absolute left-[21px] top-11 bottom-0 w-px bg-gradient-to-b from-primary/40 via-[var(--border-default)] to-transparent" aria-hidden />
                    )}
                    <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white font-black text-sm tabular-nums shadow-[0_4px_14px_rgba(237,28,36,0.3)]">
                        {i + 1}
                    </span>
                    <div className="flex items-center gap-2 mb-1">
                        <step.icon size={14} className="text-primary shrink-0" />
                        <h4 className="font-heading font-bold text-[15px]">{step.title}</h4>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-lg">{step.desc}</p>
                </li>
            ))}
        </ol>
    )
}

function FaqItem({ q, a }: { q: string; a: string }) {
    return (
        <details className="group border border-[var(--border-default)] rounded-xl overflow-hidden bg-[var(--bg-input)]">
            <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none hover:bg-primary/5 dark:hover:bg-white/5 transition-colors">
                <span className="font-semibold text-sm">{q}</span>
                <ChevronDown size={18} className="text-[var(--text-muted)] shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-5 text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-default)] pt-4">
                {a}
            </div>
        </details>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuctionsPage() {
    const [activeTab, setActiveTab] = React.useState<"live" | "upcoming">("live")
    const [track, setTrack] = React.useState<"seller" | "buyer">("seller")
    const [liveAuctions, setLiveAuctions] = React.useState<Auction[]>([])
    const [scheduledAuctions, setScheduledAuctions] = React.useState<Auction[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [lastRefresh, setLastRefresh] = React.useState(Date.now())

    // Filters
    const [showFilters, setShowFilters] = React.useState(false)
    const [makeFilter, setMakeFilter] = React.useState("")
    const [bodyTypeFilter, setBodyTypeFilter] = React.useState("")
    const [fuelTypeFilter, setFuelTypeFilter] = React.useState("")
    const [minPrice, setMinPrice] = React.useState("")
    const [maxPrice, setMaxPrice] = React.useState("")
    const [sortBy, setSortBy] = React.useState<SortOption>("ending_soon")

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

    const sourceAuctions = activeTab === "live" ? liveAuctions : scheduledAuctions

    // Distinct make list, sorted, for the filter dropdown — pulled from whichever
    // tab is active so options never show a make with zero results in this tab.
    const availableMakes = React.useMemo(() => {
        const makes = new Set<string>()
        sourceAuctions.forEach(a => { if (a.listing.make) makes.add(a.listing.make) })
        return Array.from(makes).sort()
    }, [sourceAuctions])

    const activeFilterCount = [makeFilter, bodyTypeFilter, fuelTypeFilter, minPrice, maxPrice].filter(Boolean).length

    function clearFilters() {
        setMakeFilter("")
        setBodyTypeFilter("")
        setFuelTypeFilter("")
        setMinPrice("")
        setMaxPrice("")
    }

    const displayed = sourceAuctions
        .filter(a => {
            if (search) {
                const q = search.toLowerCase()
                const matchesSearch =
                    a.listing.title.toLowerCase().includes(q) ||
                    (a.listing.make ?? "").toLowerCase().includes(q) ||
                    (a.listing.model ?? "").toLowerCase().includes(q)
                if (!matchesSearch) return false
            }
            if (makeFilter && a.listing.make !== makeFilter) return false
            if (bodyTypeFilter && a.listing.bodyType !== bodyTypeFilter) return false
            if (fuelTypeFilter && a.listing.fuelType !== fuelTypeFilter) return false
            const price = getCurrentBid(a)
            if (minPrice && price < Number(minPrice)) return false
            if (maxPrice && price > Number(maxPrice)) return false
            return true
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "price_low": return getCurrentBid(a) - getCurrentBid(b)
                case "price_high": return getCurrentBid(b) - getCurrentBid(a)
                case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                case "ending_soon":
                default:
                    return new Date(a.endTime).getTime() - new Date(b.endTime).getTime()
            }
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
                            transition={{ delay: 0.24 }}
                            className="flex flex-wrap items-center gap-x-8 gap-y-3"
                        >
                            {[
                                { icon: Flame, label: `${liveAuctions.length} Live`, color: "text-red-400" },
                                { icon: Calendar, label: `${scheduledAuctions.length} Upcoming`, color: "text-slate-400" },
                                { icon: Timer, label: "24-Hour Auctions", color: "text-slate-400" },
                                { icon: Zap, label: "Anti-Snipe Rule", color: "text-amber-400" },
                                { icon: CheckCircle, label: "Free to List", color: "text-emerald-400" },
                            ].map(({ icon: Icon, label, color }) => (
                                <div key={label} className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}>
                                    <Icon size={13} /> {label}
                                </div>
                            ))}
                        </motion.div>

                        {/* List Your Car CTA — moved up from the page-bottom closing card so it's
                            visible without scrolling past the whole How It Works section */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.32 }}
                            className="mt-8"
                        >
                            <Link href="/sell" className="inline-block w-full sm:w-auto">
                                <Button size="lg" shape="pill" className="w-full sm:w-auto px-6 sm:px-10 text-sm sm:text-lg shadow-neon group">
                                    List Your Car for Auction
                                    <ArrowRight className="ml-2 w-4 h-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
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

                    {/* Search + filters toggle + refresh — full width on mobile, capped on md+ */}
                    <div className="flex items-center gap-2 w-full md:w-auto md:flex-1 md:max-w-lg">
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
                            onClick={() => setShowFilters(v => !v)}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                                showFilters || activeFilterCount > 0
                                    ? "border-primary/40 text-primary bg-primary/10"
                                    : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-primary dark:hover:text-white hover:border-primary/30"
                            }`}
                        >
                            <Filter size={13} /> Filters
                            {activeFilterCount > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-primary/30 text-red-300">{activeFilterCount}</span>
                            )}
                        </button>
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

                {/* ── Expandable filter panel ─────────────────────────────────── */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-[var(--border-default)] overflow-hidden"
                        >
                            <div className="container mx-auto px-4 md:px-6 py-4 flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Make</label>
                                    <select
                                        value={makeFilter}
                                        onChange={e => setMakeFilter(e.target.value)}
                                        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs min-w-[140px] focus:outline-none focus:border-primary/40"
                                    >
                                        <option value="">All Makes</option>
                                        {availableMakes.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Body Type</label>
                                    <select
                                        value={bodyTypeFilter}
                                        onChange={e => setBodyTypeFilter(e.target.value)}
                                        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs min-w-[140px] focus:outline-none focus:border-primary/40"
                                    >
                                        <option value="">All Body Types</option>
                                        {Object.entries(BODY_TYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Fuel Type</label>
                                    <select
                                        value={fuelTypeFilter}
                                        onChange={e => setFuelTypeFilter(e.target.value)}
                                        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs min-w-[140px] focus:outline-none focus:border-primary/40"
                                    >
                                        <option value="">All Fuel Types</option>
                                        {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Current Bid Range</label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={minPrice}
                                            onChange={e => setMinPrice(e.target.value)}
                                            placeholder="Min £"
                                            className="w-24 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-primary/40"
                                        />
                                        <span className="text-[var(--text-muted)] text-xs">–</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={maxPrice}
                                            onChange={e => setMaxPrice(e.target.value)}
                                            placeholder="Max £"
                                            className="w-24 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs placeholder-[var(--text-muted)] focus:outline-none focus:border-primary/40"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Sort By</label>
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value as SortOption)}
                                        className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl px-3 py-2 text-xs min-w-[160px] focus:outline-none focus:border-primary/40"
                                    >
                                        {(Object.keys(SORT_LABELS) as SortOption[]).map(opt => (
                                            <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
                                        ))}
                                    </select>
                                </div>

                                {activeFilterCount > 0 && (
                                    <button
                                        onClick={clearFilters}
                                        className="text-xs font-bold text-primary hover:underline pb-2"
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
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

            {/* ── How Auctions Work ────────────────────────────────────────── */}
            <section id="how-it-works" className="border-t border-[var(--border-default)] bg-[var(--bg-card)] mt-8">
                <div className="container mx-auto px-6 py-20">

                    {/* Intro */}
                    <div className="text-center mb-12">
                        <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">How It Works</p>
                        <h2 className="text-3xl md:text-4xl font-black text-[var(--text-primary)] font-heading">How Carmazium Auctions Work</h2>
                        <p className="text-[var(--text-muted)] text-sm mt-3 max-w-md mx-auto">Two audiences, two tracks — pick the one that&apos;s you, then see exactly what happens next.</p>
                    </div>

                    {/* Track toggle */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex items-center bg-[var(--bg-input)] p-1 rounded-full border border-[var(--border-default)] relative">
                            <motion.div
                                className="absolute top-1 bottom-1 bg-primary rounded-full shadow-lg shadow-primary/25 z-0"
                                layoutId="track-pill"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                style={{
                                    left: track === "seller" ? "4px" : "50%",
                                    right: track === "seller" ? "50%" : "4px",
                                }}
                            />
                            <button
                                onClick={() => setTrack("seller")}
                                className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 ${track === "seller" ? "text-white" : "text-[var(--text-secondary)] hover:text-primary"}`}
                            >
                                For Sellers
                            </button>
                            <button
                                onClick={() => setTrack("buyer")}
                                className={`relative z-10 px-8 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 ${track === "buyer" ? "text-white" : "text-[var(--text-secondary)] hover:text-primary"}`}
                            >
                                For Buyers
                            </button>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto mb-20">
                        <div className="rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-input)] p-8 md:p-10">
                            {track === "seller" ? (
                                <>
                                    <StepTimeline steps={SELLER_STEPS} />
                                    <div className="mt-2 rounded-xl border-l-[3px] border-primary bg-[var(--bg-card)] px-5 py-4 text-sm text-[var(--text-muted)] leading-relaxed">
                                        <strong className="text-[var(--text-primary)]">Note:</strong> Carmazium isn&apos;t a party to the vehicle sale itself — that&apos;s agreed directly between you and the buyer. The £100 bonus is Carmazium&apos;s reward for selling through the platform.
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">
                                        Bidding is restricted to <strong className="text-[var(--text-primary)]">KYC-verified dealer accounts</strong> — every bid comes from a checked, trade buyer, not an anonymous account.
                                    </p>
                                    <StepTimeline steps={BUYER_STEPS} />
                                    <div className="mt-2 rounded-xl border-l-[3px] border-primary bg-[var(--bg-card)] px-5 py-4 text-sm text-[var(--text-muted)] leading-relaxed">
                                        <strong className="text-[var(--text-primary)]">Note:</strong> The £125 fee is charged only once you&apos;ve won an auction — there&apos;s nothing to pay just for bidding or browsing.
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Rules, explained */}
                    <div className="text-center mb-10">
                        <h3 className="text-2xl md:text-3xl font-black font-heading tracking-tight mb-3">The Rules, Explained</h3>
                        <p className="text-[var(--text-muted)] text-sm">The fine print, in plain English.</p>
                    </div>
                    <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4 mb-20">
                        {RULES.map((rule) => (
                            <div key={rule.term} className="flex items-start gap-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 hover:border-primary/25 transition-colors">
                                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <rule.icon size={16} className="text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-heading font-bold text-sm mb-1">{rule.term}</p>
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{rule.def}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Trust & Transparency */}
                    <div className="text-center mb-10">
                        <h3 className="text-2xl md:text-3xl font-black font-heading tracking-tight mb-3">Trust &amp; Transparency</h3>
                        <p className="text-[var(--text-muted)] text-sm">Every listing tells you exactly what you&apos;re bidding on.</p>
                    </div>
                    <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5 mb-20">
                        {TRUST.map((item) => (
                            <div key={item.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6 text-center hover:border-primary/25 transition-colors">
                                <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <item.icon size={22} className="text-primary" />
                                </div>
                                <h4 className="font-heading font-bold text-sm mb-2">{item.title}</h4>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>

                    {/* FAQ */}
                    <div className="max-w-2xl mx-auto mb-20">
                        <div className="text-center mb-10">
                            <h3 className="text-2xl md:text-3xl font-black font-heading tracking-tight mb-3">FAQ</h3>
                            <p className="text-[var(--text-muted)] text-sm">Can&apos;t find your answer? <Link href="/contact" className="text-primary hover:underline">Get in touch</Link>.</p>
                        </div>
                        <div className="space-y-3">
                            {FAQS.map((faq) => (
                                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                            ))}
                        </div>
                    </div>

                </div>
            </section>
        </div>
    )
}
