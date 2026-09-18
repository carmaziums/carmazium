"use client"

import * as React from "react"
import {
    CheckCircle2,
    Eye,
    Flag,
    Loader2,
    RefreshCw,
    Search,
    ShieldCheck,
    XCircle,
} from "lucide-react"
import {
    getAdminChatReports,
    updateAdminChatReport,
    type AdminChatReport,
    type AdminChatReportReason,
    type AdminChatReportStatus,
} from "@/lib/adminApi"

interface AdminChatModerationQueueProps {
    currentAdminId: string
}

const STATUS_CLASS: Record<AdminChatReportStatus, string> = {
    OPEN: "border-red-500/30 bg-red-500/10 text-red-400",
    REVIEWING: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    RESOLVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    DISMISSED: "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)]",
}

const REASON_LABEL: Record<AdminChatReportReason, string> = {
    HARASSMENT: "Harassment",
    SCAM_FRAUD: "Scam / fraud",
    SPAM: "Spam",
    INAPPROPRIATE_CONTENT: "Inappropriate content",
    OTHER: "Other",
}

function personName(person: {
    firstName: string | null
    lastName: string | null
    email: string
}) {
    return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.email
}

export function AdminChatModerationQueue({
    currentAdminId,
}: AdminChatModerationQueueProps) {
    const [items, setItems] = React.useState<AdminChatReport[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [actioning, setActioning] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [status, setStatus] = React.useState<"" | AdminChatReportStatus>("OPEN")

    const load = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminChatReports(
                1,
                100,
                status || undefined,
                search.trim() || undefined,
            )
            setItems(result.data)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not load reported messages")
            }
        } finally {
            setLoading(false)
        }
    }, [search, status])

    React.useEffect(() => {
        const timer = window.setTimeout(load, 250)
        return () => window.clearTimeout(timer)
    }, [load])

    const changeStatus = async (
        item: AdminChatReport,
        next: Exclude<AdminChatReportStatus, "OPEN">,
    ) => {
        try {
            setActioning(`${next}:${item.id}`)
            setError(null)
            await updateAdminChatReport(item.id, next)
            await load()
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not update this report")
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
                            <ShieldCheck size={14} /> Evidence-scoped moderation
                        </div>
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">Reported messages</h3>
                        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
                            Review the exact message a member reported. Private surrounding conversation history is not exposed here.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-xl border border-[var(--border-default)] p-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Refresh reports"
                    >
                        <RefreshCw size={17} />
                    </button>
                </div>

                <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(240px,1fr)_190px]">
                    <label className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search message, vehicle or email"
                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm"
                        />
                    </label>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as "" | AdminChatReportStatus)}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                    >
                        <option value="OPEN">Open reports</option>
                        <option value="REVIEWING">In review</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="DISMISSED">Dismissed</option>
                        <option value="">All reports</option>
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
                        No reported messages match these filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map(item => {
                            const assignedElsewhere =
                                item.status === "REVIEWING" &&
                                !!item.reviewedById &&
                                item.reviewedById !== currentAdminId
                            const busy = actioning?.endsWith(`:${item.id}`) ?? false

                            return (
                                <article
                                    key={item.id}
                                    className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${STATUS_CLASS[item.status]}`}>
                                                    {item.status}
                                                </span>
                                                <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] font-bold text-[var(--text-muted)]">
                                                    {REASON_LABEL[item.reason]}
                                                </span>
                                                <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-[10px] font-bold text-[var(--text-muted)]">
                                                    {item.roomContext}
                                                </span>
                                            </div>

                                            <h4 className="mt-2 text-sm font-black text-[var(--text-primary)]">
                                                {item.listingTitle || "Vehicle conversation"}
                                            </h4>
                                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                Reported by {personName(item.reporter)} · Message from {personName(item.reportedUser)}
                                            </p>

                                            <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                                                    <Flag size={12} /> Reported message
                                                </div>
                                                {item.attachmentPath && (
                                                    <div className="mb-3 overflow-hidden rounded-lg bg-black/10">
                                                        {item.attachmentUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={item.attachmentUrl}
                                                                alt={item.attachmentName || "Reported chat attachment"}
                                                                className="block max-h-[420px] w-auto max-w-full object-contain"
                                                            />
                                                        ) : (
                                                            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                                                                Reported attachment is temporarily unavailable.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]">
                                                    {item.messageContent || (item.attachmentPath ? "Photo message" : "Empty message")}
                                                </p>
                                            </div>

                                            {item.details && (
                                                <div className="mt-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                                                    <p className="text-[10px] font-black uppercase tracking-wide text-primary">Reporter details</p>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{item.details}</p>
                                                </div>
                                            )}

                                            {item.reviewedBy && (
                                                <p className="mt-2 text-xs text-[var(--text-muted)]">
                                                    {item.status === "REVIEWING" ? "In review by" : "Reviewed by"} {personName(item.reviewedBy)}
                                                    {item.reviewedAt ? ` · ${new Date(item.reviewedAt).toLocaleString()}` : ""}
                                                </p>
                                            )}
                                            {item.adminNote && (
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                    Internal note: {item.adminNote}
                                                </p>
                                            )}
                                            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                                                Reported {new Date(item.createdAt).toLocaleString()} · Evidence ID {item.messageId.slice(0, 8)}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {item.status === "OPEN" && (
                                                <button
                                                    type="button"
                                                    onClick={() => changeStatus(item, "REVIEWING")}
                                                    disabled={busy}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                                                >
                                                    {actioning === `REVIEWING:${item.id}` ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <Eye size={15} />
                                                    )}
                                                    Start review
                                                </button>
                                            )}

                                            {item.status === "REVIEWING" && !assignedElsewhere && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => changeStatus(item, "RESOLVED")}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-400 disabled:opacity-50"
                                                    >
                                                        {actioning === `RESOLVED:${item.id}` ? (
                                                            <Loader2 size={15} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 size={15} />
                                                        )}
                                                        Resolve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => changeStatus(item, "DISMISSED")}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-black text-[var(--text-secondary)] disabled:opacity-50"
                                                    >
                                                        {actioning === `DISMISSED:${item.id}` ? (
                                                            <Loader2 size={15} className="animate-spin" />
                                                        ) : (
                                                            <XCircle size={15} />
                                                        )}
                                                        Dismiss
                                                    </button>
                                                </>
                                            )}

                                            {assignedElsewhere && (
                                                <span className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400">
                                                    In review by another admin
                                                </span>
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
