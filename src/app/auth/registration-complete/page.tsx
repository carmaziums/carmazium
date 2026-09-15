"use client"

import { useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

const PERSONAL_FEATURES = [
    {
        icon: Car,
        title: "Buy vehicles",
        description: "Browse retail vehicles and contact sellers directly when you find the right car.",
    },
    {
        icon: Gavel,
        title: "Sell by auction",
        description: "List your vehicle for verified dealers to compete for it through CarMazium auctions.",
    },
    {
        icon: ClipboardCheck,
        title: "Sell by retail listing",
        description: "Create a public retail listing and manage your vehicle listing from your account.",
    },
    {
        icon: Search,
        title: "Manage your activity",
        description: "Keep your listings and account activity together in your CarMazium dashboard.",
    },
]

const PARTNER_FEATURES = [
    {
        icon: Gavel,
        title: "Bid in dealer auctions",
        description: "Compete for auction vehicles through your business Partner Account.",
    },
    {
        icon: Car,
        title: "List and sell stock",
        description: "Create auction and retail vehicle listings from your business account.",
    },
    {
        icon: Truck,
        title: "Add business services",
        description: "Enable Delivery & Recovery and Vehicle Inspection services alongside Vehicle Dealer tools.",
    },
    {
        icon: Users,
        title: "Work as a team",
        description: "Invite team members and give them appropriate permissions for your business workflow.",
    },
]

function safeNextPath(value: string | null): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/auth/onboarding"
    if (value === "/auth/registration-complete") return "/auth/onboarding"
    return value
}

export default function RegistrationCompletePage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        if (loading) return
        if (!user) {
            router.replace("/auth/login")
            return
        }
        if (!user.email_confirmed_at) {
            router.replace("/auth/onboarding")
        }
    }, [loading, user, router])

    const role = String(profile?.role || user?.user_metadata?.role || "").toUpperCase()
    const isPartner = role === "DEALER" || role === "CONTRACTOR"
    const accountLabel = isPartner ? "Partner Account" : "Personal Account"
    const firstName = profile?.firstName || user?.user_metadata?.first_name || user?.user_metadata?.firstName || ""
    const features = isPartner ? PARTNER_FEATURES : PERSONAL_FEATURES

    const nextPath = useMemo(
        () => safeNextPath(searchParams?.get("next") ?? null),
        [searchParams],
    )

    if (loading || !user || !user.email_confirmed_at) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

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
                            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-primary">Registration complete</p>
                            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                                Congratulations{firstName ? `, ${firstName}` : ""}.
                            </h1>
                            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
                                Your CarMazium {accountLabel} is ready. Welcome to a marketplace built to make buying, selling and automotive services simpler.
                            </p>
                            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-white">
                                {isPartner ? <Building2 className="h-4 w-4 text-primary" /> : <Car className="h-4 w-4 text-primary" />}
                                {accountLabel}
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
                            {features.map(({ icon: Icon, title, description }) => (
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
                                Your successful registration is recorded once when CarMazium confirms the new account. Revisiting this page does not create another registration conversion.
                            </p>
                        </div>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Button
                                size="lg"
                                className="flex-1 gap-2"
                                onClick={() => router.push(nextPath)}
                            >
                                Continue <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="flex-1 border-white/15 text-white hover:bg-white/5"
                                onClick={() => router.push(isPartner ? "/dashboard/partner" : "/dashboard")}
                            >
                                Go to {isPartner ? "Partner Dashboard" : "Dashboard"}
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
