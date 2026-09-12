"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle, LayoutDashboard, ShieldCheck, Users } from "lucide-react"
import { financeServiceEnabled } from "@/lib/featureFlags"
import { ServiceLeadForm } from "@/components/services/ServiceLeadForm"
import { useAuth } from "@/context/AuthContext"

export default function VehicleFinanceServicePage() {
    const { user } = useAuth()
    if (!financeServiceEnabled) notFound()

    const providerHref = user
        ? "/dashboard/service/capabilities"
        : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-6xl">
                <Link href="/auctions" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Back to TradeXchange</Link>

                <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start mb-16">
                    <aside className="lg:sticky lg:top-24">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-1.5 mb-5 text-xs font-bold uppercase tracking-widest text-amber-500">
                            <Building2 size={13} /> TradeXchange · Vehicle Finance
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black font-heading mb-4">Vehicle Finance</h1>
                        <p className="text-[var(--text-muted)] leading-relaxed mb-6">Send one enquiry to approved matching finance providers instead of filling the same information into several forms.</p>
                        <div className="space-y-4 text-sm">
                            <p className="flex gap-3"><CheckCircle size={18} className="text-emerald-500 shrink-0" /> Only providers approved by CarMazium for Vehicle Finance receive the enquiry.</p>
                            <p className="flex gap-3"><ShieldCheck size={18} className="text-emerald-500 shrink-0" /> Your contact details are shared only after you explicitly consent.</p>
                            <p className="flex gap-3"><Building2 size={18} className="text-emerald-500 shrink-0" /> Providers supply their own terms, eligibility checks, APR and regulated disclosures.</p>
                        </div>
                        <div className="mt-7 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-xs text-[var(--text-muted)] leading-relaxed">
                            CarMazium does not make a lending decision and this form is not a credit approval. Any finance agreement is between you and the provider.
                        </div>
                    </aside>
                    <ServiceLeadForm type="FINANCE" />
                </section>

                <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-8 md:p-10">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">For finance providers</p>
                            <h2 className="text-3xl font-black font-heading mb-4">Receive matched vehicle-finance enquiries through TradeXchange</h2>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
                                Apply for Vehicle Finance capability. Once approved, your business can receive relevant enquiries from CarMazium users and respond with your own eligibility process, products and regulated terms.
                            </p>
                            <div className="rounded-2xl border border-amber-500/25 bg-[var(--bg-card)] p-5 mb-6">
                                <p className="font-black mb-1">Finance uses a matched-enquiry model — not the 9% job payout model.</p>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">CarMazium does not collect the customer's finance payment or deduct the Delivery/Inspection 9% platform fee from a finance payout. The finance provider controls its own lending terms and customer agreement.</p>
                            </div>
                            <Link href={providerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                                Apply as a finance provider <ArrowRight size={15} />
                            </Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><BadgeCheck className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Capability-specific approval</h3><p className="text-xs text-[var(--text-muted)]">Only businesses approved for Vehicle Finance receive finance enquiries.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><Users className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Matched customer demand</h3><p className="text-xs text-[var(--text-muted)]">Receive finance enquiries generated inside the wider CarMazium vehicle journey.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><LayoutDashboard className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Dedicated enquiry inbox</h3><p className="text-xs text-[var(--text-muted)]">Review and manage TradeXchange finance enquiries from your provider dashboard.</p></div></div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
