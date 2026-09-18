"use client"

import * as React from "react"
import {
    CheckCircle2,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
    UserCheck,
} from "lucide-react"
import {
    getAdminDisputes,
    joinAdminDispute,
    resolveAdminDispute,
    type AdminDisputeCase,
    type AdminDisputeStatus,
} from "@/lib/adminApi"
import { chatMessagePreview } from "@/lib/chatMessageContent"
import type { ChatRoom } from "@/lib/chatApi"

interface AdminDisputeQueueProps {
    currentAdminId: string
    onOpenRoom: (room: ChatRoom) => void
}

const statusClass: Record<AdminDisputeStatus, string> = {
    OPEN: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    RESOLVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
}

function personName(person: {
    firstName: string | null
    lastName: string | null
    email: string
}) {
    return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.email
}

export function AdminDisputeQueue({
    currentAdminId,
    onOpenRoom,
}: AdminDisputeQueueProps) {
    const [items, setItems] = React.useState<AdminDisputeCase[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actioning, setActioning] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [status, setStatus] = React.useState<"" | AdminDisputeStatus>("OPEN")

    const load = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminDisputes(
                1,
                100,
                status || undefined,
                search.trim() || undefined,
            )
            setItems(result.data)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not load disputes")
            }
        } finally {
            setLoading(false)
        }
    }, [search, status])

    React.useEffect(() => {
        const timer = window.setTimeout(load, 250)
        return () => window.clearTimeout(timer)
    }, [load])

    const joinOrOpen = async (item: AdminDisputeCase) => {
        if (item.joinedAdminId && item.joinedAdminId !== currentAdminId) return

        try {
            setActioning(item.id)
            setError(null)
            const result = await joinAdminDispute(item.id)
            onOpenRoom(result.room)
            await load()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not join dispute")
            }
        } finally {
            setActioning(null)
        }
    }

    const resolve = async (item: AdminDisputeCase) => {
        if (item.joinedAdminId !== currentAdminId || item.status !== "OPEN") return

        try {
            setActioning(`resolve:${item.id}`)
            setError(null)
            await resolveAdminDispute(item.id)
            await load()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not resolve dispute")
            }
        } finally {
            setActioning(null)
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                            <ShieldAlert size={14} /> Audited case access
                        </div>
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">Vehicle disputes</h3>
                        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
                            Cases are separate from private buyer–seller chats. An admin must explicitly join a case before its dispute transcript becomes accessible.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-xl border border-[var(--border-default)] p-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Refresh disputes"
                    >
                        <RefreshCw size={17} />
                    </button>
                </div>

                <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(240px,1fr)_180px]">
                    <label className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search vehicle, email or reason"
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm"
                        />
                    </label>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as "" | AdminDisputeStatus)}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                    >
                        <option value="OPEN">Open disputes</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="">All disputes</option>
                    </select>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-16 text-center text-sm text-[var(--text-muted)]">
                        No disputes match these filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(item => {
                            const assignedToMe = item.joinedAdminId === currentAdminId
                            const assignedElsewhere = !!item.joinedAdminId && !assignedToMe
                            const lastMessage = item.chatRoom.messages[0]
                            const busy = actioning === item.id || actioning === `resolve:${item.id}`

                            return (
                                <article
                                    key={item.id}
                                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass[item.status]}`}>
                                                    {item.status}
                                                </span>
                                                {assignedToMe && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-[10px] font-black text-blue-400">
                                                        <UserCheck size={11} /> Joined by you
                                                    </span>
                                                )}
                                                {assignedElsewhere && (
                                                    <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] font-black text-[var(--text-muted)]">
                                                        Joined by {item.joinedAdmin ? personName(item.joinedAdmin) : "another admin"}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="mt-2 truncate text-base font-black text-[var(--text-primary)]">
                                                {item.listing.title}
                                            </h4>
                                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                Buyer: {personName(item.buyer)} · Seller: {personName(item.seller)}
                                            </p>
                                            {item.reason && (
                                                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                                    {item.reason}
                                                </p>
                                            )}
                                            {lastMessage && (
                                                <p className="mt-2 truncate text-xs text-[var(--text-muted)]">
                                                    Latest: {chatMessagePreview(lastMessage.content)}
                                                </p>
                                            )}
                                            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                                                Opened {new Date(item.createdAt).toLocaleString()}
                                                {item.resolvedAt ? ` · Resolved ${new Date(item.resolvedAt).toLocaleString()}` : ""}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {item.status === "OPEN" && !assignedElsewhere && (
                                                <button
                                                    type="button"
                                                    onClick={() => joinOrOpen(item)}
                                                    disabled={busy}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                                                >
                                                    {actioning === item.id ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <ShieldAlert size={15} />
                                                    )}
                                                    {assignedToMe ? "View case" : "Join dispute"}
                                                </button>
                                            )}

                                            {item.status === "OPEN" && assignedToMe && (
                                                <button
                                                    type="button"
                                                    onClick={() => resolve(item)}
                                                    disabled={busy}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-400 disabled:opacity-50"
                                                >
                                                    {actioning === `resolve:${item.id}` ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 size={15} />
                                                    )}
                                                    Resolve
                                                </button>
                                            )}

                                            {item.status === "RESOLVED" && assignedToMe && (
                                                <button
                                                    type="button"
                                                    onClick={() => joinOrOpen(item)}
                                                    disabled={busy}
                                                    className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-black text-[var(--text-primary)] disabled:opacity-50"
                                                >
                                                    View transcript
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
