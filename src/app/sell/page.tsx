"use client"

import * as React from "react"
import { Suspense } from "react"
import { ListingWizard } from "@/components/listing/ListingWizard"
import { useAuth } from "@/context/AuthContext"
import {
    ArrowRight,
    BadgeCheck,
    Banknote,
    CheckCircle2,
    Gift,
    Gavel,
    Loader2,
    Lock,
    PoundSterling,
    ShieldCheck,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

function scrollToSellerOptions() {
    document.getElementById("sell-options")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
    })
}

const SELLER_BENEFITS = [
    {
        icon: Gavel,
        title: "£0 auction listing",
        text: "List in the dealer auction for free and let verified dealers compete.",
    },
    {
        icon: PoundSterling,
        title: "Retail listing for £1",
        text: "Advertise directly to buyers at the price you choose.",
    },
    {
        icon: Gift,
        title: "£100 seller incentive",
        text: "Qualifying successful auction sales can receive a £100 CarMazium incentive.",
    },
    {
        icon: Banknote,
        title: "Buyer pays you directly",
        text: "CarMazium does not hold the vehicle purchase price between buyer and seller.",
    },
]

function SellerLanding() {
    return (
        <section className="relative overflow-hidden border-b border-[var(--border-default)] bg-[var(--bg-body)]">
            <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(237,28,36,0.14),transparent_68%)] pointer-events-none" />
            <div className="container mx-auto max-w-6xl px-5 pt-12 pb-10 md:pt-20 md:pb-16 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-xs md:text-sm font-black uppercase tracking-[0.22em] text-primary mb-4">
                        Sell your car online
                    </p>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-heading tracking-tight leading-[1.05] mb-5 text-[var(--text-primary)]">
                        Sell Your Car <span className="text-primary">Your Way</span>
                    </h1>
                    <p className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)] mb-4">
                        Auction FREE <span className="text-[var(--text-muted)]">or</span> Retail for £1
                    </p>
                    <p className="max-w-3xl mx-auto text-base md:text-lg leading-relaxed text-[var(--text-secondary)] mb-8">
                        Choose a free dealer auction and let verified dealers compete for your car, or advertise it directly to buyers for £1. Complete a qualifying auction sale and you can receive a £100 CarMazium seller incentive.
                    </p>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-9">
                        <button
                            type="button"
                            onClick={scrollToSellerOptions}
                            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#d9161d] px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Sell My Car <ArrowRight size={20} />
                        </button>
                        <a
                            href="#how-selling-works"
                            className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-8 py-4 text-base font-bold text-[var(--text-primary)] transition-colors hover:border-primary/50 hover:text-primary"
                        >
                            How It Works
                        </a>
                    </div>

                    <div className="inline-flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5"><BadgeCheck size={17} className="text-emerald-500" /> Verified dealer bidding</span>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={17} className="text-emerald-500" /> Clear seller choices</span>
                        <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={17} className="text-emerald-500" /> UK vehicle marketplace</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-10 max-w-5xl mx-auto">
                    {SELLER_BENEFITS.map(({ icon: Icon, title, text }) => (
                        <div
                            key={title}
                            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:p-5 text-left shadow-sm"
                        >
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                                <Icon size={21} />
                            </div>
                            <h2 className="text-sm md:text-base font-extrabold text-[var(--text-primary)] mb-1.5">{title}</h2>
                            <p className="text-xs md:text-sm leading-relaxed text-[var(--text-muted)]">{text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function SellerEducation() {
    const faqs = [
        {
            question: "How much does it cost to sell my car on CarMazium?",
            answer: "Auction listings are £0 for sellers. Retail listings cost £1. Optional services, if selected, can have their own separate charges.",
        },
        {
            question: "Who pays me for my car?",
            answer: "The buyer pays you directly for the vehicle after the agreed inspection and handover process. CarMazium does not hold the vehicle purchase price between buyer and seller.",
        },
        {
            question: "How does the £100 seller incentive work?",
            answer: "The £100 is a separate CarMazium promotional incentive for qualifying successful auction sales after the required handover evidence is approved. Eligibility is subject to the current platform terms.",
        },
        {
            question: "What should I disclose about my vehicle?",
            answer: "Describe the vehicle accurately, including condition, known faults, history and any insurance write-off status where applicable. Accurate listings help buyers bid and inspect with confidence.",
        },
    ]

    return (
        <section id="how-selling-works" className="border-t border-[var(--border-default)] bg-[var(--bg-body)] py-14 md:py-20 scroll-mt-24">
            <div className="container mx-auto max-w-5xl px-5">
                <div className="text-center max-w-2xl mx-auto mb-10">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3">Simple seller journey</p>
                    <h2 className="text-3xl md:text-4xl font-black font-heading text-[var(--text-primary)] mb-3">How selling on CarMazium works</h2>
                    <p className="text-[var(--text-muted)]">Choose the route that suits you, create an accurate vehicle listing, then deal directly with the successful buyer.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                    {[
                        ["1", "Choose Auction or Retail", "Use the free dealer auction or advertise retail for £1."],
                        ["2", "Create Your Vehicle Listing", "Add the vehicle details, condition, photos and your price or reserve."],
                        ["3", "Complete the Sale", "Arrange inspection and handover with the buyer and receive the vehicle payment directly."],
                    ].map(([number, title, text]) => (
                        <div key={number} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div className="w-9 h-9 rounded-full bg-primary text-white font-black flex items-center justify-center mb-4">{number}</div>
                            <h3 className="text-lg font-extrabold text-[var(--text-primary)] mb-2">{title}</h3>
                            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{text}</p>
                        </div>
                    ))}
                </div>

                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-black font-heading text-center text-[var(--text-primary)] mb-6">Selling your car: common questions</h2>
                    <div className="space-y-3">
                        {faqs.map((faq) => (
                            <details key={faq.question} className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4">
                                <summary className="cursor-pointer list-none font-bold text-[var(--text-primary)] flex items-center justify-between gap-4">
                                    {faq.question}
                                    <span className="text-primary text-xl leading-none group-open:rotate-45 transition-transform">+</span>
                                </summary>
                                <p className="pt-3 pr-8 text-sm leading-relaxed text-[var(--text-muted)]">{faq.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}

function MarketingGate({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams()
    const isResumeFlow = Boolean(
        searchParams.get("editId") ||
        searchParams.get("editSlug") ||
        searchParams.get("hpi_success") === "true"
    )

    if (isResumeFlow) return null
    return <>{children}</>
}

function SellContent() {
    const { profile, loading } = useAuth()
    const router = useRouter()

    if (loading) {
        return (
            <section id="sell-options" className="scroll-mt-24 min-h-[260px] flex flex-col items-center justify-center gap-3 px-6 text-center">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-sm font-semibold text-[var(--text-muted)]">Loading your secure listing options…</p>
            </section>
        )
    }

    if (profile?.role === "DEALER") {
        const isStaffMember = !!((profile as any)?.dealerStaffMemberships?.length)
        const isVerified = !!profile?.dealerProfile?.isVerified || isStaffMember

        if (!isVerified) {
            return (
                <section id="sell-options" className="scroll-mt-24 min-h-[70vh] flex flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                        <Lock size={36} className="text-amber-400" />
                    </div>
                    <h2 className="text-3xl font-black font-heading mb-3 tracking-tight">Dealer Verification Required</h2>
                    <p className="text-[var(--text-muted)] max-w-md mb-10 leading-relaxed">
                        As a dealer account, you must complete KYC verification before listing vehicles. Head to your dealer dashboard to get verified.
                    </p>
                    <button
                        onClick={() => router.push("/dashboard/dealer")}
                        className="flex items-center gap-2 px-10 py-4 bg-primary hover:bg-red-600 text-white font-bold rounded-2xl text-lg shadow-[0_4px_20px_rgba(237,28,36,0.4)] transition-all hover:scale-105 active:scale-95"
                    >
                        Go to Dealer Dashboard <ArrowRight size={20} />
                    </button>
                </section>
            )
        }
    }

    return (
        <section id="sell-options" className="scroll-mt-24">
            <ListingWizard isDashboard={false} />
        </section>
    )
}

function FormFallback() {
    return (
        <section id="sell-options" className="scroll-mt-24 min-h-[260px] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </section>
    )
}

export default function SellPage() {
    return (
        <>
            <Suspense fallback={<SellerLanding />}>
                <MarketingGate><SellerLanding /></MarketingGate>
            </Suspense>

            <Suspense fallback={<FormFallback />}>
                <SellContent />
            </Suspense>

            <Suspense fallback={<SellerEducation />}>
                <MarketingGate><SellerEducation /></MarketingGate>
            </Suspense>
        </>
    )
}
