"use client"

import * as React from "react"
import { getCapabilityVerification, uploadCapabilityAttachment, deleteCapabilityAttachment, type CapabilityVerificationDetail, type CapabilityVerificationRequirement, type ServiceCaseEntry } from "@/lib/serviceOperationsApi"
import { Button } from "@/components/ui/Button"

type Service = "DELIVERY" | "INSPECTION"
type Capability = { id: string; serviceType: string; status: string }
const inputCls = "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
const captionCls = "text-xs text-[var(--text-muted)]"
const dateText = (value?: string | null) => value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString("en-GB") : "Not recorded"

export function ProviderDocumentsSection({ capabilities }: { capabilities: Capability[] }) {
    const [expanded, setExpanded] = React.useState(false)
    const [service, setService] = React.useState<Service>("DELIVERY")
    const cap = capabilities.find(c => c.serviceType === service)
    const [detail, setDetail] = React.useState<CapabilityVerificationDetail | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [notice, setNotice] = React.useState<string | null>(null)
    const [historyOpen, setHistoryOpen] = React.useState(false)
    const [uploadOpen, setUploadOpen] = React.useState(false)
    const [issuer, setIssuer] = React.useState("")
    const [reference, setReference] = React.useState("")
    const [validFrom, setValidFrom] = React.useState("")
    const [expiresAt, setExpiresAt] = React.useState("")
    const [file, setFile] = React.useState<File | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const generation = React.useRef(0)

    React.useEffect(() => {
        if (window.location.hash === "#provider-documents") setExpanded(true)
    }, [])

    const reload = React.useCallback(async (id: string) => {
        const request = ++generation.current
        setLoading(true)
        setError(null)
        try {
            const next = await getCapabilityVerification(id)
            if (request === generation.current) {
                if (next.capabilityId !== id || next.serviceType !== service) throw new Error("Verification data did not match this service.")
                setDetail(next)
            }
        } catch (e) {
            if (request === generation.current) {
                setDetail(null)
                setError(e instanceof Error ? e.message : "Could not load verification documents.")
            }
        } finally {
            if (request === generation.current) setLoading(false)
        }
    }, [service])

    React.useEffect(() => {
        setDetail(null); setFile(null); setUploadOpen(false); setHistoryOpen(false); setNotice(null)
        if (expanded && cap?.id) void reload(cap.id)
        else generation.current++
        return () => { generation.current++ }
    }, [expanded, cap?.id, reload])

    const requirements = detail?.verification.requirements.filter(r => !r.optional) ?? []
    const requirement: CapabilityVerificationRequirement | undefined =
        service === "DELIVERY" ? requirements.find(r => r.type === "DELIVERY_BUSINESS_INSURANCE") : undefined

    const upload = async () => {
        if (!cap || !requirement || !file) return
        if (file.size > 10 * 1024 * 1024) { setError("Maximum file size is 10 MB."); return }
        if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setError("Choose a PDF, JPG, PNG or WEBP file."); return
        }
        if (requirement.expiryRequired && !expiresAt) { setError("Enter the trade-insurance expiry date."); return }
        setBusy(true); setError(null); setNotice(null)
        try {
            await uploadCapabilityAttachment(cap.id, file, {
                evidenceType: requirement.type,
                label: requirement.title,
                issuer: issuer.trim() || undefined,
                reference: reference.trim() || undefined,
                validFrom: validFrom || undefined,
                expiresAt: expiresAt || undefined,
            })
            setIssuer(""); setReference(""); setValidFrom(""); setExpiresAt(""); setFile(null)
            if (inputRef.current) inputRef.current.value = ""
            setUploadOpen(false)
            setNotice("Trade insurance submitted for review. Existing approved evidence remains on record.")
            await reload(cap.id)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not upload this file.")
        } finally { setBusy(false) }
    }

    const removePending = async (entry: ServiceCaseEntry) => {
        if (!cap || entry.evidenceStatus !== "PENDING" || !window.confirm("Delete this pending document? Reviewed evidence is retained for audit.")) return
        setBusy(true); setError(null); setNotice(null)
        try {
            await deleteCapabilityAttachment(cap.id, entry.id)
            setNotice("Pending document deleted.")
            await reload(cap.id)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not delete pending document.")
        } finally { setBusy(false) }
    }

    return <section id="provider-documents" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7">
        <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={expanded} aria-controls="provider-document-options" onClick={() => setExpanded(value => !value)}>
            <span>
                <span className="block text-xl font-black font-heading">Documents & Insurance</span>
                <span className="block text-sm text-[var(--text-muted)] mt-1">Only documents required for your service, plus your saved evidence history.</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-[var(--text-muted)]">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && <div id="provider-document-options" className="space-y-4 mt-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Document service">
                {(["DELIVERY", "INSPECTION"] as const).map(type =>
                    <Button key={type} type="button" variant={service === type ? "default" : "outline"} onClick={() => setService(type)}>
                        {type === "DELIVERY" ? "Collection & delivery" : "Inspection"}
                    </Button>)}
            </div>
            {!cap ? <p className={captionCls}>No {service === "DELIVERY" ? "collection/delivery" : "inspection"} application yet. Enable and apply for the service in My Services above.</p>
            : loading ? <p role="status" className={captionCls}>Loading current document status…</p>
            : !detail ? <div><p role="alert" className="text-sm text-red-600 dark:text-red-300">{error || "Verification documents are unavailable."}</p><Button variant="outline" onClick={() => void reload(cap.id)}>Retry</Button></div>
            : <>
                {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
                {notice && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-300">{notice}</p>}
                {service === "INSPECTION" ? <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-2">
                    <h3 className="font-semibold">No inspection documents required</h3>
                    <p className={captionCls}>Inspection requires the business declaration, applicable account verification and payout setup—not insurance uploads. Historical documents remain available below.</p>
                </div> : requirement ? <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
                    <div className="flex flex-wrap justify-between gap-2">
                        <div><h3 className="font-semibold">{requirement.title}</h3><p className={captionCls}>{requirement.description}</p></div>
                        <span className="text-sm font-semibold">{requirement.state === "SATISFIED" ? "Approved and current" : requirement.state === "PENDING" ? "Under review" : requirement.state === "REJECTED" ? "Rejected — replace" : "Missing or expired"}</span>
                    </div>
                    {requirement.state === "SATISFIED" && <p className={captionCls}>Approved evidence expires {dateText(requirement.evidenceExpiresAt)}.</p>}
                    <p className={captionCls}>Upload trade-insurance evidence for collection, delivery and recovery only. Do not upload personal identity documents or bank statements here.</p>
                    <Button type="button" variant="outline" onClick={() => setUploadOpen(open => !open)}>{uploadOpen ? "Close upload" : requirement.state === "SATISFIED" ? "Replace trade insurance" : requirement.state === "PENDING" ? "Submit updated insurance" : "Upload trade insurance"}</Button>
                    {uploadOpen && <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">Insurer / organisation<input className={inputCls} value={issuer} onChange={e => setIssuer(e.target.value)} maxLength={160} /></label>
                        <label className="text-sm">Policy reference<input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} maxLength={160} /></label>
                        <label className="text-sm">Valid from<input className={inputCls} type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></label>
                        <label className="text-sm">Expiry date (required)<input className={inputCls} type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label>
                        <label className="text-sm sm:col-span-2">Trade-insurance file (PDF/JPG/PNG/WEBP, up to 10 MB)<input ref={inputRef} className={inputCls} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
                        <div className="sm:col-span-2"><Button onClick={() => void upload()} disabled={busy || !file || !expiresAt}>{busy ? "Uploading…" : "Upload for review"}</Button></div>
                    </div>}
                </div> : <p role="status" className={captionCls}>No current insurance requirement was returned for this service. No upload is requested.</p>}
                <div className="border-t border-[var(--border-default)] pt-4">
                    <button type="button" className="text-sm font-semibold text-primary underline" aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)}>
                        {historyOpen ? "Hide document history" : "Show document history"} ({detail.attachments.length})
                    </button>
                    {historyOpen && <div className="space-y-2 mt-3">
                        <p className={captionCls}>Older approved, superseded or unrelated documents are retained for audit, not required again.</p>
                        {detail.attachments.length === 0 && <p className={captionCls}>No previously uploaded documents.</p>}
                        {detail.attachments.map(entry => <div key={entry.id} className="rounded-lg border border-[var(--border-default)] p-3">
                            <div className="flex justify-between gap-3"><strong className="text-sm break-words">{entry.label || entry.evidenceType || "Evidence"}</strong><span className="text-xs font-semibold">{entry.evidenceStatus || "PENDING"}</span></div>
                            <p className={captionCls}>Uploaded {dateText(entry.createdAt)}{entry.evidenceExpiresAt ? " · Expires " + dateText(entry.evidenceExpiresAt) : ""}</p>
                            {entry.evidenceReviewNote && <p className={captionCls}>{entry.evidenceReviewNote}</p>}
                            <div className="flex flex-wrap gap-3 mt-2">
                                {entry.url && <a className="text-sm font-semibold text-primary underline" href={entry.url} target="_blank" rel="noopener noreferrer">Open evidence</a>}
                                {entry.evidenceStatus === "PENDING" && <button className="text-sm text-red-600 underline" disabled={busy} onClick={() => void removePending(entry)}>Delete pending file</button>}
                            </div>
                        </div>)}
                    </div>}
                </div>
            </>}
        </div>}
    </section>
}
