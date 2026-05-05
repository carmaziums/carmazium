import type { Metadata } from "next"
import Link from "next/link"
import {
    CheckCircle, XCircle, Zap, Shield, Star, Camera,
    Tag, BarChart3, BadgeCheck, ArrowRight, HelpCircle,
    Sparkles, MessageSquare, ChevronDown,
} from "lucide-react"
import { PRICING } from "@/lib/pricingConfig"

export const metadata: Metadata = {
    title: "Pricing — CarMazium",
    description: "Transparent pricing for listing your car, HPI vehicle checks, and featured boosts. List for free or upgrade to reach more buyers faster.",
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TierFeature {
    label: string
    basic: boolean | string
    standard: boolean | string
    premium: boolean | string
}

const TIER_FEATURES: TierFeature[] = [
    { label: "Listing live on marketplace",   basic: true,     standard: true,    premium: true },
    { label: "Photo uploads",                 basic: "Up to 5", standard: "Up to 15", premium: "Unlimited" },
    { label: "Offer & negotiation system",    basic: true,     standard: true,    premium: true },
    { label: "Chat with buyers",              basic: true,     standard: true,    premium: true },
    { label: "DVLA auto-fill (VRM lookup)",   basic: true,     standard: true,    premium: true },
    { label: "Performance analytics",         basic: false,    standard: true,    premium: true },
    { label: "Priority search placement",     basic: false,    standard: false,   premium: true },
    { label: "HPI Verified badge",            basic: "Add-on", standard: "Add-on", premium: "Included" },
    { label: "Featured boost eligibility",    basic: false,    standard: true,    premium: true },
    { label: "Listing duration",              basic: "30 days", standard: "60 days", premium: "90 days" },
]

const FAQS = [
    {
        q: "Is it really free to list my car?",
        a: "Yes. Our Basic tier is completely free — no hidden fees. You get a public listing with up to 5 photos, the offer system, and buyer chat. Upgrade to Standard or Premium if you want more photos, analytics, or better placement.",
    },
    {
        q: "What does the HPI Check include?",
        a: "The HPI report covers outstanding finance, write-off history, mileage anomalies, stolen vehicle records, and plate changes. A successful check adds a verified green badge to your listing, increasing buyer confidence.",
    },
    {
        q: "How long does a Featured Boost last?",
        a: "A single boost places your listing in the Featured carousel on the homepage and at the top of search results for 28 days. After 28 days it returns to its standard position — you can boost again at any time.",
    },
    {
        q: "Can I relist after my listing expires?",
        a: "Yes. When a listing expires you can relist it instantly from your Inventory dashboard. Relisting resets the countdown to the full duration for your tier.",
    },
    {
        q: "Are payments secure?",
        a: "All payments are handled via Stripe — a PCI DSS Level 1 certified payment processor. CarMazium never stores your card details.",
    },
    {
        q: "Can dealers list on CarMazium?",
        a: "Absolutely. Dealers get a dedicated dashboard with CRM, multi-listing management, analytics, team members, and finance application tracking. Contact us for volume pricing.",
    },
]

// ─── Components ────────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: boolean | string }) {
    if (value === true) return <CheckCircle size={18} className="text-emerald-400 mx-auto" />
    if (value === false) return <XCircle size={18} className="text-gray-700 mx-auto" />
    return <span className="text-xs font-bold text-gray-300 text-center block">{value}</span>
}

