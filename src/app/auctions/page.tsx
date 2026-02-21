/* ============================================================================
 * AUCTIONS PAGE — COMING SOON
 * ============================================================================
 * Auctions have been temporarily disabled by client decision.
 * The original auction UI is preserved below in AUCTION_DISABLED blocks.
 * To re-enable: remove this file's content and uncomment AUCTION_DISABLED blocks.
 * ============================================================================ */

"use client"

import * as React from "react"
import Image from "next/image"
import { Gavel, Bell, Sparkles, Clock, ShieldCheck, TrendingUp } from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotifyFormState {
    email: string
    submitted: boolean
    loading: boolean
    error: string | null
}

// ─── Coming Soon Feature Cards ───────────────────────────────────────────────

const UPCOMING_FEATURES = [
    {
        icon: Clock,
        title: "Real-Time Bidding",
        description: "Live countdowns and instant bid updates for the most competitive auctions.",
    },
    {
        icon: ShieldCheck,
        title: "Verified Vehicles",
        description: "Every auctioned car undergoes a full inspection before it hits the block.",
    },
    {
        icon: TrendingUp,
        title: "Market Insights",
        description: "Know the true market value before you place a single bid.",
    },
]

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AuctionsPage() {
    const [form, setForm] = React.useState<NotifyFormState>({
        email: "",
        submitted: false,
        loading: false,
        error: null,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(form.email)) {
            setForm((prev) => ({ ...prev, error: "Please enter a valid email address." }))
            return
        }

        setForm((prev) => ({ ...prev, loading: true, error: null }))

        try {
            // Submit to lead capture endpoint (Phase 8)
            await fetch("/api/analytics/lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, source: "auctions_coming_soon" }),
            }).catch(() => {
                // Silently fail if endpoint not yet live — don't block the UX
            })

            setForm((prev) => ({ ...prev, submitted: true, loading: false }))
        } catch {
            setForm((prev) => ({ ...prev, loading: false }))
        }
    }

    return (
        <div className="bg-slate-950 min-h-screen flex flex-col">

            {/* ── Cinematic Hero ─────────────────────────────────────────── */}
            <div className="relative flex-1 flex items-center justify-center min-h-[70vh] overflow-hidden">
                {/* Background */}
                <Image
                    src="/assets/images/hero-bg.png"
                    alt="Auction coming soon background"
                    fill
                    className="object-cover opacity-25"
                    priority
                />
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/80" />

                {/* Animated red glow orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-600/10 blur-3xl animate-pulse pointer-events-none" />

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center text-center px-6 py-20 max-w-3xl mx-auto">

                    {/* Gavel badge */}
                    <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-red-600/10 border border-red-500/30 mb-8 shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                        <Gavel size={36} className="text-red-500" />
                    </div>

                    {/* Eyebrow */}
                    <div className="flex items-center gap-2 text-red-500 font-bold tracking-widest uppercase text-xs mb-4">
                        <Sparkles size={14} className="fill-red-500" />
                        Coming Soon
                        <Sparkles size={14} className="fill-red-500" />
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-bold font-heading text-white leading-tight mb-6">
                        The Gavel{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                            Drops Soon.
                        </span>
                    </h1>

                    {/* Subtext */}
                    <p className="text-lg md:text-xl text-slate-400 leading-relaxed mb-10 max-w-xl">
                        Carmazium Auctions is launching soon — real-time bidding on exclusive vehicles,
                        fully verified and transparently priced. Be first in line.
                    </p>

                    {/* Email capture */}
                    {form.submitted ? (
                        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-6 py-4 rounded-2xl text-sm font-medium">
                            <ShieldCheck size={18} />
                            You&apos;re on the list! We&apos;ll notify you as soon as auctions go live.
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Bell
                                        size={16}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                                    />
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, email: e.target.value, error: null }))
                                        }
                                        placeholder="Enter your email"
                                        className="w-full bg-slate-800/80 backdrop-blur border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 transition-all"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={form.loading}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] whitespace-nowrap"
                                >
                                    {form.loading ? "Saving…" : "Notify Me"}
                                </button>
                            </div>

                            {form.error && (
                                <p className="text-red-400 text-xs text-center">{form.error}</p>
                            )}

                            <p className="text-slate-600 text-xs text-center">
                                No spam. Unsubscribe any time.
                            </p>
                        </form>
                    )}
                </div>
            </div>

            {/* ── Upcoming Features ──────────────────────────────────────── */}
            <div className="container mx-auto px-6 py-20 max-w-5xl">
                <p className="text-center text-slate-500 text-sm font-bold uppercase tracking-widest mb-10">
                    What&apos;s coming
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {UPCOMING_FEATURES.map(({ icon: Icon, title, description }) => (
                        <div
                            key={title}
                            className="group relative bg-slate-900/60 backdrop-blur border border-white/5 rounded-2xl p-6 hover:border-red-500/20 transition-all duration-300 hover:-translate-y-1"
                        >
                            {/* Subtle red glow on hover */}
                            <div className="absolute inset-0 rounded-2xl bg-red-600/0 group-hover:bg-red-600/5 transition-all duration-300" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-red-600/10 border border-red-500/20 mb-4">
                                    <Icon size={20} className="text-red-500" />
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ============================================================================
 * AUCTION_DISABLED — Original auction UI preserved below.
 * Uncomment and replace the above export when auctions are re-enabled.
 * ============================================================================

"use client"
import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { CarCard } from "@/components/features/CarCard"
import { CountdownTimer } from "@/components/features/CountdownTimer"
import { Timer, Gavel, Calendar, ArrowRight, Filter, Search, Flame, User } from "lucide-react"

export default function AuctionsPage() {
    return (
        <div className="bg-slate-950 min-h-screen pb-20">

            <div className="relative min-h-[65vh] overflow-hidden flex items-center pt-20">
                <Image src="/assets/images/hero-bg.png" alt="Auctions Hero" fill className="object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                <div className="container mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-red-500 font-bold tracking-widest uppercase text-sm animate-in slide-in-from-left duration-700">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Live Now
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold font-heading text-white leading-tight animate-in slide-in-from-bottom duration-700 delay-100">
                            The Gavel <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600">Drops Here.</span>
                        </h1>
                        <p className="text-xl text-slate-400 max-w-lg leading-relaxed animate-in slide-in-from-bottom duration-700 delay-200">
                            Experience the thrill of real-time bidding on the world's most exclusive automotive inventory.
                        </p>
                        <div className="flex gap-4 pt-4 animate-in slide-in-from-bottom duration-700 delay-300">
                            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                                View Live Auctions <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky top-20 z-30 bg-slate-900/80 backdrop-blur-md border-y border-white/5 py-4 mb-12">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
                        {["All Auctions", "Supercars", "Classics", "Track Cars", "SUVs"].map((filter, i) => (
                            <button key={i} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${i === 0 ? "bg-white text-slate-950" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}>
                                {filter}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative group w-full md:w-64">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors" />
                            <input type="text" placeholder="Search inventory..." className="w-full bg-slate-800 border border-white/5 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors" />
                        </div>
                        <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white gap-2">
                            <Filter size={16} /> Filters
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 space-y-20">
                <div>
                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                                <Flame className="text-red-500 fill-red-500" /> Live Auctions
                            </h2>
                            <p className="text-slate-400">HAPPENING NOW - Bids ending soon</p>
                        </div>
                        <Link href="/auctions/live" className="text-red-500 font-bold hover:text-red-400 flex items-center gap-1 transition-colors">
                            View All Live <ArrowRight size={16} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="group relative">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl opacity-20 group-hover:opacity-100 blur transition duration-500"></div>
                                <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
                                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                                        <div className="bg-red-600 text-white px-3 py-1 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-pulse">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span> LIVE
                                        </div>
                                        <div className="bg-black/50 backdrop-blur text-white px-3 py-1 rounded-full border border-white/10 text-xs font-bold">
                                            <User size={12} className="inline mr-1" /> 14{i}
                                        </div>
                                    </div>
                                    <CarCard
                                        title={`Porsche 911 GT${i} RS`}
                                        price={`£${(135000 + i * 5000).toLocaleString()}`}
                                        image={`/assets/images/featured-sports.png`}
                                        href={`/auctions/live/auction-${i}`}
                                    />
                                    <div className="px-4 pb-4 -mt-4 relative z-20">
                                        <div className="bg-slate-800/80 backdrop-blur border border-white/5 rounded-xl p-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Current Bid</p>
                                                <p className="text-white font-mono font-bold">£{(135000 + i * 5000).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ends In</p>
                                                <div className="text-red-500 font-mono font-bold text-sm">
                                                    <CountdownTimer targetDate={new Date(Date.now() + 5000000 + i * 100000)} minimal={true} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

============================================================================ */
