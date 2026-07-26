"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    ArrowLeft, ArrowRight, ChevronDown, Key, FileText, Lock, Clock, Zap,
    Gavel, Handshake, Banknote, ShieldCheck, Search, Eye, TrendingUp,
    Trophy, CreditCard, Users, Gauge, Box, BadgeCheck,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

// ─── Content (approved copy — see client-approved "How Carmazium Auctions Work" draft) ──

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

// ─── Small local components ────────────────────────────────────────────────

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
        <details className="group border border-[var(--border-default)] rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none hover:bg-primary/5 dark:hover:bg-[var(--bg-card)] transition-colors">
                <span className="font-semibold text-sm">{q}</span>
                <ChevronDown size={18} className="text-[var(--text-muted)] shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-5 text-sm text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-default)] pt-4">
                {a}
            </div>
        </details>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AuctionHowItWorksPage() {
    const [track, setTrack] = React.useState<"seller" | "buyer">("seller")

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="relative overflow-hidden text-white" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <Image
                    src="/assets/images/live-auction-hero.jpg"
                    alt="Live car auction"
                    fill
                    priority
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent dark:bg-gradient-to-b dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top_left,rgba(237,28,36,0.18)_0%,transparent_55%)]" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.85)_0%,transparent_60%)]" />

                <div className="container mx-auto px-6 py-20 md:py-28 relative z-10">
                    <div className="max-w-3xl">
                        <Link
                            href="/auctions"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white uppercase tracking-widest mb-6 transition-colors"
                        >
                            <ArrowLeft size={13} /> Back to Live Auctions
                        </Link>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2.5 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6"
                        >
                            <Key size={12} className="text-red-400" />
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">How Auctions Work</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, duration: 0.6 }}
                            className="text-4xl md:text-6xl font-black font-heading tracking-tight leading-[1.05] mb-5"
                        >
                            Turn your keys into cash.{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-700">
                                Earn £100.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 }}
                            className="text-slate-300 text-lg max-w-xl leading-relaxed mb-8"
                        >
                            List your car for auction, get bids from verified trade dealers, and earn a £100 bonus when the sale completes — free to list, no obligation if your reserve isn&apos;t met.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="flex flex-wrap gap-3 mb-10"
                        >
                            <Link href="/sell">
                                <Button size="lg" shape="pill" className="shadow-neon group">
                                    List Your Car
                                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <Link href="/auctions">
                                <Button size="lg" shape="pill" variant="dark">
                                    Browse Live Auctions
                                </Button>
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.26 }}
                            className="flex flex-wrap items-center gap-x-8 gap-y-3"
                        >
                            {[
                                { icon: Clock, label: "24-Hour Auctions", color: "text-slate-300" },
                                { icon: Zap, label: "Anti-Snipe Protection", color: "text-amber-400" },
                                { icon: Banknote, label: "£100 Seller Bonus", color: "text-emerald-400" },
                                { icon: ShieldCheck, label: "KYC-Verified Bidders", color: "text-slate-300" },
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

            {/* ── The Process ──────────────────────────────────────────────── */}
            <section className="container mx-auto px-6 py-20">
                <div className="max-w-2xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-3">The Process</h2>
                    <p className="text-[var(--text-muted)]">Two audiences, two tracks — pick the one that&apos;s you.</p>
                </div>

                {/* Toggle */}
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

                <div className="max-w-3xl mx-auto">
                    <div className="rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10">
                        {track === "seller" ? (
                            <>
                                <StepTimeline steps={SELLER_STEPS} />
                                <div className="mt-2 rounded-xl border-l-[3px] border-primary bg-[var(--bg-input)] px-5 py-4 text-sm text-[var(--text-muted)] leading-relaxed">
                                    <strong className="text-[var(--text-primary)]">Note:</strong> Carmazium isn&apos;t a party to the vehicle sale itself — that&apos;s agreed directly between you and the buyer. The £100 bonus is Carmazium&apos;s reward for selling through the platform.
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-[var(--text-muted)] mb-8 leading-relaxed">
                                    Bidding is restricted to <strong className="text-[var(--text-primary)]">KYC-verified dealer accounts</strong> — every bid comes from a checked, trade buyer, not an anonymous account.
                                </p>
                                <StepTimeline steps={BUYER_STEPS} />
                                <div className="mt-2 rounded-xl border-l-[3px] border-primary bg-[var(--bg-input)] px-5 py-4 text-sm text-[var(--text-muted)] leading-relaxed">
                                    <strong className="text-[var(--text-primary)]">Note:</strong> The £125 fee is charged only once you&apos;ve won an auction — there&apos;s nothing to pay just for bidding or browsing.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Rules, Explained ──────────────────────────────────────────── */}
            <section className="container mx-auto px-6 py-20">
                <div className="max-w-2xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-3">The Rules, Explained</h2>
                    <p className="text-[var(--text-muted)]">The fine print, in plain English.</p>
                </div>
                <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4">
                    {RULES.map((rule) => (
                        <div key={rule.term} className="flex items-start gap-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 hover:border-primary/25 transition-colors">
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
            </section>

            {/* ── Trust & Transparency ─────────────────────────────────────── */}
            <section className="container mx-auto px-6 py-20">
                <div className="max-w-2xl mx-auto text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-3">Trust &amp; Transparency</h2>
                    <p className="text-[var(--text-muted)]">Every listing tells you exactly what you&apos;re bidding on.</p>
                </div>
                <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
                    {TRUST.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-center hover:border-primary/25 transition-colors">
                            <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <item.icon size={22} className="text-primary" />
                            </div>
                            <h3 className="font-heading font-bold text-sm mb-2">{item.title}</h3>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FAQ ───────────────────────────────────────────────────────── */}
            <section className="container mx-auto px-6 py-20">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-3">FAQ</h2>
                        <p className="text-[var(--text-muted)]">Can&apos;t find your answer? <Link href="/contact" className="text-primary hover:underline">Get in touch</Link>.</p>
                    </div>
                    <div className="space-y-3">
                        {FAQS.map((faq) => (
                            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Closing CTA ───────────────────────────────────────────────── */}
            <section className="container mx-auto px-6 pb-24">
                <div className="relative max-w-3xl mx-auto rounded-[1.75rem] border border-[var(--border-default)] bg-[var(--bg-card)] p-10 md:p-14 text-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(237,28,36,0.08)_0%,transparent_70%)] pointer-events-none" />
                    <div className="relative">
                        <h2 className="text-2xl md:text-3xl font-black font-heading mb-6">Ready to turn your keys into cash?</h2>
                        <Link href="/sell">
                            <Button size="lg" shape="pill" className="px-10 shadow-neon group">
                                List Your Car for Auction
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

        </div>
    )
}
