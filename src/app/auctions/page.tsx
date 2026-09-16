"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, BadgeCheck, Banknote, BriefcaseBusiness, ClipboardList, Gavel, LayoutDashboard, Plus, Search, ShieldCheck, Truck, Users, Wrench, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { deliveryServiceEnabled, inspectionServiceEnabled, financeServiceEnabled, warrantyServiceEnabled } from "@/lib/featureFlags"

type Pillar = { icon: LucideIcon; title: string; eyebrow: string; description: string; points: string[]; href?: string; cta: string }

const PILLARS: Pillar[] = [
    { icon: Gavel, title: "Vehicle Auctions", eyebrow: "Buy & sell trade stock", description: "Sell vehicles in dealer auctions or bid as a verified motor trader, with live bidding and anti-snipe protection.", points: ["Free auction listings", "£100 qualifying seller bonus", "£125 fee for the winning dealer"], href: "/auctions/how-it-works", cta: "Explore auctions" },
    { icon: Truck, title: "Delivery & Recovery", eyebrow: "Move vehicles nationwide", description: "Post a route and let approved transport businesses compete with fixed-price quotes for delivery or recovery work.", points: ["Single and multi-car moves", "Protected service payment", "Providers keep 91% of completed paid jobs"], ...(deliveryServiceEnabled ? { href: "/services/delivery" } : {}), cta: "Explore delivery" },
    { icon: Wrench, title: "Vehicle Inspections", eyebrow: "Check before you commit", description: "Request an independent vehicle inspection and compare fixed-price quotes from approved inspection providers.", points: ["Pre-purchase checks", "Competitive provider quotes", "Providers keep 91% of completed paid jobs"], ...(inspectionServiceEnabled ? { href: "/services/inspection" } : {}), cta: "Explore inspections" },
    { icon: Banknote, title: "Vehicle Finance", eyebrow: "Matched finance enquiries", description: "Send an enquiry to approved finance providers and compare the options, eligibility and regulated terms they return.", points: ["Matched provider enquiries", "Consent-led contact sharing", "Provider controls its own terms and APR"], ...(financeServiceEnabled ? { href: "/services/finance" } : {}), cta: "Explore finance" },
    { icon: ShieldCheck, title: "Warranty Providers", eyebrow: "Compare vehicle cover", description: "Request warranty options for a vehicle and hear from approved providers offering their own products, cover and exclusions.", points: ["Matched warranty enquiries", "Compare cover levels", "Provider issues its own policy terms"], ...(warrantyServiceEnabled ? { href: "/services/warranty" } : {}), cta: "Explore warranty" },
]

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
    const { icon: Icon, title, eyebrow, description, points, href, cta } = pillar
    const body = (
        <>
            <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"><Icon size={22} className="text-primary" /></div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${href ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-amber-500/25 bg-amber-500/10 text-amber-500"}`}>{href ? "Open now" : "Unavailable"}</span>
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h3 className="mb-3 text-xl font-black font-heading tracking-tight">{title}</h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
            <ul className="mb-6 space-y-2.5">{points.map(point => <li key={point} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{point}</li>)}</ul>
            {href && <span className="mt-auto inline-flex items-center justify-between border-t border-[var(--border-default)] pt-4 text-sm font-black text-primary">{cta}<ArrowRight size={16} /></span>}
        </>
    )
    return <motion.article initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05 }} className="h-full">{href ? <Link href={href} className="group flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">{body}</Link> : <div className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6 opacity-70">{body}</div>}</motion.article>
}

const BENEFITS = [
    { icon: Users, title: "Relevant automotive demand", text: "Reach buyers, sellers and dealers already using CarMazium around a live vehicle journey." },
    { icon: BriefcaseBusiness, title: "Choose suitable work", text: "Delivery and Inspection providers quote only on jobs that fit their routes, availability and pricing." },
    { icon: Banknote, title: "91% on paid service jobs", text: "For completed Delivery and Inspection jobs, the provider share is 91% and the CarMazium platform fee is 9%." },
    { icon: BadgeCheck, title: "Capability approval", text: "Each provider capability is reviewed separately so customers can see which services a business is approved to offer." },
    { icon: LayoutDashboard, title: "One provider workspace", text: "Manage approved capabilities, relevant jobs, accepted work and matched enquiries from one dashboard." },
    { icon: ShieldCheck, title: "Correct model for each service", text: "Delivery and Inspection use paid jobs; Finance and Warranty use matched enquiries under provider terms." },
]

export default function TradeXchangePage() {
    const { user } = useAuth()
    const providerHref = user ? "/dashboard/service/capabilities" : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"
    const jobMarketplaceEnabled = deliveryServiceEnabled || inspectionServiceEnabled

    return <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
        <section className="relative overflow-hidden text-white" style={{ marginTop: "-80px", paddingTop: "80px" }}>
            <Image src="/assets/images/live-auction-hero.jpg" alt="TradeXchange automotive marketplace" fill priority className="object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/25" />
            <div className="container mx-auto px-6 py-20 md:py-24 relative z-10"><div className="max-w-4xl">
                <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-red-300">CarMazium TradeXchange</p>
                <h1 className="mb-6 text-4xl md:text-6xl font-black font-heading tracking-tight leading-[1.02]">One marketplace. <span className="text-primary">Five automotive services.</span></h1>
                <p className="max-w-3xl text-lg leading-relaxed text-slate-100">Auction vehicles, arrange delivery or recovery, request inspections, send finance enquiries and compare warranty options — with each service keeping its own clear workflow.</p>
                <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link href={providerHref}>Become a provider <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild variant="outline" size="lg" className="border-white/35 text-white hover:bg-white/10 hover:border-white/60"><a href="#tradexchange-areas">Explore TradeXchange</a></Button></div>
            </div></div>
        </section>

        {jobMarketplaceEnabled && <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]"><div className="container mx-auto px-6 py-10">
            <div className="mb-6 max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Paid service jobs</p><h2 className="mt-2 text-2xl font-black font-heading">Post, quote and manage Delivery or Inspection work</h2><p className="mt-2 text-sm text-[var(--text-muted)]">The paid-job marketplace applies to Delivery, Recovery and Inspection. Finance and Warranty use matched enquiries instead.</p></div>
            <div className="grid gap-4 md:grid-cols-3"><Link href="/services/jobs/new" className="rounded-2xl bg-primary p-6 text-white hover:bg-primary/90"><Plus size={20} className="mb-3" /><span className="block font-black">Post a Job</span><span className="mt-1 block text-xs text-white/80">Delivery, collection, recovery or inspection.</span></Link><Link href="/dashboard/service/jobs" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6 hover:border-primary/50"><Search size={20} className="mb-3 text-primary" /><span className="block font-black">Available Jobs</span><span className="mt-1 block text-xs text-[var(--text-muted)]">Approved providers can quote on suitable work.</span></Link><Link href="/services/jobs" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6 hover:border-primary/50"><ClipboardList size={20} className="mb-3 text-primary" /><span className="block font-black">My Jobs</span><span className="mt-1 block text-xs text-[var(--text-muted)]">Track posts, compare quotes and manage jobs.</span></Link></div>
        </div></section>}

        <section id="tradexchange-areas" className="container mx-auto px-6 py-16 md:py-20 scroll-mt-24">
            <div className="mx-auto mb-10 max-w-3xl text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">Choose an area</p><h2 className="mb-3 text-3xl md:text-4xl font-black font-heading tracking-tight">Five services. One connected marketplace.</h2><p className="text-[var(--text-muted)]">Each area explains its rules, fees and next step before you continue.</p></div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">{PILLARS.map((pillar, index) => <div key={pillar.title} className={index < 3 ? "xl:col-span-2" : index === 3 ? "xl:col-span-2 xl:col-start-2" : "xl:col-span-2"}><PillarCard pillar={pillar} index={index} /></div>)}</div>
        </section>

        <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]"><div className="container mx-auto px-6 py-16 md:py-20">
            <div className="mx-auto mb-12 max-w-3xl text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">For automotive businesses</p><h2 className="mb-4 text-3xl md:text-5xl font-black font-heading tracking-tight">Build a Partner Account around the services you offer</h2><p className="text-[var(--text-muted)] leading-relaxed">Vehicle Dealer, Delivery & Recovery and Vehicle Inspection are capabilities within the wider business account. Finance and Warranty providers can also participate through their matched-enquiry workflows.</p></div>
            <div className="mb-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{BENEFITS.map(item => <article key={item.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"><item.icon size={19} className="text-primary" /></div><h3 className="mb-2 font-bold font-heading">{item.title}</h3><p className="text-sm leading-relaxed text-[var(--text-muted)]">{item.text}</p></article>)}</div>
            <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">Delivery & Inspection</p><h3 className="mb-4 text-2xl md:text-3xl font-black font-heading">Paid jobs: 91% provider share</h3><p className="text-sm leading-relaxed text-[var(--text-muted)]">Providers set their fixed quote. After a successfully completed paid Delivery or Inspection job is released, the provider receives 91% of the accepted job price and CarMazium keeps a 9% platform fee.</p></div>
                <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-input)] p-8"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">Finance & Warranty</p><h3 className="mb-4 text-2xl md:text-3xl font-black font-heading">Matched enquiries, not 9% jobs</h3><p className="text-sm leading-relaxed text-[var(--text-muted)]">Approved Finance and Warranty providers receive relevant customer enquiries and respond using their own products, commercial terms and required regulated information.</p></div>
            </div>
            <div className="mt-10 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-primary">Ready to join?</p><h3 className="text-2xl md:text-3xl font-black font-heading">Create a Partner Account and apply for the capabilities you offer.</h3></div><Button asChild size="lg"><Link href={providerHref}>Open provider setup <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></div>
        </div></section>

        <section className="container mx-auto px-6 py-14"><div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-input)] p-8 text-center"><h2 className="mb-3 text-2xl md:text-3xl font-black font-heading">Not sure where to start?</h2><p className="mx-auto mb-6 max-w-2xl text-[var(--text-muted)]">Use the TradeXchange service hub to see every available customer and provider action in one place.</p><Button asChild variant="outline" size="lg"><Link href="/services">View TradeXchange Services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>
    </div>
}
