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
            const [mine, attachments] = await Promise.all([getMyCapabilities(), getCapabilityAttachments(id)])
            const cap = mine.capabilities.find(c => c.id === id)
            if (!cap) throw new Error("This service application was not found on your account.")
            setCapability(cap)
            setEntries(attachments)
        } catch (e: any) {
            setError(e?.message || "Could not load verification documents")
        }
    }, [id])

    React.useEffect(() => { if (user) load() }, [user, load])

    const upload = async () => {
        if (!file) { setError("Choose an image or PDF first."); return }
        if (file.size > 10 * 1024 * 1024) { setError("Please keep each document under 10 MB."); return }
        setBusy(true); setError(null)
        try {
            await uploadCapabilityAttachment(id, file, label.trim() || file.name)
            setFile(null); setLabel("")
            const input = document.getElementById("verification-file") as HTMLInputElement | null
            if (input) input.value = ""
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not upload this document")
        } finally { setBusy(false) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"

    return <div className="min-h-screen pt-20 pb-12"><div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
        <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
        <main className="flex-1 max-w-3xl space-y-6">
            <div>
                <Link href="/dashboard/service/capabilities" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-5"><ArrowLeft size={14}/> Service areas</Link>
                <h1 className="text-3xl font-bold font-heading">Business verification</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">{capability ? SERVICE_LABELS[capability.serviceType] : "Service application"} · supporting evidence for CarMazium admin review.</p>
            </div>

            {error && <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5"/>{error}</div>}

            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex gap-3"><ShieldCheck size={20} className="text-amber-500 shrink-0 mt-0.5"/><div><h2 className="font-bold">Upload business evidence only</h2><p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">Useful evidence includes business insurance, goods-in-transit cover, Companies House certificates, operator/trade credentials or inspection qualifications. Do not upload passports, driving licences, bank statements or other sensitive personal identity documents here.</p></div></div>
            </section>

            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 space-y-4">
                <div><h2 className="font-heading font-bold text-lg">Add verification document</h2><p className="text-xs text-[var(--text-muted)] mt-1">PDF, JPG, PNG or WEBP. Maximum 10 files per service application.</p></div>
                <input className={inputCls} value={label} onChange={e => setLabel(e.target.value)} placeholder="Document label, e.g. Goods in transit insurance" maxLength={160}/>
                <input id="verification-file" className={inputCls} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)}/>
                <Button onClick={upload} disabled={busy || !file}>{busy ? <Loader2 size={16} className="animate-spin mr-2"/> : <Upload size={16} className="mr-2"/>}Upload document</Button>
            </section>

            <section className="space-y-3">
                <h2 className="font-heading font-bold text-lg">Submitted documents {entries ? `(${entries.length})` : ""}</h2>
                {entries === null && !error && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary"/></div>}
                {entries?.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-muted)]">No verification documents uploaded yet.</div>}
                {entries?.map(entry => <div key={entry.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 flex items-center justify-between gap-4"><div className="min-w-0 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><FileText size={18} className="text-primary"/></div><div className="min-w-0"><p className="font-bold text-sm truncate">{entry.label || "Verification document"}</p><p className="text-xs text-[var(--text-muted)]">Uploaded {new Date(entry.createdAt).toLocaleDateString("en-GB")}</p></div></div>{entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline shrink-0">Open</a>}</div>)}
            </section>
        </main>
    </div></div>
}
