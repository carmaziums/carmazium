"use client"

import * as React from "react"
import {
    CheckCircle2,
    CircleOff,
    Loader2,
    Save,
    StickyNote,
    Tags,
    Trash2,
    UserRound,
} from "lucide-react"
import {
    addAdminSupportNote,
    assignAdminSupportRoom,
    deleteAdminSupportNote,
    getAdminSupportAgents,
    getAdminSupportNotes,
    updateAdminSupportClosed,
    updateAdminSupportTags,
    type AdminSupportAgent,
    type AdminSupportNote,
} from "@/lib/adminApi"
import type { ChatRoom } from "@/lib/chatApi"

interface AdminSupportPanelProps {
    room: ChatRoom
    currentAdminId: string
    onChanged?: () => void | Promise<void>
}

function agentName(agent: AdminSupportAgent | AdminSupportNote["author"] | null | undefined) {
    if (!agent) return "Unassigned"
    return `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim() || agent.email
}

export function AdminSupportPanel({
    room,
    currentAdminId,
    onChanged,
}: AdminSupportPanelProps) {
    const [agents, setAgents] = React.useState<AdminSupportAgent[]>([])
    const [notes, setNotes] = React.useState<AdminSupportNote[]>([])
    const [assignedId, setAssignedId] = React.useState(room.supportAssignedAdminId || "")
    const [tagText, setTagText] = React.useState((room.supportTags || []).join(", "))
    const [closedAt, setClosedAt] = React.useState<string | null>(room.supportClosedAt || null)
    const [noteBody, setNoteBody] = React.useState("")
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        setAssignedId(room.supportAssignedAdminId || "")
        setTagText((room.supportTags || []).join(", "))
        setClosedAt(room.supportClosedAt || null)

        let cancelled = false
        Promise.all([
            getAdminSupportAgents(),
            getAdminSupportNotes(room.id),
        ]).then(([nextAgents, nextNotes]) => {
            if (cancelled) return
            setAgents(nextAgents)
            setNotes(nextNotes)
        }).catch((err: any) => {
            if (!cancelled && err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not load support operations")
            }
        }).finally(() => {
            if (!cancelled) setLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [room.id, room.supportAssignedAdminId, room.supportTags, room.supportClosedAt])

    const changed = async () => {
        await onChanged?.()
    }

    const assign = async (adminId: string) => {
        try {
            setSaving("assign")
            setError(null)
            const result = await assignAdminSupportRoom(room.id, adminId || null)
            setAssignedId(result.supportAssignedAdminId || "")
            await changed()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Assignment failed")
        } finally {
            setSaving(null)
        }
    }

    const saveTags = async () => {
        const tags = tagText
            .split(",")
            .map(tag => tag.trim())
            .filter(Boolean)
        try {
            setSaving("tags")
            setError(null)
            const saved = await updateAdminSupportTags(room.id, tags)
            setTagText(saved.join(", "))
            await changed()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Tags could not be saved")
        } finally {
            setSaving(null)
        }
    }

    const toggleClosed = async () => {
        try {
            setSaving("closed")
            setError(null)
            const result = await updateAdminSupportClosed(room.id, !closedAt)
            setClosedAt(result.supportClosedAt)
            await changed()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Conversation status could not be changed")
        } finally {
            setSaving(null)
        }
    }

    const addNote = async () => {
        const body = noteBody.trim()
        if (!body) return
        try {
            setSaving("note")
            setError(null)
            const note = await addAdminSupportNote(room.id, body)
            setNotes(prev => [note, ...prev])
            setNoteBody("")
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Note could not be added")
        } finally {
            setSaving(null)
        }
    }

    const removeNote = async (noteId: string) => {
        try {
            setSaving(noteId)
            setError(null)
            await deleteAdminSupportNote(room.id, noteId)
            setNotes(prev => prev.filter(note => note.id !== noteId))
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Note could not be deleted")
        } finally {
            setSaving(null)
        }
    }

    return (
        <aside className="h-full overflow-y-auto border-l border-[var(--border-default)] bg-[var(--bg-card)] p-4 xl:w-[310px]">
            <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Internal only</p>
                <h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">Support controls</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Customers cannot see assignment, tags or notes.</p>
            </div>

            {error && (
                <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
                <div className="space-y-5">
                    <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
                            <UserRound size={14} /> Assigned agent
                        </div>
                        <select
                            value={assignedId}
                            disabled={saving === "assign"}
                            onChange={(event) => assign(event.target.value)}
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                        >
                            <option value="">Unassigned</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>
                                    {agentName(agent)}{agent.id === currentAdminId ? " (you)" : ""}
                                </option>
                            ))}
                        </select>
                    </section>

                    <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
                            <Tags size={14} /> Tags
                        </div>
                        <input
                            value={tagText}
                            onChange={(event) => setTagText(event.target.value)}
                            placeholder="refund, auction, urgent"
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                        />
                        <button
                            type="button"
                            onClick={saveTags}
                            disabled={saving === "tags"}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-bold hover:border-primary/40 disabled:opacity-50"
                        >
                            {saving === "tags" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Save tags
                        </button>
                    </section>

                    <section>
                        <button
                            type="button"
                            onClick={toggleClosed}
                            disabled={saving === "closed"}
                            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black ${closedAt
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)]"
                            }`}
                        >
                            {closedAt ? <CheckCircle2 size={16} /> : <CircleOff size={16} />}
                            {closedAt ? "Reopen conversation" : "Close conversation"}
                        </button>
                    </section>

                    <section className="border-t border-[var(--border-default)] pt-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">
                            <StickyNote size={14} /> Private notes
                        </div>
                        <textarea
                            value={noteBody}
                            onChange={(event) => setNoteBody(event.target.value)}
                            maxLength={2000}
                            rows={3}
                            placeholder="Add an internal note..."
                            className="w-full resize-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                        />
                        <button
                            type="button"
                            onClick={addNote}
                            disabled={!noteBody.trim() || saving === "note"}
                            className="mt-2 w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-black text-white disabled:opacity-40"
                        >
                            {saving === "note" ? "Saving…" : "Add private note"}
                        </button>

                        <div className="mt-3 space-y-2">
                            {notes.length === 0 ? (
                                <p className="py-3 text-center text-xs text-[var(--text-muted)]">No internal notes.</p>
                            ) : notes.map(note => (
                                <div key={note.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                    <div className="mb-1 flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-black text-[var(--text-secondary)]">{agentName(note.author)}</p>
                                            <p className="text-[10px] text-[var(--text-muted)]">{new Date(note.createdAt).toLocaleString()}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeNote(note.id)}
                                            disabled={saving === note.id}
                                            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400"
                                            title="Delete note"
                                        >
                                            {saving === note.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                        </button>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-xs text-[var(--text-secondary)]">{note.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </aside>
    )
}
