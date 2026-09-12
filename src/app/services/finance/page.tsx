"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, CheckCircle, ShieldCheck } from "lucide-react"
import { financeServiceEnabled } from "@/lib/featureFlags"
import { ServiceLeadForm } from "@/components/services/ServiceLeadForm"

export default function VehicleFinanceServicePage() {
    if (!financeServiceEnabled) notFound()
    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-5xl">
                <Link href="/services" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Service Hub</Link>
                <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-10 items-start">
                    <aside className="lg:sticky lg:top-24">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5"><Building2 /></div>
                        <h1 className="text-4xl font-black font-heading mb-4">Vehicle Finance</h1>
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
                </div>
            </main>
        </div>
    )
}
