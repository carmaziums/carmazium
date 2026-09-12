"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle, FileText, LayoutDashboard, ShieldCheck, Users } from "lucide-react"
import { warrantyServiceEnabled } from "@/lib/featureFlags"
import { ServiceLeadForm } from "@/components/services/ServiceLeadForm"
import { useAuth } from "@/context/AuthContext"

export default function WarrantyServicePage() {
    const { user } = useAuth()
    if (!warrantyServiceEnabled) notFound()

    const providerHref = user
        ? "/dashboard/service/capabilities"
        : "/auth/signup?role=CONTRACTOR&redirect=%2Fdashboard%2Fservice%2Fcapabilities"

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-6xl">
                <Link href="/auctions" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Back to TradeXchange</Link>

                <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start mb-16">
                    <aside className="lg:sticky lg:top-24">
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/10 px-4 py-1.5 mb-5 text-xs font-bold uppercase tracking-widest text-purple-500">
                            <ShieldCheck size={13} /> TradeXchange · Warranty Providers
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black font-heading mb-4">Vehicle Warranty</h1>
                        <p className="text-[var(--text-muted)] leading-relaxed mb-6">Tell us about the vehicle and the cover you want. Approved matching warranty providers can respond with products and indicative prices for you to compare.</p>
                        <div className="space-y-4 text-sm">
                            <p className="flex gap-3"><CheckCircle size={18} className="text-emerald-500 shrink-0" /> Only providers approved by CarMazium for Warranty receive the enquiry.</p>
                            <p className="flex gap-3"><FileText size={18} className="text-emerald-500 shrink-0" /> Providers supply their own cover levels, exclusions, claim limits and eligibility terms.</p>
                            <p className="flex gap-3"><ShieldCheck size={18} className="text-emerald-500 shrink-0" /> CarMazium does not collect the warranty premium through the service-job payment system.</p>
                        </div>
                        <div className="mt-7 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-xs text-[var(--text-muted)] leading-relaxed">
                            Always read the provider&apos;s full warranty terms before purchasing, including covered components, exclusions, labour rates, claim limits and maintenance requirements.
                        </div>
                    </aside>
                    <ServiceLeadForm type="WARRANTY" />
                </section>

                <section className="rounded-3xl border border-purple-500/25 bg-purple-500/5 p-8 md:p-10">
                    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                        <div>
                            <p className="text-purple-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">For warranty providers</p>
                            <h2 className="text-3xl font-black font-heading mb-4">Put your warranty products in front of active vehicle customers</h2>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
                                Apply for Warranty capability. Once approved, your business can receive relevant enquiries and respond with the cover, pricing, exclusions and product terms you offer.
                            </p>
                            <div className="rounded-2xl border border-purple-500/25 bg-[var(--bg-card)] p-5 mb-6">
                                <p className="font-black mb-1">Warranty uses a matched-enquiry model — not the 9% job payout model.</p>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">CarMazium does not collect the warranty premium through the Delivery/Inspection service-job flow or deduct that 9% job fee from a warranty payout. The provider issues its own product terms and customer agreement.</p>
                            </div>
                            <Link href={providerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                                Apply as a warranty provider <ArrowRight size={15} />
                            </Link>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><BadgeCheck className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Capability-specific approval</h3><p className="text-xs text-[var(--text-muted)]">Only businesses approved for Warranty receive warranty enquiries.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><Users className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Relevant vehicle demand</h3><p className="text-xs text-[var(--text-muted)]">Reach users already buying, selling and managing vehicles through the CarMazium ecosystem.</p></div></div>
                            <div className="flex gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5"><LayoutDashboard className="text-primary shrink-0" /><div><h3 className="font-bold text-sm mb-1">Dedicated enquiry inbox</h3><p className="text-xs text-[var(--text-muted)]">Review and manage TradeXchange warranty enquiries from your provider dashboard.</p></div></div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
