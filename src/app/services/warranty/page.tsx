import Link from "next/link"
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
            <p className="text-lg text-[var(--text-muted)]">CarMazium admin manages warranty partners and customer warranty enquiries directly.</p>
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
                <h2 className="text-xl font-bold">Contact our warranty team</h2>
                <p>Online warranty quotes and purchases are being prepared. Contact our team about availability for your vehicle. We will confirm the product, eligibility, price and terms before any purchase.</p>
                <p className="text-sm text-[var(--text-muted)]">An enquiry does not activate warranty cover or buy the vehicle.</p>
                <Link href="/contact" className="inline-block rounded-xl bg-primary text-white px-5 py-3 font-bold">Contact the team</Link>
            </div>
        </section>
        <WarrantyProviderContact />
    </main>
}
