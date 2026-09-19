"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle, FileText, Loader2, ShieldCheck, Trash2, Upload, XCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { getMyCapabilities, SERVICE_LABELS, type ContractorCapability } from "@/lib/servicesApi"
import {
    deleteCapabilityAttachment,
    getCapabilityVerification,
    uploadCapabilityAttachment,
    type CapabilityEvidenceType,
    type CapabilityVerificationDetail,
    type ServiceCaseEntry,
} from "@/lib/serviceOperationsApi"

const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
const labelCls = "block text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2"

function stateClass(state: string) {
    if (state === "SATISFIED" || state === "APPROVED" || state === "VERIFIED" || state === "READY") return "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
    if (state === "REJECTED") return "text-red-500 border-red-500/30 bg-red-500/5"
    return "text-amber-500 border-amber-500/30 bg-amber-500/5"
}

export default function ProviderVerificationPage() {
    const { id } = useParams<{ id: string }>()
    const { user, profile } = useAuth()
    const [capability, setCapability] = React.useState<ContractorCapability | null>(null)
    const [detail, setDetail] = React.useState<CapabilityVerificationDetail | null>(null)
    const [evidenceType, setEvidenceType] = React.useState<CapabilityEvidenceType | "">("")
    const [issuer, setIssuer] = React.useState("")
    const [reference, setReference] = React.useState("")
    const [validFrom, setValidFrom] = React.useState("")
    const [expiresAt, setExpiresAt] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!id) return
        setError(null)
        try {
            const [mine, verification] = await Promise.all([getMyCapabilities(), getCapabilityVerification(id)])
            const cap = mine.capabilities.find(c => c.id === id)
            if (!cap) throw new Error("This service application was not found on your account.")
            setCapability(cap)
            setDetail(verification)
            setEvidenceType(current => {
                if (current && verification.verification.requirements.some(r => r.type === current)) return current
                const next = verification.verification.requirements.find(r => r.state !== "SATISFIED")
                    ?? verification.verification.requirements[0]
                return next?.type ?? ""
            })
        } catch (e: any) {
            setError(e?.message || "Could not load provider verification")
        }
    }, [id])

    React.useEffect(() => { if (user) load() }, [user, load])

    const selectedRequirement = detail?.verification.requirements.find(r => r.type === evidenceType)

    const upload = async () => {
        if (!file) { setError("Choose an image or PDF first."); return }
        if (!evidenceType) { setError("Choose the evidence requirement this document supports."); return }
        if (file.size > 10 * 1024 * 1024) { setError("Please keep each document under 10 MB."); return }
        if (selectedRequirement?.expiryRequired && !expiresAt) { setError(selectedRequirement.title + " requires an expiry date."); return }
        setBusy(true); setError(null); setNotice(null)
        try {
            await uploadCapabilityAttachment(id, file, {
                evidenceType,
                label: selectedRequirement?.title || file.name,
                issuer: issuer.trim() || undefined,
                reference: reference.trim() || undefined,
                validFrom: validFrom || undefined,
                expiresAt: expiresAt || undefined,
            })
            setFile(null); setIssuer(""); setReference(""); setValidFrom(""); setExpiresAt("")
            const input = document.getElementById("verification-file") as HTMLInputElement | null
            if (input) input.value = ""
            setNotice("Evidence uploaded for admin review.")
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not upload this document")
        } finally { setBusy(false) }
    }

    const remove = async (entry: ServiceCaseEntry) => {
        if (entry.evidenceStatus !== "PENDING") return
        setBusy(true); setError(null); setNotice(null)
        try {
            await deleteCapabilityAttachment(id, entry.id)
            setNotice("Pending evidence removed.")
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not remove this evidence")
        } finally { setBusy(false) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
        <main className="flex-1 max-w-3xl space-y-6">
            <div>
                <Link href="/dashboard/service/capabilities" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Service areas</Link>
                <h1 className="text-3xl font-bold font-heading">Provider verification</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">{capability ? SERVICE_LABELS[capability.serviceType] : "Service application"} · complete every required evidence item before CarMazium approval.</p>
            </div>

            {error && <div role="alert" className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5"/>{error}</div>}
            {notice && <div role="status" className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm">{notice}</div>}
            {!detail && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary"/></div>}

            {detail && <>
                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="font-heading font-bold text-lg">Verification status</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Approval lasts for up to 12 months, or until required evidence expires sooner.</p>
                        </div>
                        <span className={"inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider " + stateClass(detail.verification.verificationStatus)}>
                            {detail.verification.verificationStatus.replaceAll("_", " ")}
                        </span>
                    </div>
                    {detail.verification.verificationExpiresAt && <p className="text-sm mt-4">Current verification expires <strong>{new Date(detail.verification.verificationExpiresAt).toLocaleDateString("en-GB")}</strong>.</p>}
                </section>

                <section className="space-y-3">
                    <div><h2 className="font-heading font-bold text-lg">Required evidence</h2><p className="text-xs text-[var(--text-muted)] mt-1">Every item must have current admin-approved evidence.</p></div>
                    {detail.verification.requirements.map(req => <div key={req.type} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-3">
                                {req.state === "SATISFIED" ? <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5"/> : req.state === "REJECTED" ? <XCircle size={20} className="text-red-500 shrink-0 mt-0.5"/> : <ShieldCheck size={20} className="text-amber-500 shrink-0 mt-0.5"/>}
                                <div><h3 className="font-bold">{req.title}</h3><p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{req.description}</p>{req.expiryRequired && <p className="text-[11px] text-amber-500 mt-2">A current expiry date is required.</p>}{req.evidenceExpiresAt && <p className="text-[11px] text-[var(--text-muted)] mt-2">Approved evidence expires {new Date(req.evidenceExpiresAt).toLocaleDateString("en-GB")}.</p>}</div>
                            </div>
                            <span className={"shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider " + stateClass(req.state)}>{req.state}</span>
                        </div>
                    </div>)}
                </section>

                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <div className="flex gap-3"><ShieldCheck size={20} className="text-amber-500 shrink-0 mt-0.5"/><div><h2 className="font-bold">Business evidence only</h2><p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Upload business, insurance, qualification or regulatory evidence for this service. Do not upload passports, driving licences, personal bank statements or unrelated identity documents.</p></div></div>
                </section>

                <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-5">
                    <div><h2 className="font-heading font-bold text-lg">Upload evidence</h2><p className="text-xs text-[var(--text-muted)] mt-1">PDF, JPG, PNG or WEBP, maximum 10 MB each. Reviewed evidence is retained for audit.</p></div>
                    <div><label className={labelCls}>Requirement</label><select className={inputCls} value={evidenceType} onChange={e => setEvidenceType(e.target.value as CapabilityEvidenceType)}>{detail.verification.requirements.map(req => <option key={req.type} value={req.type}>{req.title}</option>)}</select></div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className={labelCls}>Issuer / organisation</label><input className={inputCls} value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Insurer, FCA principal, awarding body..."/></div>
                        <div><label className={labelCls}>Policy / FRN / certificate reference</label><input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} placeholder="Reference number"/></div>
                        <div><label className={labelCls}>Valid from</label><input className={inputCls} type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)}/></div>
                        <div><label className={labelCls}>Expiry {selectedRequirement?.expiryRequired ? "(required)" : "(if applicable)"}</label><input className={inputCls} type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}/></div>
                    </div>
                    <div><label className={labelCls}>Evidence file</label><input id="verification-file" className={inputCls} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)}/></div>
                    <Button onClick={upload} disabled={busy || !file || !evidenceType}>{busy ? <Loader2 size={16} className="animate-spin mr-2"/> : <Upload size={16} className="mr-2"/>}Upload for review</Button>
                </section>

                <section className="space-y-3">
                    <h2 className="font-heading font-bold text-lg">Evidence history ({detail.attachments.length})</h2>
                    {detail.attachments.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-muted)]">No verification evidence uploaded yet.</div>}
                    {detail.attachments.map(entry => <div key={entry.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><FileText size={18} className="text-primary"/></div><div className="min-w-0"><p className="font-bold text-sm">{entry.label || "Verification evidence"}</p><p className="text-xs text-[var(--text-muted)] mt-1">{entry.evidenceIssuer || "Issuer not supplied"}{entry.evidenceReference ? " · " + entry.evidenceReference : ""}</p><p className="text-xs text-[var(--text-muted)] mt-1">Uploaded {new Date(entry.createdAt).toLocaleDateString("en-GB")}{entry.evidenceExpiresAt ? " · Expires " + new Date(entry.evidenceExpiresAt).toLocaleDateString("en-GB") : ""}</p>{entry.evidenceReviewNote && <p className="text-xs mt-2">{entry.evidenceReviewNote}</p>}</div></div>
                            <div className="flex items-center gap-2 shrink-0"><span className={"rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider " + stateClass(entry.evidenceStatus || "PENDING")}>{entry.evidenceStatus || "PENDING"}</span>{entry.evidenceStatus === "PENDING" && <button type="button" onClick={() => remove(entry)} disabled={busy} className="p-2 rounded-lg border border-[var(--border-default)] hover:border-red-500/40 hover:text-red-500" aria-label="Delete pending evidence"><Trash2 size={14}/></button>}</div>
                        </div>
                        {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer" className="inline-flex mt-3 text-xs font-bold text-primary hover:underline">Open evidence</a>}
                    </div>)}
                </section>
            </>}
        </main>
    </div></div>
}
