"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, CheckCircle, Clock, XCircle, AlertCircle, CreditCard, ArrowRight, Truck, Wrench, Landmark, ShieldCheck } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { apiClient } from "@/lib/apiClient"
import { getMyCapabilities, applyCapability, SERVICE_LABELS, type MyCapabilities, type ServiceType, type CapabilityStatus } from "@/lib/servicesApi"

const APPLICABLE: { type: ServiceType; icon: React.ComponentType<{ size?: number; className?: string }>; blurb: string; payout: boolean }[] = [
    { type: "DELIVERY", icon: Truck, blurb: "Quote on vehicle moves and recoveries. CarMazium keeps 9%; you receive 91% after completion.", payout: true },
    { type: "INSPECTION", icon: Wrench, blurb: "Quote on pre-purchase and trade vehicle inspections. CarMazium keeps 9%; you receive 91% after completion.", payout: true },
    { type: "FINANCE", icon: Landmark, blurb: "Receive matched vehicle-finance enquiries and respond with your own products and terms. No CarMazium job payment or 9% fee.", payout: false },
    { type: "WARRANTY", icon: ShieldCheck, blurb: "Receive matched warranty enquiries and respond with suitable cover options. No CarMazium job payment or 9% fee.", payout: false },
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
    const isProvider = profile?.role === "CONTRACTOR" || profile?.role === "ADMIN"

    const becomeProvider = async () => {
        setSwitching(true); setError(null)
        try {
            await apiClient('/users/elevate', { method: 'POST', body: JSON.stringify({ newRole: 'CONTRACTOR' }) })
            await refreshProfile()
        } catch (e: any) { setError(e?.message || "Could not switch your account") }
        finally { setSwitching(false) }
    }

    const load = React.useCallback(() => {
        getMyCapabilities().then(d => {
            setData(d); setBusinessName(d.profile?.businessName ?? ""); setPhone(d.profile?.phone ?? ""); setServiceArea(d.profile?.serviceArea ?? "")
        }).catch(e => setError(e?.message || "Could not load provider settings"))
    }, [])
    React.useEffect(() => { if (!authLoading && user && isProvider) load() }, [authLoading, user, isProvider, load])

    const apply = async (type: ServiceType) => {
        setBusy(type); setError(null)
        try {
            await applyCapability({ serviceType: type, businessName: businessName.trim() || undefined, phone: phone.trim() || undefined, serviceArea: serviceArea.trim() || undefined })
            load()
        } catch (e: any) { setError(e?.message || "Could not apply") }
        finally { setBusy(null) }
    }

    const connectStripe = async () => {
        setBusy("stripe"); setError(null)
        try {
            const origin = window.location.origin
            const r = await apiClient<{ data?: { url: string }; url?: string }>('/users/stripe-connect/onboard', { method: 'POST', body: JSON.stringify({ returnUrl: `${origin}/dashboard/service/capabilities?stripe=done`, refreshUrl: `${origin}/dashboard/service/capabilities` }) })
            const url = r.data?.url ?? r.url
            if (!url) throw new Error("Stripe did not return an onboarding link")
            window.location.href = url
        } catch (e: any) { setError(e?.message || "Could not start Stripe onboarding"); setBusy(null) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"
    const byType = new Map((data?.capabilities ?? []).map(c => [c.serviceType, c]))

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 space-y-8 max-w-3xl">
                    <div><h1 className="text-3xl font-bold font-heading mb-1">Service areas</h1><p className="text-sm text-[var(--text-muted)]">Apply only for the services your business provides. CarMazium approves every area separately.</p></div>
                    {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}</div>}

                    {!authLoading && user && !isProvider && <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6"><h2 className="font-heading font-bold text-lg mb-1">Switch this account to Service Provider</h2><p className="text-sm text-[var(--text-muted)] mb-5">The same login can become a provider account. A provider role alone gives no work access; each service still requires admin approval.</p><Button onClick={becomeProvider} disabled={switching}>{switching ? <Loader2 className="animate-spin" size={16} /> : <>Switch to Service Provider <ArrowRight size={16} className="ml-2" /></>}</Button></section>}
                    {isProvider && !data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}

                    {isProvider && data && <>
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">1 · Your business</h2>
                            <div className="grid sm:grid-cols-2 gap-4"><div className="sm:col-span-2"><label className={labelCls}>Trading name</label><input className={inputCls} value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Midlands Vehicle Services" maxLength={120} /></div><div><label className={labelCls}>Business phone</label><input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} /></div><div><label className={labelCls}>Area you cover</label><input className={inputCls} value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="Nationwide, West Midlands..." maxLength={200} /></div></div>
                        </section>

                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">2 · Payments for job services</h2>
                            <p className="text-xs text-[var(--text-muted)] mb-4">Stripe Connect is required only for Delivery & Recovery and Vehicle Inspections because CarMazium collects the accepted quote and pays your 91% share. Finance and Warranty are lead introductions and do not require Stripe.</p>
                            {data.stripeConnect.complete ? <p className="text-sm inline-flex items-center gap-2 text-emerald-500 font-bold"><CheckCircle size={16} /> Stripe payouts enabled</p> : <Button onClick={connectStripe} disabled={busy === "stripe"} variant="outline">{busy === "stripe" ? <Loader2 className="animate-spin" size={16} /> : <><CreditCard size={16} className="mr-2" /> {data.stripeConnect.connected ? "Finish Stripe setup" : "Set up Stripe for paid jobs"}</>}</Button>}
                        </section>

                        <section><h2 className="text-xs font-black uppercase tracking-widest text-primary mb-4">3 · Apply for service areas</h2><div className="space-y-3">
                            {APPLICABLE.map(({ type, icon: Icon, blurb, payout }) => {
                                const cap = byType.get(type); const st = cap ? STATUS_UI[cap.status] : null
                                const canApply = !cap || cap.status === "REJECTED" || cap.status === "SUSPENDED"
                                return <div key={type} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0"><Icon size={20} className="text-primary" /></div>
                                    <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-heading font-bold">{SERVICE_LABELS[type]}</h3>{st && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${st.cls}`}><st.icon size={11} /> {st.label}</span>}</div><p className="text-xs text-[var(--text-muted)] mt-1">{blurb}</p>{payout && !data.stripeConnect.complete && <p className="text-[11px] text-amber-500 mt-2">Stripe Connect must be completed before admin can approve this paid-job service.</p>}{cap?.reviewNote && (cap.status === "REJECTED" || cap.status === "SUSPENDED") && <p className="text-xs text-red-500 mt-2">{cap.reviewNote}</p>}</div>
                                    {canApply ? <Button size="sm" variant="outline" disabled={busy === type} onClick={() => apply(type)} className="shrink-0">{busy === type ? <Loader2 className="animate-spin" size={14} /> : <>{cap ? "Apply again" : "Apply"} <ArrowRight size={14} className="ml-1" /></>}</Button> : cap?.status === "APPROVED" ? <Link href={payout ? "/dashboard/service/jobs" : "/dashboard/service/leads"} className="text-xs font-bold text-primary hover:underline shrink-0">{payout ? "See jobs" : "Open inbox"} →</Link> : null}
                                </div>
                            })}
                        </div></section>
                    </>}
                </main>
            </div>
        </div>
    )
}
