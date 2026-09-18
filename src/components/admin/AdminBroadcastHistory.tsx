"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react"
import {
    getAdminBroadcastCampaign,
    getAdminBroadcastCampaigns,
    retryAdminBroadcastFailures,
    type AdminBroadcastCampaign,
    type AdminBroadcastCampaignDetail,
} from "@/lib/adminApi"

const statusClass: Record<string, string> = {
    COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    FAILED: "border-red-500/30 bg-red-500/10 text-red-400",
    SENDING: "border-blue-500/30 bg-blue-500/10 text-blue-400",
}

export function AdminBroadcastHistory() {
    const [campaigns, setCampaigns] = React.useState<AdminBroadcastCampaign[]>([])
    const [selected, setSelected] = React.useState<AdminBroadcastCampaignDetail | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null)
    const [retrying, setRetrying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminBroadcastCampaigns(1, 50)
            setCampaigns(result.data)
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Could not load broadcast history")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    const open = async (campaign: AdminBroadcastCampaign) => {
        try {
            setLoadingDetail(campaign.id)
            setError(null)
            setSelected(await getAdminBroadcastCampaign(campaign.id))
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Could not load campaign deliveries")
        } finally {
            setLoadingDetail(null)
        }
    }

    const retry = async () => {
        if (!selected?.failed) return
        try {
            setRetrying(true)
            setError(null)
            const updated = await retryAdminBroadcastFailures(selected.id)
            setSelected(updated)
            setCampaigns(prev => prev.map(item => item.id === updated.id ? updated : item))
        } catch (err: any) {
            if (err?.message !== "AUTH_REDIRECT") setError(err?.message || "Retry failed")
        } finally {
            setRetrying(false)
        }
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <div className="mx-auto max-w-5xl">
                <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                            <Send size={14} /> Campaign operations
                        </div>
                        <h3 className="text-2xl font-black text-[var(--text-primary)]">Broadcast history</h3>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">Delivery totals and failed-recipient retry history.</p>
                    </div>
                    <button type="button" onClick={load} className="rounded-xl border border-[var(--border-default)] p-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <RefreshCw size={17} />
                    </button>
                </div>

                {error && <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
                ) : campaigns.length === 0 ? (
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] py-16 text-center text-sm text-[var(--text-muted)]">No broadcasts have been sent yet.</div>
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
                                        <p className="text-xs font-black uppercase tracking-wide text-primary">{campaign.audience.replaceAll("_", " ")}</p>
                                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                                            {campaign.text || (campaign.mediaKind === "VIDEO" ? "Video broadcast" : "Photo broadcast")}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                            {new Date(campaign.createdAt).toLocaleString()}
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
                                        <p className="text-lg font-black">{campaign.requested}</p><p className="text-[10px] uppercase text-[var(--text-muted)]">Requested</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                        <p className="text-lg font-black text-emerald-400">{campaign.sent}</p><p className="text-[10px] uppercase text-[var(--text-muted)]">Sent</p>
                                    </div>
                                    <div className="rounded-xl bg-[var(--bg-input)] px-2 py-2">
                                        <p className="text-lg font-black text-red-400">{campaign.failed}</p><p className="text-[10px] uppercase text-[var(--text-muted)]">Failed</p>
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
                                <h4 className="font-black text-[var(--text-primary)]">Recipient delivery details</h4>
                                <p className="text-xs text-[var(--text-muted)]">{selected.deliveries.length} recipient records</p>
                            </div>
                            {selected.failed > 0 && (
                                <button
                                    type="button"
                                    onClick={retry}
                                    disabled={retrying}
                                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                                >
                                    {retrying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                                    Retry {selected.failed} failed
                                </button>
                            )}
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
                                            <p className="truncate text-xs text-[var(--text-muted)]">{delivery.user.email} · {delivery.user.role.replaceAll("_", " ")}</p>
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
