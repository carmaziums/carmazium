"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    Gavel, Truck, Wrench, Banknote, ShieldCheck,
    ArrowRight, type LucideIcon,
} from "lucide-react"
import { HowAuctionsWork } from "@/components/auctions/HowAuctionsWork"
import {
    deliveryServiceEnabled,
    inspectionServiceEnabled,
    financeServiceEnabled,
    warrantyServiceEnabled,
} from "@/lib/featureFlags"

/**
 * Trade Exchange landing dashboard — the public menu for auctions and the
 * four TradeXchange service areas.
 *
 * The stock browser itself remains at /auctions/browse and stays protected by
 * verified-dealer authorization. These public cards contain no vehicle, price
 * or bid data; they only route visitors into the appropriate workflow.
 */

type Section = {
    icon: LucideIcon
    title: string
    description: string
    points: string[]
    /** Present = live. Absent = the card renders as temporarily unavailable. */
    href?: string
    cta: string
}

const SECTIONS: Section[] = [
    {
        icon: Gavel,
        title: "Auction",
        description:
            "Bid on verified vehicles in 24-hour live auctions, or see what is scheduled next. Anti-snipe protection on every lot.",
        points: ["Live and upcoming lots", "Real-time bidding", "Reserve never shown to bidders"],
        href: "/auctions/browse",
        cta: "Enter the auction room",
    },
    {
        icon: Truck,
        title: "Delivery & Recovery",
        description:
            "Move or recover a vehicle anywhere in the UK. Post the route and approved transport businesses send you a fixed-price quote.",
        points: ["Single and multi-car moves", "Recovery jobs", "9% platform / 91% provider payout"],
        ...(deliveryServiceEnabled ? { href: "/services/delivery" } : {}),
        cta: "Arrange transport",
    },
    {
        icon: Wrench,
        title: "Vehicle Inspections",
        description:
            "Request an independent vehicle inspection and let approved inspection providers compete for the job.",
        points: ["Pre-purchase vehicle checks", "Competitive approved-provider quotes", "Protected service payment"],
        ...(inspectionServiceEnabled ? { href: "/services/inspection" } : {}),
        cta: "Request an inspection",
    },
    {
        icon: Banknote,
        title: "Vehicle Finance",
        description:
            "Send one finance enquiry to approved matching providers. They respond with their own eligibility, terms and regulated disclosures.",
        points: [
            "Enquiry matching only — no CarMazium lending decision",
            "Approved finance providers respond",
            "Provider supplies its own terms and APR",
        ],
        ...(financeServiceEnabled ? { href: "/services/finance" } : {}),
        cta: "Request finance options",
    },
    {
        icon: ShieldCheck,
        title: "Warranty Providers",
        description:
            "Tell us about the vehicle and cover you want. Approved warranty providers can respond with suitable products and indicative prices.",
        points: ["Choose your preferred cover level", "Approved warranty providers respond", "Provider supplies policy terms and exclusions"],
        ...(warrantyServiceEnabled ? { href: "/services/warranty" } : {}),
        cta: "Request warranty options",
    },
]

function SectionCard({ section, index }: { section: Section; index: number }) {
    const { icon: Icon, title, description, points, href, cta } = section
    const live = Boolean(href)

    const body = (
        <>
            <div className="flex items-start justify-between gap-3 mb-5">
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${live
                        ? "bg-primary/10 border-primary/20"
                        : "bg-[var(--bg-card)] border-[var(--border-default)]"}`}
                >
                    <Icon size={22} className={live ? "text-primary" : "text-[var(--text-muted)]"} />
                </div>
                <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${live
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500"
                        : "bg-amber-500/10 border-amber-500/25 text-amber-500"}`}
                >
                    {live ? "Open now" : "Temporarily unavailable"}
                </span>
            </div>

            <h3 className="text-lg font-black font-heading tracking-tight mb-2">{title}</h3>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{description}</p>

            <ul className="space-y-2 mb-6">
                {points.map(point => (
                    <li key={point} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {point}
                    </li>
                ))}
            </ul>
        </>
    )

    const shell =
        "relative flex flex-col h-full rounded-2xl border p-6 transition-colors border-[var(--border-default)] bg-[var(--bg-input)]" +
        (live ? " hover:border-primary/40" : "")

    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            className="h-full"
        >
            {live ? (
                <Link href={href!} className={`${shell} group cursor-pointer`}>
                    {body}
                    <span className="mt-auto inline-flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-black uppercase tracking-widest text-white group-hover:bg-primary/90 transition-colors">
                        {cta}
                        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                </Link>
            ) : (
                <div className={shell}>
                    {body}
                    <button
                        type="button"
                        disabled
                        aria-label={`${cta} — temporarily unavailable`}
                        className="mt-auto w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-bold text-[var(--text-muted)] cursor-not-allowed opacity-70"
                    >
                        {cta}
                    </button>
                </div>
            )}
        </motion.div>
    )
}

export default function TradeExchangePage() {
    const allServicesOpen =
        deliveryServiceEnabled &&
        inspectionServiceEnabled &&
        financeServiceEnabled &&
        warrantyServiceEnabled

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>
            <section className="relative overflow-hidden text-white" style={{ marginTop: '-80px', paddingTop: '80px' }}>
                <Image
                    src="/assets/images/live-auction-hero.jpg"
                    alt="TradeXchange vehicle auctions and services"
                    fill
                    priority
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent dark:bg-gradient-to-b dark:from-slate-900/80 dark:via-slate-900/70 dark:to-slate-900" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_top_left,rgba(237,28,36,0.18)_0%,transparent_55%)]" />
                <div className="absolute inset-0 dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(15,23,42,0.85)_0%,transparent_60%)]" />

                <div className="container mx-auto px-6 py-20 md:py-24 relative z-10">
                    <div className="max-w-3xl">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2.5 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6"
                        >
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                                TradeXchange
                            </span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05, duration: 0.6 }}
                            className="text-5xl md:text-6xl font-black font-heading tracking-tight leading-[0.95] mb-5"
                        >
                            Everything trade,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-700">
                                in one room.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12 }}
                            className="text-slate-300 text-lg max-w-xl leading-relaxed"
                        >
                            Live vehicle auctions alongside delivery, inspections, finance and warranty —
                            all connected through CarMazium and approved providers.
                        </motion.p>
                    </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </section>

            <section className="container mx-auto px-4 md:px-6 py-16">
                <div className="mb-10">
                    <h2 className="text-2xl md:text-3xl font-black font-heading tracking-tight mb-2">
                        Where do you want to go?
                    </h2>
                    <p className="text-[var(--text-muted)] text-sm">
                        {allServicesOpen
                            ? "Auctions, delivery, inspections, finance and warranty are all open now."
                            : "Available TradeXchange areas are marked Open now below."}
                    </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {SECTIONS.map((section, i) => (
                        <SectionCard key={section.title} section={section} index={i} />
                    ))}
                </div>
            </section>

            <HowAuctionsWork />
        </div>
    )
}
