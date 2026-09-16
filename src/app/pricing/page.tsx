import type { Metadata } from "next"
import Link from "next/link"
import {
    BadgeCheck,
    CheckCircle,
    ChevronDown,
    Gavel,
    HelpCircle,
    Lock,
    Shield,
    Sparkles,
    Star,
    XCircle,
    Zap,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"
import { DealerCtaButton } from "@/components/features/DealerCtaButton"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"

export const metadata: Metadata = {
    title: "Pricing",
    description: "Transparent pricing for listing your car, HPI vehicle checks, and featured boosts. List for free or upgrade to reach more buyers faster.",
}

interface TierFeature {
    label: string
    basic: boolean | string
    standard: boolean | string
    premium: boolean | string
}

const TIER_FEATURES: TierFeature[] = [
    { label: "Listing live on marketplace", basic: true, standard: true, premium: true },
    { label: "Photo uploads", basic: "Up to 20", standard: "Up to 50", premium: "Up to 100" },
    { label: "Offer & negotiation system", basic: true, standard: true, premium: true },
    { label: "Chat with buyers", basic: true, standard: true, premium: true },
    { label: "DVLA auto-fill (VRM lookup)", basic: true, standard: true, premium: true },
    { label: "Performance analytics", basic: true, standard: true, premium: true },
    { label: "Priority search placement", basic: false, standard: false, premium: true },
    { label: "HPI Verified badge", basic: "Add-on", standard: "Add-on", premium: "Included" },
    { label: "Featured boost eligibility", basic: true, standard: true, premium: true },
    { label: "Listing duration", basic: "30 days", standard: "60 days", premium: "Until sold" },
]

const FAQS = [
    {
        q: "How much does it cost to list my car?",
        a: "Our Basic tier costs just £1 — no subscription, no hidden fees. You get a public listing with up to 20 photos, the offer system, buyer chat and analytics. Upgrade to Standard or Premium for the additional features shown above.",
    },
    {
        q: "What does the HPI Check include?",
        a: "The HPI report covers outstanding finance, write-off history, mileage anomalies, stolen vehicle records, and plate changes. A successful check adds a verified badge to the listing.",
    },
    {
        q: "How long does a Featured Boost last?",
        a: `A Featured Boost runs for ${PRICING.featuredBoost.durationDays} days. After that period the listing returns to its standard position and can be boosted again if required.`,
    },
    {
        q: "Can I relist after my listing expires?",
        a: "Yes. When a listing expires you can relist it from your Inventory dashboard. Relisting resets the countdown to the full duration for the selected tier.",
    },
    {
        q: "Are payments secure?",
        a: "Card payments are handled by the platform's configured payment processor. CarMazium does not store raw card details.",
    },
    {
        q: "Can automotive businesses list on CarMazium?",
        a: "Yes. Businesses use a Partner Account, with Vehicle Dealer and other approved services or capabilities added within the existing business-account architecture.",
    },
]

function FeatureCell({ value }: { value: boolean | string }) {
    if (value === true) {
        return <CheckCircle size={18} className="mx-auto text-emerald-600 dark:text-emerald-400" aria-label="Included" />
    }
    if (value === false) {
        return <XCircle size={18} className="mx-auto text-[var(--text-faint)]" aria-label="Not included" />
    }
    return <span className="block text-center text-xs font-bold text-[var(--text-secondary)]">{value}</span>
}

function FaqItem({ q, a }: { q: string; a: string }) {
    return (
        <details className="group overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                <span className="text-sm font-semibold">{q}</span>
                <ChevronDown size={18} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--border-default)] px-6 pb-5 pt-4 text-sm leading-6 text-[var(--text-muted)]">
                {a}
            </div>
        </details>
    )
}

const featureItemClass = "flex items-start gap-2.5 text-sm leading-5 text-[var(--text-secondary)]"

