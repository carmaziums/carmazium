"use client"

import * as React from "react"
import { AlertTriangle, FileImage, Loader2, ShieldCheck, Video } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import {
    adminReviewSaleCancellation,
    getAdminPendingSaleCancellations,
    SALE_CANCELLATION_REASON_LABELS,
    type SaleCancellationRequest,
} from "@/lib/saleCancellationApi"

export default function AdminSaleCancellationsPage() {
    const [requests, setRequests] = React.useState<SaleCancellationRequest[]>([])
    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState("")
    const filteredRequests = requests.filter(request =>
        `${request.listing?.vrm || ""} ${request.listing?.title || ""}`.replace(/\s/g, "").toLowerCase()
            .includes(search.replace(/\s/g, "").toLowerCase())
    )

    const load = React.useCallback(async () => {
        setLoading(true)
        try {
            setRequests(await getAdminPendingSaleCancellations())
            setError(null)
        } catch (err: any) {
            setError(err?.message || "Could not load cancellation reviews.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => { void load() }, [load])

    async function review(request: SaleCancellationRequest, decision: "APPROVE" | "REJECT") {
        const note = window.prompt(
            decision === "APPROVE"
                ? (request.status === "PENDING_COUNTERPARTY"
                    ? "The other party has not accepted this request. Enter the reason for your admin decision (required):"
                    : "Admin note for this approval:")
                : "Reason for rejecting this cancellation:",
            ""
        )
        if (note === null) return
        if (request.status === "PENDING_COUNTERPARTY" && !note.trim()) {
            setError("Enter an admin note when deciding before the other party responds.")
            return
        }
        let refundBuyerFee: boolean | undefined
        if (decision === "APPROVE" && request.auctionId) {
            refundBuyerFee = window.confirm(
                "Refund the £125 auction buyer fee as part of this cancellation?\n\nChoose OK to refund £125, or Cancel to approve the sale cancellation without refunding the platform fee."
            )
        }

        setBusy(request.id)
        try {
            await adminReviewSaleCancellation(request.id, decision, note || undefined, refundBuyerFee)
            await load()
        } catch (err: any) {
            setError(err?.message || "Could not complete admin review.")
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" />
                <main className="flex-1 min-w-0 space-y-6">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Marketplace controls</p>
                        <h1 className="text-3xl font-black mt-1">Sale Cancellation Review</h1>
                        <p className="text-sm text-[var(--text-muted)] mt-2">
                            All open requests appear here, including those awaiting the other party or declined by them. Admins can review the evidence and approve or reject cancellation regardless of the other party’s response. Decisions are recorded against the request.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex-1 min-w-48 text-sm font-bold">
                            Search registration or vehicle
                            <input value={search} onChange={event => setSearch(event.target.value)}
                                placeholder="Registration or vehicle name"
                                className="mt-2 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3" />
                        </label>
                        <button type="button" onClick={() => void load()} disabled={loading}
                            className="rounded-xl border border-[var(--border-default)] px-4 py-3 text-sm font-bold disabled:opacity-50">Refresh requests</button>
                    </div>

                    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}

                    {loading ? (
                        <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                            <ShieldCheck size={30} className="mx-auto text-emerald-400" />
                            <h2 className="font-black mt-3">{requests.length ? "No requests match this search" : "No open cancellation requests"}</h2>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredRequests.map(request => (
                                <article key={request.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle size={17} className="text-amber-400" />
                                                <h2 className="font-black">{request.listing?.title || "Vehicle sale"}</h2>
                                            </div>
                                            {request.listing?.vrm && <p className="font-mono font-black mt-2">{request.listing.vrm}</p>}
                                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                                {request.requestedByRole} requested · {new Date(request.createdAt).toLocaleString("en-GB")}
                                            </p>
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-amber-400">{request.status === "PENDING_COUNTERPARTY" ? "Awaiting other party" : "Admin review"}</span>
                                    </div>

                                    <div className="rounded-xl bg-[var(--bg-input)] p-4">
                                        <p className="font-bold text-sm">{SALE_CANCELLATION_REASON_LABELS[request.reason]}</p>
                                        {request.details && <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-line">{request.details}</p>}
                                        {request.counterpartResponseNote && <p className="text-xs text-[var(--text-muted)] mt-3">Counterparty: {request.counterpartResponseNote}</p>}
                                    </div>

                                    {!!request.linkedServiceJobs?.length && (
                                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                                            <p className="font-black text-sm text-red-400">Linked TradeXchange work needs separate handling</p>
                                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                                Do not assume cancelling the vehicle sale cancels paid or progressed provider work. Review these jobs separately before approving.
                                            </p>
                                            <div className="mt-3 space-y-2">
                                                {request.linkedServiceJobs.map(job => (
                                                    <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2 text-xs">
                                                        <span className="font-bold truncate">{job.title}</span>
                                                        <span className="shrink-0 font-black text-amber-400">{job.serviceType} · {job.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {request.evidence.length > 0 && (
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            {request.evidence.map(item => (
                                                <a key={item.id} href={item.url || undefined} target="_blank" rel="noreferrer"
                                                    className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-xs font-bold hover:border-primary/40">
                                                    {item.mimeType.startsWith("video/") ? <Video size={14} /> : <FileImage size={14} />}
                                                    <span className="truncate">{item.fileName}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <button
                                            type="button"
                                            disabled={busy === request.id}
                                            onClick={() => void review(request, "REJECT")}
                                            className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            Reject cancellation
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy === request.id}
                                            onClick={() => void review(request, "APPROVE")}
                                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
                                        >
                                            {busy === request.id ? "Processing…" : "Approve & reverse sale"}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
