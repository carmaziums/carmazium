"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Ban, CheckCircle, CreditCard, ExternalLink, FileText, Loader2, XCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { adminReviewCapability, SERVICE_LABELS, type CapabilityStatus } from "@/lib/servicesApi"
import { adminGetCapabilityDetail, adminReviewCapabilityEvidence, type AdminCapabilityDetail, type ServiceCaseEntry } from "@/lib/serviceOperationsApi"

export default function AdminProviderReviewPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [data, setData] = React.useState<AdminCapabilityDetail | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!id) return
        setError(null)
        try { setData(await adminGetCapabilityDetail(id)) }
        catch (e: any) { setError(e?.message || "Could not load provider application") }
    }, [id])
    React.useEffect(() => { if (user) load() }, [user, load])

    const review = async (status: CapabilityStatus) => {
        const reviewNote = status === "APPROVED" ? undefined : (prompt("Note to the provider:") ?? undefined)
        if (status !== "APPROVED" && reviewNote === undefined) return
        setBusy(true); setError(null); setNotice(null)
        try { await adminReviewCapability(id, { status, reviewNote }); setNotice("Provider application updated."); await load() }
        catch (e: any) { setError(e?.message || "Could not update application") }
        finally { setBusy(false) }
    }

    const reviewEvidence = async (entry: ServiceCaseEntry, status: "APPROVED" | "REJECTED") => {
        const reviewNote = status === "REJECTED" ? (prompt("Reason this evidence is not acceptable:") ?? undefined) : undefined
        if (status === "REJECTED" && reviewNote === undefined) return
        setBusy(true); setError(null); setNotice(null)
        try {
            await adminReviewCapabilityEvidence(id, entry.id, {
                status,
                reviewNote,
                expiresAt: entry.evidenceExpiresAt || undefined,
            })
            setNotice(status === "APPROVED" ? "Evidence approved." : "Evidence rejected.")
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not review this evidence")
        } finally { setBusy(false) }
    }

        const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Admin"
    const u = data?.contractor?.user
    const paidService = data?.serviceType === "DELIVERY" || data?.serviceType === "INSPECTION"
    const stripeReady = !!u?.stripeConnectAccountId && !!u?.stripeConnectOnboardingComplete
    const leadService = data?.serviceType === "FINANCE" || data?.serviceType === "WARRANTY"
    const matchingReady = !leadService || !!data?.leadNationwide || (data?.leadPostcodeAreas?.length ?? 0) > 0
    const verificationReady = !!data?.verification?.ready
    const canApprove = verificationReady && matchingReady && (!paidService || stripeReady)

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 max-w-4xl space-y-6">
            <div><Link href="/dashboard/admin/services?tab=queue" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Trade Exchange services</Link><h1 className="text-3xl font-bold font-heading">Provider application review</h1><p className="text-sm text-[var(--text-muted)] mt-1">Business details, payout readiness and submitted verification evidence.</p></div>
            {notice && <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm">{notice}</div>}
            {error && <div role="alert" className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex gap-3"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
            {!data && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}
            {data && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5"><div><div className="flex items-center gap-2 flex-wrap"><h2 className="text-xl font-heading font-bold">{data.contractor?.businessName || `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() || "Unnamed provider"}</h2><span className="text-[10px] uppercase tracking-widest font-black text-primary border border-primary/25 bg-primary/10 rounded-full px-2.5 py-1">{SERVICE_LABELS[data.serviceType]}</span><span className="text-[10px] uppercase tracking-widest font-black border border-[var(--border-default)] rounded-full px-2.5 py-1">{data.status}</span></div><div className="text-sm text-[var(--text-muted)] mt-3 space-y-1"><p>{u?.email}</p>{data.contractor?.phone && <p>{data.contractor.phone}</p>}{data.contractor?.serviceArea && <p>Service area: {data.contractor.serviceArea}</p>}<p>Applied {new Date(data.appliedAt).toLocaleString("en-GB")}</p>{data.reviewedAt && <p>Last reviewed {new Date(data.reviewedAt).toLocaleString("en-GB")}</p>}</div></div><div className="shrink-0">{paidService ? <div className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${stripeReady ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : "border-amber-500/30 text-amber-500 bg-amber-500/5"}`}><CreditCard size={15}/>{stripeReady ? "Stripe Connect complete" : "Stripe Connect incomplete"}</div> : <div className="rounded-xl border border-emerald-500/30 text-emerald-500 bg-emerald-500/5 px-4 py-3 text-xs font-bold">Lead service · no Stripe payout required</div>}</div></div>
                    {data.reviewNote && <div className="mt-5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4 text-sm"><span className="font-bold">Review note:</span> {data.reviewNote}</div>}
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div><h2 className="font-heading font-bold text-lg">Verification checklist</h2><p className="text-xs text-[var(--text-muted)] mt-1">Every requirement must show SATISFIED before the provider can be approved.</p></div>
                        <div className="text-right text-xs"><span className={"inline-flex rounded-full border px-3 py-1 font-black uppercase tracking-wider " + (data.verification.ready ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-amber-500 border-amber-500/30 bg-amber-500/5")}>{data.verification.verificationStatus.replaceAll("_", " ")}</span>{data.verification.verificationExpiresAt && <p className="text-[var(--text-muted)] mt-2">Expires {new Date(data.verification.verificationExpiresAt).toLocaleDateString("en-GB")}</p>}</div>
                    </div>
                    <div className="space-y-3">{data.verification.requirements.map(req => <div key={req.type} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 flex items-start justify-between gap-4"><div><p className="font-bold text-sm">{req.title}</p><p className="text-xs text-[var(--text-muted)] mt-1">{req.description}</p>{req.expiryRequired && <p className="text-[11px] text-amber-500 mt-2">Current expiry date required.</p>}</div><span className={"shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider " + (req.state === "SATISFIED" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : req.state === "REJECTED" ? "text-red-500 border-red-500/30 bg-red-500/5" : "text-amber-500 border-amber-500/30 bg-amber-500/5")}>{req.state}</span></div>)}</div>
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex items-center justify-between gap-4 mb-4"><div><h2 className="font-heading font-bold text-lg">Verification evidence</h2><p className="text-xs text-[var(--text-muted)] mt-1">Review each pending file against its declared requirement. Reviewed evidence is retained for audit.</p></div><span className="text-xs font-bold text-[var(--text-muted)]">{data.attachments.length} file{data.attachments.length === 1 ? "" : "s"}</span></div>
                    {data.attachments.length === 0 ? <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-500">No verification evidence has been uploaded. Approval is blocked.</div> : <div className="space-y-3">{data.attachments.map(a => <div key={a.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div className="flex items-start gap-3 min-w-0"><FileText size={18} className="text-primary shrink-0 mt-0.5"/><div className="min-w-0"><p className="font-bold text-sm">{a.label || "Verification evidence"}</p><p className="text-xs text-[var(--text-muted)] mt-1">{a.evidenceType || "Unclassified"}{a.evidenceIssuer ? " · " + a.evidenceIssuer : ""}{a.evidenceReference ? " · " + a.evidenceReference : ""}</p><p className="text-xs text-[var(--text-muted)] mt-1">Uploaded {new Date(a.createdAt).toLocaleString("en-GB")}{a.evidenceExpiresAt ? " · Expires " + new Date(a.evidenceExpiresAt).toLocaleDateString("en-GB") : ""}</p>{a.evidenceReviewNote && <p className="text-xs mt-2">Review note: {a.evidenceReviewNote}</p>}</div></div><div className="flex items-center gap-2 shrink-0"><span className={"rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider " + (a.evidenceStatus === "APPROVED" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : a.evidenceStatus === "REJECTED" ? "text-red-500 border-red-500/30 bg-red-500/5" : "text-amber-500 border-amber-500/30 bg-amber-500/5")}>{a.evidenceStatus || "PENDING"}</span>{a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">Open <ExternalLink size={12}/></a>}</div></div>{a.evidenceStatus === "PENDING" && <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-default)]"><Button size="sm" disabled={busy} onClick={() => reviewEvidence(a, "APPROVED")}><CheckCircle size={14} className="mr-1.5"/>Approve evidence</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => reviewEvidence(a, "REJECTED")}><XCircle size={14} className="mr-1.5"/>Reject evidence</Button></div>}</div>)}</div>}
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Admin decision</h2><div className="flex flex-wrap gap-3">{data.status !== "APPROVED" && <Button disabled={busy || !canApprove} title={!verificationReady ? "Every verification requirement must be satisfied first" : paidService && !stripeReady ? "Provider must complete Stripe Connect first" : !matchingReady ? "Finance/Warranty lead matching coverage must be configured first" : undefined} onClick={() => review("APPROVED")}>{busy ? <Loader2 size={15} className="animate-spin mr-2"/> : <CheckCircle size={15} className="mr-2"/>}Approve</Button>}{!canApprove && data.status !== "APPROVED" && <p className="text-xs text-amber-500 w-full">Approval is locked until verification is complete{paidService && !stripeReady ? ", Stripe Connect is ready" : ""}{leadService && !matchingReady ? ", and lead matching coverage is configured" : ""}.</p>}{data.status === "PENDING" && <Button variant="outline" disabled={busy} onClick={() => review("REJECTED")}><XCircle size={15} className="mr-2"/>Reject</Button>}{data.status === "APPROVED" && <Button variant="outline" disabled={busy} onClick={() => review("SUSPENDED")}><Ban size={15} className="mr-2"/>Suspend</Button>}</div></section>
            </>}
        </main>
    </div></div>
}
