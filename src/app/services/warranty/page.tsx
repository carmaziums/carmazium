import { Suspense } from "react"
import { WarrantyQuoteForm } from "@/components/warranties/WarrantyQuoteForm"
import { ShieldCheck } from "lucide-react"
import { WarrantyProviderContact } from "@/components/services/WarrantyProviderContact"
import { warrantyServiceEnabled } from "@/lib/featureFlags"
import { ServiceTemporarilyUnavailable } from "@/components/services/ServiceTemporarilyUnavailable"

export default function WarrantyServicePage() {
    if (!warrantyServiceEnabled) return <ServiceTemporarilyUnavailable serviceName="Warranty" />
    return <main className="container mx-auto px-5 max-w-4xl pt-28 pb-20 space-y-10">
        <section className="space-y-5">
            <ShieldCheck className="text-primary" size={40} />
            <h1 className="text-4xl md:text-5xl font-black font-heading">Vehicle warranties</h1>
            <p className="text-lg text-[var(--text-muted)]">Get your price, choose your cover options and pay securely online.</p>
            <p className="text-sm text-[var(--text-muted)]">Warrantywise warranties arranged through Pulse Cars Limited, the broker. CarMazium is the platform. Admin arranges issuance after payment.</p>
        </section>
        <Suspense fallback={<p>Loading warranty form…</p>}><WarrantyQuoteForm /></Suspense>
        <WarrantyProviderContact />
    </main>
}
