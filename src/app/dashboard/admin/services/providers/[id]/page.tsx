"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Ban, CheckCircle, CreditCard, ExternalLink, FileText, Loader2, XCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { adminReviewCapability, SERVICE_LABELS, type CapabilityStatus } from "@/lib/servicesApi"
import { adminGetCapabilityDetail, type AdminCapabilityDetail } from "@/lib/serviceOperationsApi"

export default function AdminProviderReviewPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [data, setData] = React.useState<AdminCapabilityDetail | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

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
        setBusy(true); setError(null)
        try { await adminReviewCapability(id, { status, reviewNote }); await load() }
        catch (e: any) { setError(e?.message || "Could not update application") }
        finally { setBusy(false) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Admin"
    const u = data?.contractor?.user
    const paidService = data?.serviceType === "DELIVERY" || data?.serviceType === "INSPECTION"
    const stripeReady = !!u?.stripeConnectAccountId && !!u?.stripeConnectOnboardingComplete

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 max-w-4xl space-y-6">
            <div><Link href="/dashboard/admin/services?tab=queue" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Trade Exchange services</Link><h1 className="text-3xl font-bold font-heading">Provider application review</h1><p className="text-sm text-[var(--text-muted)] mt-1">Business details, payout readiness and submitted verification evidence.</p></div>
            {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex gap-3"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
            {!data && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}
            {data && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5"><div><div className="flex items-center gap-2 flex-wrap"><h2 className="text-xl font-heading font-bold">{data.contractor?.businessName || `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() || "Unnamed provider"}</h2><span className="text-[10px] uppercase tracking-widest font-black text-primary border border-primary/25 bg-primary/10 rounded-full px-2.5 py-1">{SERVICE_LABELS[data.serviceType]}</span><span className="text-[10px] uppercase tracking-widest font-black border border-[var(--border-default)] rounded-full px-2.5 py-1">{data.status}</span></div><div className="text-sm text-[var(--text-muted)] mt-3 space-y-1"><p>{u?.email}</p>{data.contractor?.phone && <p>{data.contractor.phone}</p>}{data.contractor?.serviceArea && <p>Service area: {data.contractor.serviceArea}</p>}<p>Applied {new Date(data.appliedAt).toLocaleString("en-GB")}</p>{data.reviewedAt && <p>Last reviewed {new Date(data.reviewedAt).toLocaleString("en-GB")}</p>}</div></div><div className="shrink-0">{paidService ? <div className={`rounded-xl border px-4 py-3 text-xs font-bold flex items-center gap-2 ${stripeReady ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" : "border-amber-500/30 text-amber-500 bg-amber-500/5"}`}><CreditCard size={15}/>{stripeReady ? "Stripe Connect complete" : "Stripe Connect incomplete"}</div> : <div className="rounded-xl border border-emerald-500/30 text-emerald-500 bg-emerald-500/5 px-4 py-3 text-xs font-bold">Lead service · no Stripe payout required</div>}</div></div>
                    {data.reviewNote && <div className="mt-5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4 text-sm"><span className="font-bold">Review note:</span> {data.reviewNote}</div>}
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex items-center justify-between gap-4 mb-4"><div><h2 className="font-heading font-bold text-lg">Verification documents</h2><p className="text-xs text-[var(--text-muted)] mt-1">Evidence uploaded specifically for this service application.</p></div><span className="text-xs font-bold text-[var(--text-muted)]">{data.attachments.length} file{data.attachments.length === 1 ? "" : "s"}</span></div>
                    {data.attachments.length === 0 ? <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-500">No supporting documents have been uploaded for this application yet. Ask the provider to add evidence from their Service Areas dashboard before approval where appropriate.</div> : <div className="space-y-2">{data.attachments.map(a => <div key={a.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 flex items-center justify-between gap-4"><div className="flex items-center gap-3 min-w-0"><FileText size={18} className="text-primary shrink-0"/><div className="min-w-0"><p className="font-bold text-sm truncate">{a.label || "Verification document"}</p><p className="text-xs text-[var(--text-muted)]">{a.kind} · {new Date(a.createdAt).toLocaleString("en-GB")}</p></div></div>{a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline shrink-0">Open <ExternalLink size={12}/></a>}</div>)}</div>}
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Admin decision</h2><div className="flex flex-wrap gap-3">{data.status !== "APPROVED" && <Button disabled={busy || (paidService && !stripeReady)} title={paidService && !stripeReady ? "Provider must complete Stripe Connect first" : undefined} onClick={() => review("APPROVED")}>{busy ? <Loader2 size={15} className="animate-spin mr-2"/> : <CheckCircle size={15} className="mr-2"/>}Approve</Button>}{data.status === "PENDING" && <Button variant="outline" disabled={busy} onClick={() => review("REJECTED")}><XCircle size={15} className="mr-2"/>Reject</Button>}{data.status === "APPROVED" && <Button variant="outline" disabled={busy} onClick={() => review("SUSPENDED")}><Ban size={15} className="mr-2"/>Suspend</Button>}</div></section>
            </>}
        </main>
    </div></div>
}
