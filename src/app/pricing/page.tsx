import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle, ChevronDown, Gavel, Sparkles, Star, XCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { PRICING } from "@/lib/pricingConfig"

export const metadata: Metadata = {
    title: "Pricing",
    description: "Transparent CarMazium pricing for dealer auctions and retail vehicle listings.",
}

type Tier = {
    name: string
    price: string
    eyebrow: string
    description: string
    features: { label: string; included: boolean }[]
    accent?: "auction" | "premium"
}

const TIERS: Tier[] = [
    {
        name: "Auction",
        price: "Free",
        eyebrow: "Dealer auction",
        description: "List for a competitive trade auction with no seller listing fee.",
        accent: "auction",
        features: [
            { label: "Free seller listing", included: true },
            { label: "Verified motor traders can bid", included: true },
            { label: "Live competitive bidding", included: true },
            { label: "£100 qualifying seller reward", included: true },
            { label: "£125 winning-dealer platform fee", included: true },
        ],
    },
    {
        name: "Basic",
        price: `£${PRICING.listing.basic.price}`,
        eyebrow: "Retail listing",
        description: "A straightforward public listing for sellers who want to advertise directly.",
        features: [
            { label: "Public marketplace listing", included: true },
            { label: "Up to 20 photos", included: true },
            { label: "Buyer offers and chat", included: true },
            { label: "DVLA auto-fill", included: true },
            { label: "Priority placement", included: false },
        ],
    },
    {
        name: "Standard",
        price: `£${PRICING.listing.standard.price}`,
        eyebrow: "Retail listing",
        description: "More media and a longer listing window for sellers who want extra reach.",
        features: [
            { label: "Everything in Basic", included: true },
            { label: "Up to 50 photos", included: true },
            { label: "Performance analytics", included: true },
            { label: "60-day listing", included: true },
            { label: "Priority placement", included: false },
        ],
    },
    {
        name: "Premium",
        price: `£${PRICING.listing.premium.price}`,
        eyebrow: "Retail listing",
        description: "Maximum visibility and an until-sold listing for sellers who want the strongest retail package.",
        accent: "premium",
        features: [
            { label: "Everything in Standard", included: true },
            { label: "Up to 100 photos", included: true },
            { label: "Priority search placement", included: true },
            { label: "Advertise until sold", included: true },
            { label: "Featured boost eligibility", included: true },
        ],
    },
]

const FAQS = [
    { q: "How much does it cost to sell by auction?", a: "The seller auction listing is free. Verified motor traders can bid. The winning dealer pays the applicable £125 platform fee before the post-auction process continues." },
    { q: "How much does a retail listing cost?", a: `Retail packages start at £${PRICING.listing.basic.price}. Standard is £${PRICING.listing.standard.price} and Premium is £${PRICING.listing.premium.price}. Each is a one-off listing charge rather than a subscription.` },
    { q: "Does CarMazium handle the vehicle purchase money?", a: "No. CarMazium collects its own platform fees only. Vehicle purchase funds are agreed and paid directly between buyer and seller." },
    { q: "Can automotive businesses use CarMazium?", a: "Yes. Businesses can create a Partner Account and add the capabilities relevant to them, including Vehicle Dealer, Delivery & Recovery and Vehicle Inspection." },
]

export default function PricingPage() {
    return (
        <main className="min-h-screen pb-24">
            <section className="border-b border-[var(--border-default)] pt-24 pb-16" style={{ background: "var(--bg-card)" }}>
                <div className="container mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary mb-5"><Sparkles size={12} /> Transparent Pricing</div>
                    <h1 className="text-4xl md:text-6xl font-black font-heading tracking-tight mb-5">Simple pricing. Clear choices.</h1>
                    <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto leading-relaxed">Sell by dealer auction for free, or choose the retail listing package that matches how much visibility you want.</p>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16 md:py-20">
                <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4 items-stretch">
                    {TIERS.map((tier) => {
                        const premium = tier.accent === "premium"
                        const auction = tier.accent === "auction"
                        return (
                            <article key={tier.name} className={`relative flex h-full flex-col rounded-2xl border p-7 ${premium ? "border-primary/50 bg-primary/5 shadow-[0_0_35px_rgba(237,28,36,0.12)]" : auction ? "border-orange-500/30 bg-orange-500/5" : "border-[var(--border-default)] bg-[var(--bg-card)]"}`}>
                                {premium && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"><Star size={10} className="mr-1 inline" /> Most Popular</span>}
                                <div className="min-h-[150px] border-b border-[var(--border-default)] pb-6">
                                    <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">{auction && <Gavel size={14} />}{tier.eyebrow}</div>
                                    <h2 className="text-2xl font-black font-heading">{tier.name}</h2>
                                    <div className="my-3 text-5xl font-black">{tier.price}</div>
                                    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{tier.description}</p>
                                </div>
                                <ul className="flex-1 space-y-3 py-6">
                                    {tier.features.map(feature => <li key={feature.label} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">{feature.included ? <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />}<span>{feature.label}</span></li>)}
                                </ul>
                                <Button asChild variant={premium ? "default" : "outline"} className="w-full"><Link href="/sell">{auction ? "Start Auction" : `Choose ${tier.name}`} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                            </article>
                        )
                    })}
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] py-16" style={{ background: "var(--bg-card)" }}>
                <div className="container mx-auto px-6 max-w-5xl">
                    <div className="mb-9 text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Compare routes</p><h2 className="text-3xl md:text-4xl font-black font-heading">Auction or retail?</h2></div>
                    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)]">
                        <div className="grid grid-cols-3 border-b border-[var(--border-default)] bg-[var(--bg-card)] text-sm font-black"><div className="p-5">Feature</div><div className="p-5 text-center">Dealer Auction</div><div className="p-5 text-center">Retail Listing</div></div>
                        {[
                            ["Who can buy", "Verified motor traders", "Retail buyers"],
                            ["Seller listing fee", "Free", `From £${PRICING.listing.basic.price}`],
                            ["Pricing method", "Competitive bidding", "Seller advert price"],
                            ["Vehicle sale funds", "Buyer pays seller directly", "Buyer pays seller directly"],
                        ].map(row => <div key={row[0]} className="grid grid-cols-3 border-b last:border-b-0 border-[var(--border-default)] text-sm"><div className="p-5 font-semibold">{row[0]}</div><div className="p-5 text-center text-[var(--text-muted)]">{row[1]}</div><div className="p-5 text-center text-[var(--text-muted)]">{row[2]}</div></div>)}
                    </div>
                </div>
            </section>

            <section className="container mx-auto px-6 py-16 md:py-20"><div className="mx-auto max-w-3xl"><div className="mb-8 text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Questions</p><h2 className="text-3xl font-black font-heading">Pricing FAQs</h2></div><div className="space-y-3">{FAQS.map(item => <details key={item.q} className="group overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold"><span>{item.q}</span><ChevronDown size={18} className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" /></summary><div className="border-t border-[var(--border-default)] px-6 py-5 text-sm leading-relaxed text-[var(--text-muted)]">{item.a}</div></details>)}</div></div></section>
        </main>
    )
}