function FaqItem({ q, a }: { q: string; a: string }) {
    return (
        <details className="group border border-white/10 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none hover:bg-white/5 transition-colors">
                <span className="font-semibold text-white text-sm">{q}</span>
                <ChevronDown size={18} className="text-gray-500 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                {a}
            </div>
        </details>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
    return (
        <main className="min-h-screen bg-slate-900 text-white pt-24 pb-24">

            {/* ── Hero ─────────────────────────────────────────────────── */}
            <section className="container mx-auto px-6 text-center mb-20">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest mb-6">
                    <Sparkles size={12} /> Transparent Pricing
                </div>
                <h1 className="text-5xl md:text-6xl font-black font-heading tracking-tight text-white mb-5">
                    Simple, Honest Pricing
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                    List your car for free, or upgrade for more reach. No subscriptions. No surprises.
                </p>
            </section>

            {/* ── Listing Tiers ────────────────────────────────────────── */}
            <section className="container mx-auto px-6 mb-24">
                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">

                    {/* Basic */}
                    <div className="relative bg-slate-800/50 border border-white/10 rounded-2xl p-8 flex flex-col">
                        <div className="mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Basic</p>
                            <div className="flex items-end gap-2 mb-1">
                                <span className="text-5xl font-black text-white">Free</span>
                            </div>
                            <p className="text-gray-500 text-sm">Always free, no card required</p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Public marketplace listing</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Up to 5 photos</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Offer & negotiation system</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Direct buyer chat</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> DVLA auto-fill</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><XCircle size={15} className="text-gray-700 shrink-0" /> Analytics</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><XCircle size={15} className="text-gray-700 shrink-0" /> Priority placement</li>
                        </ul>
                        <Link href="/sell" className="block w-full py-3 rounded-xl border border-white/20 text-center text-sm font-bold text-white hover:bg-white/10 transition-all">
                            List for Free
                        </Link>
                    </div>

                    {/* Standard */}
                    <div className="relative bg-slate-800/50 border border-white/10 rounded-2xl p-8 flex flex-col">
                        <div className="mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Standard</p>
                            <div className="flex items-end gap-2 mb-1">
                                <span className="text-5xl font-black text-white">£{PRICING.listing.standard.price}</span>
                                <span className="text-gray-500 text-sm mb-1.5">one-off</span>
                            </div>
                            <p className="text-gray-500 text-sm">60-day listing, more reach</p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Everything in Basic</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Up to 15 photos</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Performance analytics</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Featured boost eligible</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> 60-day listing duration</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><XCircle size={15} className="text-gray-700 shrink-0" /> Priority search placement</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><XCircle size={15} className="text-gray-700 shrink-0" /> Free HPI included</li>
                        </ul>
                        <Link href="/sell" className="block w-full py-3 rounded-xl border border-white/20 text-center text-sm font-bold text-white hover:bg-white/10 transition-all">
                            Get Standard
                        </Link>
                    </div>

                    {/* Premium — highlighted */}
                    <div className="relative bg-gradient-to-b from-primary/10 to-slate-800/50 border-2 border-primary/50 rounded-2xl p-8 flex flex-col shadow-[0_0_40px_rgba(237,28,36,0.15)]">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center gap-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-neon">
                                <Star size={10} /> Most Popular
                            </span>
                        </div>
                        <div className="mb-6">
                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Premium</p>
                            <div className="flex items-end gap-2 mb-1">
                                <span className="text-5xl font-black text-white">£{PRICING.listing.premium.price}</span>
                                <span className="text-gray-500 text-sm mb-1.5">one-off</span>
                            </div>
                            <p className="text-gray-500 text-sm">90-day listing, maximum exposure</p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Everything in Standard</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Unlimited photos</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Priority search placement</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> HPI Verified badge included</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> 90-day listing duration</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Featured boost eligible</li>
                            <li className="flex items-center gap-2.5 text-sm text-gray-300"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Seller performance analytics</li>
                        </ul>
                        <Link href="/sell" className="block w-full py-3 rounded-xl bg-primary hover:bg-red-600 text-center text-sm font-bold text-white transition-all shadow-neon">
                            Get Premium
                        </Link>
                    </div>
                </div>
            </section>

            {/* ── Feature Comparison Table ─────────────────────────────── */}
            <section className="container mx-auto px-6 mb-24">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl font-black text-white text-center mb-8">Full Feature Comparison</h2>
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-800/80">
                                    <th className="text-left px-6 py-4 text-gray-400 font-bold w-1/2">Feature</th>
                                    <th className="text-center px-4 py-4 text-gray-400 font-bold">Basic</th>
                                    <th className="text-center px-4 py-4 text-gray-400 font-bold">Standard</th>
                                    <th className="text-center px-4 py-4 text-primary font-bold">Premium</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {TIER_FEATURES.map((row) => (
                                    <tr key={row.label} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 text-gray-300">{row.label}</td>
                                        <td className="px-4 py-4 text-center"><FeatureCell value={row.basic} /></td>
                                        <td className="px-4 py-4 text-center"><FeatureCell value={row.standard} /></td>
                                        <td className="px-4 py-4 text-center bg-primary/5"><FeatureCell value={row.premium} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ── Add-ons ──────────────────────────────────────────────── */}
            <section className="container mx-auto px-6 mb-24">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl font-black text-white mb-2">Optional Add-Ons</h2>
                        <p className="text-gray-500 text-sm">Enhance any listing at any time — buy once, apply instantly.</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">

                        {/* HPI Check */}
                        <div className="group bg-slate-800/50 border border-white/10 hover:border-emerald-500/30 rounded-2xl p-8 flex gap-6 transition-all hover:shadow-[0_0_30px_rgba(52,211,153,0.08)]">
                            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Shield size={24} className="text-emerald-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-black text-white text-lg">HPI Vehicle Check</h3>
                                    <span className="text-2xl font-black text-white">£{PRICING.hpiReport.price}</span>
                                </div>
                                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                                    Official HPI report covering outstanding finance, write-off history, mileage anomalies, stolen records, and plate changes. Adds a verified badge to your listing.
                                </p>
                                <ul className="space-y-1.5">
                                    {["Outstanding finance check", "Write-off & salvage history", "Stolen vehicle check", "Mileage discrepancy", "✓ Verified badge on listing"].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                                            <CheckCircle size={11} className="text-emerald-400 shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Featured Boost */}
                        <div className="group bg-slate-800/50 border border-white/10 hover:border-amber-500/30 rounded-2xl p-8 flex gap-6 transition-all hover:shadow-[0_0_30px_rgba(251,191,36,0.08)]">
                            <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Zap size={24} className="text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="font-black text-white text-lg">Featured Boost</h3>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-white">£{PRICING.featuredBoost.price}</span>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{PRICING.featuredBoost.durationDays} days</p>
                                    </div>
                                </div>
                                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                                    Pin your listing to the Featured carousel on the homepage and top of all relevant search results for 28 days. Cancel at any time.
                                </p>
                                <ul className="space-y-1.5">
                                    {["Homepage featured carousel", "Search results priority pin", "28-day duration", "Renewable at any time", "Instant activation"].map(f => (
                                        <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                                            <CheckCircle size={11} className="text-amber-400 shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Dealer CTA ───────────────────────────────────────────── */}
            <section className="container mx-auto px-6 mb-24">
                <div className="max-w-5xl mx-auto">
                    <div className="relative bg-gradient-to-r from-slate-800 to-slate-800/80 border border-white/10 rounded-2xl p-10 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
                        <div className="relative flex flex-col md:flex-row items-center gap-8 justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <BadgeCheck size={20} className="text-primary" />
                                    <span className="text-xs font-black uppercase tracking-widest text-primary">For Dealerships</span>
                                </div>
                                <h2 className="text-2xl font-black text-white mb-2">Need to list multiple vehicles?</h2>
                                <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                                    Dealers get a dedicated dashboard with CRM, inventory management, team accounts, analytics, and finance application tracking. Ask us about volume listing rates.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 shrink-0">
                                <Link href="/auth/signup?role=dealer" className="inline-flex items-center gap-2 bg-primary hover:bg-red-600 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-neon whitespace-nowrap">
                                    Apply as Dealer <ArrowRight size={16} />
                                </Link>
                                <Link href="/contact" className="text-center text-sm text-gray-400 hover:text-white transition-colors">
                                    Contact sales →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────────── */}
            <section className="container mx-auto px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-2 mb-3">
                            <HelpCircle size={18} className="text-gray-500" />
                            <h2 className="text-2xl font-black text-white">Frequently Asked Questions</h2>
                        </div>
                        <p className="text-gray-500 text-sm">Can&apos;t find your answer? <Link href="/contact" className="text-primary hover:underline">Get in touch</Link>.</p>
                    </div>
                    <div className="space-y-3">
                        {FAQS.map((faq) => (
                            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                        ))}
                    </div>
                </div>
            </section>

        </main>
    )
}
