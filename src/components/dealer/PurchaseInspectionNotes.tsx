"use client"

import * as React from "react"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { apiClient } from "@/lib/apiClient"

export const INSPECTION_NOTE_KIND_LABELS: Record<string, string> = {
    NEW_DAMAGE: "New damage found",
    DIFFERS_FROM_ADVERT: "Differs from the advert",
    GENERAL: "General note",
}

interface InspectionNote {
    id: string
    kind: string
    part: string | null
    description: string
    createdAt: string
    byYou: boolean
}

/**
 * The dealership's own findings at inspection, set against the original
 * disclosure above. Append-only, and it never changes the agreed price or
 * purchase status: any price change still goes through Adjustments &
 * cancellations. Hidden entirely until the backend has notes switched on.
 */
export function PurchaseInspectionNotes({ saleId }: { saleId: string }) {
    const base = `/dealers/purchases/${encodeURIComponent(saleId)}/inspection-notes`
    const [enabled, setEnabled] = React.useState<boolean | null>(null)
    // Adding needs a stock permission (MANAGE_INVENTORY); reading needs VIEW_PURCHASES.
    const [canAdd, setCanAdd] = React.useState(false)
    const [notes, setNotes] = React.useState<InspectionNote[]>([])
    const [loadError, setLoadError] = React.useState(false)
    const [kind, setKind] = React.useState("NEW_DAMAGE")
    const [part, setPart] = React.useState("")
    const [description, setDescription] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [saveError, setSaveError] = React.useState<string | null>(null)

    React.useEffect(() => {
        let mounted = true
        apiClient<{ data: { enabled: boolean; canAdd?: boolean; notes: InspectionNote[] } }>(base, { cache: "no-store" })
            .then(res => {
                if (!mounted) return
                setEnabled(res.data.enabled)
                setCanAdd(res.data.canAdd === true)
                setNotes(res.data.notes)
            })
            .catch(() => { if (mounted) { setEnabled(true); setLoadError(true) } })
        return () => { mounted = false }
    }, [base])

    if (enabled === false || enabled === null) return null

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (description.trim().length < 3) {
            setSaveError("Describe what you found (at least 3 characters).")
            return
        }
        setSaving(true)
        setSaveError(null)
        try {
            const res = await apiClient<{ data: InspectionNote }>(base, {
                method: "POST",
                body: JSON.stringify({ kind, part: part.trim() || undefined, description: description.trim() }),
            })
            setNotes(prev => [...prev, res.data])
            setPart("")
            setDescription("")
        } catch (err: any) {
            setSaveError(err?.message || "The note could not be saved. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <section id="inspection-notes" className="dealer-glass-card p-5 md:p-7 space-y-4">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardCheck size={20} className="text-primary" /> Inspection notes</h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Record anything you find that the advert above didn&apos;t show. Notes are kept as a record for your
                    team and don&apos;t change the agreed price or purchase status. To change the price, use Adjustments &amp; cancellations.
                </p>
            </div>

            {loadError && <p role="alert" className="text-sm text-amber-300">Earlier notes could not be loaded.</p>}

            {notes.length > 0 ? (
                <ul className="space-y-2">
                    {notes.map(n => (
                        <li key={n.id} className="rounded-xl border border-[var(--border-default)] p-3 text-sm">
                            <p className="font-bold">
                                {INSPECTION_NOTE_KIND_LABELS[n.kind] ?? "Note"}{n.part ? ` · ${n.part}` : ""}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{n.description}</p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                {n.byYou ? " · You" : " · Your team"}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : !loadError && (
                <p className="text-sm text-[var(--text-muted)]">No inspection notes yet.</p>
            )}

            {canAdd ? <form onSubmit={save} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="block">
                        <span className="text-xs font-bold text-[var(--text-muted)]">Type</span>
                        <select value={kind} onChange={e => setKind(e.target.value)}
                            className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm">
                            {Object.entries(INSPECTION_NOTE_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs font-bold text-[var(--text-muted)]">Panel or area (optional)</span>
                        <input value={part} onChange={e => setPart(e.target.value)} maxLength={80} placeholder="e.g. Rear bumper"
                            className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm" />
                    </label>
                </div>
                <label className="block">
                    <span className="text-xs font-bold text-[var(--text-muted)]">What you found</span>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={3}
                        className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm" />
                </label>
                {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
                <button type="submit" disabled={saving}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white disabled:opacity-50">
                    {saving && <Loader2 size={15} className="animate-spin" />} Add note
                </button>
            </form> : (
                <p className="text-xs text-[var(--text-muted)]">Your team role can read these notes. Ask an owner, admin or sales agent to add one.</p>
            )}
        </section>
    )
}
