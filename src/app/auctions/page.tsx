"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    ArrowRight,
    BadgeCheck,
    Banknote,
    BriefcaseBusiness,
    Gavel,
    LayoutDashboard,
    ShieldCheck,
    Truck,
    Users,
    Wrench,
    type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import {
    deliveryServiceEnabled,
    inspectionServiceEnabled,
    financeServiceEnabled,
    warrantyServiceEnabled,
} from "@/lib/featureFlags"

type Pillar = {
    icon: LucideIcon
    title: string
    eyebrow: string
    description: string
    points: string[]
    href?: string
    cta: string
}

const PILLARS: Pillar[] = [
    {
        icon: Gavel,
        title: "Vehicle Auctions",
        eyebrow: "Buy & sell trade stock",
        description: "Sell vehicles in 24-hour auctions or bid as a verified trade dealer, with live bidding and anti-snipe protection.",
        points: ["Free auction listings", "£100 qualifying seller bonus", "£125 fee only for the winning dealer"],
        href: "/auctions/how-it-works",
        cta: "Explore auctions",
    },
    {
        icon: Truck,
        title: "Delivery & Recovery",
        eyebrow: "Move vehicles nationwide",
        description: "Post a route and let approved transport businesses compete with fixed-price quotes for delivery or recovery work.",
        points: ["Single and multi-car moves", "Protected service payment", "Providers keep 91% of the job price"],
        ...(deliveryServiceEnabled ? { href: "/services/delivery" } : {}),
        cta: "Explore delivery",
    },
    {
        icon: Wrench,
        title: "Vehicle Inspections",
        eyebrow: "Check before you commit",
        description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers.",
        points: ["Pre-purchase checks", "Competitive provider quotes", "Providers keep 91% of the job price"],
        ...(inspectionServiceEnabled ? { href: "/services/inspection" } : {}),
        cta: "Explore inspections",
    },
    {
        icon: Banknote,
        title: "Vehicle Finance",
        eyebrow: "Matched finance enquiries",
        description: "Send one enquiry to approved finance providers and compare the options, eligibility and regulated terms they return.",
        points: ["One enquiry, matched providers", "Consent-led contact sharing", "Provider controls its own terms and APR"],
        ...(financeServiceEnabled ? { href: "/services/finance" } : {}),
        cta: "Explore finance",
    },
    {
        icon: ShieldCheck,
        title: "Warranty Providers",
        eyebrow: "Compare vehicle cover",
        description: "Request warranty options for a vehicle and hear from approved providers offering their own products, cover and exclusions.",
        points: ["Matched warranty enquiries", "Compare cover levels", "Provider issues its own policy terms"],
        ...(warrantyServiceEnabled ? { href: "/services/warranty" } : {}),
        cta: "Explore warranty",
    },
]

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
    const { icon: Icon, title, eyebrow, description, points, href, cta } = pillar
    const live = Boolean(href)

    return (
        <motion.article
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4 }}
            className="h-full"
        >
            {live ? (
                <Link
                    href={href!}
                    className="group flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                    <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                            <Icon size={22} className="text-primary" />
                        </div>
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                            Open now
                        </span>
                    </div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
                    <h2 className="mb-3 text-xl font-black font-heading tracking-tight">{title}</h2>
                    <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
                    <ul className="mb-6 space-y-2.5">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                {point}
                            </li>
                        ))}
                    </ul>
                    <span className="mt-auto inline-flex items-center justify-between border-t border-[var(--border-default)] pt-4 text-sm font-black text-primary">
                        {cta}
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </span>
                </Link>
            ) : (
                <div className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 opacity-70">
                    <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                            <Icon size={22} className="text-[var(--text-muted)]" />
                        </div>
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                            Temporarily unavailable
                        </span>
                    </div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{eyebrow}</p>
                    <h2 className="mb-3 text-xl font-black font-heading tracking-tight">{title}</h2>
                    <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
                    <ul className="space-y-2.5">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-muted)]" />
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </motion.article>
    )
}

const PROVIDER_BENEFITS = [
    {
        icon: Users,
        title: "Reach active automotive demand",
        text: "Approved providers can receive work and enquiries from buyers, sellers and dealers already using CarMazium.",
    },
    {
        icon: BriefcaseBusiness,
        title: "Work only in approved categories",
        text: "Apply for Delivery, Inspection, Finance or Warranty separately. Your business is shown only for capabilities CarMazium approves.",
    },
    {
        icon: BadgeCheck,
        title: "Compete on a trusted platform",
        text: "Approved-provider status helps customers understand who has been checked before they choose a quote or respond to an enquiry.",
    },
    {
        icon: LayoutDashboard,
        title: "Manage everything in one dashboard",
        text: "Track open jobs, accepted work, provider enquiries and capability approvals without relying on scattered calls and messages.",
    },
]

