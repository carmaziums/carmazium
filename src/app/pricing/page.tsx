import type { Metadata } from "next"
import Link from "next/link"
import {
    ArrowRight,
    BadgeCheck,
    CheckCircle,
    ChevronDown,
    Gavel,
    HelpCircle,
    Lock,
    Shield,
    ShoppingBag,
    Sparkles,
    Star,
    Zap,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"
import { DealerCtaButton } from "@/components/features/DealerCtaButton"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"

export const metadata: Metadata = {
    title: "Pricing",
    description: "CarMazium customer pricing: free auction listings, Basic £1, Standard £10 with HPI included, Premium £25, and no retail buyer fee.",
}

const FAQS = [
    {
        q: "What retail listing packages can I choose?",
        a: `Basic is £${PRICING.listing.basic.price}, Standard is £${PRICING.listing.standard.price} and includes an HPI vehicle-history report, and Premium is £${PRICING.listing.premium.price} and includes the Standard package benefits.`,
    },
    {
        q: "How much does it cost to put my car into auction?",
        a: "Nothing. Auction listings are free for sellers and run for 24 hours. Verified motor traders can bid.",
    },
    {
        q: "Is an HPI check compulsory?",
        a: `No. HPI is optional. You can choose Basic without HPI, add an HPI check separately, or choose Standard/Premium where HPI is included.`,
    },
    {
        q: "Does CarMazium charge retail buyers?",
        a: "No. CarMazium does not charge a buyer fee for retail vehicle purchases.",
    },
    {
        q: "Does CarMazium handle the vehicle purchase money?",
        a: "No. Buyers pay sellers directly for the vehicle. CarMazium only collects its own applicable platform fees and optional add-on charges.",
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

const item = "flex items-start gap-2.5 text-sm leading-5 text-[var(--text-secondary)]"

export default function PricingPage() {
    const auction = PRICING.marketplace.auction

    return (
        <main className="min-h-screen pb-24 pt-20">
            <PageHero
                eyebrow={<><Sparkles size={14} /> Customer pricing</>}
                title="Auction FREE. Retail from £1."
                description={<p>Choose the way you want to sell. Retail buyers pay no CarMazium buyer fee.</p>}
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
                            <p className="mt-2 text-sm text-[var(--text-muted)]">£0 seller listing fee</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> {auction.durationHours}-hour live auction</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Verified motor traders can bid</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> Live bidding and anti-snipe protection</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-orange-500" /> £{auction.sellerReward} reward after successful approved handover</li>
                        </ul>
                        <Button asChild className="mt-auto w-full"><Link href="/sell">Start Free Auction</Link></Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Basic retail</p>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black">£{PRICING.listing.basic.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Advertised until sold</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" /> Public marketplace listing</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" /> Offers and buyer chat</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" /> HPI remains optional</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" /> Featured Boost available separately</li>
                        </ul>
                        <Button asChild variant="outline" className="mt-auto w-full"><Link href="/sell">Choose Basic</Link></Button>
                    </article>

                    <article className="relative flex h-full flex-col rounded-2xl border-2 border-blue-500/45 bg-gradient-to-b from-blue-500/[0.08] to-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">HPI included</span></div>
                        <div className="min-h-[150px] border-b border-blue-500/20 pb-6">
                            <div className="mb-3 flex items-center gap-2 text-blue-500"><Shield size={16} /><p className="text-xs font-black uppercase tracking-[0.14em]">Standard retail</p></div>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black">£{PRICING.listing.standard.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Includes HPI vehicle-history report</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-blue-500" /> Everything in Basic</li>
                            <li className={item}><BadgeCheck size={15} className="mt-0.5 shrink-0 text-blue-500" /> HPI report included</li>
                            <li className={item}><BadgeCheck size={15} className="mt-0.5 shrink-0 text-blue-500" /> Standard package badge</li>
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-blue-500" /> Featured Boost still optional</li>
                        </ul>
                        <Button asChild className="mt-auto w-full"><Link href="/sell">Choose Standard</Link></Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.08] to-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-amber-500/20 pb-6">
                            <div className="mb-3 flex items-center gap-2 text-amber-500"><Star size={16} /><p className="text-xs font-black uppercase tracking-[0.14em]">Premium retail</p></div>
                            <div className="flex items-end gap-2"><span className="text-4xl font-black">£{PRICING.listing.premium.price}</span><span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span></div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Premium package</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={item}><CheckCircle size={15} className="mt-0.5 shrink-0 text-amber-500" /> Everything in Standard</li>
                            <li className={item}><BadgeCheck size={15} className="mt-0.5 shrink-0 text-amber-500" /> HPI report included</li>
                            <li className={item}><Star size={15} className="mt-0.5 shrink-0 text-amber-500" /> Premium listing badge and presentation</li>
                            <li className={item}><Zap size={15} className="mt-0.5 shrink-0 text-amber-500" /> Featured Boost is a separate add-on</li>
                        </ul>
                        <Button asChild variant="outline" className="mt-auto w-full"><Link href="/sell">Choose Premium</Link></Button>
                    </article>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16">
                <div className="mx-auto max-w-7xl rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-7 shadow-[var(--shadow-card)]">
                    <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><ShoppingBag size={18} /><span className="text-xs font-black uppercase tracking-[0.14em]">Retail buyer</span></div>
                            <h2 className="text-2xl font-black">No CarMazium retail buyer fee.</h2>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Browse, make offers, chat with the seller and pay the seller directly for the vehicle.</p>
                        </div>
                        <Button asChild><Link href="/buy-cars">Browse Retail Cars</Link></Button>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-9 text-center">
                            <h2 className="text-2xl font-black md:text-3xl">Optional Add-Ons</h2>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">These are separate from the retail package price unless specifically included above.</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                                <div className="flex items-start justify-between gap-4">
                                    <div><h3 className="font-black">HPI Vehicle Check</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Optional for Auction and Basic Retail. Included with Standard and Premium Retail.</p></div>
                                    <span className="text-xl font-black">£{PRICING.hpiReport.price}</span>
                                </div>
                            </article>
                            <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7">
                                <div className="flex items-start justify-between gap-4">
                                    <div><h3 className="font-black">Featured Boost</h3><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Separate optional boost. It is not included automatically with Premium.</p></div>
                                    <div className="text-right"><span className="text-xl font-black">£{PRICING.featuredBoost.price}</span><p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{PRICING.featuredBoost.durationDays} days</p></div>
                                </div>
                            </article>
                        </div>
                        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-sm text-[var(--text-muted)]">
                            <Lock size={17} className="mt-0.5 shrink-0 text-primary" />
                            <p><strong className="text-[var(--text-primary)]">Vehicle sale money stays between buyer and seller.</strong> CarMazium does not receive or hold the vehicle purchase price.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10">
                    <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-primary"><BadgeCheck size={20} /><span className="text-xs font-black uppercase tracking-[0.14em]">Motor Trade & Partner Accounts</span></div>
                            <h2 className="text-2xl font-black">Are you a motor trader or automotive business?</h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Trader auction pricing and Partner Account information are kept on a separate business page.</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <Button asChild variant="outline" size="lg"><Link href="/pricing/traders">View Trader Pricing <ArrowRight size={16} /></Link></Button>
                            <DealerCtaButton />
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5">
                <div className="mx-auto max-w-3xl">
                    <div className="mb-9 text-center">
                        <div className="mb-3 flex items-center justify-center gap-2"><HelpCircle size={18} className="text-primary" /><p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Questions</p></div>
                        <h2 className="text-2xl font-black md:text-3xl">Frequently Asked Questions</h2>
                    </div>
                    <div className="space-y-3">{FAQS.map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}</div>
                </div>
            </section>
        </main>
    )
}
