import type { Metadata } from "next"
import Link from "next/link"
import {
    ArrowRight,
    BadgeCheck,
    BarChart3,
    CarFront,
    CheckCircle,
    ChevronDown,
    Crown,
    Gavel,
    HelpCircle,
    Lock,
    Shield,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Star,
    Tag,
    Users,
    Zap,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"
import { DealerCtaButton } from "@/components/features/DealerCtaButton"
import { Button } from "@/components/ui/Button"

export const metadata: Metadata = {
    title: "Pricing",
    description: "CarMazium customer pricing: free auction listings, Basic £1, Standard £10 with HPI included, Premium £25, and no retail buyer fee.",
}

const FAQS = [
    {
        q: "What retail listing packages can I choose?",
        a: `Basic is £${PRICING.listing.basic.price}, Standard is £${PRICING.listing.standard.price} and includes an HPI vehicle-history report, and Premium is £${PRICING.listing.premium.price} and includes the Standard package benefits plus a 28-day Featured Boost.`,
    },
    {
        q: "How much does it cost to put my car into auction?",
        a: "Nothing. Auction listings are free for sellers and run for 24 hours. Verified motor traders can bid.",
    },
    {
        q: "Is an HPI check compulsory?",
        a: "No. HPI is optional. You can choose Basic without HPI, add an HPI check separately, or choose Standard/Premium where HPI is included.",
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
        <details className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm">
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

const featureRow = "flex items-start gap-3 text-sm leading-5 text-[var(--text-secondary)]"
const redCta = "mt-auto w-full rounded-xl bg-primary py-6 font-bold text-white shadow-[0_10px_24px_rgba(220,38,38,0.22)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_14px_30px_rgba(220,38,38,0.28)]"

export default function PricingPage() {
    const auction = PRICING.marketplace.auction

    return (
        <main className="min-h-screen overflow-hidden pb-24 pt-20">
            <section className="relative border-b border-[var(--border-default)] bg-gradient-to-b from-primary/[0.04] via-[var(--bg-primary)] to-[var(--bg-primary)]">
                <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
                <div className="pointer-events-none absolute -right-24 top-8 h-80 w-80 rounded-full bg-amber-400/[0.05] blur-3xl" />
                <div className="container relative mx-auto px-5 pb-8 pt-10 text-center md:pt-12">
                    <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-primary">
                        <Sparkles size={14} /> Simple customer pricing
                    </div>
                    <h1 className="mx-auto max-w-4xl text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                        Simple, transparent pricing for every way you sell.
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)] md:text-lg">
                        Auction for free, or choose the retail package that fits your car. Retail buyers pay no CarMazium buyer fee.
                    </p>
                    <p className="absolute right-8 top-10 hidden rotate-[-6deg] text-lg italic text-[var(--text-muted)]/55 xl:block">
                        A smarter way to car
                    </p>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-10 pt-10 md:pt-12">
                <div className="mx-auto grid max-w-[1450px] items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <article className="group flex h-full flex-col rounded-[24px] border border-rose-300/50 bg-gradient-to-b from-rose-50/70 via-[var(--bg-card)] to-[var(--bg-card)] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(15,23,42,0.10)] dark:from-rose-500/[0.06]">
                        <div className="border-b border-[var(--border-default)] pb-6">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-primary ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/20">
                                    <Gavel size={22} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Auction seller</p>
                            </div>
                            <div className="text-5xl font-black tracking-tight">Free</div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">£0 seller listing fee</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3.5">
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-rose-400" /> {auction.durationHours}-hour live auction</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-rose-400" /> Verified motor traders can bid</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-rose-400" /> Live bidding and anti-snipe protection</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-rose-400" /> £{auction.sellerReward} reward after successful approved handover</li>
                        </ul>
                        <Button asChild className={redCta}>
                            <Link href="/sell">Start Free Auction <ArrowRight size={17} /></Link>
                        </Button>
                    </article>

                    <article className="group flex h-full flex-col rounded-[24px] border border-slate-200 bg-gradient-to-b from-slate-50/80 via-[var(--bg-card)] to-[var(--bg-card)] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(15,23,42,0.10)] dark:border-white/10 dark:from-white/[0.035]">
                        <div className="border-b border-[var(--border-default)] pb-6">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10">
                                    <Tag size={22} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">Basic retail</p>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-black tracking-tight">£{PRICING.listing.basic.price}</span>
                                <span className="mb-1.5 text-sm text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Advertised until sold</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3.5">
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" /> Public marketplace listing</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" /> Offers and buyer chat</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" /> HPI remains optional</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-500" /> Featured Boost available separately</li>
                        </ul>
                        <Button asChild className={redCta}>
                            <Link href="/sell">Choose Basic <ArrowRight size={17} /></Link>
                        </Button>
                    </article>

                    <article className="group relative flex h-full flex-col rounded-[24px] border-2 border-blue-500 bg-gradient-to-b from-blue-50 via-[var(--bg-card)] to-[var(--bg-card)] p-6 shadow-[0_18px_48px_rgba(37,99,235,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(37,99,235,0.22)] dark:from-blue-500/[0.09]">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20">
                                <BadgeCheck size={13} /> HPI Included
                            </span>
                        </div>
                        <div className="border-b border-blue-500/20 pb-6">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/20">
                                    <CarFront size={22} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">Standard retail</p>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-black tracking-tight">£{PRICING.listing.standard.price}</span>
                                <span className="mb-1.5 text-sm text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Includes HPI vehicle-history report</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3.5">
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-blue-500" /> Everything in Basic</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-blue-500" /> HPI report included</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-blue-500" /> Standard package badge</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-blue-500" /> Featured Boost still optional</li>
                        </ul>
                        <Button asChild className={redCta}>
                            <Link href="/sell">Choose Standard <ArrowRight size={17} /></Link>
                        </Button>
                    </article>

                    <article className="group relative flex h-full flex-col rounded-[24px] border border-amber-400/60 bg-gradient-to-b from-amber-50/90 via-[var(--bg-card)] to-[var(--bg-card)] p-6 shadow-[0_16px_42px_rgba(245,158,11,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(245,158,11,0.18)] dark:from-amber-500/[0.07]">
                        <div className="absolute -top-3.5 right-5">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/20">
                                <Star size={12} className="fill-white" /> Best Value · HPI + Boost
                            </span>
                        </div>
                        <div className="border-b border-amber-500/20 pb-6">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/20">
                                    <Crown size={22} />
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">Premium retail</p>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-black tracking-tight">£{PRICING.listing.premium.price}</span>
                                <span className="mb-1.5 text-sm text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Premium package</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3.5">
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-amber-500" /> Everything in Standard</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-amber-500" /> HPI report included</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-amber-500" /> Premium listing badge and presentation</li>
                            <li className={featureRow}><CheckCircle size={18} className="mt-0.5 shrink-0 text-amber-500" /> Featured Boost included for 28 days</li>
                        </ul>
                        <Button asChild className={redCta}>
                            <Link href="/sell">Choose Premium <ArrowRight size={17} /></Link>
                        </Button>
                    </article>
                </div>

                <div className="mx-auto mt-9 grid max-w-[1240px] gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex items-center gap-3 xl:justify-center">
                        <Users size={22} className="text-[var(--text-muted)]" />
                        <div><p className="text-sm font-bold">Retail buyers pay £0</p><p className="text-xs text-[var(--text-muted)]">No CarMazium buyer fee</p></div>
                    </div>
                    <div className="flex items-center gap-3 border-t border-[var(--border-default)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 xl:justify-center">
                        <ShieldCheck size={22} className="text-[var(--text-muted)]" />
                        <div><p className="text-sm font-bold">HPI available</p><p className="text-xs text-[var(--text-muted)]">Included in Standard & Premium</p></div>
                    </div>
                    <div className="flex items-center gap-3 border-t border-[var(--border-default)] pt-4 sm:border-t-0 xl:border-l xl:pl-5 xl:pt-0 xl:justify-center">
                        <ShoppingBag size={22} className="text-[var(--text-muted)]" />
                        <div><p className="text-sm font-bold">Direct vehicle payment</p><p className="text-xs text-[var(--text-muted)]">Buyer pays seller directly</p></div>
                    </div>
                    <div className="flex items-center gap-3 border-t border-[var(--border-default)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 xl:justify-center">
                        <BarChart3 size={22} className="text-[var(--text-muted)]" />
                        <div><p className="text-sm font-bold">No subscriptions</p><p className="text-xs text-[var(--text-muted)]">Simple one-off listing fees</p></div>
                    </div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] bg-[var(--bg-card)]/35 py-16 md:py-20">
                <div className="container mx-auto px-5">
                    <div className="mx-auto max-w-5xl">
                        <div className="mb-9 text-center">
                            <h2 className="text-2xl font-black md:text-3xl">Optional Add-Ons</h2>
                            <p className="mt-2 text-sm text-[var(--text-muted)]">Optional extras for Auction, Basic and Standard; Premium already includes HPI and the first 28-day Featured Boost.</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Shield size={20} /></div>
                                        <h3 className="font-black">HPI Vehicle Check</h3>
                                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Optional for Auction and Basic Retail. Included with Standard and Premium Retail.</p>
                                    </div>
                                    <span className="text-xl font-black">£{PRICING.hpiReport.price}</span>
                                </div>
                            </article>
                            <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><Zap size={20} /></div>
                                        <h3 className="font-black">Featured Boost</h3>
                                        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">£25 for 28 days when purchased separately. Premium already includes the first 28-day Featured Boost.</p>
                                    </div>
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
                <div className="mx-auto max-w-5xl rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[0_14px_36px_rgba(15,23,42,0.07)] md:p-10">
                    <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2 text-primary"><BadgeCheck size={20} /><span className="text-xs font-black uppercase tracking-[0.14em]">Motor Trade & Partner Accounts</span></div>
                            <h2 className="text-2xl font-black">Are you a motor trader or automotive business?</h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Trader auction pricing and Partner Account information are kept on a separate business page.</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                            <Button asChild className="rounded-xl bg-primary text-white hover:bg-primary/90" size="lg"><Link href="/pricing/traders">View Trader Pricing <ArrowRight size={16} /></Link></Button>
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
