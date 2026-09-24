"use client"

import * as React from "react"
import { AlertTriangle, FileImage, Loader2, Upload, Video, X } from "lucide-react"
import {
    createSaleCancellation,
    SALE_CANCELLATION_EVIDENCE_REQUIRED,
    SALE_CANCELLATION_REASON_LABELS,
    type SaleCancellationReason,
    type SaleCancellationRequest,
} from "@/lib/saleCancellationApi"

const REASONS = Object.keys(SALE_CANCELLATION_REASON_LABELS) as SaleCancellationReason[]

export function SaleCancellationModal({
    listingId,
    vehicleTitle,
    onClose,
    onCreated,
}: {
    listingId: string
    vehicleTitle: string
    onClose: () => void
    onCreated?: (request: SaleCancellationRequest) => void
}) {
    const [reason, setReason] = React.useState<SaleCancellationReason>('MUTUAL_AGREEMENT')
    const [details, setDetails] = React.useState("")
    const [files, setFiles] = React.useState<File[]>([])
    const [submitting, setSubmitting] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const evidenceRequired = SALE_CANCELLATION_EVIDENCE_REQUIRED.has(reason)

    function handleFiles(next: FileList | null) {
        if (!next) return
        const selected = Array.from(next).slice(0, 5)
        const tooLarge = selected.find(file => file.size > 25 * 1024 * 1024)
        if (tooLarge) {
            setError(`${tooLarge.name} is larger than 25 MB.`)
            return
        }
        setFiles(selected)
        setError(null)
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (evidenceRequired && files.length === 0) {
            setError("Add at least one photo, screenshot or video for this reason.")
            return
        }
        if (reason === 'OTHER' && details.trim().length < 20) {
            setError("Please explain the reason in at least 20 characters.")
            return
        }

        setSubmitting(true)
        setError(null)
        try {
            const created = await createSaleCancellation({
                listingId,
                reason,
                details,
                evidence: files,
            })
            onCreated?.(created)
            onClose()
        } catch (err: any) {
            setError(err?.message || "Could not submit the cancellation request.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
            <form onSubmit={submit} className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border-default)] bg-[var(--bg-dropdown)] p-5">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-red-400">Sale cancellation</p>
                        <h2 className="text-xl font-black mt-1">{vehicleTitle}</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            This sends a formal request to the other party. It does not silently erase the transaction.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)]">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                            Why are you cancelling?
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => { setReason(e.target.value as SaleCancellationReason); setError(null) }}
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-3 text-sm"
                        >
                            {REASONS.map(value => (
                                <option key={value} value={value}>{SALE_CANCELLATION_REASON_LABELS[value]}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                            Explain what happened
                        </label>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            maxLength={2000}
                            rows={5}
                            placeholder="Give the other party and CarMazium enough detail to understand the cancellation."
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-3 text-sm resize-y"
                        />
                    </div>

                    <div className={`rounded-2xl border p-4 ${evidenceRequired ? 'border-amber-500/35 bg-amber-500/10' : 'border-[var(--border-default)] bg-[var(--bg-card)]'}`}>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {evidenceRequired ? <AlertTriangle size={18} className="text-amber-400" /> : <Upload size={18} className="text-primary" />}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-sm">
                                    Evidence {evidenceRequired ? "required" : "optional"}
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Add up to 5 photos, screenshots or short videos. Each file can be up to 25 MB. Evidence is stored privately and only shown to authorised parties/admins.
                                </p>
                                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-xs font-bold hover:border-primary/40">
                                    <Upload size={14} /> Choose evidence
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
                                        className="hidden"
                                        onChange={(e) => handleFiles(e.target.files)}
                                    />
                                </label>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map((file, index) => (
                                    <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-xs">
                                        {file.type.startsWith('video/') ? <Video size={14} /> : <FileImage size={14} />}
                                        <span className="truncate flex-1">{file.name}</span>
                                        <span className="text-[var(--text-muted)]">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                        <button
                                            type="button"
                                            onClick={() => setFiles(current => current.filter((_, i) => i !== index))}
                                            className="p-1 text-[var(--text-muted)] hover:text-red-400"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-[var(--text-muted)] leading-5">
                        The other party must normally agree before the deal is reversed. If handover or the £100 seller reward has already been approved, CarMazium admin review is required. Auction buyer-fee refunds depend on who cancelled and the reason.
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>

                <div className="sticky bottom-0 flex gap-3 border-t border-[var(--border-default)] bg-[var(--bg-dropdown)] p-5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 rounded-xl border border-[var(--border-default)] px-4 py-3 text-sm font-bold"
                    >
                        Keep sale
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-60"
                    >
                        {submitting ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Submitting…</span> : "Request cancellation"}
                    </button>
                </div>
            </form>
        </div>
    )
}
