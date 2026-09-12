"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Banknote,
    CheckCircle,
    FileText,
    LayoutDashboard,
    Lock,
    ShieldCheck,
    Truck,
    Users,
} from "lucide-react"
import { deliveryServiceEnabled } from "@/lib/featureFlags"
import { useAuth } from "@/context/AuthContext"

const STEPS = [
    { icon: FileText, title: "Post the route", desc: "Where the car is, where it is going, and when. One car or a full load." },
    { icon: Users, title: "Approved transporters quote", desc: "Only businesses CarMazium has approved for delivery can see and quote on the job." },
    { icon: Lock, title: "Pick one and pay CarMazium", desc: "Your service payment is held by CarMazium. Provider contact details unlock after you accept and pay." },
    { icon: CheckCircle, title: "Confirm delivery, then payout", desc: "When the vehicle arrives you confirm completion. The provider payout is then released." },
]

export default function DeliveryLandingPage() {
    const { user } = useAuth()
    if (!deliveryServiceEnabled) notFound()

    const providerHref = user
        ? "/dashboard/service/capabilities"
        : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
            <section className="relative overflow-hidden border-b border-[var(--border-default)]" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(237,28,36,0.10)_0%,transparent_55%)]" />
                <div className="container mx-auto px-6 py-16 md:py-24 relative">
                    <Link href="/auctions" className="mb-7 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary">
                        <ArrowLeft size={15} /> Back to TradeXchange
                    </Link>
                    <div className="max-w-3xl">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-widest text-primary">
                            <Truck size={13} /> TradeXchange · Delivery &amp; Recovery
                        </motion.div>
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-4xl md:text-6xl font-black font-heading tracking-tight leading-[0.95] mb-5">
                            Move any car,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-red-700">anywhere in the UK.</span>
                        </motion.h1>
                        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="text-[var(--text-muted)] text-lg max-w-xl leading-relaxed mb-8">
                            Post a route and approved transport businesses compete with fixed-price quotes. Use it for single vehicles, multi-car moves and recovery jobs for non-runners.
                        </motion.p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Link href="/services/delivery/new" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors shadow-neon">
                                Post a delivery job <ArrowRight size={16} />
                            </Link>
                            {user && (
                                <Link href="/services/jobs" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors">
                                    My jobs
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">For customers</p>
                    <h2 className="text-3xl md:text-4xl font-black font-heading tracking-tight">Four steps from route to delivery</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {STEPS.map((step, index) => (
                        <div key={step.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <step.icon size={18} className="text-primary" />
                                </div>
                                <span className="text-xs font-black text-[var(--text-muted)]">0{index + 1}</span>
                            </div>
                            <h3 className="font-heading font-bold mb-2">{step.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]">
                <div className="container mx-auto px-6 py-14 grid md:grid-cols-3 gap-6">
                    <div className="flex gap-4"><ShieldCheck size={22} className="text-primary shrink-0 mt-0.5" /><div><h3 className="font-heading font-bold mb-1">Approved transporters only</h3><p className="text-sm text-[var(--text-muted)] leading-relaxed">Only businesses approved by CarMazium for Delivery &amp; Recovery can quote.</p></div></div>
                    <div className="flex gap-4"><Banknote size={22} className="text-primary shrink-0 mt-0.5" /><div><h3 className="font-heading font-bold mb-1">Protected service payment</h3><p className="text-sm text-[var(--text-muted)] leading-relaxed">The accepted job is paid through CarMazium and released to the provider after completion.</p></div></div>
                    <div className="flex gap-4"><Users size={22} className="text-primary shrink-0 mt-0.5" /><div><h3 className="font-heading font-bold mb-1">Contact shared after selection</h3><p className="text-sm text-[var(--text-muted)] leading-relaxed">The provider gets the customer contact details after the quote is accepted and the job moves forward.</p></div></div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16 md:py-20">
                <div className="rounded-3xl border border-primary/25 bg-primary/5 p-8 md:p-10">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-3">For transport providers</p>
                            <h2 className="text-3xl font-black font-heading mb-4">Win more vehicle movement work through TradeXchange</h2>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
                                Apply for Delivery &amp; Recovery capability and, once approved, quote on suitable jobs posted by CarMazium users.
                            </p>
                            <div className="rounded-2xl border border-primary/25 bg-[var(--bg-card)] p-5 mb-6">
                                <p className="font-black mb-1">9% CarMazium platform fee. You keep 91%.</p>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">The fee is deducted from the accepted job price. Your 91% provider payout is released after the job is successfully completed and payment is released.</p>
                            </div>
                            <Link href={providerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                                Apply as a delivery provider <ArrowRight size={15} />
                            </Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><BadgeCheck className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Approved-provider visibility</h3><p className="text-xs text-[var(--text-muted)]">Customers can see they are choosing from businesses approved for delivery work.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><LayoutDashboard className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">One job dashboard</h3><p className="text-xs text-[var(--text-muted)]">See available work, accepted jobs and progress from the same provider area.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><Banknote className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Clear payout economics</h3><p className="text-xs text-[var(--text-muted)]">Know the customer price, the 9% platform fee and your 91% share before completion.</p></div></div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
