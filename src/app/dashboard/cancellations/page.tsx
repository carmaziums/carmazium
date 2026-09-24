"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle2, FileImage, Loader2, RotateCcw, ShieldCheck, Video, XCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getMySaleCancellations,
    respondToSaleCancellation,
    SALE_CANCELLATION_REASON_LABELS,
    withdrawSaleCancellation,
    type SaleCancellationRequest,
} from "@/lib/saleCancellationApi"

const STATUS_LABEL: Record<string, string> = {
    PENDING_COUNTERPARTY: "Waiting for other party",
    PENDING_ADMIN: "Waiting for CarMazium review",
    APPROVED: "Cancelled",
    REJECTED: "Cancellation declined",
    WITHDRAWN: "Request withdrawn",
}

function Evidence({ request }: { request: SaleCancellationRequest }) {
    if (!request.evidence.length) {
        return <p className="text-xs text-[var(--text-muted)]">No evidence attached.</p>
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {request.evidence.map(item => (
                <a
                    key={item.id}
                    href={item.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 hover:border-primary/40 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        {item.mimeType.startsWith("video/") ? <Video size={15} className="text-violet-400" /> : <FileImage size={15} className="text-blue-400" />}
                        <span className="text-xs font-bold truncate flex-1">{item.fileName}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        {(item.sizeBytes / 1024 / 1024).toFixed(1)} MB · private evidence
                    </p>
                </a>
            ))}
        </div>
    )
}

export default function SaleCancellationsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [requests, setRequests] = React.useState<SaleCancellationRequest[]>([])
    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)

    const load = React.useCallback(async () => {
        if (!user) return
        setLoading(true)
        try {
            setRequests(await getMySaleCancellations())
            setError(null)
        } catch (err: any) {
            setError(err?.message || "Could not load cancellation requests.")
        } finally {
            setLoading(false)
        }
    }, [user])

    React.useEffect(() => {
        if (!authLoading && user) void load()
    }, [authLoading, user, load])

    async function respond(request: SaleCancellationRequest, decision: "ACCEPT" | "REJECT") {
        const note = window.prompt(
            decision === "ACCEPT"
                ? "Optional note confirming the cancellation:"
                : "Why are you declining the cancellation request?",
            ""
        )
        if (note === null) return
        setBusy(request.id)
        try {
            await respondToSaleCancellation(request.id, decision, note || undefined)
            await load()
        } catch (err: any) {
            setError(err?.message || "Could not update the cancellation request.")
        } finally {
            setBusy(null)
        }
    }

    async function withdraw(request: SaleCancellationRequest) {
        if (!window.confirm("Withdraw this cancellation request and keep the sale in place?")) return
        setBusy(request.id)
        try {
            await withdrawSaleCancellation(request.id)
            await load()
        } catch (err: any) {
            setError(err?.message || "Could not withdraw the request.")
        } finally {
            setBusy(null)
        }
    }

    const sidebarRole =
        profile?.role === "DEALER" ? "dealer"
        : profile?.role === "SELLER" ? "seller"
        : "buyer"

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role={sidebarRole} />
                <main className="flex-1 min-w-0 space-y-6">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Buyer & seller protection</p>
                        <h1 className="text-3xl font-black mt-1">Cancellation Requests</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-2 max-w-3xl">
                            Sale cancellations are recorded here with the reason, evidence and decision history. Neither party can silently erase a completed deal.
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    ) : requests.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                            <ShieldCheck size={30} className="mx-auto text-[var(--text-muted)]" />
                            <h2 className="font-black mt-3">No cancellation requests</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Any request involving you will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map(request => {
                                const pending = request.status === "PENDING_COUNTERPARTY" || request.status === "PENDING_ADMIN"
                                const Icon = request.status === "APPROVED" ? CheckCircle2
                                    : request.status === "REJECTED" ? XCircle
                                    : request.status === "WITHDRAWN" ? RotateCcw
                                    : AlertTriangle
                                return (
                                    <article key={request.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-5">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Icon size={17} className={pending ? "text-amber-400" : request.status === "APPROVED" ? "text-emerald-400" : "text-[var(--text-muted)]"} />
                                                    <h2 className="font-black">{request.listing?.title || "Vehicle sale"}</h2>
                                                    {request.listing?.vrm && <span className="text-xs font-mono text-[var(--text-muted)]">{request.listing.vrm}</span>}
                                                </div>
                                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                                    Opened {new Date(request.createdAt).toLocaleString("en-GB")}
                                                    {" · "}
                                                    {request.requestedByRole === "BUYER" ? "Buyer requested" : "Seller requested"}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-[var(--border-default)] px-3 py-1 text-xs font-black">
                                                {STATUS_LABEL[request.status] || request.status}
                                            </span>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="rounded-xl bg-[var(--bg-input)] p-4">
                                                <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Reason</p>
                                                <p className="text-sm font-bold mt-1">{SALE_CANCELLATION_REASON_LABELS[request.reason]}</p>
                                                {request.details && <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-line">{request.details}</p>}
                                            </div>
                                            <div className="rounded-xl bg-[var(--bg-input)] p-4">
                                                <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)]">Outcome / notes</p>
                                                <p className="text-sm text-[var(--text-secondary)] mt-1">
                                                    {request.counterpartResponseNote || request.adminNote || (
                                                        request.status === "PENDING_ADMIN"
                                                            ? "The request needs CarMazium review before the transaction can be reversed."
                                                            : request.status === "PENDING_COUNTERPARTY"
                                                                ? "Waiting for the other party to respond."
                                                                : "No additional note."
                                                    )}
                                                </p>
                                                {request.buyerFeeRefunded && <p className="text-xs font-bold text-emerald-400 mt-2">£125 auction buyer fee refunded.</p>}
                                                {request.sellerBonusRecoveryRequired && <p className="text-xs font-bold text-amber-400 mt-2">Seller bonus recovery requires admin reconciliation.</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-black text-[var(--text-muted)] mb-2">Evidence</p>
                                            <Evidence request={request} />
                                        </div>

                                        {(request.viewer?.canRespond || request.viewer?.canWithdraw) && (
                                            <div className="flex flex-wrap gap-2 border-t border-[var(--border-default)] pt-4">
                                                {request.viewer?.canRespond && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            disabled={busy === request.id}
                                                            onClick={() => void respond(request, "REJECT")}
                                                            className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                                        >
                                                            Decline cancellation
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busy === request.id}
                                                            onClick={() => void respond(request, "ACCEPT")}
                                                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                                                        >
                                                            {busy === request.id ? "Updating…" : "Agree & cancel sale"}
                                                        </button>
                                                    </>
                                                )}
                                                {request.viewer?.canWithdraw && (
                                                    <button
                                                        type="button"
                                                        disabled={busy === request.id}
                                                        onClick={() => void withdraw(request)}
                                                        className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                                                    >
                                                        Withdraw my request
                                                    </button>
                                                )}
                                            </div>
                                        )}
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
