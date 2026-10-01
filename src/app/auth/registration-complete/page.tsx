"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    Building2,
    Car,
    CheckCircle2,
    ClipboardCheck,
    Gavel,
    Loader2,
    Search,
    ShieldCheck,
    Truck,
    Users,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"

type GuideFeature = {
    icon: typeof Car
    title: string
    description: string
}

type AccountGuide = {
    accountLabel: string
    intro: string
    features: GuideFeature[]
    protectionNote: string
    dashboardPath: string
    dashboardLabel: string
    businessAccount: boolean
}

const PERSONAL_GUIDE: AccountGuide = {
    accountLabel: "Personal Account",
    intro: "One account for buying retail vehicles and selling your own vehicle.",
    features: [
        {
            icon: Car,
            title: "Buy retail vehicles",
            description: "Browse retail listings and buy directly from sellers. Personal Accounts do not bid in dealer auctions.",
        },
        {
            icon: Gavel,
            title: "Sell by dealer auction",
            description: "Create an auction listing free of charge and let verified motor traders compete for your vehicle.",
        },
        {
            icon: ClipboardCheck,
            title: "Sell by £1 retail listing",
            description: "Create a public retail listing for £1 and keep it listed until sold.",
        },
        {
            icon: Search,
            title: "Manage everything in one place",
            description: "Follow your listings, offers, messages and account activity from your dashboard.",
        },
    ],
    protectionNote: "Your Personal Account can buy retail vehicles and sell vehicles, but dealer-auction bidding is reserved for verified motor traders.",
    dashboardPath: "/dashboard",
    dashboardLabel: "Dashboard",
    businessAccount: false,
}

const DEALER_GUIDE: AccountGuide = {
    accountLabel: "Partner Account",
    intro: "Your business account brings vehicle trading and approved automotive services together.",
    features: [
        {
            icon: ShieldCheck,
            title: "Complete business & KYC verification",
            description: "Dealer-auction bidding and other protected trade tools stay locked until the required verification is approved.",
        },
        {
            icon: Gavel,
            title: "Bid in dealer auctions",
            description: "Once verified, bid for auction vehicles. A £125 CarMazium buyer fee applies to successful auction purchases.",
        },
        {
            icon: Car,
            title: "List and sell stock",
            description: "Create free auction listings or £1 retail listings from your business account.",
        },
        {
            icon: Truck,
            title: "Add approved business services",
            description: "Add Delivery & Recovery, Vehicle Inspection, Finance or Warranty services where the relevant capability has been approved.",
        },
        {
            icon: Users,
            title: "Work as a team",
            description: "Invite team members and manage stock, offers, purchases and business activity together.",
        },
    ],
    protectionNote: "Creating a Partner Account does not itself verify the business. Complete KYC before dealer-auction bidding, and complete any additional capability approval required for business services.",
    dashboardPath: "/dashboard/partner",
    dashboardLabel: "Partner Dashboard",
    businessAccount: true,
}

const CONTRACTOR_GUIDE: AccountGuide = {
    accountLabel: "Service Partner Account",
    intro: "Your account is set up for approved automotive service work.",
    features: [
        {
            icon: ShieldCheck,
            title: "Complete capability approval",
            description: "Apply for the service capabilities you provide. Protected service work becomes available only after approval.",
        },
        {
            icon: Truck,
            title: "Respond to suitable work",
            description: "Use your service workspace to manage eligible jobs and offers.",
        },
        {
            icon: Users,
            title: "Communicate through CarMazium",
            description: "Use the permitted messaging workflow once the relevant job or offer has reached the correct stage.",
        },
        {
            icon: Search,
            title: "Track your service activity",
            description: "Keep jobs, account details and service activity together in your dashboard.",
        },
    ],
    protectionNote: "Service access is capability-based: an account role alone does not approve a contractor to take protected work.",
    dashboardPath: "/dashboard/service",
    dashboardLabel: "Service Dashboard",
    businessAccount: true,
}

const FINANCE_GUIDE: AccountGuide = {
    accountLabel: "Finance Partner Account",
    intro: "Your finance partner workspace is ready.",
    features: [
        {
            icon: Search,
            title: "Review finance enquiries",
            description: "See finance requests routed to your partner account.",
        },
        {
            icon: ClipboardCheck,
            title: "Return finance quotes",
            description: "Respond to enquiries through the CarMazium finance workflow.",
        },
        {
            icon: Building2,
            title: "Manage partner activity",
            description: "Track enquiries and maintain your finance partner account from the finance dashboard.",
        },
    ],
    protectionNote: "Only the finance-partner tools assigned to your approved account are available.",
    dashboardPath: "/dashboard/finance",
    dashboardLabel: "Finance Dashboard",
    businessAccount: true,
}

