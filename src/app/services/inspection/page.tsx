"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    CheckCircle,
    CreditCard,
    FileSearch,
    LayoutDashboard,
    ShieldCheck,
    Users,
} from "lucide-react"
import { inspectionServiceEnabled } from "@/lib/featureFlags"
import { useAuth } from "@/context/AuthContext"

const STEPS = [
    { icon: FileSearch, title: "Post the vehicle", desc: "Tell inspectors where the car is, when you need it checked and the vehicle details." },
    { icon: Users, title: "Approved inspectors quote", desc: "Providers approved by CarMazium for inspection work send fixed-price quotes." },
    { icon: CreditCard, title: "Choose and pay", desc: "Accept the quote you prefer and pay through CarMazium. Provider contact details then unlock." },
    { icon: CheckCircle, title: "Inspection completed", desc: "The inspector completes the job. You confirm completion before their payout is released." },
]

export default function InspectionLandingPage() {
    const { user } = useAuth()
    if (!inspectionServiceEnabled) notFound()

    const providerHref = user
        ? "/dashboard/service/capabilities"
        : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
            <section className="relative overflow-hidden border-b border-[var(--border-default)]" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10)_0%,transparent_55%)]" />
                <div className="container mx-auto px-6 py-16 md:py-24 relative">
                    <Link href="/auctions" className="mb-7 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary">
                        <ArrowLeft size={15} /> Back to TradeXchange
                    </Link>
                    <div className="max-w-3xl">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-widest text-emerald-500">
                            <FileSearch size={13} /> TradeXchange · Vehicle Inspections
                        </motion.div>
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-6xl font-black font-heading tracking-tight leading-[0.95] mb-5">
                            Inspect the car <span className="text-primary">before you commit.</span>
                        </motion.h1>
                        <p className="text-[var(--text-muted)] text-lg max-w-xl leading-relaxed mb-8">
                            Post one vehicle inspection request and approved inspection businesses can compete for the job. Choose the quote you want and keep the service payment protected through CarMazium until the work is completed.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link href="/services/inspection/new" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-neon">
                                Request an inspection <ArrowRight size={16} />
                            </Link>
                            {user && <Link href="/services/jobs" className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-[var(--border-default)] text-sm font-bold">My jobs</Link>}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">For customers</p>
                    <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight">From request to completed inspection</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {STEPS.map((step, index) => (
                        <div key={step.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><step.icon size={18} className="text-primary" /></div>
                            <p className="text-[10px] font-black text-[var(--text-muted)] mb-1">0{index + 1}</p>
                            <h3 className="font-heading font-bold mb-2">{step.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="container mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
                    <div className="flex gap-3"><ShieldCheck className="text-primary shrink-0" /><p className="text-sm text-[var(--text-muted)]"><b className="text-[var(--text-primary)]">Approved providers.</b> Only contractors approved for Vehicle Inspections can quote.</p></div>
                    <div className="flex gap-3"><CreditCard className="text-primary shrink-0" /><p className="text-sm text-[var(--text-muted)]"><b className="text-[var(--text-primary)]">Protected payment.</b> The accepted quote uses the same secure service-payment flow as vehicle delivery.</p></div>
                    <div className="flex gap-3"><Users className="text-primary shrink-0" /><p className="text-sm text-[var(--text-muted)]"><b className="text-[var(--text-primary)]">9% platform fee.</b> Deducted from the provider payout; the provider keeps 91%.</p></div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16 md:py-20">
                <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-8 md:p-10">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">For inspection providers</p>
                            <h2 className="text-3xl font-black font-heading mb-4">Turn your inspection expertise into more paid work</h2>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
                                Apply for Vehicle Inspection capability. Once approved, you can quote on suitable inspection requests and compete for work through TradeXchange.
                            </p>
                            <div className="rounded-2xl border border-emerald-500/25 bg-[var(--bg-card)] p-5 mb-6">
                                <p className="font-black mb-1">9% CarMazium platform fee. You keep 91%.</p>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">The fee is deducted from the accepted job price. Your 91% provider payout is released after the inspection is completed and the customer confirms completion.</p>
                            </div>
                            <Link href={providerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                                Apply as an inspection provider <ArrowRight size={15} />
                            </Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><BadgeCheck className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Capability-based approval</h3><p className="text-xs text-[var(--text-muted)]">Customers see providers who have been approved specifically for inspection work.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><LayoutDashboard className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Central job dashboard</h3><p className="text-xs text-[var(--text-muted)]">Track available inspection work, accepted jobs and progress in one place.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><Users className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Compete for relevant work</h3><p className="text-xs text-[var(--text-muted)]">Quote selectively on the inspection requests that suit your business and availability.</p></div></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
