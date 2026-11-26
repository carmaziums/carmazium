import Link from 'next/link'

const TOPICS = [
    { title: 'Running a motor dealership', links: [
        ['carmazium-for-motor-traders-partner-accounts-auction-buying', 'Partner accounts and auction buying'],
        ['used-car-stock-feeds-uk-dealers-sync-adverts', 'Keep stock adverts in sync'],
        ['vat-margin-scheme-used-car-dealers-records-profit-uk-2026', 'VAT margin scheme records'],
        ['used-car-stock-finance-vs-cash-uk-dealers-profit-guide', 'Stock finance or cash'],
        ['used-car-dealer-aftersales-reserve-uk-repairs-refunds', 'Planning an aftersales reserve'],
        ['used-car-auction-disputes-uk-dealers-condition-reports-claims', 'Auction condition reports and disputes'],
        ['ex-fleet-used-cars-auction-uk-dealers-buying-checklist-2026', 'Buying ex-fleet stock'],
        ['google-business-profile-uk-used-car-dealers-local-leads', 'Finding local leads with Google Business Profile'],
    ] },
    { title: 'Condition, history and resale value', links: [
        ['does-service-history-affect-your-cars-value-uk-guide-2026', 'Service history and your car’s value'],
        ['should-you-service-car-before-selling-uk-guide-2026', 'Should you service before selling?'],
        ['do-previous-owners-affect-a-cars-value-uk-guide-2026', 'Previous owners and resale value'],
        ['do-alloy-wheel-damage-kerbing-affect-car-value-uk-2026', 'Alloy damage and kerbing'],
        ['do-worn-tyres-affect-car-value-uk-guide-2026', 'Worn tyres and resale value'],
        ['sell-high-mileage-car-uk-pricing-buyer-trust-guide-2026', 'Selling a high-mileage car'],
        ['selling-an-electric-car-in-the-uk-battery-health-range-value-guide-2026', 'Selling an electric car'],
    ] },
    { title: 'Selling options and vehicle services', links: [
        ['motorway-alternatives-uk-2026-best-places-to-sell-your-car', 'Compare Motorway alternatives'],
        ['private-car-viewings-test-drives-safe-uk-guide-2026', 'Private viewings and test drives'],
        ['uk-used-car-market-2026-what-sellers-need-to-know-before-selling', 'Understanding the UK used-car market'],
        ['what-is-tradexchange-carmazium-automotive-services-marketplace-guide-2026', 'How TradeXchange works'],
        ['vehicle-delivery-recovery-tradexchange-compare-quotes-uk-guide-2026', 'Compare delivery and recovery quotes'],
        ['vehicle-finance-enquiries-tradexchange-matching-process-uk-guide-2026', 'How finance enquiries are matched'],
    ] },
] as const

export function BlogTopicGuides({ dealersOnly = false }: { dealersOnly?: boolean }) {
    const topics = dealersOnly ? TOPICS.slice(0, 1) : TOPICS
    return <section aria-labelledby="topic-guides-heading" className="my-12">
        <h2 id="topic-guides-heading" className="text-2xl font-bold text-[var(--text-primary)]">
            {dealersOnly ? 'Practical guides for motor traders' : 'Find a guide by topic'}
        </h2>
        <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">Advice for your next sale, stock purchase or vehicle service.</p>
        <div className={`mt-5 grid gap-5 ${dealersOnly ? '' : 'md:grid-cols-3'}`}>
            {topics.map(topic => <div key={topic.title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                {!dealersOnly && <h3 className="text-lg font-bold">{topic.title}</h3>}
                <ul className={`mt-3 space-y-3 ${dealersOnly ? 'md:columns-2' : ''}`}>
                    {topic.links.map(([slug, label]) => <li key={slug}>
                        <Link href={`/blog/${slug}`} className="text-base leading-7 text-primary underline underline-offset-4 hover:opacity-80">{label}</Link>
                    </li>)}
                </ul>
            </div>)}
        </div>
    </section>
}
