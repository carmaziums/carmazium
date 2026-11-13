import Link from "next/link"
import { FinanceReferralForm } from "@/components/finance/FinanceReferralForm"
import { FinanceProviderContact } from "@/components/finance/FinanceProviderContact"

export default async function VehicleFinanceServicePage({ searchParams }: { searchParams: Promise<{ listingId?: string }> }) {
    const { listingId } = await searchParams
    return <main className="container mx-auto max-w-4xl px-5 py-12 space-y-8">
        <Link href="/services" className="text-sm text-primary">Back to services</Link>
        <header className="space-y-4"><h1 className="text-4xl font-bold">Vehicle Finance</h1>
            <p className="text-[var(--text-muted)]">Apply through Jigsaw Finance, a third-party finance broker. CarMazium does not provide finance or make lending decisions.</p>
        </header>
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
            {listingId ? <FinanceReferralForm key={listingId} listingId={listingId} /> : <div className="space-y-4"><h2 className="text-2xl font-bold">Start with the vehicle you want</h2><p>On a participating retail listing, select Apply for Finance. Enter your name, email address and phone number; we notify the CarMazium admin team, then take you to the application on Jigsaw Finance’s website.</p><p className="text-sm text-[var(--text-muted)]">Sellers choose whether to show the calculator and application button. Jigsaw handles the separate application, checks and finance disclosures. Finance is subject to status and lender approval. CarMazium charges its finance partner a fee for a successful application.</p><Link href="/search" className="inline-block rounded-xl bg-primary px-5 py-3 font-bold text-white">Browse cars</Link></div>}
        </section>
        <div id="providers"><FinanceProviderContact /></div>
    </main>
}