export default function PricingPage() {
    return (
        <main className="min-h-screen pb-24 pt-20">
            <PageHero
                eyebrow={<><Sparkles size={14} /> Transparent pricing</>}
                title="Choose the listing route that fits"
                description={<p>Four existing routes, clearly aligned. The prices and package rules below are unchanged; the page simply makes them easier to compare.</p>}
                compact
            />

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto grid max-w-7xl items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <article className="flex h-full flex-col rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/[0.08] to-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <div className="mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                <Gavel size={16} />
                                <p className="text-xs font-black uppercase tracking-[0.14em]">Auction</p>
                            </div>
                            <div className="text-4xl font-black tracking-tight">Free</div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">24-hour live dealer auction</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Live bidding marketplace</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Verified dealer bidding</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> 24-hour auction duration</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Anti-snipe protection</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Real-time bid feed</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Post-auction seller chat</li>
                        </ul>
                        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                            <Lock size={13} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <p className="text-[11px] leading-5 text-amber-700 dark:text-amber-300">Only verified dealers can bid on or buy auction vehicles.</p>
                        </div>
                        <Button asChild variant="outline" className="mt-auto w-full">
                            <Link href="/sell">Start Auction</Link>
                        </Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Basic</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black tracking-tight">£{PRICING.listing.basic.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Standard listing, quick to list</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Public marketplace listing</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Up to 20 photos</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Offer & negotiation system</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Direct buyer chat</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> DVLA auto-fill</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Featured boost eligible</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Performance analytics</li>
                            <li className={featureItemClass}><XCircle size={15} className="mt-0.5 shrink-0 text-[var(--text-faint)]" /> Priority placement</li>
                        </ul>
                        <Button asChild variant="outline" className="mt-auto w-full"><Link href="/sell">Get Basic</Link></Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Standard</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black tracking-tight">£{PRICING.listing.standard.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">60-day listing, more reach</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Everything in Basic</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Up to 50 photos</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Performance analytics</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Featured boost eligible</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> 60-day listing duration</li>
                            <li className={featureItemClass}><XCircle size={15} className="mt-0.5 shrink-0 text-[var(--text-faint)]" /> Priority search placement</li>
                            <li className={featureItemClass}><XCircle size={15} className="mt-0.5 shrink-0 text-[var(--text-faint)]" /> Free HPI included</li>
                        </ul>
                        <Button asChild variant="outline" className="mt-auto w-full"><Link href="/sell">Get Standard</Link></Button>
                    </article>

                    <article className="relative flex h-full flex-col rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/[0.08] to-[var(--bg-card)] p-7 shadow-[0_14px_36px_rgba(237,28,36,0.10)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"><Star size={10} /> Most Popular</span>
                        </div>
                        <div className="min-h-[150px] border-b border-primary/20 pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-primary">Premium</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black tracking-tight">£{PRICING.listing.premium.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Advertise until sold, maximum exposure</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Everything in Standard</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Up to 100 photos</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Priority search placement</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> HPI Verified badge included</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Advertise until sold</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Featured boost eligible</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Analytics: views, enquiries, offers & earnings</li>
                        </ul>
                        <Button asChild className="mt-auto w-full"><Link href="/sell">Get Premium</Link></Button>
                    </article>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16 md:pb-20">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-8 text-center">
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-primary">At a glance</p>
                        <h2 className="text-2xl font-black md:text-3xl">Full Feature Comparison</h2>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead className="bg-[var(--bg-input)]">
                                <tr className="border-b-2 border-[var(--border-default)]">
                                    <th scope="col" className="w-1/2 px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Feature</th>
                                    <th scope="col" className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Basic</th>
                                    <th scope="col" className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Standard</th>
                                    <th scope="col" className="bg-primary/[0.06] px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-primary">Premium</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                {TIER_FEATURES.map((row, index) => (
                                    <tr key={row.label} className={`transition-colors hover:bg-primary/[0.03] ${index % 2 === 1 ? "bg-[var(--bg-input)]/35" : ""}`}>
                                        <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">{row.label}</th>
                                        <td className="px-4 py-4 text-center"><FeatureCell value={row.basic} /></td>
                                        <td className="px-4 py-4 text-center"><FeatureCell value={row.standard} /></td>
                                        <td className="bg-primary/[0.035] px-4 py-4 text-center"><FeatureCell value={row.premium} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-9 text-center">
                            <h2 className="text-2xl font-black md:text-3xl">Optional Add-Ons</h2>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Enhance an eligible listing without changing its core package.</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <article className="flex gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10"><Shield size={22} className="text-emerald-600 dark:text-emerald-400" /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4"><h3 className="font-black">HPI Vehicle Check</h3><span className="text-xl font-black">£{PRICING.hpiReport.price}</span></div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">The existing HPI add-on for the listing, including the vehicle-history information and verified-badge workflow already supported by CarMazium.</p>
                                </div>
                            </article>
                            <article className="flex gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10"><Zap size={22} className="text-amber-600 dark:text-amber-400" /></div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4"><h3 className="font-black">Featured Boost</h3><div className="text-right"><span className="text-xl font-black">£{PRICING.featuredBoost.price}</span><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{PRICING.featuredBoost.durationDays} days</p></div></div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">The existing featured placement add-on for the configured duration, available through the current listing workflow.</p>
                                </div>
                            </article>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)] md:p-10">
                    <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-primary"><BadgeCheck size={20} /><span className="text-xs font-black uppercase tracking-[0.14em]">Partner Account</span></div>
                            <h2 className="text-2xl font-black">Running an automotive business?</h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Use one Partner Account for the business, with Vehicle Dealer and other approved capabilities available through the existing Partner architecture.</p>
                        </div>
                        <div className="shrink-0"><DealerCtaButton /></div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-9 text-center">
                        <div className="mb-3 flex items-center justify-center gap-2"><HelpCircle size={18} className="text-primary" /><p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Questions</p></div>
                        <h2 className="text-2xl font-black md:text-3xl">Frequently Asked Questions</h2>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">Can&apos;t find your answer? <Link href="/contact" className="font-bold text-primary underline-offset-4 hover:underline">Get in touch</Link>.</p>
                    </div>
                    <div className="space-y-3">
                        {FAQS.map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
                    </div>
                </div>
            </section>
        </main>
    )
}
