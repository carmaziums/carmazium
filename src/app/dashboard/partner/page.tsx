"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    Clock3,
    CreditCard,
    FileText,
    Loader2,
    ShieldCheck,
    Truck,
    Users,
    Wrench,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { Button } from "@/components/ui/Button"

type CapabilityStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
type PartnerCapability = {
    id: string
    serviceType: "DELIVERY" | "INSPECTION" | "FINANCE" | "WARRANTY"
    status: CapabilityStatus
    reviewNote?: string | null
}
type PartnerTeam = {
    dealerProfileId: string
    companyName: string
    stripeConnect: { connected: boolean; complete: boolean }
    capabilities: PartnerCapability[]
    payoutPolicy: string
}

const statusLabel: Record<CapabilityStatus, string> = {
    PENDING: "Awaiting approval",
    APPROVED: "Active",
    REJECTED: "Needs attention",
    SUSPENDED: "Suspended",
}

export default function PartnerDashboardPage() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const router = useRouter()
    const [team, setTeam] = React.useState<PartnerTeam | null>(null)
    const [loadingTeam, setLoadingTeam] = React.useState(false)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [companyName, setCompanyName] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [businessAddress, setBusinessAddress] = React.useState("")

    const role = profile?.role || ""
    const isPartnerRole = role === "DEALER"
    const isLegacyProvider = role === "CONTRACTOR"
    const isAdmin = role === "ADMIN"
    const partnerBusiness = profile?.dealerProfile

    React.useEffect(() => {
        if (!partnerBusiness) return
        setCompanyName(partnerBusiness.companyName || "")
        setPhone(partnerBusiness.phone || "")
        setBusinessAddress(partnerBusiness.businessAddress || "")
    }, [partnerBusiness])

    const loadTeam = React.useCallback(async () => {
        if (!partnerBusiness || (!isPartnerRole && !isAdmin)) return
        setLoadingTeam(true)
        try {
            const response = await apiClient<{ data?: PartnerTeam }>("/services/team")
            setTeam(response.data ?? (response as unknown as PartnerTeam))
        } catch (e: any) {
            setError(e?.message || "Could not load Partner services")
        } finally {
            setLoadingTeam(false)
        }
    }, [partnerBusiness, isPartnerRole, isAdmin])

    React.useEffect(() => {
        if (!authLoading && user) loadTeam()
    }, [authLoading, user, loadTeam])

    const becomePartner = async () => {
        setBusy("partner")
        setError(null)
        try {
            await apiClient("/users/elevate", {
                method: "POST",
                body: JSON.stringify({ newRole: "DEALER" }),
            })
            await refreshProfile()
            router.replace("/dashboard/partner")
        } catch (e: any) {
            setError(e?.message || "Could not create your Partner Account")
        } finally {
            setBusy(null)
        }
    }

    const saveBusiness = async () => {
        if (!companyName.trim()) {
            setError("Enter your business or trading name first.")
            return
        }
        setBusy("business")
        setError(null)
        try {
            await apiClient("/users/dealer-profile", {
                method: "PATCH",
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    phone: phone.trim() || undefined,
                    businessAddress: businessAddress.trim() || undefined,
                }),
            })
            await refreshProfile()
        } catch (e: any) {
            setError(e?.message || "Could not save Partner business details")
        } finally {
            setBusy(null)
        }
    }

    const applyService = async (serviceType: "DELIVERY" | "INSPECTION" | "FINANCE" | "WARRANTY") => {
        setBusy(serviceType)
        setError(null)
        try {
            await apiClient(`/services/team/capabilities/${serviceType}`, { method: "POST" })
            await loadTeam()
        } catch (e: any) {
            setError(e?.message || "Could not add this service")
        } finally {
            setBusy(null)
        }
    }

    const connectStripe = async () => {
        setBusy("stripe")
        setError(null)
        try {
            const origin = window.location.origin
            const response = await apiClient<{ data?: { url: string }; url?: string }>("/users/stripe-connect/onboard", {
                method: "POST",
                body: JSON.stringify({
                    returnUrl: `${origin}/dashboard/partner?stripe=done`,
                    refreshUrl: `${origin}/dashboard/partner`,
                }),
            })
            const url = response.data?.url ?? response.url
            if (!url) throw new Error("Stripe did not return an onboarding link")
            window.location.href = url
        } catch (e: any) {
            setError(e?.message || "Could not start Stripe onboarding")
            setBusy(null)
        }
    }

    if (authLoading) {
        return <div className="min-h-[70vh] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={36} /></div>
    }

    if (!user) {
        router.replace("/auth/login?redirect=/dashboard/partner")
        return null
    }

    const delivery = team?.capabilities?.find(c => c.serviceType === "DELIVERY")
    const inspection = team?.capabilities?.find(c => c.serviceType === "INSPECTION")
    const finance = team?.capabilities?.find(c => c.serviceType === "FINANCE")
    const warranty = team?.capabilities?.find(c => c.serviceType === "WARRANTY")
    const dealerActive = !!partnerBusiness?.isVerified

    if (!isPartnerRole && !isLegacyProvider && !isAdmin) {
        return (
            <div className="max-w-3xl mx-auto pt-28 pb-16 px-5">
                <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-12 text-center">
                    <Building2 className="mx-auto text-primary mb-5" size={46} />
                    <h1 className="text-3xl font-black font-heading mb-3">Create a Partner Account</h1>
                    <p className="text-[var(--text-muted)] max-w-xl mx-auto mb-7">
                        One business account lets you add the CarMazium services you need — Vehicle Dealer, Delivery & Recovery, Vehicle Inspection, Vehicle Finance and Warranty — without changing account type each time.
                    </p>
                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                    <Button onClick={becomePartner} disabled={busy === "partner"}>
                        {busy === "partner" ? <Loader2 className="animate-spin" size={16} /> : <>Create Partner Account <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                </div>
            </div>
        )
    }

    if (isLegacyProvider && !isPartnerRole) {
        return (
            <div className="max-w-3xl mx-auto pt-28 pb-16 px-5">
                <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 md:p-12">
                    <h1 className="text-3xl font-black font-heading mb-3">Move to the new Partner Account</h1>
                    <p className="text-[var(--text-muted)] mb-5">
                        Your existing service-provider profile and approvals are kept. This only changes the account shell so you can add Vehicle Dealer and other Partner services without replacing your current services.
                    </p>
                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                    <Button onClick={becomePartner} disabled={busy === "partner"}>
                        {busy === "partner" ? <Loader2 className="animate-spin" size={16} /> : <>Continue as Partner <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto pt-28 pb-16 px-5 space-y-8">
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div>
                    <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary mb-3">
                        <Building2 size={15} /> Partner Account
                    </div>
                    <h1 className="text-4xl font-black font-heading tracking-tight">Partner Dashboard</h1>
                    <p className="text-[var(--text-muted)] mt-2 max-w-2xl">
                        One CarMazium business account. Add only the services your business provides and keep them all under the same login.
                    </p>
                </div>
                {partnerBusiness && (
                    <Link href="/dashboard/dealer/team">
                        <Button variant="outline"><Users size={16} className="mr-2" /> Manage Team</Button>
                    </Link>
                )}
            </header>

            {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 p-4 text-sm">{error}</div>}

            {!partnerBusiness ? (
                <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7 md:p-9">
                    <h2 className="text-xl font-black font-heading mb-2">Set up your Partner business</h2>
                    <p className="text-sm text-[var(--text-muted)] mb-6">Add your trading details once. CarMazium reuses them across the services you add.</p>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Business / trading name</label>
                            <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3" placeholder="Your business name" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Business phone</label>
                            <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3" placeholder="01234 567890" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Business address / service area</label>
                            <input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3" placeholder="Birmingham / Nationwide" />
                        </div>
                    </div>
                    <Button onClick={saveBusiness} disabled={busy === "business"} className="mt-6">
                        {busy === "business" ? <Loader2 className="animate-spin" size={16} /> : "Save Partner Business"}
                    </Button>
                </section>
            ) : (
                <>
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Partner business</p>
                            <h2 className="text-xl font-black font-heading mt-1">{partnerBusiness.companyName}</h2>
                        </div>
                        <Link href="/profile"><Button variant="outline">Edit business details</Button></Link>
                    </section>

                    <section>
                        <div className="flex items-end justify-between gap-4 mb-5">
                            <div><h2 className="text-2xl font-black font-heading">Your add-ons</h2><p className="text-sm text-[var(--text-muted)]">Activate one service or several. Adding one never removes another.</p></div>
                        </div>
                        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                            <AddonCard
                                icon={Building2}
                                title="Vehicle Dealer"
                                description="List retail stock, bid in auctions, manage inventory, CRM and dealer tools. Dealer KYC is required only for this add-on."
                                status={dealerActive ? "Active" : partnerBusiness?.kyc?.status === "PENDING" ? "Awaiting verification" : "Not activated"}
                                active={dealerActive}
                                action={<Link href="/dashboard/dealer"><Button size="sm" variant={dealerActive ? "outline" : "default"}>{dealerActive ? "Open dealer tools" : "Add Vehicle Dealer"}</Button></Link>}
                            />
                            <AddonCard
                                icon={Truck}
                                title="Delivery & Recovery"
                                description="Quote on transport and recovery jobs on behalf of your Partner business."
                                status={delivery ? statusLabel[delivery.status] : "Not activated"}
                                active={delivery?.status === "APPROVED"}
                                action={delivery?.status === "APPROVED"
                                    ? <Link href="/dashboard/service/jobs"><Button size="sm" variant="outline">Open jobs</Button></Link>
                                    : delivery?.status === "PENDING"
                                        ? <Link href={`/dashboard/service/capabilities/${delivery.id}/verification`}><Button size="sm"><FileText size={14} className="mr-1.5" /> Upload verification documents</Button></Link>
                                        : <Button size="sm" onClick={() => applyService("DELIVERY")} disabled={busy === "DELIVERY"}>{busy === "DELIVERY" ? <Loader2 className="animate-spin" size={14} /> : "Add service"}</Button>}
                            />
                            <AddonCard
                                icon={Wrench}
                                title="Vehicle Inspection"
                                description="Quote on vehicle inspection jobs using the same Partner account and business payout details."
                                status={inspection ? statusLabel[inspection.status] : "Not activated"}
                                active={inspection?.status === "APPROVED"}
                                action={inspection?.status === "APPROVED"
                                    ? <Link href="/dashboard/service/jobs"><Button size="sm" variant="outline">Open jobs</Button></Link>
                                    : inspection?.status === "PENDING"
                                        ? <Link href={`/dashboard/service/capabilities/${inspection.id}/verification`}><Button size="sm"><FileText size={14} className="mr-1.5" /> Upload verification documents</Button></Link>
                                        : <Button size="sm" onClick={() => applyService("INSPECTION")} disabled={busy === "INSPECTION"}>{busy === "INSPECTION" ? <Loader2 className="animate-spin" size={14} /> : "Add service"}</Button>}
                            />
                            <AddonCard
                                icon={CreditCard}
                                title="Vehicle Finance"
                                description="Receive matched customer finance enquiries and respond with your own products and terms. No CarMazium payout account is required."
                                status={finance ? statusLabel[finance.status] : "Not activated"}
                                active={finance?.status === "APPROVED"}
                                action={finance?.status === "APPROVED"
                                    ? <Link href="/dashboard/service/leads"><Button size="sm" variant="outline">Open enquiries</Button></Link>
                                    : finance?.status === "PENDING"
                                        ? <Link href={`/dashboard/service/capabilities/${finance.id}/verification`}><Button size="sm"><FileText size={14} className="mr-1.5" /> Upload verification documents</Button></Link>
                                        : <Button size="sm" onClick={() => applyService("FINANCE")} disabled={busy === "FINANCE"}>{busy === "FINANCE" ? <Loader2 className="animate-spin" size={14} /> : "Add service"}</Button>}
                            />
                            <AddonCard
                                icon={ShieldCheck}
                                title="Warranty Provider"
                                description="Receive matched warranty enquiries and respond with suitable cover options. No CarMazium payout account is required."
                                status={warranty ? statusLabel[warranty.status] : "Not activated"}
                                active={warranty?.status === "APPROVED"}
                                action={warranty?.status === "APPROVED"
                                    ? <Link href="/dashboard/service/leads"><Button size="sm" variant="outline">Open enquiries</Button></Link>
                                    : warranty?.status === "PENDING"
                                        ? <Link href={`/dashboard/service/capabilities/${warranty.id}/verification`}><Button size="sm"><FileText size={14} className="mr-1.5" /> Upload verification documents</Button></Link>
                                        : <Button size="sm" onClick={() => applyService("WARRANTY")} disabled={busy === "WARRANTY"}>{busy === "WARRANTY" ? <Loader2 className="animate-spin" size={14} /> : "Add service"}</Button>}
                            />
                        </div>
                    </section>

                    <section className="grid lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-3"><CreditCard className="text-primary" size={22} /><h3 className="font-black font-heading">TradeXchange payouts</h3></div>
                            <p className="text-sm text-[var(--text-muted)] mb-5">For Delivery and Inspection, the job poster always pays through CarMazium. CarMazium deducts 9% and the remaining 91% is paid to the Partner business Stripe Connect account.</p>
                            {loadingTeam ? <Loader2 className="animate-spin text-primary" size={18} /> : team?.stripeConnect.complete
                                ? <div className="inline-flex items-center gap-2 text-emerald-500 font-bold text-sm"><CheckCircle2 size={17} /> Business payouts enabled</div>
                                : <Button onClick={connectStripe} disabled={busy === "stripe"} variant="outline">{busy === "stripe" ? <Loader2 className="animate-spin" size={15} /> : "Set up business payouts"}</Button>}
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-3"><ShieldCheck className="text-primary" size={22} /><h3 className="font-black font-heading">One team, service permissions</h3></div>
                            <p className="text-sm text-[var(--text-muted)] mb-5">Invite staff once, then decide who can quote, manage or complete Delivery and Inspection jobs on behalf of this business. Staff never receive the CarMazium payout personally.</p>
                            <Link href="/dashboard/dealer/team"><Button variant="outline">Manage Partner team <ArrowRight size={15} className="ml-2" /></Button></Link>
                        </div>
                    </section>
                </>
            )}
        </div>
    )
}

function AddonCard({
    icon: Icon,
    title,
    description,
    status,
    active,
    action,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>
    title: string
    description: string
    status: string
    active: boolean
    action: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 flex flex-col min-h-[280px]">
            <div className="flex items-start justify-between gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Icon size={22} className="text-primary" /></div>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border px-2.5 py-1 ${active ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" : "text-[var(--text-muted)] border-[var(--border-default)] bg-[var(--bg-input)]"}`}>
                    {active ? <CheckCircle2 size={12} /> : <Clock3 size={12} />} {status}
                </span>
            </div>
            <h3 className="text-xl font-black font-heading">{title}</h3>
            <p className="text-sm text-[var(--text-muted)] mt-2 mb-6 leading-relaxed flex-1">{description}</p>
            <div>{action}</div>
        </div>
    )
}
