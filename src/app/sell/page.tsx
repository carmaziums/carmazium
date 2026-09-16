"use client"

import * as React from "react"
import { Suspense } from "react"
import { ListingWizard } from "@/components/listing/ListingWizard"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { PageHero } from "@/components/layout/PageHero"
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
        <>
            <PageHero
                eyebrow="Free car valuation · Sell your car online"
                title={<>Sell Your Car <span className="text-primary">Online</span></>}
                description={
                    <div>
                        <p className="font-bold text-[var(--text-primary)]">See what your car is worth, then choose Auction or Retail.</p>
                        <p className="mt-2">Get a free car valuation, list in our dealer auction for £0 and let verified dealers compete, or advertise directly to buyers for £1. Complete a qualifying auction sale and you can receive a £100 CarMazium seller incentive.</p>
                    </div>
                }
                actions={
                    <>
                        <Button type="button" size="lg" onClick={scrollToSellerOptions}>
                            Sell My Car <ArrowRight size={18} />
                        </Button>
                        <Button asChild variant="outline" size="lg">
                            <a href="#how-selling-works">How It Works</a>
                        </Button>
                    </>
                }
            />

            <section className="border-b border-[var(--border-default)] bg-[var(--bg-body)] py-10 md:py-12">
                <div className="container mx-auto max-w-6xl px-5">
                    <div className="mb-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5"><BadgeCheck size={17} className="text-emerald-600 dark:text-emerald-400" /> Verified dealer bidding</span>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400" /> Clear seller choices</span>
                        <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400" /> UK vehicle marketplace</span>
                    </div>
                    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                        {SELLER_BENEFITS.map(({ icon: Icon, title, text }) => (
                            <article key={title} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left shadow-[var(--shadow-card)] md:p-5">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></div>
                                <h2 className="mb-1.5 text-sm font-extrabold text-[var(--text-primary)] md:text-base">{title}</h2>
                                <p className="text-xs leading-relaxed text-[var(--text-muted)] md:text-sm">{text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
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
        <section id="how-selling-works" className="scroll-mt-24 border-t border-[var(--border-default)] bg-[var(--bg-body)] py-14 md:py-20">
            <div className="container mx-auto max-w-5xl px-5">
                <div className="mx-auto mb-10 max-w-2xl text-center">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Simple seller journey</p>
                    <h2 className="mb-3 text-3xl font-black text-[var(--text-primary)] md:text-4xl">How selling on CarMazium works</h2>
                    <p className="text-[var(--text-muted)]">Choose the route that suits you, create an accurate vehicle listing, then deal directly with the successful buyer.</p>
                </div>

                <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                        ["1", "Choose Auction or Retail", "Use the free dealer auction or advertise retail for £1."],
                        ["2", "Create Your Vehicle Listing", "Add the vehicle details, condition, photos and your price or reserve."],
                        ["3", "Complete the Sale", "Arrange inspection and handover with the buyer and receive the vehicle payment directly."],
                    ].map(([number, title, text]) => (
                        <article key={number} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-white">{number}</div>
                            <h3 className="mb-2 text-lg font-extrabold text-[var(--text-primary)]">{title}</h3>
                            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{text}</p>
                        </article>
                    ))}
                </div>

                <div className="mx-auto max-w-3xl">
                    <h2 className="mb-6 text-center text-2xl font-black text-[var(--text-primary)] md:text-3xl">Selling your car: common questions</h2>
                    <div className="space-y-3">
                        {faqs.map((faq) => (
                            <details key={faq.question} className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    {faq.question}
                                    <span className="text-xl leading-none text-primary transition-transform group-open:rotate-45">+</span>
                                </summary>
                                <p className="pr-8 pt-3 text-sm leading-relaxed text-[var(--text-muted)]">{faq.answer}</p>
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
            <section id="sell-options" className="scroll-mt-24 flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
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
                <section id="sell-options" className="scroll-mt-24 flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center">
                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
                        <Lock size={36} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <h2 className="mb-3 text-3xl font-black tracking-tight">Dealer Verification Required</h2>
                    <p className="mb-10 max-w-md leading-relaxed text-[var(--text-muted)]">As a dealer account, you must complete KYC verification before listing vehicles. Head to your dealer dashboard to get verified.</p>
                    <Button type="button" size="lg" onClick={() => router.push("/dashboard/dealer")}>Go to Dealer Dashboard <ArrowRight size={18} /></Button>
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
        <section id="sell-options" className="scroll-mt-24 flex min-h-[260px] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </section>
    )
}

function ListingSelectionLayoutFixes() {
    return (
        <style jsx global>{`
            #sell-options > div.relative.min-h-screen.pt-24.pb-12 {
                min-height: auto !important;
                padding-top: 3rem !important;
                padding-bottom: 2rem !important;
            }

            #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: 0 !important;
                margin-top: 2.25rem !important;
                margin-left: auto !important;
                margin-right: auto !important;
                max-width: 36rem;
                padding: 0.85rem 0.5rem 0.75rem;
                border: 1px solid var(--border-default);
                border-radius: 1rem;
                background: var(--bg-card);
                position: relative;
                overflow: hidden;
            }

            #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"]::before {
                content: "";
                position: absolute;
                top: 2rem;
                left: 12.5%;
                right: 12.5%;
                height: 2px;
                background: var(--border-default);
                z-index: 0;
            }

            #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] > .glass-card {
                position: relative;
                z-index: 1;
                padding: 0.25rem !important;
                border: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                backdrop-filter: none !important;
            }

            #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] > .glass-card > div {
                width: 2rem !important;
                height: 2rem !important;
                margin-bottom: 0.45rem !important;
                background: var(--bg-card) !important;
                border-width: 2px !important;
                border-color: rgba(237, 28, 36, 0.45) !important;
                box-shadow: 0 0 0 4px var(--bg-card);
            }

            #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] > .glass-card p {
                font-size: 0.72rem !important;
                line-height: 1rem !important;
                font-weight: 700 !important;
            }

            @media (max-width: 480px) {
                #sell-options > div.relative.min-h-screen.pt-24.pb-12 {
                    padding-top: 2rem !important;
                    padding-bottom: 1.5rem !important;
                }

                #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] {
                    margin-top: 1.75rem !important;
                    padding: 0.75rem 0.25rem 0.65rem;
                }

                #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"]::before {
                    top: 1.9rem;
                }

                #sell-options div[class~="mt-24"][class~="grid"][class~="grid-cols-2"][class~="gap-6"][class~="text-center"] > .glass-card p {
                    font-size: 0.66rem !important;
                    line-height: 0.9rem !important;
                }
            }
        `}</style>
    )
}

export default function SellPage() {
    return (
        <>
            <ListingSelectionLayoutFixes />

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
