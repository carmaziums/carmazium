"use client"

import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, FileText, ShieldCheck } from "lucide-react"
import { warrantyServiceEnabled } from "@/lib/featureFlags"
import { ServiceLeadForm } from "@/components/services/ServiceLeadForm"

export default function WarrantyServicePage() {
    if (!warrantyServiceEnabled) notFound()
    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-5xl">
                <Link href="/services" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={15} /> Service Hub</Link>
                <div className="grid lg:grid-cols-[0.75fr_1.25fr] gap-10 items-start">
                    <aside className="lg:sticky lg:top-24">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5"><ShieldCheck /></div>
                        <h1 className="text-4xl font-black font-heading mb-4">Warranty Providers</h1>
                        <p className="text-[var(--text-muted)] leading-relaxed mb-6">Tell us about the vehicle and the cover you want. Approved matching warranty providers can respond with products for you to compare.</p>
                        <div className="space-y-4 text-sm">
                            <p className="flex gap-3"><CheckCircle size={18} className="text-emerald-500 shrink-0" /> Only providers approved by CarMazium for Warranty receive the enquiry.</p>
                            <p className="flex gap-3"><FileText size={18} className="text-emerald-500 shrink-0" /> Providers supply their own cover levels, exclusions, claim limits and eligibility terms.</p>
                            <p className="flex gap-3"><ShieldCheck size={18} className="text-emerald-500 shrink-0" /> CarMazium does not collect the warranty premium through the service-job payment system.</p>
                        </div>
                        <div className="mt-7 p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-xs text-[var(--text-muted)] leading-relaxed">
                            Always read the provider's full warranty terms before purchasing, including covered components, exclusions, labour rates, claim limits and maintenance requirements.
                        </div>
                    </aside>
                    <ServiceLeadForm type="WARRANTY" />
                </div>
            </main>
        </div>
    )
}
