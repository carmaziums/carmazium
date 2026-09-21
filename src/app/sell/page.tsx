"use client"

import * as React from "react"
import { Suspense } from "react"
import { ListingWizard } from "@/components/listing/ListingWizard"
import { dvlaLookup } from "@/lib/dvlaApi"
import { getVehicleValuation, type VehicleValuation } from "@/lib/valuationApi"
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

type LandingVehiclePrefill = {
    vrm: string
    make: string
    model: string
    year: string
    mileage: string
    fuelType: string
    transmission: string
    color: string
    primaryColour: string
    engineSize: string
    euroStandard: string
    co2Emissions: string
    dateOfLastV5CIssued: string
    motStatus: string
    taxStatus: string
    motExpiryDate: string
    taxDueDate: string
    markedForExport: boolean | null
    monthOfFirstRegistration: string
    wheelplan: string
    typeApproval: string
    motHistory: unknown[]
}

type LandingValuationResult = {
    vehicle: LandingVehiclePrefill
    valuation: VehicleValuation
}

function formatGuidePrice(value: number) {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
    }).format(value)
}

function QuickValuationForm() {
    const [vrm, setVrm] = React.useState("")
    const [mileage, setMileage] = React.useState("")
    const [model, setModel] = React.useState("")
    const [pendingVehicle, setPendingVehicle] = React.useState<Awaited<ReturnType<typeof dvlaLookup>> | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [result, setResult] = React.useState<LandingValuationResult | null>(null)

    const handleValuation = async (event: React.FormEvent) => {
        event.preventDefault()

        const cleanVrm = vrm.replace(/\s/g, "").toUpperCase()
        const mileageNumber = Number(mileage.replace(/,/g, ""))

        if (!/^[A-Z0-9]{2,8}$/.test(cleanVrm)) {
            setError("Enter a valid UK registration number.")
            return
        }
        if (!Number.isFinite(mileageNumber) || mileageNumber <= 0 || mileageNumber > 1000000) {
            setError("Enter the vehicle's current mileage.")
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            // Changing the registration clears pendingVehicle, so if one is
            // present it belongs to the current VRM and can be reused without
            // another DVLA request.
            const vehicle = pendingVehicle ?? await dvlaLookup(cleanVrm)

            if (!vehicle.make || !vehicle.year) {
                throw new Error("Vehicle details could not be confirmed")
            }

            const resolvedModel = (vehicle.model || model).trim()
            if (!resolvedModel) {
                setPendingVehicle(vehicle)
                return
            }

            const valuation = await getVehicleValuation({
                make: vehicle.make,
                model: resolvedModel,
                year: vehicle.year,
                mileage: mileageNumber,
                fuelType: vehicle.fuelType,
                transmission: vehicle.transmission,
            })

            setResult({
                valuation,
                vehicle: {
                    vrm: cleanVrm,
                    make: vehicle.make,
                    model: resolvedModel,
                    year: String(vehicle.year),
                    mileage: String(mileageNumber),
                    fuelType: vehicle.fuelType || "",
                    transmission: vehicle.transmission || "",
                    color: vehicle.colour || vehicle.primaryColour || "",
                    primaryColour: vehicle.primaryColour || vehicle.colour || "",
                    engineSize: vehicle.engineSize ? String(vehicle.engineSize) : "",
                    euroStandard: vehicle.euroStandard || "",
                    co2Emissions: vehicle.co2Emissions ? String(vehicle.co2Emissions) : "",
                    dateOfLastV5CIssued: vehicle.dateOfLastV5CIssued || "",
                    motStatus: vehicle.motStatus || "",
                    taxStatus: vehicle.taxStatus || "",
                    motExpiryDate: vehicle.motExpiryDate || "",
                    taxDueDate: vehicle.taxDueDate || "",
                    markedForExport: vehicle.markedForExport ?? null,
                    monthOfFirstRegistration: vehicle.monthOfFirstRegistration || "",
                    wheelplan: vehicle.wheelplan || "",
                    typeApproval: vehicle.typeApproval || "",
                    motHistory: vehicle.motHistory || [],
                },
            })
            setPendingVehicle(null)
        } catch {
            setError("We couldn't value that vehicle right now. Check the registration and mileage, then try again.")
        } finally {
            setLoading(false)
        }
    }

    const startListing = (listingType: "AUCTION" | "CLASSIFIED") => {
        if (!result) return
        window.dispatchEvent(new CustomEvent("carmazium:start-seller-listing", {
            detail: {
                listingType,
                vehicle: result.vehicle,
                valuation: result.valuation,
            },
        }))
        window.setTimeout(scrollToSellerOptions, 0)
    }

    const hasReliableGuide = result
        ? !(result.valuation.source === "CARMAZIUM_MODEL" && result.valuation.comparables === 0)
        : false
    const needsModel = !!pendingVehicle && !pendingVehicle.model && !result

    return (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-[var(--bg-card)] p-4 text-left shadow-[var(--shadow-card)] sm:p-5">
            <form onSubmit={handleValuation} className="space-y-3">
                <div className={`grid gap-3 sm:items-end ${needsModel ? "sm:grid-cols-[1.05fr_0.9fr_1fr_auto]" : "sm:grid-cols-[1.15fr_1fr_auto]"}`}>
                    <label className="block">
                        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Registration</span>
                        <input
                            value={vrm}
                            onChange={(event) => {
                                setVrm(event.target.value.toUpperCase())
                                setPendingVehicle(null)
                                setModel("")
                                setResult(null)
                            }}
                            inputMode="text"
                            autoComplete="off"
                            placeholder="AB12 CDE"
                            aria-label="Vehicle registration"
                            className="h-12 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 font-mono text-base font-black uppercase tracking-[0.12em] text-[var(--text-primary)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Current mileage</span>
                        <input
                            value={mileage}
                            onChange={(event) => setMileage(event.target.value.replace(/[^\d,]/g, ""))}
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="45,000"
                            aria-label="Current vehicle mileage"
                            className="h-12 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 text-base font-bold text-[var(--text-primary)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                    </label>
                    {needsModel && (
                        <label className="block">
                            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Model</span>
                            <input
                                value={model}
                                onChange={(event) => setModel(event.target.value)}
                                autoComplete="off"
                                placeholder="e.g. Corsa"
                                aria-label="Vehicle model"
                                className="h-12 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 text-base font-bold text-[var(--text-primary)] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </label>
                    )}
                    <Button type="submit" size="lg" disabled={loading} className="h-12 w-full sm:w-auto">
                        {loading
                            ? <><Loader2 size={18} className="animate-spin" /> Valuing…</>
                            : <>{needsModel ? "Continue Valuation" : "Get My Free Valuation"} <ArrowRight size={18} /></>}
                    </Button>
                </div>

                {needsModel && pendingVehicle && (
                    <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        Vehicle found: {pendingVehicle.year} {pendingVehicle.make}. Enter the model to finish your free valuation.
                    </p>
                )}

                <p className="text-center text-[11px] font-semibold text-[var(--text-muted)] sm:text-left">
                    Free valuation · No obligation · Your guide price is based on vehicle details and available CarMazium market evidence.
                </p>

                {error && (
                    <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500">
                        {error}
                    </p>
                )}
            </form>

            {result && (
                <div className="mt-4 border-t border-[var(--border-default)] pt-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                                {result.vehicle.year} {result.vehicle.make} {result.vehicle.model}
                            </p>
                            {hasReliableGuide ? (
                                <>
                                    <p className="mt-1 text-3xl font-black tabular-nums text-[var(--text-primary)]">
                                        {formatGuidePrice(result.valuation.mid)}
                                    </p>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                                        Estimated market value. Guide only; specification, condition, demand and inspection can change the final sale price.
                                    </p>
                                </>
                            ) : (
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                                    Vehicle found. CarMazium needs a few more listing details before showing a reliable guide price for this exact model.
                                </p>
                            )}
                        </div>
                        <div className="grid shrink-0 grid-cols-1 gap-2 sm:min-w-[230px]">
                            <Button type="button" onClick={() => startListing("AUCTION")} className="bg-orange-600 hover:bg-orange-500">
                                FREE Dealer Auction <Gavel size={16} />
                            </Button>
                            <Button type="button" variant="outline" onClick={() => startListing("CLASSIFIED")}>
                                £1 Retail Listing <ArrowRight size={16} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function SellerLanding() {
    return (
        <>
            <PageHero
                compact
                className="sell-hero"
                eyebrow="Sell my car · UK"
                title={<>Sell Your Car <span className="text-primary">Online</span></>}
                description={
                    <div className="mx-auto max-w-3xl">
                        <p className="font-bold text-[var(--text-primary)]">
                            Get your free car valuation first, then choose a FREE dealer auction or £1 retail listing.
                        </p>

                        <QuickValuationForm />

                        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 shadow-sm">
                                <Banknote size={20} className="mx-auto mb-1.5 text-primary" />
                                <p className="text-sm font-black leading-tight text-[var(--text-primary)]">FREE Valuation</p>
                                <p className="mt-1 text-[10px] font-semibold leading-tight text-[var(--text-muted)] sm:text-xs">See what your car is worth</p>
                            </div>
                            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 shadow-sm">
                                <Gavel size={20} className="mx-auto mb-1.5 text-primary" />
                                <p className="text-sm font-black leading-tight text-[var(--text-primary)]">FREE Auction</p>
                                <p className="mt-1 text-[10px] font-semibold leading-tight text-[var(--text-muted)] sm:text-xs">Verified dealers compete</p>
                            </div>
                            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 shadow-sm">
                                <PoundSterling size={20} className="mx-auto mb-1.5 text-primary" />
                                <p className="text-sm font-black leading-tight text-[var(--text-primary)]">£1 Retail</p>
                                <p className="mt-1 text-[10px] font-semibold leading-tight text-[var(--text-muted)] sm:text-xs">Advertise directly to buyers</p>
                            </div>
                        </div>

                        <p className="mt-4 hidden text-sm leading-6 text-[var(--text-muted)] sm:block">
                            Use the free dealer auction for competitive trade bids or advertise directly to retail buyers for £1. Qualifying completed auction sales can also receive a £100 CarMazium seller incentive.
                        </p>
                    </div>
                }
                actions={
                    <Button asChild variant="outline" size="lg" className="hidden sm:inline-flex">
                        <a href="#how-selling-works">How It Works</a>
                    </Button>
                }
            />

            <section className="border-b border-[var(--border-default)] bg-[var(--bg-body)] py-10 md:py-12">
                <div className="container mx-auto max-w-6xl px-5">
                    <div className="mb-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1.5"><BadgeCheck size={17} className="text-emerald-600 dark:text-emerald-400" /> Verified dealer bidding</span>
                        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400" /> Sell with finance outstanding</span>
                        <span className="inline-flex items-center gap-1.5"><Banknote size={17} className="text-emerald-600 dark:text-emerald-400" /> Buyer pays you directly</span>
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

                    <div className="mx-auto mt-4 max-w-5xl rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 text-left md:flex md:items-center md:justify-between md:gap-6 md:p-5">
                        <div>
                            <p className="font-black text-[var(--text-primary)]">Car on finance?</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                                You can still list it. The buyer can clear the outstanding settlement with the finance company as part of the agreed collection and handover.
                            </p>
                        </div>
                        <Button type="button" variant="outline" className="mt-3 shrink-0 md:mt-0" onClick={scrollToSellerOptions}>
                            Start Selling <ArrowRight size={16} />
                        </Button>
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
            question: "Can I sell a car with outstanding finance?",
            answer: "Yes. You can list a vehicle with outstanding finance as long as you disclose it accurately. The buyer can clear the agreed settlement with the finance company as part of collection and handover.",
        },
        {
            question: "How does the free car valuation work?",
            answer: "CarMazium uses your vehicle details, mileage, transmission and available marketplace evidence to produce an estimated guide value. It is not a guaranteed purchase offer and the final sale price can change after condition checks and buyer inspection.",
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
                    <p className="text-[var(--text-muted)]">Value your car first, choose the selling route that suits you, create an accurate listing, then deal directly with the successful buyer.</p>
                </div>

                <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        ["1", "Value Your Car", "Enter the registration and mileage to get your CarMazium estimated market value."],
                        ["2", "Choose Auction or Retail", "Use the free dealer auction or advertise retail for £1."],
                        ["3", "Create Your Vehicle Listing", "Add the vehicle details, condition, photos and your price or reserve."],
                        ["4", "Complete the Sale", "Arrange inspection and handover with the buyer and receive the vehicle payment directly."],
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
