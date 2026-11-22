"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    CreditCard,
    Loader2,
    ShieldCheck,
    Users,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { Button } from "@/components/ui/Button"
import { serviceVerificationPath, type JobService } from "@/lib/serviceSetupRouting"

type CapabilityStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
type PartnerCapability = {
    id: string
    serviceType: "DELIVERY" | "INSPECTION" | "FINANCE" | "WARRANTY"
    status: CapabilityStatus
    verificationStatus?: string | null
    verificationExpiresAt?: string | null
    jobNationwide?: boolean
    jobPostcodeAreas?: string[]
    reviewNote?: string | null
}
type PartnerTeam = {
    dealerProfileId: string
    companyName: string
    stripeConnect: { connected: boolean; complete: boolean }
    capabilities: PartnerCapability[]
    payoutPolicy: string
}

export default function PartnerDashboardPage() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const router = useRouter()
    const [team, setTeam] = React.useState<PartnerTeam | null>(null)
    const [loadingTeam, setLoadingTeam] = React.useState(true)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [companyName, setCompanyName] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [businessAddress, setBusinessAddress] = React.useState("")
    const [servicesExpanded, setServicesExpanded] = React.useState(true)

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

    const applyService = async (serviceType: JobService) => {
        setBusy(serviceType)
        setError(null)
        try {
            const response = await apiClient(`/services/team/capabilities/${serviceType}`, { method: "POST" })
            router.push(serviceVerificationPath(response, serviceType))
        } catch (e: any) {
            setError(e?.message || "Could not add this service")
        } finally {
            setBusy(null)
        }
    }

    const toggleService = async (serviceType: JobService, enabled: boolean) => {
        const key = serviceType === "DELIVERY" ? "deliveryServicesEnabled" : "inspectionServicesEnabled"
        setBusy(key)
        setError(null)
        try {
            await apiClient("/users/dealer-profile", {
                method: "PATCH",
                body: JSON.stringify({ [key]: enabled }),
            })
            await refreshProfile()
            // Preference changes never replace capability approvals or documents.
        } catch (e: any) {
            setError(e?.message || "Could not update your service preference")
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

    if (!isPartnerRole && !isLegacyProvider && !isAdmin) {
        return (
            <div className="max-w-3xl mx-auto pt-28 pb-16 px-5">
                <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-12 text-center">
                    <Building2 className="mx-auto text-primary mb-5" size={46} />
                    <h1 className="text-3xl font-black font-heading mb-3">{partnerBusiness ? "Continue your existing business setup" : "Create a Partner Account"}</h1>
                    <p className="text-[var(--text-muted)] max-w-xl mx-auto mb-7">
                        {partnerBusiness ? "Your saved business details are already on this account. Continue verification without creating another business profile or repeating onboarding." : "One business account lets you add Vehicle Dealer, Delivery & Recovery and Vehicle Inspection services. Finance and warranty providers should contact our team directly."}
                    </p>
                    {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                    <Button onClick={becomePartner} disabled={busy === "partner"}>
                        {busy === "partner" ? <Loader2 className="animate-spin" size={16} /> : <>{partnerBusiness ? "Continue setup" : "Create Partner Account"} <ArrowRight size={16} className="ml-2" /></>}
                    </Button>
                </div>
            </div>
        )
    }

    if (isLegacyProvider && !isPartnerRole) {
        return (
            <div className="max-w-3xl mx-auto pt-28 pb-16 px-5">
                <div className="rounded-3xl border border-primary/30 bg-primary/5 p-8 md:p-12">
                    <h1 className="text-3xl font-black font-heading mb-3">TradeXchange</h1>
                    <p className="text-[var(--text-muted)] mb-5">
                        Continue using your existing service-provider account. Your applications, approvals and documents remain unchanged; no dealer registration is needed.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/dashboard/service/capabilities"><Button>My services</Button></Link>
                        <Link href="/dashboard/service/jobs"><Button variant="outline">Find jobs</Button></Link>
                        <Link href="/dashboard/service/jobs?tab=mine"><Button variant="outline">My work</Button></Link>
                    </div>
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
                    <Link href="/business-partner-agreement" className="mt-3 inline-flex text-sm font-bold text-primary underline">View signed Business Partner Agreement and legal record</Link>
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
                        <div className="flex flex-wrap gap-2">
                            <Link href="/profile?section=business"><Button variant="outline">Edit business details</Button></Link>
                            {!partnerBusiness.isVerified && <Link href="/profile?section=verification"><Button>Continue dealer verification</Button></Link>}
                        </div>
                    </section>


                    <section id="provider-services" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7">
                        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={servicesExpanded} aria-controls="provider-service-options" onClick={() => setServicesExpanded(current => !current)}>
                            <span>
                                <span className="block text-xl font-black font-heading">My Services</span>
                                <span className="block text-sm text-[var(--text-muted)] mt-1">Choose the work you offer. Approval and documents are kept when a service is paused.</span>
                            </span>
                            <span className="text-2xl text-[var(--text-muted)]" aria-hidden="true">{servicesExpanded ? "−" : "+"}</span>
                        </button>
                        {servicesExpanded && <div id="provider-service-options" className="mt-5 space-y-3">
                            {(["DELIVERY", "INSPECTION"] as const).map(serviceType => {
                                const cap = serviceType === "DELIVERY" ? delivery : inspection
                                const key = serviceType === "DELIVERY" ? "deliveryServicesEnabled" : "inspectionServicesEnabled"
                                const enabled = partnerBusiness[key] !== false
                                const expires = cap?.verificationExpiresAt ? new Date(cap.verificationExpiresAt).getTime() : 0
                                const verified = cap?.verificationStatus === "VERIFIED" && expires > Date.now()
                                const coverage = cap?.jobNationwide || (cap?.jobPostcodeAreas?.length ?? 0) > 0
                                const status = !team ? "Status unavailable" : !enabled ? "Paused" : !cap ? "Not set up"
                                    : cap.status === "SUSPENDED" ? "Suspended"
                                    : cap.status === "REJECTED" ? "Needs attention"
                                    : cap.status === "PENDING" ? "Awaiting approval"
                                    : !verified ? "Verification required"
                                    : !partnerBusiness.isVerified ? "Dealer verification required"
                                    : !team.stripeConnect.complete ? "Payout setup required"
                                    : !coverage ? "Set working areas"
                                    : "Approved"
                                return <div key={serviceType} className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-bold text-base">{serviceType === "DELIVERY" ? "Collection, delivery & recovery" : "Vehicle inspection"}</h3>
                                            <p className="text-sm text-[var(--text-muted)] mt-1">{serviceType === "DELIVERY" ? "Vehicle movements and recovery work." : "Vehicle and pre-purchase inspections."}</p>
                                        </div>
                                        <label className="flex shrink-0 items-center gap-2 text-sm font-semibold">
                                            <input type="checkbox" className="h-5 w-5" aria-label={serviceType === "DELIVERY" ? "Offer collection, delivery and recovery" : "Offer vehicle inspection"} checked={enabled} disabled={!!busy || loadingTeam || !team} onChange={event => void toggleService(serviceType, event.target.checked)} />
                                            {enabled ? "On" : "Off"}
                                        </label>
                                    </div>
                                    <p className="text-sm font-semibold" role="status">{status}</p>
                                    {cap?.reviewNote && (cap.status === "REJECTED" || cap.status === "SUSPENDED") && <p className="text-sm text-red-600 dark:text-red-300">{cap.reviewNote}</p>}
                                    {!enabled && <div className="flex flex-wrap items-center gap-2"><p className="text-xs text-[var(--text-muted)]">No new jobs while paused. Existing work, evidence and approval history are preserved.</p><Link className="text-sm font-semibold text-primary underline" href="/dashboard/service/jobs?tab=mine">View existing work</Link></div>}
                                    {enabled && team && <div className="flex flex-wrap gap-2">
                                        {!cap || cap.status === "REJECTED"
                                            ? <Button size="sm" disabled={!!busy} onClick={() => void applyService(serviceType)}>{cap ? "Reapply" : "Apply for service"}</Button>
                                            : cap.status === "PENDING" || (cap.status === "APPROVED" && !verified)
                                                ? <Link href={'/dashboard/service/capabilities/' + cap.id + '/verification'}><Button size="sm">{cap.status === "PENDING" ? "Continue setup" : "Review verification"}</Button></Link>
                                                : cap.status === "SUSPENDED"
                                                    ? <p className="text-xs text-[var(--text-muted)]">Contact CarMazium to reactivate this service.</p>
                                                    : <Link href="/dashboard/service/jobs"><Button size="sm" variant="outline">View jobs</Button></Link>}
                                        {cap?.status === "APPROVED" && verified && !coverage &&
                                            <Link href={'/dashboard/service/capabilities/' + cap.id + '/matching'}><Button size="sm" variant="outline">Set working areas</Button></Link>}
                                    </div>}
                                </div>
                            })}
                            <p className="text-xs text-[var(--text-muted)]">Switching a service on does not approve it. Job eligibility is checked by CarMazium using your verification, working areas and payout setup.</p>
                        </div>}
                    </section>

                    <section className="grid lg:grid-cols-2 gap-5">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div className="flex items-center gap-3 mb-3"><CreditCard className="text-primary" size={22} /><h3 className="font-black font-heading">TradeXchange payouts</h3></div>
                            <p className="text-sm text-[var(--text-muted)] mb-5">For Delivery and Inspection, the job poster always pays through CarMazium. CarMazium deducts 9% and the remaining 91% is paid to the Partner business Stripe Connect account.</p>
                            {loadingTeam ? <Loader2 className="animate-spin text-primary" size={18} /> : team?.stripeConnect.complete
                                ? <div className="inline-flex items-center gap-2 text-emerald-500 font-bold text-sm"><CheckCircle2 size={17} /> Business payouts enabled</div>
                                : <Button onClick={connectStripe} disabled={!team || busy === "stripe"} variant="outline">{busy === "stripe" ? <Loader2 className="animate-spin" size={15} /> : "Set up business payouts"}</Button>}
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
