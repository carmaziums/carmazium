"use client"

import * as React from "react"
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    Clock3,
    Loader2,
    RefreshCw,
    Search,
    Send,
    XCircle,
} from "lucide-react"
import {
    cancelAdminScheduledBroadcast,
    getAdminBroadcastAnalytics,
    getAdminBroadcastCampaign,
    getAdminBroadcastCampaigns,
    retryAdminBroadcastFailures,
    sendAdminScheduledBroadcastNow,
    type AdminBroadcastAnalytics,
    type AdminBroadcastCampaign,
    type AdminBroadcastCampaignDetail,
    type BroadcastCampaignStatus,
} from "@/lib/adminApi"

const statusClass: Record<string, string> = {
    SCHEDULED: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    FAILED: "border-red-500/30 bg-red-500/10 text-red-400",
    CANCELLED: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    SENDING: "border-blue-500/30 bg-blue-500/10 text-blue-400",
}

const STATUS_OPTIONS: Array<{ value: "" | BroadcastCampaignStatus; label: string }> = [
    { value: "", label: "All statuses" },
    { value: "SCHEDULED", label: "Scheduled" },
    { value: "SENDING", label: "Sending" },
    { value: "COMPLETED", label: "Completed" },
    { value: "PARTIAL", label: "Partial" },
    { value: "FAILED", label: "Failed" },
    { value: "CANCELLED", label: "Cancelled" },
]

