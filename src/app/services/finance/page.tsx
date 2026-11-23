import Link from "next/link"
import { ArrowLeft, ArrowRight, Banknote } from "lucide-react"
import { FinanceReferralForm } from "@/components/finance/FinanceReferralForm"
import { financeServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"

const panel = "rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-7"

export default async function VehicleFinanceServicePage({ searchParams }: { searchParams: Promise<{ listingId?: string }> }) {
    const { listingId } = await searchParams
    if (!financeServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Vehicle Finance" />
    return <div className="min-h-screen bg-[var(--bg-body)]">
        <section className="border-b border-[var(--border-default)] bg-[var(--bg-card)]"><div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
            <Link href="/auctions" className="mb-6 inline-flex min-h-12 items-center gap-2 font-semibold hover:underline"><ArrowLeft size={18} aria-hidden="true"/> Back to TradeXchange</Link>
            <p className="flex items-center gap-2 text-sm font-bold text-violet-700 dark:text-violet-300"><Banknote size={19} aria-hidden="true"/> Vehicle Finance</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-heading font-black leading-tight tracking-tight sm:text-5xl">Find your car. Explore your finance options.</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--text-secondary)]">Apply through the finance provider selected for a participating vehicle. CarMazium introduces you to the provider; it does not provide finance or make lending decisions.</p>
        </div></section>
        <div className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">
            {listingId ? <section className={panel}><FinanceReferralForm key={listingId} listingId={listingId} /></section> : <>
                <section className={panel}><h2 className="text-2xl font-bold">Start with the vehicle you want</h2><p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">On eligible retail adverts, you can use the calculator for illustrative monthly payments and choose Apply for Finance. The actual offer and eligibility are determined by the selected provider and lender.</p><Link href="/search" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800">Browse cars <ArrowRight size={18} aria-hidden="true"/></Link></section>
                <section><h2 className="text-2xl font-heading font-bold">How finance applications work</h2><ol className="mt-5 grid gap-4 sm:grid-cols-3">{[["Choose a vehicle","Find a participating retail listing and review the illustrative calculator."],["Enter contact details","Supply your name, email and telephone number. CarMazium records your interest and notifies its admin team."],["Continue with the provider","Complete a separate application on the selected provider's website. Finance is subject to status and lender approval."]].map(([title,detail],i)=><li key={title} className={panel}><span className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-input)] font-bold">{i+1}</span><h3 className="mt-3 font-bold text-lg">{title}</h3><p className="mt-2 text-base leading-7 text-[var(--text-secondary)]">{detail}</p></li>)}</ol></section>
            </>}
            <p className="text-sm leading-6 text-[var(--text-secondary)]">The calculator is not a finance offer. Sellers may switch off finance for their listings. CarMazium receives a fee from its finance partner for a successful application. Vehicle purchase payments remain between buyer and seller.</p>
            <section id="providers" className={panel+" scroll-mt-24"}><h2 className="text-xl font-bold">Finance businesses</h2><p className="mt-2 text-base text-[var(--text-secondary)]">Specialist integrations are arranged directly with CarMazium, not through service-job registration.</p><Link href="/contact?topic=finance-partnership" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-3 font-semibold">Discuss a finance partnership <ArrowRight size={17}/></Link></section>
        </div>
    </div>
}
