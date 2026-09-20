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
    Zap,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"
import { DealerCtaButton } from "@/components/features/DealerCtaButton"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"

export const metadata: Metadata = {
    title: "Pricing",
    description: "Simple CarMazium pricing: auction listings are free for sellers, retail listings are £1 one-off until sold, and retail buyers pay no CarMazium buyer fee.",
}

const FAQS = [
    {
        q: "How much does it cost to list my car for retail sale?",
        a: `£${PRICING.marketplace.retail.sellerListingFee} one-off. The listing stays advertised until sold. There are no Basic, Standard or Premium retail listing packages.`,
    },
    {
        q: "How much does it cost to put my car into auction?",
        a: "Nothing. Auction listings are free for sellers. Only verified Traders can bid in CarMazium auctions.",
    },
    {
        q: "What is the auction buyer fee?",
        a: `The winning verified Trader pays a £${PRICING.marketplace.auction.buyerFee} one-off CarMazium buyer fee after winning the auction. The vehicle purchase price itself is paid directly to the seller.`,
    },
    {
        q: "Does CarMazium charge retail buyers?",
        a: "No. CarMazium does not charge a buyer fee for retail vehicle purchases.",
    },
    {
        q: "Does CarMazium handle the vehicle purchase money?",
        a: "No. For both auction and retail sales, the buyer pays the seller directly. CarMazium only collects its own applicable platform fees and optional add-on charges.",
    },
    {
        q: "Is an HPI check compulsory?",
        a: `No. HPI is optional for both auction and retail listings. An optional CarMazium HPI Vehicle Check is currently £${PRICING.hpiReport.price}.`,
    },
    {
        q: "How does the £100 auction seller reward work?",
        a: `After a successful auction sale, the seller uploads the handover photo. Once the handover is approved, CarMazium releases the £${PRICING.marketplace.auction.sellerReward} seller reward.`,
    },
]

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
    const auction = PRICING.marketplace.auction
    const retail = PRICING.marketplace.retail

    return (
        <main className="min-h-screen pb-24 pt-20">
            <PageHero
                eyebrow={<><Sparkles size={14} /> Transparent pricing</>}
                title="Auction FREE. Retail £1."
                description={
                    <p>
                        Simple pricing with no retail package ladder: sellers list in auction for free or advertise in retail for £1 one-off until sold.
                    </p>
                }
                compact
            />

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto grid max-w-7xl items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <article className="flex h-full flex-col rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/[0.08] to-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <div className="mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                <Gavel size={16} />
                                <p className="text-xs font-black uppercase tracking-[0.14em]">Auction seller</p>
                            </div>
                            <div className="text-4xl font-black tracking-tight">Free</div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">£0 seller listing fee</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> {auction.durationHours}-hour live auction</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Verified Traders compete for the vehicle</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Live bidding and anti-snipe protection</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> No seller listing fee</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> £{auction.sellerReward} seller reward after successful approved handover</li>
                        </ul>
                        <Button asChild className="mt-auto w-full">
                            <Link href="/sell">Start Free Auction</Link>
                        </Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <div className="mb-3 flex items-center gap-2 text-[var(--text-muted)]">
                                <Lock size={15} />
                                <p className="text-xs font-black uppercase tracking-[0.14em]">Winning Trader</p>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black tracking-tight">£{auction.buyerFee}</span>
                                <span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Auction buyer fee only after winning</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Only the winning verified Trader pays</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Seller contact and deal details unlock after the fee</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Vehicle price is paid directly to the seller</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> CarMazium does not hold the vehicle purchase funds</li>
                        </ul>
                        <Button asChild className="mt-auto w-full">
                            <Link href="/auctions/browse">Browse Auctions</Link>
                        </Button>
                    </article>

                    <article className="relative flex h-full flex-col rounded-2xl border-2 border-primary/50 bg-gradient-to-b from-primary/[0.08] to-[var(--bg-card)] p-7 shadow-[0_14px_36px_rgba(237,28,36,0.10)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Retail seller</span>
                        </div>
                        <div className="min-h-[150px] border-b border-primary/20 pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-primary">Retail listing</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black tracking-tight">£{retail.sellerListingFee}</span>
                                <span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Advertise until sold</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Public marketplace listing</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> One £1 listing fee — no package upgrades</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Listing remains live until sold</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Offers, negotiation and buyer chat</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> HPI and Featured Boost remain optional</li>
                        </ul>
                        <Button asChild className="mt-auto w-full">
                            <Link href="/sell">List for £1</Link>
                        </Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Retail buyer</p>
                            <div className="text-4xl font-black tracking-tight">Free</div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">£0 CarMazium retail buyer fee</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Browse retail vehicles</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Make offers and negotiate</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Chat with the seller</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Pay the seller directly for the vehicle</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> No CarMazium buyer fee on retail purchases</li>
                        </ul>
                        <Button asChild className="mt-auto w-full">
                            <Link href="/buy-cars">Browse Retail Cars</Link>
                        </Button>
                    </article>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16 md:pb-20">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-8 text-center">
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-primary">At a glance</p>
                        <h2 className="text-2xl font-black md:text-3xl">Simple Fee Comparison</h2>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                        <table className="w-full min-w-[720px] border-collapse text-sm">
                            <thead className="bg-[var(--bg-input)]">
                                <tr className="border-b-2 border-[var(--border-default)]">
                                    <th scope="col" className="w-1/2 px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Fee / Rule</th>
                                    <th scope="col" className="px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">Auction</th>
                                    <th scope="col" className="bg-primary/[0.06] px-4 py-4 text-center text-xs font-black uppercase tracking-wider text-primary">Retail</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-default)]">
                                <tr>
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Seller listing fee</th>
                                    <td className="px-4 py-4 text-center font-black">Free</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center font-black">£{retail.sellerListingFee} one-off</td>
                                </tr>
                                <tr className="bg-[var(--bg-input)]/35">
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Buyer fee</th>
                                    <td className="px-4 py-4 text-center">£{auction.buyerFee}, winning Trader only</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">Free</td>
                                </tr>
                                <tr>
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Duration</th>
                                    <td className="px-4 py-4 text-center">{auction.durationHours} hours</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">{retail.durationLabel}</td>
                                </tr>
                                <tr className="bg-[var(--bg-input)]/35">
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Who can bid / buy?</th>
                                    <td className="px-4 py-4 text-center">Verified Traders bid</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">Retail buyers</td>
                                </tr>
                                <tr>
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Vehicle purchase funds</th>
                                    <td className="px-4 py-4 text-center">Buyer pays seller directly</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">Buyer pays seller directly</td>
                                </tr>
                                <tr className="bg-[var(--bg-input)]/35">
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">HPI check</th>
                                    <td className="px-4 py-4 text-center">Optional</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">Optional</td>
                                </tr>
                                <tr>
                                    <th scope="row" className="px-6 py-4 text-left font-semibold text-[var(--text-secondary)]">Seller reward</th>
                                    <td className="px-4 py-4 text-center">£{auction.sellerReward} after approved handover</td>
                                    <td className="bg-primary/[0.035] px-4 py-4 text-center">—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                        <Lock size={17} className="mt-0.5 shrink-0 text-primary" />
                        <p><strong className="text-[var(--text-primary)]">Vehicle payments stay between buyer and seller.</strong> CarMazium does not receive or hold the purchase price of the vehicle.</p>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-9 text-center">
                            <h2 className="text-2xl font-black md:text-3xl">Optional Add-Ons</h2>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Optional extras only — they do not change the core £1 retail or free auction listing price.</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <article className="flex gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                                    <Shield size={22} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3 className="font-black">HPI Vehicle Check</h3>
                                        <span className="text-xl font-black">£{PRICING.hpiReport.price}</span>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Optional for both auction and retail listings. Adds the supported CarMazium vehicle-history check and verified-badge workflow.</p>
                                </div>
                            </article>

                            <article className="flex gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                                    <Zap size={22} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h3 className="font-black">Featured Boost</h3>
                                        <div className="text-right">
                                            <span className="text-xl font-black">£{PRICING.featuredBoost.price}</span>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{PRICING.featuredBoost.durationDays} days</p>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Optional featured placement for an eligible retail listing for the configured boost period.</p>
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
                            <div className="mb-3 flex items-center gap-2 text-primary">
                                <BadgeCheck size={20} />
                                <span className="text-xs font-black uppercase tracking-[0.14em]">Partner Account</span>
                            </div>
                            <h2 className="text-2xl font-black">Running an automotive business?</h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Use one Partner Account for your business, with Vehicle Dealer and other approved capabilities available from the same business dashboard.</p>
                        </div>
                        <div className="shrink-0"><DealerCtaButton /></div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-9 text-center">
                        <div className="mb-3 flex items-center justify-center gap-2">
                            <HelpCircle size={18} className="text-primary" />
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Questions</p>
                        </div>
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