function startIso(value: string) {
    if (!value) return undefined
    const date = new Date(`${value}T00:00:00`)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function endIso(value: string) {
    if (!value) return undefined
    const date = new Date(`${value}T23:59:59.999`)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function campaignLabel(campaign: AdminBroadcastCampaign) {
    if (campaign.status === "SCHEDULED" && campaign.scheduledAt) {
        return `Scheduled for ${new Date(campaign.scheduledAt).toLocaleString()}`
    }
    if (campaign.status === "CANCELLED" && campaign.cancelledAt) {
        return `Cancelled ${new Date(campaign.cancelledAt).toLocaleString()}`
    }
    if (campaign.finishedAt) {
        return `Finished ${new Date(campaign.finishedAt).toLocaleString()}`
    }
    if (campaign.startedAt) {
        return `Started ${new Date(campaign.startedAt).toLocaleString()}`
    }
    return new Date(campaign.createdAt).toLocaleString()
}

export function AdminBroadcastHistory() {
    const [campaigns, setCampaigns] = React.useState<AdminBroadcastCampaign[]>([])
    const [analytics, setAnalytics] = React.useState<AdminBroadcastAnalytics | null>(null)
    const [selected, setSelected] = React.useState<AdminBroadcastCampaignDetail | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null)
    const [actioning, setActioning] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const [status, setStatus] = React.useState<"" | BroadcastCampaignStatus>("")
    const [fromDate, setFromDate] = React.useState("")
    const [toDate, setToDate] = React.useState("")

    const load = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const from = startIso(fromDate)
            const to = endIso(toDate)
            const [history, summary] = await Promise.all([
                getAdminBroadcastCampaigns(1, 50, {
                    search: search.trim() || undefined,
                    status: status || undefined,
                    from,
                    to,
                }),
                getAdminBroadcastAnalytics(from, to),
            ])
            setCampaigns(history.data)
            setAnalytics(summary)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not load broadcast history")
            }
        } finally {
            setLoading(false)
        }
    }, [search, status, fromDate, toDate])

    React.useEffect(() => {
        const timer = window.setTimeout(load, 250)
        return () => window.clearTimeout(timer)
    }, [load])

    const open = async (campaign: AdminBroadcastCampaign) => {
        try {
            setLoadingDetail(campaign.id)
            setError(null)
            setSelected(await getAdminBroadcastCampaign(campaign.id))
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") {
                setError(err?.message || "Could not load campaign deliveries")
            }
        } finally {
            setLoadingDetail(null)
        }
    }

    const refreshSelectedAndList = async (campaignId: string) => {
        const [detail] = await Promise.all([
            getAdminBroadcastCampaign(campaignId),
            load(),
        ])
        setSelected(detail)
    }

    const retry = async () => {
        if (!selected?.failed) return
        try {
            setActioning("retry")
            setError(null)
            await retryAdminBroadcastFailures(selected.id)
            await refreshSelectedAndList(selected.id)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Retry failed")
        } finally {
            setActioning(null)
        }
    }

    const cancelScheduled = async () => {
        if (!selected || selected.status !== "SCHEDULED") return
        try {
            setActioning("cancel")
            setError(null)
            await cancelAdminScheduledBroadcast(selected.id)
            await refreshSelectedAndList(selected.id)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Scheduled broadcast could not be cancelled")
        } finally {
            setActioning(null)
        }
    }

    const sendNow = async () => {
        if (!selected || selected.status !== "SCHEDULED") return
        try {
            setActioning("send-now")
            setError(null)
            await sendAdminScheduledBroadcastNow(selected.id)
            await refreshSelectedAndList(selected.id)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Scheduled broadcast could not be sent")
        } finally {
            setActioning(null)
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-6xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                            <Send size={14} /> Campaign operations
                        </div>
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">Broadcast history</h3>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                            Search campaigns, manage scheduled sends and review delivery performance.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-xl border border-[var(--border-default)] p-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                        <RefreshCw size={17} />
                    </button>
                </div>

                {analytics && (
                    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Campaigns</p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{analytics.totalCampaigns.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Scheduled</p>
                            <p className="mt-1 text-2xl font-black text-violet-400">{analytics.scheduledCampaigns.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Delivered</p>
                            <p className="mt-1 text-2xl font-black text-emerald-400">{analytics.sentRecipients.toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Success rate</p>
                            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {analytics.deliverySuccessRate == null ? "—" : `${analytics.deliverySuccessRate.toFixed(2)}%`}
                            </p>
                        </div>
                    </div>
                )}

                <div className="mb-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 sm:p-4">
                    <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_150px_150px]">
                        <label className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search message, media or audience"
                                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm"
                            />
                        </label>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value as "" | BroadcastCampaignStatus)}
                            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                        >
                            {STATUS_OPTIONS.map(option => (
                                <option key={option.value || "all"} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(event) => setFromDate(event.target.value)}
                            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                            title="From date"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(event) => setToDate(event.target.value)}
                            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm"
                            title="To date"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-16 text-center text-sm text-[var(--text-muted)]">
                        No broadcasts match these filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {campaigns.map(campaign => (
                            <button
                                key={campaign.id}
                                type="button"
                                onClick={() => open(campaign)}
                                className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left transition-colors hover:border-primary/30"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-black uppercase tracking-wide text-primary">
                                            {campaign.audience.replaceAll("_", " ")}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                                            {campaign.text || (campaign.mediaKind === "VIDEO" ? "Video broadcast" : "Photo broadcast")}
                                        </p>
                                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                            {campaign.status === "SCHEDULED" ? <CalendarClock size={12} /> : <Clock3 size={12} />}
                                            {campaignLabel(campaign)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass[campaign.status] || ""}`}>
                                            {campaign.status}
                                        </span>
                                        {loadingDetail === campaign.id && <Loader2 size={15} className="animate-spin text-primary" />}
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                        <p className="text-lg font-black">{campaign.requested}</p>
                                        <p className="text-[10px] uppercase text-[var(--text-muted)]">Recipients</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                        <p className="text-lg font-black text-emerald-400">{campaign.sent}</p>
                                        <p className="text-[10px] uppercase text-[var(--text-muted)]">Sent</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                        <p className="text-lg font-black text-red-400">{campaign.failed}</p>
                                        <p className="text-[10px] uppercase text-[var(--text-muted)]">Failed</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {selected && (
                    <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-black text-[var(--text-primary)]">Recipient delivery details</h4>
                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${statusClass[selected.status] || ""}`}>
                                        {selected.status}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    {selected.deliveries.length} locked recipient record{selected.deliveries.length === 1 ? "" : "s"}
                                    {selected.scheduledAt ? ` · Scheduled ${new Date(selected.scheduledAt).toLocaleString()}` : ""}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {selected.status === "SCHEDULED" && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={cancelScheduled}
                                            disabled={!!actioning}
                                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-400 disabled:opacity-50"
                                        >
                                            {actioning === "cancel" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                                            Cancel schedule
                                        </button>
                                        <button
                                            type="button"
                                            onClick={sendNow}
                                            disabled={!!actioning}
                                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                                        >
                                            {actioning === "send-now" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                            Send now
                                        </button>
                                    </>
                                )}

                                {selected.failed > 0 && !["SCHEDULED", "CANCELLED"].includes(selected.status) && (
                                    <button
                                        type="button"
                                        onClick={retry}
                                        disabled={!!actioning}
                                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                                    >
                                        {actioning === "retry" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                        Retry {selected.failed} failed
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                <p className="text-lg font-black">{selected.requested}</p>
                                <p className="text-[10px] uppercase text-[var(--text-muted)]">Locked</p>
                            </div>
                            <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                <p className="text-lg font-black text-emerald-400">{selected.sent}</p>
                                <p className="text-[10px] uppercase text-[var(--text-muted)]">Sent</p>
                            </div>
                            <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                <p className="text-lg font-black text-red-400">{selected.failed}</p>
                                <p className="text-[10px] uppercase text-[var(--text-muted)]">Failed</p>
                            </div>
                        </div>

                        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
                            {selected.deliveries.map(delivery => {
                                const name = `${delivery.user.firstName ?? ""} ${delivery.user.lastName ?? ""}`.trim() || delivery.user.email
                                return (
                                    <div key={delivery.id} className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
                                        <div className="mt-0.5">
                                            {delivery.status === "SENT" ? <CheckCircle2 size={16} className="text-emerald-400" /> :
                                                delivery.status === "FAILED" ? <XCircle size={16} className="text-red-400" /> :
                                                <AlertTriangle size={16} className="text-amber-400" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{name}</p>
                                            <p className="truncate text-xs text-[var(--text-muted)]">
                                                {delivery.user.email} · {delivery.user.role.replaceAll("_", " ")}
                                            </p>
                                            {delivery.error && <p className="mt-1 break-words text-xs text-red-300">{delivery.error}</p>}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">{delivery.status}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
