"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Check, Loader2, X } from "lucide-react"
import { markAdminListingSold } from "@/lib/adminApi"

export function AdminMarkSoldButton({ listing, onSaved }: {
    listing: { id: string; title: string; vrm?: string | null; status: string; deletedAt?: string | null }
    onSaved: () => void
}) {
    const [open, setOpen] = React.useState(false)
    const [busy, setBusy] = React.useState(false)
    const [source, setSource] = React.useState<"EXTERNAL" | "UNKNOWN">("EXTERNAL")
    const [reason, setReason] = React.useState("")
    const [error, setError] = React.useState<string | null>(null)
    if (listing.deletedAt || listing.status === "SOLD") return null

    const close = () => { if (!busy) { setOpen(false); setError(null) } }
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy || reason.trim().length < 10) return
        setBusy(true)
        setError(null)
        try {
            await markAdminListingSold(listing.id, source, reason.trim())
            setOpen(false)
            setReason("")
            onSaved()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Could not mark this listing sold. Please try again.")
        } finally { setBusy(false) }
    }
    return <>
        <button type="button" onClick={() => setOpen(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-300 hover:bg-blue-500/20"
            aria-label={`Mark ${listing.title} as sold`}>
            <Check size={15} /> Mark as sold
        </button>
        {open && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3" onClick={close}>
                <form onSubmit={submit} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mark listing as sold"
                    className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">Mark as sold</h2>
                        <button type="button" onClick={close} disabled={busy} aria-label="Close mark as sold" className="p-2"><X size={20} /></button>
                    </div>
                    <p className="mt-3 font-bold break-words">{listing.title}{listing.vrm ? ` · ${listing.vrm}` : ""}</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Remove this car from available adverts and keep it in Sold history. Any linked advert will also be marked sold.</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">This records the seller’s report. It does not create a CarMazium purchase, payment or sale price. An outstanding auction or accepted deal must be resolved first.</p>
                    <label className="mt-4 block text-sm font-bold">Buyer source
                        <select value={source} onChange={e => setSource(e.target.value as "EXTERNAL" | "UNKNOWN")} disabled={busy} className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                            <option value="EXTERNAL">Seller says sold elsewhere</option>
                            <option value="UNKNOWN">Buyer source not confirmed</option>
                        </select>
                    </label>
                    <label className="mt-4 block text-sm font-bold">Reason / seller confirmation
                        <textarea autoFocus required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy}
                            placeholder="For example: Seller confirmed in support chat that the car was sold elsewhere."
                            className="mt-1 min-h-24 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-3 font-normal" />
                    </label>
                    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={close} disabled={busy} className="min-h-11 rounded-lg border border-[var(--border-default)] px-4">Cancel</button>
                        <button type="submit" disabled={busy || reason.trim().length < 10} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-bold text-white disabled:opacity-50">
                            {busy && <Loader2 size={16} className="animate-spin" />} Confirm sold
                        </button>
                    </div>
                </form>
            </div>, document.body,
        )}
    </>
}
