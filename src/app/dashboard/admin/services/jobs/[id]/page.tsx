"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, ExternalLink, FileText, Loader2, Scale, Upload } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { JobRoute, JobStatusBadge, JobTiming, JobVehicles } from "@/components/services/JobBits"
import { formatPence, SERVICE_LABELS } from "@/lib/servicesApi"
import {
    adminAddDisputeCaseEntry,
    adminGetJobDetail,
    adminUploadDisputeCaseEntry,
    adminResolveDisputeWithCase,
    type AdminJobDetail,
} from "@/lib/serviceOperationsApi"

const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"

export default function AdminServiceJobPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [job, setJob] = React.useState<AdminJobDetail | null>(null)
    const [note, setNote] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!id) return
        setError(null)
        try { setJob(await adminGetJobDetail(id)) }
        catch (e: any) { setError(e?.message || "Could not load service job") }
    }, [id])
    React.useEffect(() => { if (user) load() }, [user, load])

    const addNote = async () => {
        if (!note.trim()) return
        setBusy("note"); setError(null)
        try { await adminAddDisputeCaseEntry(id, { kind: "NOTE", note: note.trim() }); setNote(""); await load() }
        catch (e: any) { setError(e?.message || "Could not add case note") }
        finally { setBusy(null) }
    }

    const uploadEvidence = async () => {
        if (!file) return
        if (file.size > 10 * 1024 * 1024) { setError("Please keep each evidence file under 10 MB."); return }
        setBusy("upload"); setError(null)
        try {
            await adminUploadDisputeCaseEntry(id, file, file.name)
            setFile(null)
            const input = document.getElementById("dispute-evidence") as HTMLInputElement | null
            if (input) input.value = ""
            await load()
        } catch (e: any) { setError(e?.message || "Could not upload evidence") }
        finally { setBusy(null) }
    }

    const resolve = async (outcome: "RELEASE" | "REFUND") => {
        const decisionNote = prompt(outcome === "RELEASE" ? "Why is payment being released to the provider?" : "Why is the customer being refunded?")
        if (decisionNote === null) return
        setBusy(outcome); setError(null)
        try { await adminResolveDisputeWithCase(id, { outcome, note: decisionNote.trim() || undefined }); await load() }
        catch (e: any) { setError(e?.message || "Could not resolve dispute") }
        finally { setBusy(null) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Admin"
    const timeline = job ? [
        ["Created", job.createdAt], ["Quote accepted", job.acceptedAt], ["Started", job.startedAt],
        ["Provider completed", job.completedAt], ["Customer confirmed", job.confirmedAt], ["Cancelled", job.cancelledAt],
    ].filter(([,value]) => value) as [string,string][] : []

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 max-w-5xl space-y-6">
            <div><Link href="/dashboard/admin/services?tab=jobs" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Trade Exchange services</Link><h1 className="text-3xl font-bold font-heading">Service job</h1><p className="text-sm text-[var(--text-muted)] mt-1">Read-only operational view. Customer/provider actions are intentionally not available here.</p></div>
            {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex gap-3"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
            {!job && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}
            {job && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><div className="flex items-center gap-3 flex-wrap"><h2 className="text-2xl font-black font-heading">{job.title}</h2><JobStatusBadge status={job.status}/><span className="text-[10px] uppercase tracking-widest font-black text-primary">{SERVICE_LABELS[job.serviceType]}</span></div><div className="mt-4"><JobRoute job={job}/><JobTiming job={job}/></div>{job.description && <p className="text-sm text-[var(--text-secondary)] mt-4 whitespace-pre-line">{job.description}</p>}</div><div className="text-xs text-[var(--text-muted)] md:text-right"><p>Job ID</p><p className="font-mono break-all">{job.id}</p></div></div></section>

                <div className="grid lg:grid-cols-2 gap-6">
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Customer & provider</h2><div className="space-y-5 text-sm"><div><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-1">Customer</p><p className="font-bold">{[job.customer?.firstName,job.customer?.lastName].filter(Boolean).join(" ") || "Customer"}</p><p className="text-[var(--text-muted)]">{job.customer?.email || "—"}</p><p className="text-[var(--text-muted)]">{job.customer?.phone || "—"}</p></div><div><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-1">Accepted provider</p>{job.contractor ? <><p className="font-bold">{job.contractor.businessName || job.contractor.user.firstName || "Provider"}</p><p className="text-[var(--text-muted)]">{job.contractor.user.email || "—"}</p><p className="text-[var(--text-muted)]">{job.contractor.phone || job.contractor.user.phone || "—"}</p></> : <p className="text-[var(--text-muted)]">Not assigned yet.</p>}</div></div></section>
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Payment</h2>{job.payment ? <div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-[var(--text-muted)] text-xs">Customer paid</p><p className="font-bold text-lg">{formatPence(job.payment.grossPence)}</p></div><div><p className="text-[var(--text-muted)] text-xs">Provider share</p><p className="font-bold text-lg">{formatPence(job.payment.contractorPence)}</p></div><div><p className="text-[var(--text-muted)] text-xs">CarMazium fee</p><p className="font-bold">{formatPence(job.payment.platformFeePence)}</p></div><div><p className="text-[var(--text-muted)] text-xs">Payment status</p><p className="font-bold">{job.payment.status}</p></div></div> : <p className="text-sm text-[var(--text-muted)]">No service payment has been created.</p>}</section>
                </div>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Vehicles</h2><JobVehicles vehicles={job.vehicles}/></section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Quotes ({job.quotes?.length ?? 0})</h2>{!job.quotes?.length ? <p className="text-sm text-[var(--text-muted)]">No quotes submitted.</p> : <div className="space-y-2">{job.quotes.map(q => <div key={q.id} className={`rounded-xl border p-4 ${q.id === job.acceptedQuoteId ? "border-emerald-500/35 bg-emerald-500/5" : "border-[var(--border-default)] bg-[var(--bg-input)]"}`}><div className="flex justify-between gap-4"><div><p className="font-bold">{q.contractor?.businessName || q.contractor?.user.firstName || "Provider"}</p><p className="text-xs text-[var(--text-muted)]">{q.status}{q.message ? ` · ${q.message}` : ""}</p></div><p className="font-black text-lg">{formatPence(q.amountPence)}</p></div></div>)}</div>}</section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Status timeline</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{timeline.map(([label,value]) => <div key={label} className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-3"><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">{label}</p><p className="text-sm font-bold mt-1">{new Date(value).toLocaleString("en-GB")}</p></div>)}</div></section>

                {(job.status === "DISPUTED" || job.caseEntries.length > 0) && <section className="rounded-2xl border border-red-500/30 bg-[var(--bg-card)] p-6 space-y-5"><div className="flex gap-3 items-start"><Scale size={22} className="text-red-500 shrink-0"/><div><h2 className="font-heading font-bold text-lg">Dispute case</h2><p className="text-xs text-[var(--text-muted)] mt-1">{job.cancelReason || "Admin case history and evidence."}</p></div></div>
                    {job.settlementOperations.length > 0 && <div className="space-y-2"><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Settlement operations</p>{job.settlementOperations.map(op => <div key={op.id} className={"rounded-xl border p-4 " + (op.status === "REQUIRES_RECONCILIATION" ? "border-amber-500/40 bg-amber-500/5" : op.status === "FAILED" ? "border-red-500/35 bg-red-500/5" : "border-[var(--border-default)] bg-[var(--bg-input)]")}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-sm">{op.outcome === "RELEASE" ? "Release to provider" : "Refund customer"}</p><p className="text-[11px] text-[var(--text-muted)] mt-1">{op.adminEmail || [op.adminFirstName,op.adminLastName].filter(Boolean).join(" ") || "Admin"} · {new Date(op.createdAt).toLocaleString("en-GB")} · attempt {op.attemptCount}</p></div><span className="text-[10px] uppercase tracking-widest font-black border border-current rounded-full px-2.5 py-1">{op.status.replaceAll("_"," ")}</span></div>{op.note && <p className="text-sm mt-3 whitespace-pre-line">{op.note}</p>}{op.externalReference && <p className="text-[11px] font-mono break-all text-[var(--text-muted)] mt-2">External ref: {op.externalReference}</p>}{op.error && <p className="text-xs text-red-500 mt-2 whitespace-pre-line">{op.error}</p>}</div>)}</div>}
                    {job.paymentAuditEvents.length > 0 && <div className="space-y-2"><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Payment audit</p>{job.paymentAuditEvents.map(event => <div key={event.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3"><p className="text-sm font-bold">{event.fromStatus || "INITIAL"} → {event.toStatus}</p><p className="text-[11px] text-[var(--text-muted)] mt-1">{new Date(event.createdAt).toLocaleString("en-GB")}</p></div>)}</div>}
                    {job.caseEntries.length > 0 && <div className="space-y-2">{job.caseEntries.map(e => <div key={e.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4"><div className="flex justify-between gap-3"><div><p className="text-[10px] uppercase tracking-widest font-black text-primary">{e.kind}</p>{e.label && <p className="font-bold text-sm mt-1">{e.label}</p>}{e.note && <p className="text-sm mt-2 whitespace-pre-line">{e.note}</p>}<p className="text-[11px] text-[var(--text-muted)] mt-2">{e.submittedByEmail || e.submittedByRole || "System"} · {new Date(e.createdAt).toLocaleString("en-GB")}</p></div>{e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 shrink-0">Open <ExternalLink size={12}/></a>}</div></div>)}</div>}
                    {job.status === "DISPUTED" && <><div className="grid md:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-bold">Admin case note</label><textarea className={`${inputCls} min-h-28`} value={note} onChange={e => setNote(e.target.value)} placeholder="Record calls, evidence reviewed or investigation notes..." maxLength={4000}/><Button variant="outline" disabled={busy === "note" || !note.trim()} onClick={addNote}>{busy === "note" && <Loader2 size={14} className="animate-spin mr-2"/>}Add case note</Button></div><div className="space-y-2"><label className="text-xs font-bold">Evidence image / PDF</label><input id="dispute-evidence" className={inputCls} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)}/><p className="text-[11px] text-[var(--text-muted)]">Use for vehicle/damage evidence only. Do not upload bank details, identity documents or other highly sensitive personal information.</p><Button variant="outline" disabled={busy === "upload" || !file} onClick={uploadEvidence}>{busy === "upload" ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} className="mr-2"/>}Upload evidence</Button></div></div><div className="border-t border-[var(--border-default)] pt-5"><p className="font-bold text-sm mb-3">Resolve case</p><div className="flex flex-wrap gap-3"><Button disabled={!!busy} onClick={() => resolve("RELEASE")}>Release payment to provider</Button><Button variant="outline" disabled={!!busy} onClick={() => resolve("REFUND")}>Refund customer in full</Button></div></div></>}
                </section>}
            </>}
        </main>
    </div></div>
}