export default function TradeXchangePage() {
    const { user } = useAuth()
    const providerHref = user
        ? "/dashboard/service/capabilities"
        : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
            <section className="relative overflow-hidden text-white" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <Image
                    src="/assets/images/live-auction-hero.jpg"
                    alt="TradeXchange automotive marketplace"
                    fill
                    priority
                    className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/25" />
                <div className="container mx-auto px-6 py-20 md:py-28 relative z-10">
                    <div className="max-w-4xl">
                        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 text-xs font-black uppercase tracking-[0.22em] text-red-300">
                            CarMazium TradeXchange
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 text-4xl md:text-6xl font-black font-heading tracking-tight leading-[0.98]"
                        >
                            One trade platform.
                            <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-400">Five ways to do business.</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="max-w-2xl text-lg leading-relaxed text-slate-200"
                        >
                            Auction vehicles, move them, inspect them, arrange finance enquiries and source warranty cover — with each TradeXchange area built around approved businesses and a clear workflow.
                        </motion.p>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-4 md:px-6 py-16 md:py-20">
                <div className="mx-auto mb-10 max-w-3xl text-center">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Choose a TradeXchange area</p>
                    <h2 className="mb-3 text-3xl md:text-4xl font-black font-heading tracking-tight">Five equal parts of the same marketplace</h2>
                    <p className="text-sm md:text-base text-[var(--text-muted)]">
                        Each area has its own rules, fees and workflow. Open a card to see exactly how that part of TradeXchange works before you continue.
                    </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                    {PILLARS.map((pillar, index) => (
                        <PillarCard key={pillar.title} pillar={pillar} index={index} />
                    ))}
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="container mx-auto px-6 py-16 md:py-20">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
                        <div>
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">For service providers</p>
                            <h2 className="mb-4 text-3xl md:text-4xl font-black font-heading tracking-tight">Bring your automotive business to TradeXchange</h2>
                            <p className="mb-6 text-[var(--text-muted)] leading-relaxed">
                                Delivery companies, recovery operators, vehicle inspectors, finance providers and warranty businesses can apply for the service areas they actually provide. Each capability is approved separately.
                            </p>

                            <div className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-5">
                                <p className="mb-1 text-sm font-black text-[var(--text-primary)]">Delivery &amp; Inspection jobs: 9% CarMazium fee</p>
                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                                    On paid Delivery and Inspection jobs, CarMazium keeps 9% of the accepted job price and the provider receives 91% after successful completion and release of payment.
                                </p>
                            </div>
                            <div className="mb-7 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                                <p className="mb-1 text-sm font-black text-[var(--text-primary)]">Finance &amp; Warranty: matched-enquiry model</p>
                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                                    Finance and Warranty do not use the 9% service-job payout model. CarMazium matches approved providers with customer enquiries; the provider supplies its own terms, products and regulated information directly.
                                </p>
                            </div>

                            <Link
                                href={providerHref}
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-primary/90"
                            >
                                Apply as a service provider <ArrowRight size={16} />
                            </Link>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            {PROVIDER_BENEFITS.map((benefit) => (
                                <div key={benefit.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                                        <benefit.icon size={18} className="text-primary" />
                                    </div>
                                    <h3 className="mb-2 font-heading font-bold">{benefit.title}</h3>
                                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{benefit.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-14 md:py-16">
                <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-input)] p-8 md:p-10 text-center">
                    <h2 className="mb-3 text-2xl md:text-3xl font-black font-heading">Not sure where to start?</h2>
                    <p className="mx-auto mb-6 max-w-2xl text-sm md:text-base text-[var(--text-muted)]">
                        Open the card that matches what you need. Every TradeXchange page explains that service first, then gives you the relevant action — browse, post a job, send an enquiry or apply as a provider.
                    </p>
                    <Link href="/services" className="inline-flex items-center gap-2 text-sm font-black text-primary hover:underline">
                        View the TradeXchange Services hub <ArrowRight size={15} />
                    </Link>
                </div>
            </section>
        </div>
    )
}
