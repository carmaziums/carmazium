"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle, Clock, Eye, Loader2, Mail, Phone, RefreshCw } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { adminRematchServiceLead, formatPence, SERVICE_LABELS } from "@/lib/servicesApi"
import { adminGetServiceLeadDetail, type AdminServiceLeadDetail } from "@/lib/serviceOperationsApi"

function money(value: number | null | undefined) {
    return value == null ? "—" : formatPence(value)
}

export default function AdminServiceLeadPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [lead, setLead] = React.useState<AdminServiceLeadDetail | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [rematching, setRematching] = React.useState(false)
    const [notice, setNotice] = React.useState<string | null>(null)

    const load = React.useCallback(() => {
        if (!user || !id) return
        setError(null)
        adminGetServiceLeadDetail(id).then(setLead).catch((e: any) => setError(e?.message || "Could not load enquiry"))
    }, [user, id])

    React.useEffect(() => { load() }, [load])

    const rematch = async () => {
        setRematching(true)
        setError(null)
        setNotice(null)
        try {
            const result = await adminRematchServiceLead(id)
            setNotice(result.added
                ? `Matched ${result.added} additional provider${result.added === 1 ? "" : "s"}. Total ${result.recipientCount}/${result.recipientLimit}.`
                : `No additional eligible provider was available. Total ${result.recipientCount}/${result.recipientLimit}.`)
            load()
        } catch (e: any) {
            setError(e?.message || "Could not rematch this enquiry")
        } finally {
            setRematching(false)
        }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Admin"

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
        <main className="flex-1 max-w-5xl space-y-6">
            <div><Link href="/dashboard/admin/services?tab=leads" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Finance / Warranty enquiries</Link><h1 className="text-3xl font-bold font-heading">Enquiry detail</h1><p className="text-sm text-[var(--text-muted)] mt-1">Oversight of the customer enquiry, matched providers and their responses.</p></div>
            {notice && <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm">{notice}</div>}
            {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex gap-3"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
            {!lead && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}
            {lead && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><div className="flex items-center gap-2 flex-wrap"><h2 className="text-xl font-heading font-bold">{[lead.vehicleRegistration, lead.vehicleMake, lead.vehicleModel].filter(Boolean).join(" · ") || "Vehicle enquiry"}</h2><span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/25 bg-primary/10 rounded-full px-2.5 py-1">{SERVICE_LABELS[lead.serviceType]}</span><span className="text-[10px] font-black uppercase tracking-widest border border-[var(--border-default)] rounded-full px-2.5 py-1">{lead.status}</span></div><p className="text-xs text-[var(--text-muted)] mt-3">Created {new Date(lead.createdAt).toLocaleString("en-GB")} · Expires {new Date(lead.expiresAt).toLocaleString("en-GB")}</p></div><div className="text-right text-xs text-[var(--text-muted)]"><p>Matched providers <strong className="text-[var(--text-primary)]">{lead.recipientCount ?? lead.recipients.length}</strong></p><p>Responses <strong className="text-[var(--text-primary)]">{lead.responseCount ?? 0}</strong></p></div></div>
                </section>

                <div className="grid lg:grid-cols-2 gap-6">
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Customer</h2><div className="space-y-2 text-sm"><p className="font-bold text-lg">{lead.fullName || "Anonymised customer"}</p>{lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail size={14}/>{lead.email}</a>}{lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone size={14}/>{lead.phone}</a>}<p className="text-[var(--text-muted)]">Postcode: {lead.postcode || "—"}</p><p className={`text-xs font-bold ${lead.consentToProviderContact ? "text-emerald-500" : "text-red-500"}`}>{lead.consentToProviderContact ? "Provider-contact consent recorded" : "No provider-contact consent flag"}{lead.consentRecordedAt ? ` · ${new Date(lead.consentRecordedAt).toLocaleString("en-GB")}` : ""}</p></div></section>
                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">Vehicle & request</h2><div className="grid grid-cols-2 gap-4 text-sm"><Info label="Registration" value={lead.vehicleRegistration}/><Info label="Vehicle" value={[lead.vehicleYear,lead.vehicleMake,lead.vehicleModel].filter(Boolean).join(" ")}/><Info label="Mileage" value={lead.vehicleMileage != null ? `${lead.vehicleMileage.toLocaleString("en-GB")} miles` : null}/><Info label="Vehicle value" value={money(lead.vehicleValuePence)}/></div>{lead.summary && <div className="mt-5"><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Customer summary</p><p className="text-sm mt-2 whitespace-pre-line">{lead.summary}</p></div>}</section>
                </div>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6"><h2 className="font-heading font-bold text-lg mb-4">{lead.serviceType === "FINANCE" ? "Finance requirements" : "Warranty requirements"}</h2>{lead.serviceType === "FINANCE" ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"><Info label="Deposit" value={money(lead.depositPence)}/><Info label="Requested term" value={lead.termMonths ? `${lead.termMonths} months` : null}/><Info label="Monthly budget" value={money(lead.monthlyBudgetPence)}/><Info label="Employment" value={lead.employmentStatus}/><Info label="Annual income" value={money(lead.annualIncomePence)}/></div> : <div className="grid sm:grid-cols-2 gap-4"><Info label="Cover period" value={lead.warrantyMonths ? `${lead.warrantyMonths} months` : null}/><Info label="Cover level" value={lead.warrantyLevel}/></div>}</section>

                <section className="space-y-3"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h2 className="font-heading font-bold text-lg">Matched providers ({lead.recipients.length})</h2><p className="text-xs text-[var(--text-muted)]">Automatic sharing is capped at five. Historical enquiries are only expanded through this explicit admin action.</p></div>{lead.status === "OPEN" && lead.recipients.length < 5 && <Button size="sm" variant="outline" onClick={rematch} disabled={rematching}>{rematching ? <Loader2 size={14} className="animate-spin"/> : <><RefreshCw size={14} className="mr-2"/>Rematch eligible providers</>}</Button>}</div>{lead.recipients.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-10 text-center text-sm text-[var(--text-muted)]">No approved providers were matched to this enquiry.</div> : lead.recipients.map(r => <div key={r.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-heading font-bold">{r.businessName || [r.providerFirstName,r.providerLastName].filter(Boolean).join(" ") || "Provider"}</h3><RecipientStatus status={r.status}/></div><p className="text-xs text-[var(--text-muted)] mt-1">{r.providerEmail || "—"}{r.providerPhone ? ` · ${r.providerPhone}` : ""}{r.serviceArea ? ` · ${r.serviceArea}` : ""}</p><div className="flex flex-wrap gap-4 text-[11px] text-[var(--text-muted)] mt-2">{r.matchedAt && <span>Matched {new Date(r.matchedAt).toLocaleString("en-GB")} · {r.matchSource || "AUTO"}</span>}{r.viewedAt && <span className="inline-flex items-center gap-1"><Eye size={12}/>Viewed {new Date(r.viewedAt).toLocaleString("en-GB")}</span>}{r.contactDisclosedAt && <span>Contact disclosed {new Date(r.contactDisclosedAt).toLocaleString("en-GB")}</span>}{r.respondedAt && <span className="inline-flex items-center gap-1"><CheckCircle size={12}/>Responded {new Date(r.respondedAt).toLocaleString("en-GB")}</span>}</div>{r.matchReason && <p className="text-[11px] text-[var(--text-muted)] mt-2">Match: {r.matchReason}</p>}</div>{r.indicativePricePence != null && <p className="font-black text-lg shrink-0">{formatPence(r.indicativePricePence)}</p>}</div>{r.status === "RESPONDED" && <div className="mt-4 pt-4 border-t border-[var(--border-default)] grid md:grid-cols-[1fr_auto] gap-4"><div><p className="font-bold text-sm">{r.headline || r.productName || "Provider response"}</p>{r.productName && <p className="text-xs text-primary font-bold mt-1">{r.productName}</p>}{r.message && <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-line">{r.message}</p>}</div><div className="text-xs text-[var(--text-muted)] md:text-right space-y-1">{r.representativeApr != null && <p>Representative APR <strong className="text-[var(--text-primary)]">{r.representativeApr}%</strong></p>}{r.termMonths != null && <p>Term <strong className="text-[var(--text-primary)]">{r.termMonths} months</strong></p>}</div></div>}</div>)}</section>
            </>}
        </main>
    </div></div>
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
    return <div><p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">{label}</p><p className="font-bold text-sm mt-1">{value || "—"}</p></div>
}

function RecipientStatus({ status }: { status: string }) {
    const cls = status === "RESPONDED" ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : status === "VIEWED" ? "text-blue-500 border-blue-500/30 bg-blue-500/5" : "text-amber-500 border-amber-500/30 bg-amber-500/5"
    const Icon = status === "RESPONDED" ? CheckCircle : status === "VIEWED" ? Eye : Clock
    return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${cls}`}><Icon size={11}/>{status}</span>
}
