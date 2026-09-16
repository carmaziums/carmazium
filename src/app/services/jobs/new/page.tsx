"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, ClipboardCheck, Truck } from "lucide-react"
import { deliveryServiceEnabled, inspectionServiceEnabled } from "@/lib/featureFlags"

export default function NewServiceJobPage() {
    if (!deliveryServiceEnabled && !inspectionServiceEnabled) notFound()

    const jobTypes = [
        {
            title: "Delivery, Collection or Recovery",
            description: "Move one or more vehicles between locations. Approved transport providers compete with fixed-price quotes.",
            href: "/services/delivery/new",
            icon: Truck,
            enabled: deliveryServiceEnabled,
            detail: "Delivery · Collection · Recovery",
        },
        {
            title: "Vehicle Inspection",
            description: "Ask an approved inspection provider to check a vehicle before you buy or collect it, then compare provider quotes.",
            href: "/services/inspection/new",
            icon: ClipboardCheck,
            enabled: inspectionServiceEnabled,
            detail: "Pre-purchase · Condition · Independent check",
        },
    ].filter((job) => job.enabled)

    return (
        <div className="min-h-screen pt-24 pb-20">
            <main className="container mx-auto px-5 max-w-4xl">
                <Link
                    href="/services"
                    className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-primary mb-7"
                >
                    <ArrowLeft size={15} /> TradeXchange
                </Link>

                <div className="max-w-2xl mb-10">
                    <p className="text-primary text-xs font-black uppercase tracking-[0.22em] mb-3">TradeXchange Jobs</p>
                    <h1 className="text-3xl md:text-5xl font-black font-heading tracking-tight mb-3">Post a job</h1>
                    <p className="text-[var(--text-secondary)] text-base md:text-lg">
                        Tell us what you need. Your job goes live to approved providers who can compete for the work by sending you quotes. You choose the provider and price you prefer.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                    {jobTypes.map((job) => (
                        <Link
                            key={job.title}
                            href={job.href}
                            className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-7 hover:border-primary/50 hover:bg-primary/[0.03] transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                                <job.icon size={24} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">{job.detail}</p>
                            <h2 className="text-xl font-bold font-heading mb-2">{job.title}</h2>
                            <p className="text-sm leading-relaxed text-[var(--text-muted)] mb-6">{job.description}</p>
                            <span className="inline-flex items-center gap-2 text-sm font-black text-primary">
                                Continue <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    ))}
                </div>

                <div className="mt-8 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-sm text-[var(--text-muted)]">
                    Posting is open to signed-in CarMazium users. Only providers approved for the relevant service can submit a quote, helping keep competition genuine and the job marketplace safer.
                </div>
            </main>
        </div>
    )
}
