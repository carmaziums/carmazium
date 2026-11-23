import Link from "next/link"
import { Suspense } from "react"
import { WarrantyQuoteForm } from "@/components/warranties/WarrantyQuoteForm"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { warrantyServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"

export default function WarrantyServicePage() {
    if (!warrantyServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Warranty" />
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]"><div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
            <Link href="/auctions" className="mb-6 inline-flex min-h-12 items-center gap-2 font-semibold hover:underline"><ArrowLeft size={18} aria-hidden="true"/> Back to TradeXchange</Link>
            <p className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300"><ShieldCheck size={19} aria-hidden="true"/> Vehicle Warranty</p>
            <h1 className="mt-3 text-4xl font-heading font-black leading-tight tracking-tight sm:text-5xl">Choose your 12-month vehicle warranty.</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Choose your cover options, get a confirmed price and pay online. Warrantywise warranties are arranged through Pulse Cars Limited, the broker. CarMazium is the platform.</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Payment creates a warranty order. Cover is active only after issuance and from the confirmed cover start date, subject to plan terms and vehicle eligibility.</p>
            <div className="mt-5 flex flex-wrap gap-3"><a href="#warranty-quote" className="inline-flex min-h-12 items-center rounded-xl bg-red-700 px-5 py-3 font-bold text-white">Choose cover</a><Link href="/dashboard/warranties" className="inline-flex min-h-12 items-center rounded-xl border border-[var(--border-default)] px-5 py-3 font-semibold">My warranty orders</Link></div>
        </div></section>
        <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8">
            <section id="warranty-quote" className="scroll-mt-24"><Suspense fallback={<p role="status">Loading warranty form…</p>}><WarrantyQuoteForm /></Suspense></section>
            <section id="providers" className="scroll-mt-24 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7"><h2 className="text-xl font-bold">Warranty businesses</h2><p className="mt-2 text-base text-[var(--text-secondary)]">CarMazium arranges specialist warranty partnerships directly. Contact the team to discuss your products and integration.</p><Link href="/contact?topic=warranty-partnership" className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-[var(--border-default)] px-4 py-3 font-semibold">Discuss a warranty partnership</Link></section>
        </div>
    </div>
}
