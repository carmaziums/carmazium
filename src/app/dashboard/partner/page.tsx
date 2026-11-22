"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    Building2,
    Loader2,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { Button } from "@/components/ui/Button"
import { validatedServiceCapability, type JobService } from "@/lib/serviceSetupRouting"
import { ProviderDocumentsSection } from "@/components/tradexchange/ProviderDocumentsSection"
import { ContractorServicesInline } from "@/components/tradexchange/ContractorServicesInline"
import { ProviderBusinessPaymentsSection, ProviderJobPreferencesSection } from "@/components/tradexchange/ProviderSettingsSections"
import { getMyCapabilities, type ContractorCapability, type MyCapabilities } from "@/lib/servicesApi"

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
    const [legacyCapabilities, setLegacyCapabilities] = React.useState<ContractorCapability[]>([])
    const [legacyProviderProfile, setLegacyProviderProfile] = React.useState<MyCapabilities["profile"]>(null)
    const [legacyPayoutComplete, setLegacyPayoutComplete] = React.useState(false)

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

    React.useEffect(() => {
        if (!isLegacyProvider || !user) return
        let cancelled = false
        getMyCapabilities().then(result => {
            if (!cancelled) { setLegacyCapabilities(result.capabilities); setLegacyProviderProfile(result.profile); setLegacyPayoutComplete(result.stripeConnect.complete) }
        }).catch(() => { if (!cancelled) setError("Could not load service documents. Refresh to retry.") })
        return () => { cancelled = true }
    }, [isLegacyProvider, user])

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
            validatedServiceCapability(response, serviceType)
            await loadTeam()
            window.location.hash = "provider-business"
            window.dispatchEvent(new HashChangeEvent("hashchange"))
        } catch (e: any) {
            setError(e?.message || "Could not add this service")
        } finally {
            setBusy(null)
        }
    }

    const openInlineSection = (section: 'business' | 'preferences', capabilityId: string) => {
        const url = new URL(window.location.href)
        url.searchParams.set('capability', capabilityId)
        url.hash = `provider-${section}`
        window.history.replaceState(null, '', url)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
        document.getElementById(`provider-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
                        <Link href="#provider-services"><Button>My services</Button></Link>
                        <Link href="/dashboard/service/jobs"><Button variant="outline">Find jobs</Button></Link>
                        <Link href="/dashboard/service/jobs?tab=mine"><Button variant="outline">My work</Button></Link>
                    </div>
                    <div className="mt-5 space-y-4">
                        <ContractorServicesInline capabilities={legacyCapabilities} profile={legacyProviderProfile} onUpdated={async () => {
                            const result = await getMyCapabilities()
                            setLegacyCapabilities(result.capabilities)
                            setLegacyProviderProfile(result.profile)
                            setLegacyPayoutComplete(result.stripeConnect.complete)
                        }} />
                        <ProviderBusinessPaymentsSection capabilities={legacyCapabilities} stripeComplete={legacyPayoutComplete} />
                        <ProviderDocumentsSection capabilities={legacyCapabilities} />
                        <ProviderJobPreferencesSection capabilities={legacyCapabilities} />
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
                        <Building2 size={15} /> TradeXchange
                    </div>
                    <h1 className="text-4xl font-black font-heading tracking-tight">TradeXchange</h1>
                    <p className="text-[var(--text-muted)] mt-2 max-w-2xl">
                        One CarMazium business account. Choose one or multiple services—collection, delivery & recovery and/or vehicle inspections—under the same login. Each application has its own insurance checks.
                    </p>
                    <Link href="/business-partner-agreement" className="mt-3 inline-flex text-sm font-bold text-primary underline">View signed Business Partner Agreement and legal record</Link>
                </div>
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
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Registered business address</label>
                            <input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3" placeholder="Registered business address" />
                        </div>
                    </div>
                    <Button onClick={saveBusiness} disabled={busy === "business"} className="mt-6">
                        {busy === "business" ? <Loader2 className="animate-spin" size={16} /> : "Save Partner Business"}
                    </Button>
                </section>
            ) : (
                <>
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
                                                ? <Button size="sm" onClick={() => openInlineSection("business", cap.id)}>{cap.status === "PENDING" ? "Continue setup" : "Review verification"}</Button>
                                                : cap.status === "SUSPENDED"
                                                    ? <p className="text-xs text-[var(--text-muted)]">Contact CarMazium to reactivate this service.</p>
                                                    : <Link href="/dashboard/service/jobs"><Button size="sm" variant="outline">View jobs</Button></Link>}
                                        {cap?.status === "APPROVED" && verified && !coverage &&
                                            <Button size="sm" variant="outline" onClick={() => openInlineSection('preferences', cap.id)}>Set working areas</Button>}
                                    </div>}
                                </div>
                            })}
                            <p className="text-xs text-[var(--text-muted)]">Switching a service on does not approve it. Job eligibility is checked by CarMazium using your verification, working areas and payout setup.</p>
                        </div>}
                    </section>

                    <ProviderBusinessPaymentsSection capabilities={team?.capabilities ?? []} dealer={partnerBusiness} stripeComplete={team?.stripeConnect.complete} onSaved={refreshProfile} />
                    <ProviderDocumentsSection capabilities={team?.capabilities ?? []} />
                    <ProviderJobPreferencesSection capabilities={team?.capabilities ?? []} />

                </>
            )}
        </div>
    )
}
