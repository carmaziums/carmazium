"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle, FileSearch, ShieldCheck, Users, CreditCard } from "lucide-react"
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

    return (
        <div className="min-h-screen" style={{ background: "var(--bg-body)" }}>
            <section className="relative overflow-hidden border-b border-[var(--border-default)]" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10)_0%,transparent_55%)]" />
                <div className="container mx-auto px-6 py-16 md:py-24 relative">
                    <div className="max-w-3xl">
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 mb-6 text-xs font-bold uppercase tracking-widest text-emerald-500">
                            <FileSearch size={13} /> TradeXchange · Vehicle Inspections
                        </motion.div>
                        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-6xl font-black font-heading tracking-tight leading-[0.95] mb-5">
                            Inspect the car <span className="text-primary">before you commit.</span>
                        </motion.h1>
                        <p className="text-[var(--text-muted)] text-lg max-w-xl leading-relaxed mb-8">
                            Post one vehicle inspection request and approved inspection businesses can compete for the job. Choose the quote you want and keep the payment protected through CarMazium until the work is completed.
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
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {STEPS.map((s, i) => (
                        <div key={s.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><s.icon size={18} className="text-primary" /></div>
                            <p className="text-[10px] font-black text-[var(--text-muted)] mb-1">0{i + 1}</p>
                            <h3 className="font-heading font-bold mb-2">{s.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.desc}</p>
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
        </div>
    )
}
