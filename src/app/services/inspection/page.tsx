import Link from "next/link"
import { ArrowLeft, ArrowRight, ClipboardCheck, Wrench, Paintbrush, CarFront, ShieldCheck } from "lucide-react"
import { inspectionServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"
import { TradeXchangePartnerAction } from "@/components/tradexchange/TradeXchangeAccountActions"

const choices = [
    { kind: "prepurchase", title: "Pre-purchase inspection", detail: "Check the vehicle before buying or collecting it.", icon: ClipboardCheck },
    { kind: "mechanical", title: "Mechanical condition", detail: "Request checks for mechanical faults, diagnostics or other areas of concern.", icon: Wrench },
    { kind: "cosmetic", title: "Cosmetic and bodywork", detail: "Request checks of paintwork, panels, visible damage and cosmetic condition.", icon: Paintbrush },
    { kind: "stock", title: "Multiple vehicles / dealer stock", detail: "Request an agreed inspection scope for up to 12 vehicles at one location.", icon: CarFront },
] as const
const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-6"

export default function InspectionLandingPage() {
    if (!inspectionServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Inspections" />
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]">
            <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <Link href="/auctions" className="mb-6 inline-flex min-h-12 items-center gap-2 font-semibold hover:underline"><ArrowLeft size={18} aria-hidden="true" /> Back to TradeXchange</Link>
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300"><ClipboardCheck size={19} aria-hidden="true" /> Vehicle Inspections</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-heading font-black leading-tight tracking-tight sm:text-5xl">Independent vehicle inspections across the UK.</h1>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Compare fixed-price quotes from approved inspection businesses. Agree the scope, report requirements and availability with the provider before booking.</p>
            </div>
        </section>
        <div className="mx-auto max-w-7xl space-y-12 px-5 py-10 sm:px-8 sm:py-14">
            <section aria-labelledby="inspection-choice"><h2 id="inspection-choice" className="text-2xl font-heading font-bold">What would you like checked?</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{choices.map(choice => <Link key={choice.kind} href={"/services/inspection/new?kind=" + choice.kind} className={panel + " flex flex-col gap-3 hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"}>
                    <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"><choice.icon size={25} aria-hidden="true" /></span>
                    <h3 className="text-xl font-bold">{choice.title}</h3><p className="text-base leading-7 text-[var(--text-secondary)]">{choice.detail}</p>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-2 font-bold text-red-700 dark:text-red-300">Request quotes <ArrowRight size={18} aria-hidden="true" /></span>
                </Link>)}</div>
                <Link href="/services/jobs" className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-[var(--border-default)] px-5 py-3 font-semibold hover:bg-[var(--bg-input)]">My service requests</Link>
            </section>
            <section aria-labelledby="inspection-process"><h2 id="inspection-process" className="text-2xl font-heading font-bold">How it works</h2>
                <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
                    ["Describe the work", "Enter the vehicle details, inspection location and preferred checks."],
                    ["Compare quotes", "Approved providers can quote for the requested scope. Posting does not book or charge you."],
                    ["Choose and pay", "Review the provider's scope and price, accept a quote and pay through CarMazium."],
                    ["Review the findings", "Review the inspection outcome and agreed report. Completion and payout follow the service terms, including the 48-hour review period."],
                ].map(([title,detail],i) => <li key={title} className={panel}><span className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-input)] font-bold">{i+1}</span><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{detail}</p></li>)}</ol>
            </section>
            <section className={panel}><h2 className="text-xl font-bold">Inspections for CarMazium purchases</h2><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">Use the inspection option on an active retail advert to carry vehicle details into your request. If you have won an auction, use the linked inspection option on your won-auction page after buyer-fee clearance and before approved handover. A general inspection request does not qualify for the auction-specific refusal and buyer-fee refund process.</p></section>
            <section className={panel}><div className="flex gap-3"><ShieldCheck size={25} className="shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /><div><h2 className="text-xl font-bold">Approved inspection providers</h2><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">Inspection-only providers must provide approved Public Liability Insurance. Motor Trade Insurance is not required for inspection-only approval. Check the provider's experience and proposed inspection scope; approval is not a guarantee of a fault-free vehicle.</p></div></div></section>
            <section className={panel}><h2 className="text-xl font-bold">Do you provide vehicle inspections?</h2><p className="mt-2 max-w-3xl text-base leading-7 text-[var(--text-secondary)]">Apply for inspection services through your existing Partner Account. Approved providers can quote for suitable work. The platform fee is 9% of the accepted job price and the provider share is 91%, subject to service payment terms.</p><TradeXchangePartnerAction /></section>
        </div>
    </div>
}