const INSURANCE_GUIDE: AccountGuide = {
    accountLabel: "Insurance Partner Account",
    intro: "Your insurance partner workspace is ready.",
    features: [
        {
            icon: Search,
            title: "Review quote requests",
            description: "See insurance requests routed to your partner account.",
        },
        {
            icon: ClipboardCheck,
            title: "Return insurance quotes",
            description: "Respond through the CarMazium insurance workflow.",
        },
        {
            icon: ShieldCheck,
            title: "Manage partner activity",
            description: "Track requests and maintain your insurance partner account from the insurance dashboard.",
        },
    ],
    protectionNote: "Only the insurance-partner tools assigned to your approved account are available.",
    dashboardPath: "/dashboard/insurance",
    dashboardLabel: "Insurance Dashboard",
    businessAccount: true,
}

function getAccountGuide(role: string): AccountGuide {
    switch (role) {
        case "DEALER":
            return DEALER_GUIDE
        case "CONTRACTOR":
            return CONTRACTOR_GUIDE
        case "FINANCE_PARTNER":
            return FINANCE_GUIDE
        case "INSURANCE_PARTNER":
            return INSURANCE_GUIDE
        case "SELLER":
        case "BUYER":
        default:
            return PERSONAL_GUIDE
    }
}

function hasRequiredAccountDetails(profile: {
    firstName?: string
    lastName?: string
    phone?: string
    location?: string
    postcode?: string
} | null): boolean {
    if (!profile) return false
    return Boolean(
        profile.firstName?.trim() &&
        profile.lastName?.trim() &&
        profile.phone?.trim() &&
        profile.location?.trim() &&
        profile.postcode?.trim()
    )
}

function LoadingScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    )
}

export default function RegistrationCompletePage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()
    const profileComplete = hasRequiredAccountDetails(profile)

    useEffect(() => {
        if (loading) return
        if (!user) {
            router.replace("/auth/login")
            return
        }
        if (!user.email_confirmed_at || !profileComplete) {
            router.replace("/auth/onboarding")
        }
    }, [loading, user, profileComplete, router])

    if (loading || !user || !user.email_confirmed_at || !profileComplete) {
        return <LoadingScreen />
    }

    const role = String(profile?.role || user.user_metadata?.role || "").toUpperCase()
    const guide = getAccountGuide(role)
    const firstName = profile?.firstName || user.user_metadata?.first_name || user.user_metadata?.firstName || ""

    return (
        <main className="min-h-screen bg-slate-950 pt-24 pb-14 px-5">
            <div className="mx-auto max-w-5xl">
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
                    <div className="relative px-6 py-10 sm:px-10 sm:py-12 text-center border-b border-white/10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),transparent_55%)]" />
                        <div className="relative">
                            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                                <CheckCircle2 className="h-11 w-11 text-emerald-400" />
                            </div>
                            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">Welcome to CarMazium</p>
                            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                                Congratulations{firstName ? `, ${firstName}` : ""}.
                            </h1>
                            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
                                Your CarMazium {guide.accountLabel} is complete. {guide.intro}
                            </p>
                            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-white">
                                {guide.businessAccount ? <Building2 className="h-4 w-4 text-primary" /> : <Car className="h-4 w-4 text-primary" />}
                                {guide.accountLabel}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-8 sm:px-10 sm:py-10">
                        <div className="mb-7">
                            <h2 className="text-2xl font-bold text-white">What you can do with this account</h2>
                            <p className="mt-2 text-sm text-slate-400">
                                These tools are available from your CarMazium account and dashboard.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {guide.features.map(({ icon: Icon, title, description }) => (
                                <div key={title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold text-white">{title}</h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-4">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
                            <p className="text-sm leading-relaxed text-slate-300">
                                {guide.protectionNote}
                            </p>
                        </div>

                        <Button
                            size="lg"
                            className="mt-8 w-full gap-2 sm:w-auto sm:min-w-64"
                            onClick={() => router.push(guide.dashboardPath)}
                        >
                            Go to {guide.dashboardLabel}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </section>
            </div>
        </main>
    )
}
