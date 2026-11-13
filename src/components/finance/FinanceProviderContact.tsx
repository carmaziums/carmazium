import Link from "next/link"

export function FinanceProviderContact() {
    return <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-3">
        <h2 className="text-xl font-bold">Finance providers: contact our team</h2>
        <p className="text-sm text-[var(--text-muted)]">Want to offer vehicle finance through CarMazium? Contact our team directly to discuss a partnership. Finance providers cannot register or activate this service through the website.</p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
            <Link href="/contact">Contact the team</Link>
            <a href="mailto:info@carmazium.com?subject=Finance%20provider%20partnership">Email info@carmazium.com</a>
            <a href="tel:+441218385040">Call 0121 838 5040</a>
        </div>
    </section>
}
