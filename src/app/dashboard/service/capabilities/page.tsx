"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, CheckCircle, Clock, CreditCard, FileText, Landmark, Loader2, ShieldCheck, Truck, Wrench, XCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { apiClient } from "@/lib/apiClient"
import { getMyCapabilities, applyCapability, SERVICE_LABELS, type MyCapabilities, type ServiceType, type CapabilityStatus } from "@/lib/servicesApi"

const APPLICABLE: { type: ServiceType; icon: React.ComponentType<{ size?: number; className?: string }>; blurb: string; payout: boolean }[] = [
    { type: "DELIVERY", icon: Truck, blurb: "Quote on vehicle moves and recoveries. CarMazium keeps 9%; your Partner business receives 91% after completion.", payout: true },
    { type: "INSPECTION", icon: Wrench, blurb: "Quote on pre-purchase and trade vehicle inspections. CarMazium keeps 9%; your Partner business receives 91% after completion.", payout: true },
    { type: "FINANCE", icon: Landmark, blurb: "Receive matched vehicle-finance enquiries and respond with your own products and terms.", payout: false },
    { type: "WARRANTY", icon: ShieldCheck, blurb: "Receive matched warranty enquiries and respond with suitable cover options.", payout: false },
]

const STATUS_UI: Record<CapabilityStatus, { icon: React.ComponentType<{ size?: number; className?: string }>; cls: string; label: string }> = {
    PENDING: { icon: Clock, cls: "text-amber-500 bg-amber-500/10 border-amber-500/25", label: "Awaiting review" },
    APPROVED: { icon: CheckCircle, cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25", label: "Approved" },
    REJECTED: { icon: XCircle, cls: "text-red-500 bg-red-500/10 border-red-500/25", label: "Not approved" },
    SUSPENDED: { icon: XCircle, cls: "text-red-500 bg-red-500/10 border-red-500/25", label: "Suspended" },
}
const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
const labelCls = "block text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2"

export default function CapabilitiesPage() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const [data, setData] = React.useState<MyCapabilities | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [switching, setSwitching] = React.useState(false)
    const [businessName, setBusinessName] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [serviceArea, setServiceArea] = React.useState("")

    const role = profile?.role || ""
    const isPartner = role === "DEALER"
    const isLegacyProvider = role === "CONTRACTOR"
    const isProvider = isPartner || isLegacyProvider || role === "ADMIN"

    const becomePartner = async () => {
        setSwitching(true); setError(null)
        try {
            await apiClient("/users/elevate", { method: "POST", body: JSON.stringify({ newRole: "DEALER" }) })
            await refreshProfile()
        } catch (e: any) {
            setError(e?.message || "Could not create your Partner Account")
        } finally {
            setSwitching(false)
        }
    }

    const load = React.useCallback(() => {
        getMyCapabilities().then(d => {
            setData(d)
            setBusinessName(d.profile?.businessName ?? profile?.dealerProfile?.companyName ?? "")
            setPhone(d.profile?.phone ?? profile?.dealerProfile?.phone ?? "")
            setServiceArea(d.profile?.serviceArea ?? profile?.dealerProfile?.businessAddress ?? "")
        }).catch(e => setError(e?.message || "Could not load service settings"))
    }, [profile?.dealerProfile?.companyName, profile?.dealerProfile?.phone, profile?.dealerProfile?.businessAddress])

    React.useEffect(() => {
        if (!authLoading && user && isProvider) load()
    }, [authLoading, user, isProvider, load])

    const apply = async (type: ServiceType) => {
        setBusy(type); setError(null)
        try {
            if (isPartner && (type === "DELIVERY" || type === "INSPECTION")) {
                if (!profile?.dealerProfile) {
                    throw new Error("Set up your Partner business details first from the Partner Dashboard.")
                }
                await apiClient(`/services/team/capabilities/${type}`, { method: "POST" })
            } else {
                await applyCapability({ serviceType: type, businessName: businessName.trim() || undefined, phone: phone.trim() || undefined, serviceArea: serviceArea.trim() || undefined })
            }
            load()
        } catch (e: any) {
            setError(e?.message || "Could not apply")
        } finally {
            setBusy(null)
        }
    }

    const connectStripe = async () => {
        setBusy("stripe"); setError(null)
        try {
            const origin = window.location.origin
            const returnPath = isPartner ? "/dashboard/partner" : "/dashboard/service/capabilities"
            const r = await apiClient<{ data?: { url: string }; url?: string }>("/users/stripe-connect/onboard", {
                method: "POST",
                body: JSON.stringify({ returnUrl: `${origin}${returnPath}?stripe=done`, refreshUrl: `${origin}${returnPath}` }),
            })
            const url = r.data?.url ?? r.url
            if (!url) throw new Error("Stripe did not return an onboarding link")
            window.location.href = url
        } catch (e: any) {
            setError(e?.message || "Could not start Stripe onboarding"); setBusy(null)
        }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Partner"
    const byType = new Map((data?.capabilities ?? []).map(c => [c.serviceType, c]))
    const visibleServices = isPartner ? APPLICABLE.filter(s => s.type === "DELIVERY" || s.type === "INSPECTION") : APPLICABLE

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role={isPartner ? "dealer" : "provider"} userName={userName} userType="Partner Account" />
                <main className="flex-1 space-y-8 max-w-3xl">
                    <div>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div><h1 className="text-3xl font-bold font-heading mb-1">Service add-ons</h1><p className="text-sm text-[var(--text-muted)]">Add services to the same Partner Account. Adding one never replaces another.</p></div>
                            {isPartner && <Link href="/dashboard/partner" className="text-sm font-bold text-primary hover:underline">Partner Dashboard →</Link>}
                        </div>
                    </div>

                    {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}</div>}

                    {!authLoading && user && !isProvider && (
                        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                            <h2 className="font-heading font-bold text-lg mb-1">Create a Partner Account</h2>
                            <p className="text-sm text-[var(--text-muted)] mb-5">Businesses use one Partner Account, then add Vehicle Dealer, Delivery, Recovery or Inspection services from that dashboard.</p>
                            <Button onClick={becomePartner} disabled={switching}>{switching ? <Loader2 className="animate-spin" size={16} /> : <>Create Partner Account <ArrowRight size={16} className="ml-2" /></>}</Button>
                        </section>
                    )}

                    {isProvider && !data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}

                    {isProvider && data && <>
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Your business</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2"><label className={labelCls}>Trading name</label><input className={inputCls} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Midlands Vehicle Services" maxLength={120} /></div>
                                <div><label className={labelCls}>Business phone</label><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} /></div>
                                <div><label className={labelCls}>Area you cover</label><input className={inputCls} value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="Nationwide, West Midlands..." maxLength={200} /></div>
                            </div>
                            {isPartner && <p className="text-xs text-[var(--text-muted)] mt-3">Partner business details are managed centrally from your Partner Dashboard/Profile.</p>}
                        </section>

                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Payments for job services</h2>
                            <p className="text-xs text-[var(--text-muted)] mb-4">For Delivery & Recovery and Vehicle Inspections, the customer pays through CarMazium. CarMazium keeps 9% and pays the 91% balance to the Partner business Stripe Connect account.</p>
                            {data.stripeConnect.complete
                                ? <p className="text-sm inline-flex items-center gap-2 text-emerald-500 font-bold"><CheckCircle size={16} /> Business payouts enabled</p>
                                : <Button onClick={connectStripe} disabled={busy === "stripe"} variant="outline">{busy === "stripe" ? <Loader2 className="animate-spin" size={16} /> : <><CreditCard size={16} className="mr-2" /> {data.stripeConnect.connected ? "Finish Stripe setup" : "Set up business payouts"}</>}</Button>}
                        </section>

                        <section>
                            <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Add services</h2>
                            <div className="space-y-3">
                                {visibleServices.map(({ type, icon: Icon, blurb, payout }) => {
                                    const cap = byType.get(type)
                                    const st = cap ? STATUS_UI[cap.status] : null
                                    const canApply = !cap || cap.status === "REJECTED" || cap.status === "SUSPENDED"
                                    return <div key={type} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"><Icon size={20} className="text-primary" /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap"><h3 className="font-heading font-bold">{SERVICE_LABELS[type]}</h3>{st && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${st.cls}`}><st.icon size={11} /> {st.label}</span>}</div>
                                            <p className="text-xs text-[var(--text-muted)] mt-1">{blurb}</p>
                                            {payout && !data.stripeConnect.complete && <p className="text-[11px] text-amber-500 mt-2">Stripe Connect must be completed before admin can approve this paid-job service.</p>}
                                            {cap?.reviewNote && (cap.status === "REJECTED" || cap.status === "SUSPENDED") && <p className="text-xs text-red-500 mt-2">{cap.reviewNote}</p>}
                                            {cap && <Link href={`/dashboard/service/capabilities/${cap.id}/verification`} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mt-2"><FileText size={13} /> Verification documents</Link>}
                                        </div>
                                        {canApply
                                            ? <Button size="sm" variant="outline" disabled={busy === type} onClick={() => apply(type)} className="shrink-0">{busy === type ? <Loader2 className="animate-spin" size={14} /> : <>{cap ? "Apply again" : "Add service"} <ArrowRight size={14} className="ml-1" /></>}</Button>
                                            : cap?.status === "APPROVED" ? <Link href={payout ? "/dashboard/service/jobs" : "/dashboard/service/leads"} className="text-xs font-bold text-primary hover:underline shrink-0">{payout ? "See jobs" : "Open inbox"} →</Link> : null}
                                    </div>
                                })}
                            </div>
                        </section>
                    </>}
                </main>
            </div>
        </div>
    )
}
