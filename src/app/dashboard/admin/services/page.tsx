"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, CheckCircle, XCircle, AlertCircle, CreditCard, Ban, Scale, Inbox } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import {
    adminGetCapabilities, adminReviewCapability, adminGetJobs, adminResolveDispute, adminGetServiceLeads,
    formatPence, SERVICE_LABELS,
    type ContractorCapability, type ServiceJob, type CapabilityStatus, type ServiceLead,
} from "@/lib/servicesApi"
import { JobListCard } from "@/components/services/JobBits"

type Tab = "queue" | "providers" | "jobs" | "leads" | "disputes"

function AdminServices() {
    const { user, profile } = useAuth()
    const params = useSearchParams()
    const [tab, setTab] = React.useState<Tab>((params.get("tab") as Tab) || "queue")
    const [caps, setCaps] = React.useState<ContractorCapability[] | null>(null)
    const [jobs, setJobs] = React.useState<ServiceJob[] | null>(null)
    const [leads, setLeads] = React.useState<ServiceLead[] | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(() => {
        setError(null)
        adminGetCapabilities().then(setCaps).catch(e => setError(e?.message))
        adminGetJobs().then(setJobs).catch(e => setError(e?.message))
        adminGetServiceLeads().then(setLeads).catch(e => setError(e?.message))
    }, [])
    React.useEffect(() => { if (user) load() }, [user, load])

    const review = async (id: string, status: CapabilityStatus) => {
        const reviewNote = status === "APPROVED" ? undefined : (prompt("Note to the provider:") ?? undefined)
        if (status !== "APPROVED" && reviewNote === undefined) return
        setBusy(id); setError(null)
        try { await adminReviewCapability(id, { status, reviewNote }); load() }
        catch (e: any) { setError(e?.message) } finally { setBusy(null) }
    }

    const resolve = async (id: string, outcome: "RELEASE" | "REFUND") => {
        const note = prompt(outcome === "RELEASE" ? "Release payment to the provider. Note (optional):" : "Refund the customer in full. Note (optional):")
        if (note === null) return
        setBusy(id); setError(null)
        try { await adminResolveDispute(id, { outcome, note: note || undefined }); load() }
        catch (e: any) { setError(e?.message) } finally { setBusy(null) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Admin"
    const pending = caps?.filter(c => c.status === "PENDING") ?? []
    const others = caps?.filter(c => c.status !== "PENDING") ?? []
    const disputes = jobs?.filter(j => j.status === "DISPUTED") ?? []
    const TABS: [Tab, string][] = [
        ["queue", `Applications${pending.length ? ` (${pending.length})` : ""}`],
        ["providers", "Providers"], ["jobs", `Jobs${jobs ? ` (${jobs.length})` : ""}`],
        ["leads", `Finance / Warranty${leads ? ` (${leads.length})` : ""}`],
        ["disputes", `Disputes${disputes.length ? ` (${disputes.length})` : ""}`],
    ]

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 space-y-6">
            <div><h1 className="text-3xl font-bold font-heading mb-1">Trade Exchange services</h1><p className="text-sm text-[var(--text-muted)]">Provider approvals, paid jobs, Finance/Warranty enquiries and disputes.</p></div>
            <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-1 w-fit flex-wrap">{TABS.map(([k,label]) => <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${tab===k?"bg-primary text-white":"text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{label}</button>)}</div>
            {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}</div>}
            {(!caps || !jobs || !leads) && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>}

            {caps && (tab === "queue" || tab === "providers") && <div className="space-y-3">
                {(tab === "queue" ? pending : others).length === 0 && <p className="text-sm text-[var(--text-muted)] py-10 text-center">{tab === "queue" ? "No applications waiting." : "No reviewed providers yet."}</p>}
                {(tab === "queue" ? pending : others).map(c => {
                    const u = c.contractor?.user
                    const connectOk = !!u?.stripeConnectAccountId && !!u?.stripeConnectOnboardingComplete
                    const paidJobService = c.serviceType === "DELIVERY" || c.serviceType === "INSPECTION"
                    const approvalReady = !paidJobService || connectOk
                    return <div key={c.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5"><div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap mb-1"><h3 className="font-heading font-bold">{c.contractor?.businessName || `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() || "Unnamed"}</h3><span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border bg-primary/10 border-primary/25 text-primary">{SERVICE_LABELS[c.serviceType]}</span><StatusPill status={c.status}/></div><p className="text-xs text-[var(--text-muted)]">{u?.email}{c.contractor?.phone ? ` · ${c.contractor.phone}` : ""}{c.contractor?.serviceArea ? ` · ${c.contractor.serviceArea}` : ""}</p>
                        {paidJobService ? <p className={`text-xs mt-2 inline-flex items-center gap-1.5 font-bold ${connectOk ? "text-emerald-500" : "text-amber-500"}`}><CreditCard size={13}/>{connectOk ? "Stripe Connect complete" : "Stripe Connect required before approval"}</p> : <p className="text-xs mt-2 text-emerald-500 font-bold">Lead service — no Stripe payout required</p>}
                        {c.reviewNote && <p className="text-xs text-[var(--text-muted)] mt-2">Note: {c.reviewNote}</p>}</div>
                        <div className="flex gap-2 shrink-0">{c.status !== "APPROVED" && <Button size="sm" disabled={busy===c.id || !approvalReady} title={!approvalReady ? "Provider must complete Stripe Connect first" : undefined} onClick={() => review(c.id,"APPROVED")}>{busy===c.id?<Loader2 className="animate-spin" size={14}/>:<><CheckCircle size={14} className="mr-1"/>Approve</>}</Button>}{c.status === "PENDING" && <Button size="sm" variant="outline" disabled={busy===c.id} onClick={() => review(c.id,"REJECTED")}><XCircle size={14} className="mr-1"/>Reject</Button>}{c.status === "APPROVED" && <Button size="sm" variant="outline" disabled={busy===c.id} onClick={() => review(c.id,"SUSPENDED")}><Ban size={14} className="mr-1"/>Suspend</Button>}</div>
                    </div></div>
                })}
            </div>}

            {jobs && tab === "jobs" && <div className="space-y-3">{jobs.length===0 && <p className="text-sm text-[var(--text-muted)] py-10 text-center">No jobs yet.</p>}{jobs.map(j => <JobListCard key={j.id} job={j} href={`/services/jobs/${j.id}`} trailing={<span className="text-xs text-[var(--text-muted)]">{j.customer?.firstName} {j.customer?.lastName}{j.contractor ? ` → ${j.contractor.businessName || j.contractor.user.firstName}` : ""}{j.agreedAmountPence != null ? ` · ${formatPence(j.agreedAmountPence)}` : ""}</span>} />)}</div>}

            {leads && tab === "leads" && <div className="space-y-3">{leads.length===0 && <p className="text-sm text-[var(--text-muted)] py-10 text-center">No Finance or Warranty enquiries yet.</p>}{leads.map(l => <div key={l.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex gap-2 items-center flex-wrap"><h3 className="font-heading font-bold">{[l.vehicleRegistration,l.vehicleMake,l.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}</h3><span className="text-[10px] font-black uppercase tracking-widest text-primary">{SERVICE_LABELS[l.serviceType]}</span></div><p className="text-xs text-[var(--text-muted)] mt-2">Customer: {l.fullName} · {l.email}{l.phone ? ` · ${l.phone}` : ""}</p><p className="text-xs text-[var(--text-muted)] mt-1">Matched providers: {l.recipientCount ?? 0} · Responses: {l.responseCount ?? 0} · Created {new Date(l.createdAt).toLocaleDateString("en-GB")}</p></div><span className="text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] rounded-full px-2.5 py-1">{l.status}</span></div></div>)}</div>}

            {jobs && tab === "disputes" && <div className="space-y-3">{disputes.length===0 && <p className="text-sm text-[var(--text-muted)] py-10 text-center">Nothing in dispute.</p>}{disputes.map(j => <div key={j.id} className="rounded-2xl border border-red-500/30 bg-[var(--bg-card)] p-5"><div className="flex items-start justify-between gap-4 mb-3"><div><h3 className="font-heading font-bold">{j.title}</h3><p className="text-xs text-[var(--text-muted)]">Held: {j.payment ? formatPence(j.payment.grossPence) : "—"} · provider share {j.payment ? formatPence(j.payment.contractorPence) : "—"}</p>{j.cancelReason && <p className="text-sm mt-2">{j.cancelReason}</p>}</div><Scale size={20} className="text-red-500 shrink-0"/></div><div className="flex gap-2"><Button size="sm" disabled={busy===j.id} onClick={() => resolve(j.id,"RELEASE")}>Release to provider</Button><Button size="sm" variant="outline" disabled={busy===j.id} onClick={() => resolve(j.id,"REFUND")}>Refund customer</Button></div></div>)}</div>}
        </main>
    </div></div>
}

function StatusPill({ status }: { status: CapabilityStatus }) {
    const cls = status === "APPROVED" ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/25" : status === "PENDING" ? "text-amber-500 bg-amber-500/10 border-amber-500/25" : "text-red-500 bg-red-500/10 border-red-500/25"
    return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${cls}`}>{status.toLowerCase()}</span>
}

export default function AdminServicesPage() {
    return <React.Suspense fallback={<div className="flex justify-center py-32"><Loader2 className="animate-spin text-primary" /></div>}><AdminServices /></React.Suspense>
}
