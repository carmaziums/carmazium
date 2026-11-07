import Link from "next/link"

// Stable, published guides checked against the public catalogue. Keep older
// evergreen articles reachable without walking the chronological archive.
const GUIDE_GROUPS = [
    {
        title: "Choose how to sell",
        guides: [
            ["carmazium-auction-vs-retail-which-route-should-sellers-choose", "Auction or retail: which route suits your car?"],
            ["carwow-alternatives-uk-2026-best-ways-to-sell-your-car", "Compare Carwow alternatives in the UK"],
            ["how-to-price-used-car-for-sale-uk-asking-price-vs-trade-value-2026", "Set a realistic asking price"],
        ],
    },
    {
        title: "Prepare the paperwork",
        guides: [
            ["what-documents-do-you-need-to-sell-a-car-in-the-uk-2026-checklist", "Documents you need to sell your car"],
            ["can-you-sell-car-without-v5c-uk-guide-2026", "Selling without a V5C logbook"],
            ["can-you-sell-a-car-with-outstanding-finance-uk-guide-2026", "Selling a car with outstanding finance"],
        ],
    },
    {
        title: "Selling a car with faults",
        guides: [
            ["how-to-sell-non-runner-faulty-car-uk-guide-2026", "Selling a faulty or non-running car"],
            ["can-you-sell-car-without-mot-uk-guide-2026", "Selling a car without an MOT"],
            ["adblue-warning-problems-uk-used-car-sellers-guide-2026", "What an AdBlue warning means for sellers"],
        ],
    },
] as const

export function SellerGuideLinks({ compact = false }: { compact?: boolean }) {
    return (
        <section aria-labelledby="seller-guides-heading" className="my-12">
            <h2 id="seller-guides-heading" className="text-2xl font-black font-heading text-[var(--text-primary)]">Practical guides for UK car sellers</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Compare selling options, prepare your documents and understand how your car’s condition affects the sale.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
                {GUIDE_GROUPS.map(group => (
                    <div key={group.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                        <h3 className="font-bold text-[var(--text-primary)]">{group.title}</h3>
                        <ul className="mt-3 space-y-3">
                            {(compact ? group.guides.slice(0, 1) : group.guides).map(([slug, label]) => (
                                <li key={slug}>
                                    <Link href={`/blog/${slug}`} className="text-sm leading-6 text-primary underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{label}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    )
}
