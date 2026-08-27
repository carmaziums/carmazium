"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X, Loader2, Upload, FileText, ShieldCheck, ShieldX, Trash2, AlertTriangle } from "lucide-react"
import { uploadHpiPdf, removeHpiPdf, openHpiPdf } from "@/lib/hpiApi"

const MAX_BYTES = 15 * 1024 * 1024

interface PanelProps {
    listingId: string
    /** Set when a PDF is already attached, so this doubles as the replace/remove UI. */
    hasExistingPdf?: boolean
    onSaved: () => void
    /** Rendered beside the primary action — lets the host add its own Cancel. */
    secondaryAction?: React.ReactNode
}

/**
 * The upload half of preparing an HPI report — the alternative to filling in
 * HpiReportForm for admins who just have the supplied third-party PDF and no
 * reason to re-key it into our own structure.
 *
 * Extracted from the modal below so the same panel can be reached from
 * wherever an admin already is: the HPI queue, the pending-review listing, the
 * transaction ledger, or the report form itself. Making staff navigate to a
 * particular page to attach a file they already have is the friction this
 * removes.
 *
 * The clear / not-clear choice is deliberately mandatory and unset by default.
 * On the form path `isClear` is derived from the checks and can't disagree with
 * the document; here nothing is derivable, so the admin has to actually read
 * the PDF and say — a silent default would put an unverified "all checks
 * passed" badge on a listing.
 */
export function HpiPdfUploadPanel({ listingId, hasExistingPdf, onSaved, secondaryAction }: PanelProps) {
    const [file, setFile] = React.useState<File | null>(null)
    const [isClear, setIsClear] = React.useState<boolean | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [removing, setRemoving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [dragging, setDragging] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    function acceptFile(picked: File | undefined | null) {
        setError(null)
        if (!picked) return
        // Extension as well as MIME: some browsers hand over an empty type for
        // files dragged in from certain apps.
        const looksPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name)
        if (!looksPdf) {
            setError('That file is not a PDF.')
            return
        }
        if (picked.size > MAX_BYTES) {
            setError(`That file is ${(picked.size / (1024 * 1024)).toFixed(1)}MB — the limit is 15MB.`)
            return
        }
        setFile(picked)
    }

    async function handleUpload() {
        if (!file || isClear === null) return
        setSaving(true)
        setError(null)
        try {
            await uploadHpiPdf(listingId, file, isClear)
            onSaved()
        } catch (e: any) {
            setError(e?.message || 'Failed to upload the report')
            setSaving(false)
        }
    }

    async function handleRemove() {
        setRemoving(true)
        setError(null)
        try {
            await removeHpiPdf(listingId)
            onSaved()
        } catch (e: any) {
            setError(e?.message || 'Failed to remove the report')
            setRemoving(false)
        }
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {hasExistingPdf && (
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 flex items-center gap-3">
                    <FileText size={16} className="text-primary shrink-0" />
                    <p className="text-sm flex-1 min-w-0">A PDF is already attached to this report.</p>
                    <button
                        onClick={() => openHpiPdf(listingId).catch((e) => setError(e?.message || 'Failed to open the PDF'))}
                        className="text-xs font-bold text-primary hover:underline shrink-0"
                    >
                        View
                    </button>
                </div>
            )}

            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]) }}
                onClick={() => inputRef.current?.click()}
                className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${dragging
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--border-default)] hover:border-primary/50'}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                {file ? (
                    <>
                        <FileText size={26} className="mx-auto mb-2 text-primary" />
                        <p className="text-sm font-bold text-[var(--text-primary)] break-all">{file.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {(file.size / (1024 * 1024)).toFixed(2)}MB · click to choose a different file
                        </p>
                    </>
                ) : (
                    <>
                        <Upload size={26} className="mx-auto mb-2 text-[var(--text-muted)]" />
                        <p className="text-sm font-bold text-[var(--text-primary)]">Drop the report PDF here</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">or click to browse · PDF, up to 15MB</p>
                    </>
                )}
            </div>

            <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-2">
                    Outcome shown to buyers
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setIsClear(true)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-colors ${isClear === true
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                            : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-emerald-500/40'}`}
                    >
                        <ShieldCheck size={16} className="shrink-0" /> All checks passed
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsClear(false)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-colors ${isClear === false
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                            : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-amber-500/40'}`}
                    >
                        <ShieldX size={16} className="shrink-0" /> Adverse history
                    </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                    Read the PDF before choosing — this drives the badge on the listing, and there are no
                    structured checks behind an uploaded report to cross-check it against.
                </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
                <button
                    onClick={handleUpload}
                    disabled={!file || isClear === null || saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {hasExistingPdf ? 'Replace report' : 'Upload & complete'}
                </button>
                {hasExistingPdf && (
                    <button
                        onClick={handleRemove}
                        disabled={removing}
                        title="Remove the attached PDF"
                        className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                        {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                )}
                {secondaryAction}
            </div>
        </div>
    )
}

interface Props extends Omit<PanelProps, 'secondaryAction'> {
    listingTitle: string
    onClose: () => void
}

/** Standalone modal wrapper around the panel above. */
export function HpiPdfUpload({ listingId, listingTitle, hasExistingPdf, onClose, onSaved }: Props) {
    if (typeof document === 'undefined') return null

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative w-full max-w-lg bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden">
                <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
                    <div className="min-w-0">
                        <h3 className="font-bold text-[var(--text-primary)]">
                            {hasExistingPdf ? 'Replace report PDF' : 'Upload report PDF'}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] truncate">{listingTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
                        <X size={18} />
                    </button>
                </header>

                <div className="p-5">
                    <HpiPdfUploadPanel
                        listingId={listingId}
                        hasExistingPdf={hasExistingPdf}
                        onSaved={onSaved}
                        secondaryAction={
                            <button
                                onClick={onClose}
                                className="px-5 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                                Cancel
                            </button>
                        }
                    />
                </div>
            </div>
        </div>,
        document.body,
    )
}
