import type { Metadata } from "next"
import Link from "next/link"
import {
    ArrowLeft,
    BadgeCheck,
    CheckCircle,
    Gavel,
    Lock,
    ShoppingBag,
    Sparkles,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"
import { DealerCtaButton } from "@/components/features/DealerCtaButton"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"

export const metadata: Metadata = {
    title: "Trader & Partner Pricing",
    description: "CarMazium pricing for verified motor traders and Partner Accounts, including the auction fee paid by the winning Trader.",
}

const featureItemClass = "flex items-start gap-2.5 text-sm leading-5 text-[var(--text-secondary)]"

export default function TraderPricingPage() {
    const auction = PRICING.marketplace.auction

    return (
        <main className="min-h-screen pb-24 pt-20">
            <PageHero
                eyebrow={<><BadgeCheck size={14} /> Motor Trade & Partner Accounts</>}
                title="Trader pricing, kept separate from customer pricing."
                description={
                    <p>
                        This page covers the fees and rules relevant to verified motor traders using CarMazium auctions and retail marketplace features.
                    </p>
                }
                compact
            />

            <section className="container mx-auto px-5 py-16 md:py-20">
                <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
                    <article className="flex h-full flex-col rounded-2xl border border-primary/35 bg-gradient-to-b from-primary/[0.08] to-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <div className="mb-3 flex items-center gap-2 text-primary">
                                <Gavel size={16} />
                                <p className="text-xs font-black uppercase tracking-[0.14em]">Auction purchase</p>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black tracking-tight">£{auction.buyerFee}</span>
                                <span className="mb-1 text-xs text-[var(--text-muted)]">one-off</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Paid only by the winning verified Trader</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> No auction buyer fee if you do not win</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Seller contact and deal details unlock after the fee is paid</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Vehicle purchase price is paid directly to the seller</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> CarMazium does not hold the vehicle purchase funds</li>
                        </ul>
                        <Button asChild className="mt-auto w-full">
                            <Link href="/auctions/browse">Browse Auctions</Link>
                        </Button>
                    </article>

                    <article className="flex h-full flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 shadow-[var(--shadow-card)]">
                        <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                            <div className="mb-3 flex items-center gap-2 text-[var(--text-muted)]">
                                <ShoppingBag size={16} />
                                <p className="text-xs font-black uppercase tracking-[0.14em]">Retail marketplace purchase</p>
                            </div>
                            <div className="text-4xl font-black tracking-tight">Free</div>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">£0 CarMazium retail buyer fee</p>
                        </div>
                        <ul className="my-6 flex-1 space-y-3">
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Browse retail vehicle listings</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Make offers and negotiate with sellers</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Pay the seller directly for the vehicle</li>
                            <li className={featureItemClass}><CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> No CarMazium retail buyer fee</li>
                        </ul>
                        <Button asChild variant="outline" className="mt-auto w-full">
                            <Link href="/buy-cars">Browse Retail Cars</Link>
                        </Button>
                    </article>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16 md:pb-20">
                <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)] md:p-10">
                    <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                            <div className="mb-3 flex items-center gap-2 text-primary">
                                <Sparkles size={18} />
                                <span className="text-xs font-black uppercase tracking-[0.14em]">Partner Account</span>
                            </div>
                            <h2 className="text-2xl font-black">One business account for your CarMazium services.</h2>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                                Verified Traders use a Partner Account for auction bidding and approved business capabilities. Trader verification is required before auction bidding is enabled.
                            </p>
                        </div>
                        <DealerCtaButton />
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5 pb-16">
                <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
                    <div className="flex items-start gap-3">
                        <Lock size={18} className="mt-0.5 shrink-0 text-primary" />
                        <div className="text-sm leading-6 text-[var(--text-muted)]">
                            <p>
                                <strong className="text-[var(--text-primary)]">Vehicle money does not pass through CarMazium.</strong> The auction fee above is CarMazium&apos;s platform fee; the agreed vehicle purchase price is paid directly to the seller.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-5">
                <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 md:flex-row md:items-center">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Not a motor trader?</p>
                        <h2 className="mt-2 text-xl font-black">See customer pricing instead.</h2>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">Customer pricing covers selling by auction, £1 retail listings and retail buying.</p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/pricing"><ArrowLeft size={16} /> Customer Pricing</Link>
                    </Button>
                </div>
            </section>
        </main>
    )
}
