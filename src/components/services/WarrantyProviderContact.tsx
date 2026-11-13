import Link from "next/link"

/** Warranty partnerships are administered by CarMazium, not self-service. */
export function WarrantyProviderContact() {
    return <section id="providers" className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-6 space-y-3">
        <h2 className="text-xl font-bold">Warranty providers: contact our team</h2>
        <p className="text-sm text-[var(--text-muted)]">Want to provide vehicle warranties through CarMazium? Contact our team to discuss becoming a warranty partner. Our admin team manages partner approval, products and warranty applications.</p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <Link href="/contact">Contact the team</Link>
            <a href="mailto:info@carmazium.com?subject=Warranty%20provider%20partnership">Email info@carmazium.com</a>
        </div>
    </section>
}
