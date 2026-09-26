"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    AlertTriangle,
    CheckCircle2,
    Flag,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
    XCircle,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getAdminAiReports,
    updateAdminAiReport,
    type AdminAiReport,
    type AiReportReason,
    type AiReportStatus,
} from "@/lib/aiApi"

const REASON_LABEL: Record<AiReportReason, string> = {
    UNSAFE_OFFENSIVE: "Unsafe or offensive",
    INACCURATE_MISLEADING: "Inaccurate or misleading",
    SCAM_DISHONEST: "Scam or dishonest guidance",
    OTHER: "Other",
}

const STATUS_CLASS: Record<AiReportStatus, string> = {
    OPEN: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    REVIEWING: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
    RESOLVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    DISMISSED: "border-slate-400/30 bg-slate-400/10 text-slate-300",
}

export default function AdminAiReportsPage() {
    const router = useRouter()
    const { user, profile, loading: authLoading } = useAuth()
    const [items, setItems] = React.useState<AdminAiReport[]>([])
    const [status, setStatus] = React.useState<"" | AiReportStatus>("OPEN")
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) router.replace("/auth/login")
            else if (profile?.role !== "ADMIN") router.replace("/dashboard")
        }
    }, [authLoading, user, profile, router])

    const load = React.useCallback(async () => {
        if (profile?.role !== "ADMIN") return
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminAiReports(1, 100, status)
            setItems(result.data)
        } catch (err: any) {
            setError(err?.message || "Could not load AI reports.")
        } finally {
            setLoading(false)
        }
    }, [profile?.role, status])

    React.useEffect(() => {
        void load()
    }, [load])

    const update = async (item: AdminAiReport, next: AiReportStatus) => {
        try {
            setUpdatingId(item.id)
            setError(null)
            const updated = await updateAdminAiReport(item.id, next)
            setItems(prev => prev.map(row => row.id === item.id ? updated : row))
        } catch (err: any) {
            setError(err?.message || "Could not update this report.")
        } finally {
            setUpdatingId(null)
        }
    }

    if (authLoading || (user && !profile)) {
        return <div className="min-h-screen grid place-items-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== "ADMIN") return null

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : (user.email?.split("@")[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-24">
            <div className="container mx-auto px-4 sm:px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 min-w-0 space-y-6">
                    <section className="rounded-[26px] border border-violet-400/20 bg-gradient-to-br from-violet-500/12 via-slate-900/40 to-fuchsia-500/10 p-5 sm:p-7">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                                    <Sparkles size={14} /> MaziuM AI safety
                                </div>
                                <h1 className="mt-2 text-3xl sm:text-4xl font-black text-[var(--text-primary)]">AI response reports</h1>
                                <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
                                    Review user-flagged MaziuM responses. Reports contain the reported AI text and, when available, the prompt that produced it.
                                </p>
                            </div>
                            <button
                                onClick={() => void load()}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] disabled:opacity-50"
                            >
                                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
                            </button>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                                <Search size={15} /> Queue
                            </div>
                            <select
                                value={status}
                                onChange={event => setStatus(event.target.value as "" | AiReportStatus)}
                                className="sm:ml-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            >
                                <option value="OPEN">Open</option>
                                <option value="REVIEWING">Reviewing</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="DISMISSED">Dismissed</option>
                                <option value="">All</option>
                            </select>
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-10 text-center">
                            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-10 text-center">
                            <ShieldAlert className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                            <p className="mt-3 font-bold text-[var(--text-primary)]">No AI reports in this view</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {items.map(item => {
                                const busy = updatingId === item.id
                                return (
                                    <article key={item.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${STATUS_CLASS[item.status]}`}>{item.status}</span>
                                            <span className="rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-[10px] font-black text-red-300">
                                                {REASON_LABEL[item.reason]}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{item.surface}</span>
                                            <span className="ml-auto text-xs text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</span>
                                        </div>

                                        {item.prompt && (
                                            <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                                                <p className="text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">User prompt</p>
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{item.prompt}</p>
                                            </div>
                                        )}

                                        <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-violet-300">
                                                <Sparkles size={12} /> Reported AI response
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{item.response}</p>
                                        </div>

                                        {item.details && (
                                            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                                                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
                                                <p className="text-xs leading-5 text-[var(--text-secondary)]">{item.details}</p>
                                            </div>
                                        )}

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {item.status === "OPEN" && (
                                                <button
                                                    onClick={() => void update(item, "REVIEWING")}
                                                    disabled={busy}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-300 disabled:opacity-50"
                                                >
                                                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Flag size={13} />} Start review
                                                </button>
                                            )}
                                            {item.status === "REVIEWING" && (
                                                <>
                                                    <button
                                                        onClick={() => void update(item, "RESOLVED")}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-50"
                                                    >
                                                        <CheckCircle2 size={13} /> Resolve
                                                    </button>
                                                    <button
                                                        onClick={() => void update(item, "DISMISSED")}
                                                        disabled={busy}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-400/30 bg-slate-400/10 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-50"
                                                    >
                                                        <XCircle size={13} /> Dismiss
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
