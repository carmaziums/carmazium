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
        title: "Reach customers with real automotive intent",
        text: "Put your business in front of buyers, sellers and dealers already using CarMazium to move, inspect, finance and protect vehicles.",
    },
    {
        icon: BriefcaseBusiness,
        title: "Choose the work that fits your business",
        text: "Delivery and Inspection providers can quote selectively on the jobs that suit their routes, availability and pricing.",
    },
    {
        icon: Banknote,
        title: "Keep 91% on paid service jobs",
        text: "For completed Delivery and Inspection jobs, the CarMazium platform fee is 9% and the provider receives 91% of the accepted job price.",
    },
    {
        icon: BadgeCheck,
        title: "Stand out as an approved provider",
        text: "Capability-specific approval gives customers a clearer reason to trust the businesses they see inside TradeXchange.",
    },
    {
        icon: LayoutDashboard,
        title: "Run opportunities from one dashboard",
        text: "Keep relevant jobs, accepted work, matched enquiries and capability approvals together instead of relying on scattered calls and messages.",
    },
    {
        icon: ShieldCheck,
        title: "Use the model that suits your service",
        text: "Delivery and Inspection use paid job workflows, while Finance and Warranty providers receive matched customer enquiries under their own commercial terms.",
    },
]

const PROVIDER_STEPS = [
    {
        step: "01",
        title: "Create your provider account",
        text: "Register with CarMazium and open the service-provider area of your dashboard.",
    },
    {
        step: "02",
        title: "Choose your capabilities",
        text: "Apply only for the TradeXchange services your business actually provides: Delivery, Inspection, Finance or Warranty.",
    },
    {
        step: "03",
        title: "Complete capability approval",
        text: "Submit the business information requested for each capability. CarMazium reviews every service capability separately.",
    },
    {
        step: "04",
        title: "Start receiving opportunities",
        text: "Once approved, quote on relevant Delivery or Inspection jobs, or receive matched Finance and Warranty enquiries.",
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
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
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
                            className="max-w-2xl text-lg leading-relaxed text-slate-100"
                        >
                            Auction vehicles, move them, inspect them, arrange finance enquiries and source warranty cover — while approved service providers can compete for work and grow their automotive business through the same marketplace.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                            className="mt-8 flex flex-col gap-3 sm:flex-row"
                        >
                            <Link
                                href={providerHref}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-primary/90"
                            >
                                Join as a service provider <ArrowRight size={16} />
                            </Link>
                            <a
                                href="#tradexchange-areas"
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-black uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                            >
                                Explore TradeXchange
                            </a>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="container mx-auto px-6 py-8">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
                            <p className="mb-1 text-2xl font-black font-heading text-primary">91%</p>
                            <p className="text-sm font-bold">Provider share on paid Delivery &amp; Inspection jobs</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                            <p className="mb-1 text-lg font-black font-heading">Quote selectively</p>
                            <p className="text-sm text-[var(--text-muted)]">Choose the jobs that fit your routes, capacity, availability and pricing.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                            <p className="mb-1 text-lg font-black font-heading">Matched enquiries</p>
                            <p className="text-sm text-[var(--text-muted)]">Finance and Warranty providers can receive relevant customer demand inside CarMazium.</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                            <p className="mb-1 text-lg font-black font-heading">Approved-provider status</p>
                            <p className="text-sm text-[var(--text-muted)]">Build customer confidence through capability-specific approval.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="tradexchange-areas" className="container mx-auto px-4 md:px-6 py-16 md:py-20 scroll-mt-24">
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
                    <div className="mx-auto mb-12 max-w-3xl text-center">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Grow with TradeXchange</p>
                        <h2 className="mb-4 text-3xl md:text-5xl font-black font-heading tracking-tight">Turn your automotive expertise into more business</h2>
                        <p className="text-[var(--text-muted)] leading-relaxed">
                            TradeXchange is built to bring approved automotive businesses closer to customers who already need vehicle services. Apply for the capabilities that match your business, choose the opportunities you want and manage them from one provider area.
                        </p>
                    </div>

                    <div className="mb-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {PROVIDER_BENEFITS.map((benefit) => (
                            <div key={benefit.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                                    <benefit.icon size={19} className="text-primary" />
                                </div>
                                <h3 className="mb-2 font-heading font-bold">{benefit.title}</h3>
                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{benefit.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-7 md:p-8">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Delivery &amp; Inspection providers</p>
                            <h3 className="mb-4 text-2xl md:text-3xl font-black font-heading">Your quote. Your work. 91% provider share.</h3>
                            <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">
                                You decide which suitable jobs to quote on and what fixed price to offer. When a paid Delivery or Inspection job is successfully completed, CarMazium keeps a 9% platform fee and the provider receives 91% of the accepted job price after payment is released.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                    <p className="font-black">9% CarMazium fee</p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">Clear platform economics before you build your provider activity.</p>
                                </div>
                                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                    <p className="font-black">91% to the provider</p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">Released after successful completion through the service-job payment flow.</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-input)] p-7 md:p-8">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Finance &amp; Warranty providers</p>
                            <h3 className="mb-4 text-2xl md:text-3xl font-black font-heading">Meet customers already in the vehicle journey</h3>
                            <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">
                                Finance and Warranty use a matched-enquiry model rather than the 9% paid-job model. Approved providers can receive relevant customer enquiries and respond using their own products, commercial terms and required regulated information.
                            </p>
                            <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-secondary)]">
                                The opportunity is simple: reach relevant CarMazium users at the point they are already buying, selling or managing a vehicle.
                            </p>
                        </div>
                    </div>

                    <div className="mt-14">
                        <div className="mx-auto mb-9 max-w-2xl text-center">
                            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Getting started</p>
                            <h3 className="text-2xl md:text-3xl font-black font-heading">From account to approved provider in four clear steps</h3>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {PROVIDER_STEPS.map((item) => (
                                <div key={item.step} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5">
                                    <p className="mb-4 text-sm font-black text-primary">{item.step}</p>
                                    <h4 className="mb-2 font-heading font-bold">{item.title}</h4>
                                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-10 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-7 md:p-9">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Ready to grow with CarMazium?</p>
                                <h3 className="mb-2 text-2xl md:text-3xl font-black font-heading">Create your provider account and apply for the services you offer.</h3>
                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                                    Start with one capability or apply for several. Approval is handled per service, so your TradeXchange presence can grow with your business.
                                </p>
                            </div>
                            <Link
                                href={providerHref}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-7 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-primary/90"
                            >
                                Create provider account <ArrowRight size={16} />
                            </Link>
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
