"use client"

import * as React from "react"
import { ServiceJobChanges } from "@/components/services/ServiceJobChanges"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Loader2, ArrowLeft, AlertCircle, CheckCircle, Phone, Mail, MapPin, Play, Flag, Trash2, PoundSterling, MessageSquare } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import {
    getJob, getServiceSettings, upsertQuote, withdrawQuote, startJob, completeJob, formatPence, parseServiceQuotePence, servicePaymentEvidence, servicePaymentStatusText,
    type ServiceJob, type ServiceMarketplaceSettings,
} from "@/lib/servicesApi"
import { JobStatusBadge, RecoveryBadge, JobRoute, JobTiming, JobVehicles } from "@/components/services/JobBits"
import { getOrCreateServiceJobRoom } from "@/lib/chatApi"

/**
 * The contractor's view of one job. Before acceptance: quote or update the
 * quote. After: the customer's contact details and the start / complete
 * controls. The API redacts what this account is not entitled to; this page
 * only renders what came back.
 */
const inputCls = "w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"

export default function ContractorJobPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const { user, profile } = useAuth()
    const [job, setJob] = React.useState<ServiceJob | null>(null)
    const [settings, setSettings] = React.useState<ServiceMarketplaceSettings | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [flash, setFlash] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [amount, setAmount] = React.useState("")
    const [message, setMessage] = React.useState("")
    const [inspectionOutcome, setInspectionOutcome] = React.useState<"" | "PASS" | "FAULTS_FOUND">("")
    const [inspectionSummary, setInspectionSummary] = React.useState("")

    const load = React.useCallback(() => {
        getJob(id).then(j => {
            setJob(j)
            const mine = j.quotes?.[0]
            if (mine?.status === "ACTIVE") {
                setAmount((mine.amountPence / 100).toFixed(2)); setMessage(mine.message ?? "")
            } else { setAmount(""); setMessage("") }
            if (j.serviceType === "INSPECTION") {
                setInspectionOutcome(j.inspectionOutcome ?? "")
                setInspectionSummary(j.inspectionSummary ?? "")
            }
        }).catch(e => setError(e?.message || "Job not found"))
    }, [id])
    React.useEffect(() => { load() }, [load])
    React.useEffect(() => { getServiceSettings().then(setSettings).catch(() => setSettings(null)) }, [])

    const openJobChat = async () => {
        setBusy("chat")
        setError(null)
        try {
            const result = await getOrCreateServiceJobRoom(id)
            router.push(result.inboxUrl)
        } catch (e: any) {
            setError(e?.message || "Could not open the job conversation")
        } finally {
            setBusy(null)
        }
    }

    const run = async (key: string, fn: () => Promise<unknown>, after?: string) => {
        setBusy(key); setError(null); setFlash(null)
        try { await fn(); if (after) setFlash(after); load() }
        catch (e: any) { setError(e?.message || "Something went wrong") }
        finally { setBusy(null) }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"
    const myQuote = job?.quotes?.[0]
    const quotePence = parseServiceQuotePence(amount)
    const amountPence = quotePence ?? 0
    const isMine = job?.viewerRole === "contractor"
    const canQuote = job?.status === "OPEN" && job.canQuote === true
    const hasOpenQuote = myQuote?.status === "ACTIVE"
    const canWithdrawQuote = job?.status === "OPEN" && job.canWithdrawQuote === true && hasOpenQuote
    const platformFeePence = settings ? Math.round(amountPence * settings.platformFeeRate) : null
    const providerPence = platformFeePence == null ? null : amountPence - platformFeePence
    const paymentEvidence = servicePaymentEvidence(job?.payment, job?.agreedAmountPence)
    const canMessageCustomer = isMine && ["PAID", "IN_PROGRESS", "COMPLETED", "RELEASED", "DISPUTED"].includes(job?.status || "")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <div className="flex-1 max-w-4xl">
            {job && isMine && <ServiceJobChanges job={job} role="provider" onChange={load} />}
                    <Link href="/dashboard/service/jobs" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary mb-6"><ArrowLeft size={14} /> Jobs</Link>

                    {flash && <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-sm flex items-start gap-3"><CheckCircle size={18} className="shrink-0 mt-0.5" /> {flash}</div>}
                    {error && <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}</div>}
                    {!job && !error && <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary" /></div>}

                    {job && (
                        <div className="grid lg:grid-cols-[1fr_340px] gap-8">
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <h1 className="text-2xl md:text-3xl font-black font-heading tracking-tight">{job.title}</h1>
                                    <div className="flex items-center gap-2 shrink-0">{job.isRecovery && <RecoveryBadge />}<JobStatusBadge status={job.status} /></div>
                                </div>
                                <JobRoute job={job} className="mb-1" />
                                <div className="mb-6"><JobTiming job={job} /></div>

                                {isMine && (job.pickupAddress || job.deliveryAddress || job.serviceAddress) && (
                                    <section className="mb-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 space-y-2 text-sm">
                                        {job.pickupAddress && <p className="flex gap-2"><MapPin size={14} className="text-primary mt-0.5 shrink-0" /><span><span className="text-[var(--text-muted)]">Pickup:</span> {job.pickupAddress}, {job.pickupPostcode}</span></p>}
                                        {job.deliveryAddress && <p className="flex gap-2"><MapPin size={14} className="text-primary mt-0.5 shrink-0" /><span><span className="text-[var(--text-muted)]">Deliver to:</span> {job.deliveryAddress}, {job.deliveryPostcode}</span></p>}
                                        {job.serviceAddress && <p className="flex gap-2"><MapPin size={14} className="text-primary mt-0.5 shrink-0" /><span><span className="text-[var(--text-muted)]">Inspection location:</span> {job.serviceAddress}, {job.servicePostcode}</span></p>}
                                    </section>
                                )}

                                <section className="mb-6">
                                    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Vehicles</h2>
                                    <JobVehicles vehicles={job.vehicles} />
                                </section>
                                {job.description && (
                                    <section className="mb-6">
                                        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Customer notes</h2>
                                        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{job.description}</p>
                                    </section>
                                )}
                            </div>

                            <aside className="space-y-4">
                                {canQuote && (
                                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">{myQuote?.status === "ACTIVE" ? "Your quote" : "Quote this job"}</p>
                                        <label htmlFor="service-quote-price" className="block text-xs font-bold mb-2">Fixed price for the whole job (GBP)</label>
                                        <div className="relative mb-2">
                                            <PoundSterling size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                            <input id="service-quote-price" className={`${inputCls} pl-9 text-lg font-bold`}
                                                type="text" inputMode="decimal" maxLength={8} value={amount}
                                                onChange={e => setAmount(e.target.value)} placeholder="0.00"
                                                aria-invalid={amount.trim().length > 0 && quotePence === null}
                                                aria-describedby="service-quote-price-hint" />
                                        </div>
                                        <p id="service-quote-price-hint" className="text-[11px] text-[var(--text-muted)] mb-3">
                                            Quote £1 to £50,000 for the complete job. Include VAT if your business charges it. Up to two decimal places.
                                        </p>
                                        <textarea className={`${inputCls} resize-none mb-3`} rows={3} value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} placeholder="Collection window, vehicle type, anything that helps the customer pick you" />
                                        {amountPence >= 100 && platformFeePence != null && providerPence != null && (
                                            <p className="text-[11px] text-[var(--text-muted)] mb-3">
                                                Customer pays {formatPence(amountPence)}. CarMazium fee {formatPence(platformFeePence)}. <strong className="text-[var(--text-primary)]">You receive {formatPence(providerPence)}.</strong>
                                            </p>
                                        )}
                                        {amountPence >= 100 && platformFeePence == null && (
                                            <p className="text-[11px] text-[var(--text-muted)] mb-3">The current platform fee and provider payout will be confirmed from TradeXchange when the quote is accepted.</p>
                                        )}
                                        <Button className="w-full" disabled={busy !== null || quotePence === null}
                                            onClick={() => run("quote", () => upsertQuote(job.id, { amountPence, message: message.trim() || undefined }), hasOpenQuote ? "Quote updated." : "Quote sent. The customer has been notified.")}>
                                            {busy === "quote" ? <Loader2 className="animate-spin" size={16} /> : hasOpenQuote ? "Update quote" : "Send quote"}
                                        </Button>
                                        {canWithdrawQuote && (
                                            <button type="button" disabled={busy !== null} onClick={() => {
                                                if (!window.confirm("Withdraw this quote? The customer will no longer be able to accept it.")) return
                                                void run("withdraw", () => withdrawQuote(job.id), "Quote withdrawn.")
                                            }}
                                                className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-red-500"><Trash2 size={13} /> Withdraw quote</button>
                                        )}
                                    </div>
                                )}

                                {job.status === "OPEN" && !canQuote && (
                                    <p role="status" className="rounded-xl border border-[var(--border-default)] p-4 text-sm text-[var(--text-muted)]">
                                        New quotations are unavailable for this account. Review your service approval, insurance,
                                        payout setup and team permissions in <Link className="underline text-primary" href="/dashboard/partner">My services</Link>.
                                        Existing accepted work remains in My Work.
                                        {canWithdrawQuote && (
                                            <button type="button" disabled={busy !== null}
                                                onClick={() => {
                                                    if (!window.confirm("Withdraw this quote? The customer will no longer be able to accept it.")) return
                                                    void run("withdraw", () => withdrawQuote(job.id), "Quote withdrawn.")
                                                }}
                                                className="block font-bold text-red-600 mt-3 disabled:opacity-50">
                                                Withdraw your existing quote
                                            </button>
                                        )}
                                    </p>
                                )}

                                {isMine && job.agreedAmountPence != null && (
                                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Your payout</p>
                                        {paymentEvidence ? (
                                            <div className="space-y-2">
                                                <p className="text-3xl font-black font-heading">{formatPence(paymentEvidence.contractorPence)}</p>
                                                <dl className="text-xs border-t border-[var(--border-default)] pt-3 space-y-2">
                                                    <div className="flex justify-between gap-2"><dt>Customer total</dt><dd>{formatPence(paymentEvidence.grossPence)}</dd></div>
                                                    {paymentEvidence.refundPence > 0 && <>
                                                        <div className="flex justify-between gap-2"><dt>Recorded customer refund</dt><dd>{formatPence(paymentEvidence.refundPence)}</dd></div>
                                                        <div className="flex justify-between gap-2"><dt>Remaining service amount</dt><dd>{formatPence(paymentEvidence.netServicePence)}</dd></div>
                                                    </>}
                                                    <div className="flex justify-between gap-2"><dt>CarMazium fee (9%)</dt><dd>{formatPence(paymentEvidence.platformFeePence)}</dd></div>
                                                    <div className="flex justify-between gap-2"><dt>Provider allocation (91%)</dt><dd>{formatPence(paymentEvidence.contractorPence)}</dd></div>
                                                </dl>
                                            </div>
                                        ) : <p role="status" className="text-sm text-amber-600 dark:text-amber-300">Payment breakdown needs verification. Refresh or contact support before relying on this payout amount.</p>}
                                        <p className="text-xs text-[var(--text-muted)] mt-3">{servicePaymentStatusText(job.payment?.status)}</p>
                                    </div>
                                )}

                                {isMine && job.customer && (job.status === "PAID" || job.status === "IN_PROGRESS" || job.status === "COMPLETED" || job.status === "RELEASED" || job.status === "DISPUTED") && (
                                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Customer</p>
                                        <p className="font-heading font-bold">{job.customer.firstName} {job.customer.lastName}</p>
                                        <div className="mt-3 space-y-2 text-sm">
                                            {job.customer.phone && <a href={`tel:${job.customer.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone size={14} /> {job.customer.phone}</a>}
                                            {job.customer.email && <a href={`mailto:${job.customer.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail size={14} /> {job.customer.email}</a>}
                                        </div>
                                        {canMessageCustomer && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="mt-4 w-full"
                                                disabled={busy === "chat"}
                                                onClick={() => void openJobChat()}
                                            >
                                                {busy === "chat"
                                                    ? <Loader2 className="animate-spin" size={16} />
                                                    : <><MessageSquare size={16} className="mr-2" /> Message customer</>}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {isMine && (job.status === "PAID" || job.status === "IN_PROGRESS") && (
                                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 space-y-3">
                                        {job.status === "PAID" && (
                                            <>
                                                <Button className="w-full" disabled={busy === "start"} onClick={() => run("start", () => startJob(job.id), "Marked as started.")}>
                                                    {busy === "start" ? <Loader2 className="animate-spin" size={16} /> : <><Play size={16} className="mr-2" /> Start job</>}
                                                </Button>
                                                <p className="text-[11px] text-[var(--text-muted)] text-center">The job must be started before it can be marked complete.</p>
                                            </>
                                        )}
                                        {job.status === "IN_PROGRESS" && (
                                            <>
                                                {job.serviceType === "INSPECTION" && (
                                                    <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Inspection outcome</label>
                                                            <select
                                                                className={`${inputCls} mt-2`}
                                                                value={inspectionOutcome}
                                                                onChange={e => setInspectionOutcome(e.target.value as "" | "PASS" | "FAULTS_FOUND")}
                                                            >
                                                                <option value="">Choose outcome</option>
                                                                <option value="PASS">No refusal-triggering faults found</option>
                                                                <option value="FAULTS_FOUND">Faults found</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                                                                Inspection summary {inspectionOutcome === "FAULTS_FOUND" ? "· required" : "· optional"}
                                                            </label>
                                                            <textarea
                                                                className={`${inputCls} mt-2 resize-none`}
                                                                rows={5}
                                                                maxLength={4000}
                                                                value={inspectionSummary}
                                                                onChange={e => setInspectionSummary(e.target.value)}
                                                                placeholder="Record the inspected condition and any faults found."
                                                            />
                                                        </div>
                                                        {inspectionOutcome === "FAULTS_FOUND" && (
                                                            <p className="text-[11px] text-amber-600 dark:text-amber-300">
                                                                This outcome can make a linked auction purchase eligible for buyer refusal and a full £125 buyer-fee refund.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <Button
                                                    className="w-full"
                                                    disabled={
                                                        busy === "complete"
                                                        || (job.serviceType === "INSPECTION" && !inspectionOutcome)
                                                        || (job.serviceType === "INSPECTION" && inspectionOutcome === "FAULTS_FOUND" && !inspectionSummary.trim())
                                                    }
                                                    onClick={() => {
                                                        if (!confirm("Mark this job complete? The customer will be asked to confirm, and your payout releases on confirmation or after 48 hours.")) return
                                                        run(
                                                            "complete",
                                                            () => completeJob(job.id, job.serviceType === "INSPECTION" ? {
                                                                inspectionOutcome: inspectionOutcome || undefined,
                                                                inspectionSummary: inspectionSummary.trim() || undefined,
                                                            } : undefined),
                                                            "Marked complete. Payout releases when the customer confirms, or in 48 hours.",
                                                        )
                                                    }}
                                                >
                                                    {busy === "complete" ? <Loader2 className="animate-spin" size={16} /> : <><Flag size={16} className="mr-2" /> Mark complete</>}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}

                                {isMine && job.status === "ACCEPTED" && <p className="text-sm text-[var(--text-muted)] text-center">Your quote was accepted. Waiting for the customer to pay{settings ? ` within ${settings.acceptedPaymentTimeoutMinutes} minutes` : ""}. If payment is not completed, the job reopens safely.</p>}
                                {isMine && job.status === "COMPLETED" && <p className="text-sm text-[var(--text-muted)] text-center">Waiting for the customer to confirm. Auto-releases 48h after completion.</p>}
                                {job.status !== "OPEN" && !isMine && <p className="text-sm text-[var(--text-muted)] text-center">This job is no longer open for quotes.</p>}
                            </aside>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
