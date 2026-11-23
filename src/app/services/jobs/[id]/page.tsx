"use client"

import * as React from "react"
import { ServiceJobChanges } from "@/components/services/ServiceJobChanges"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
    Loader2, ArrowLeft, Star, CheckCircle, AlertCircle, ShieldCheck, Phone, Mail, XCircle, Clock, Banknote, MessageSquare, RefreshCw,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { customerServiceNextStep, inspectionRefusalNotice } from "@/lib/serviceJobJourney"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { Button } from "@/components/ui/Button"
import {
    getJob, acceptQuote, confirmCompletion, disputeJob, cancelJob, createServiceReview, formatPence,
    comparableServiceQuotes, isServiceQuoteSelectable, classifyServiceCheckoutTarget,
    servicePaymentEvidence, servicePaymentStatusText, serviceCompletionReview,
    type ServiceJob, type ServiceQuote,
} from "@/lib/servicesApi"
import { JobStatusBadge, RecoveryBadge, JobRoute, JobTiming, JobVehicles } from "@/components/services/JobBits"
import { getOrCreateServiceJobRoom } from "@/lib/chatApi"
import { refuseAuctionAfterInspection } from "@/lib/auctionApi"
import { checkoutPaymentNotice } from "@/lib/tradeXchangeCheckoutNotice"
import { formatUkServiceDateTime } from "@/lib/ukServiceDateTime"

/**
 * The customer's view of one TradeXchange service job. Quotes can be compared
 * before payment, then the customer can confirm completion or raise a dispute.
 *
 * A provider following a notification link here is sent to their provider view
 * at /dashboard/service/jobs/[id] — same job, different actions and visibility.
 */
function JobDetail({ id }: { id: string }) {
    const router = useRouter()
    const params = useSearchParams()
    const [job, setJob] = React.useState<ServiceJob | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const checkoutPending = React.useRef(false)
    const actionPending = React.useRef(false)
    const generation = React.useRef(0)
    const [loading, setLoading] = React.useState(false)
    const [reviewRating, setReviewRating] = React.useState(0)
    const [reviewComment, setReviewComment] = React.useState("")
    const [flash, setFlash] = React.useState<string | null>(
        params.get("posted") ? "Job posted. It will stay open for matching verified providers to quote — we will email you as prices come in."
            : params.get("paid") === "0" ? "Checkout was cancelled. Your quote is still accepted — pay when you are ready."
                : null,
    )

    const load = React.useCallback(async (preserveError = true) => {
        const request = ++generation.current
        setLoading(true)
        if (!preserveError) setError(null)
        try {
            const next = await getJob(id)
            if (request !== generation.current) return
            if (next.viewerRole === "contractor" || next.viewerRole === "bidder") {
                router.replace(`/dashboard/service/jobs/${id}`)
                return
            }
            setJob(next)
        } catch (e: unknown) {
            if (request === generation.current) setError(current => current || (e instanceof Error ? e.message : "Request not found"))
        } finally {
            if (request === generation.current) setLoading(false)
        }
    }, [id, router])

    React.useEffect(() => {
        void load()
        return () => { generation.current++ }
    }, [load])

    // If we came back from Stripe, the webhook may land a beat after we do.
    // Poll briefly so the page catches up without a manual refresh.
    React.useEffect(() => {
        if (params.get("paid") !== "1" || job?.status !== "ACCEPTED") return
        const t = setInterval(load, 2500)
        const stop = setTimeout(() => clearInterval(t), 30000)
        return () => { clearInterval(t); clearTimeout(stop) }
    }, [params, job?.status, load])

    const openJobChat = async () => {
        if (actionPending.current || checkoutPending.current || busy !== null) return
        actionPending.current = true
        setBusy("chat")
        setError(null)
        try {
            const result = await getOrCreateServiceJobRoom(id)
            router.push(result.inboxUrl)
        } catch (e: any) {
            setError(e?.message || "Could not open the job conversation")
        } finally {
            actionPending.current = false
            setBusy(null)
        }
    }

    const run = async (key: string, fn: () => Promise<void>, after?: string) => {
        if (actionPending.current || checkoutPending.current || busy !== null) return
        actionPending.current = true
        setBusy(key); setError(null); setFlash(null)
        try { await fn(); if (after) setFlash(after); await load() }
        catch (e: any) { setError(e?.message || "Something went wrong"); await load() }
        finally { actionPending.current = false; setBusy(null) }
    }

    // A synchronous latch prevents a second tap choosing a different provider
    // while the first acceptance/Checkout request is still in flight.
    const startCheckout = async (quote: ServiceQuote, resume = false) => {
        if (!job || checkoutPending.current || busy !== null || actionPending.current) return
        if (resume) {
            if (job.status !== "ACCEPTED" || job.acceptedQuoteId !== quote.id || job.payment?.status !== "PENDING") {
                setError("This job is no longer awaiting checkout. Refresh the job for its current payment status.")
                load()
                return
            }
        } else {
            if (job.status !== "OPEN" || !isServiceQuoteSelectable(quote)) {
                setError("This quote is no longer available. Refresh the job to compare current offers.")
                load()
                return
            }
            const provider = quote.contractor?.businessName || quote.contractor?.user.firstName || "this provider"
            if (!window.confirm(`Choose ${provider} for ${formatPence(quote.amountPence)}?\n\nOnly this quote will be accepted. Secure checkout opens next; the provider must not start until payment is confirmed.`)) return
        }
        checkoutPending.current = true
        setBusy(quote.id)
        setError(null)
        try {
            const url = await acceptQuote(job.id, quote.id)
            const target = classifyServiceCheckoutTarget(url, job.id)
            if (target === "JOB_RETURN") {
                // Stripe already reported this existing session as paid. Never
                // open a second Checkout; re-read server-recorded payment state.
                setFlash("The previous checkout was completed. Refreshing the confirmed payment status.")
                await load()
                return
            }
            if (target !== "STRIPE_CHECKOUT") {
                throw new Error("Secure checkout could not be verified. Please refresh and try again.")
            }
            window.location.assign(url)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Could not open secure checkout.")
            // Accept may have committed before Stripe became unavailable. Never
            // leave stale OPEN quotes on screen or imply that payment succeeded.
            await load()
        } finally {
            checkoutPending.current = false
            setBusy(null)
        }
    }

    const submitReview = async () => {
        if (!job || actionPending.current || checkoutPending.current || busy !== null) return
        if (reviewRating < 1 || reviewRating > 5) {
            setError("Choose a rating from 1 to 5 stars.")
            return
        }
        actionPending.current = true
        setBusy("review")
        setError(null)
        try {
            await createServiceReview(job.id, {
                rating: reviewRating,
                comment: reviewComment.trim() || undefined,
            })
            setReviewRating(0)
            setReviewComment("")
            setFlash("Thank you. Your verified service review is now published.")
            await load()
        } catch (e: any) {
            setError(e?.message || "Could not submit your review")
            await load()
        } finally {
            actionPending.current = false
            setBusy(null)
        }
    }

    if (error && !job) return <div className="container mx-auto px-5 py-20 text-center space-y-4">
        <p role="alert" className="text-red-500">{error}</p>
        <Button disabled={loading} onClick={() => void load(false)}>Try again</Button>
        <p><Link href="/services/jobs" className="text-primary">My Service Requests</Link></p>
    </div>
    if (!job) return <div className="flex justify-center py-32"><Loader2 className="animate-spin text-primary" /></div>

    const checkoutNotice = checkoutPaymentNotice(params.get("paid"), job.payment?.status)
    const paymentEvidence = servicePaymentEvidence(job.payment, job.agreedAmountPence)
    const completionReview = serviceCompletionReview(job)
    const activeQuotes = comparableServiceQuotes(job.quotes)
    const accepted = (job.quotes ?? []).find(q => q.id === job.acceptedQuoteId)
    const nextStep = customerServiceNextStep(job)
    const isPaidState = ["PAID", "IN_PROGRESS", "COMPLETED", "RELEASED"].includes(job.status)
    const isInspection = job.serviceType === "INSPECTION"
    const providerLabel = isInspection ? "inspector" : "transporter"
    const completionLabel = isInspection ? "inspection" : "delivery"
    const contactUnlocked = ["PAID", "RELEASED", "REFUNDED"].includes(job.payment?.status ?? "")
    const canMessageProvider = !!job.contractor && ["PAID", "IN_PROGRESS", "COMPLETED", "RELEASED", "DISPUTED"].includes(job.status)

    return (
        <div className="container mx-auto px-5 py-10 max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Link href="/services/jobs" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-primary">
                <ArrowLeft size={14} /> My Service Requests
            </Link>
            <Button variant="outline" size="sm" disabled={loading || busy !== null} onClick={() => void load(false)} aria-label="Refresh request">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            </div>

            {checkoutNotice && (
                <div role="status" className={`mb-6 p-4 rounded-xl border text-sm flex items-start gap-3 ${
                    checkoutNotice.tone === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}>
                    {checkoutNotice.tone === "success"
                        ? <CheckCircle size={18} className="shrink-0 mt-0.5" />
                        : <Clock size={18} className="shrink-0 mt-0.5" />}
                    {checkoutNotice.text}
                </div>
            )}
            {flash && (
                <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-sm flex items-start gap-3">
                    <CheckCircle size={18} className="shrink-0 mt-0.5" /> {flash}
                </div>
            )}
            {error && (
                <div role="alert" className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300 text-sm flex items-start gap-3">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
                </div>
            )}

                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <h1 className="min-w-0 break-words text-2xl md:text-3xl font-black font-heading tracking-tight">{job.title}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            {job.isRecovery && <RecoveryBadge />}
                            <JobStatusBadge status={job.status} />
                        </div>
                    </div>
                    <JobRoute job={job} className="mb-1" />
                    <div className="mb-6"><JobTiming job={job} /></div>

            <section aria-label="Next step" className="mb-6 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Next step</p>
                <h2 className="mt-1 text-xl font-bold">{nextStep.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{nextStep.description}</p>
                    {isInspection && job.inspectionOutcome && (
                        <section className={`mb-8 rounded-2xl border p-5 ${
                            job.inspectionOutcome === "FAULTS_FOUND"
                                ? "border-amber-500/35 bg-amber-500/10"
                                : "border-emerald-500/30 bg-emerald-500/10"
                        }`}>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Inspection result</p>
                            <h2 className="font-heading font-black text-lg">
                                {job.inspectionOutcome === "FAULTS_FOUND" ? "Faults found" : "No refusal-triggering faults found"}
                            </h2>
                            {job.inspectionSummary && (
                                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line mt-2">{job.inspectionSummary}</p>
                            )}
                            {job.inspectionOutcome === "FAULTS_FOUND" && job.sourceAuctionId && (
                                <p className="text-xs text-[var(--text-muted)] mt-3">
                                    Because this inspection is tied to your won auction, you can refuse the vehicle before approved handover and receive a refund of any buyer fee paid (up to £125).
                                </p>
                            )}
                        </section>
                    )}

                <div className="mt-4 space-y-3">
                        {job.status === "ACCEPTED" && accepted && <div className="rounded-xl bg-[var(--bg-input)] p-4">
                            <p className="font-bold">{accepted.contractor?.businessName || job.contractor?.businessName || "Selected provider"}</p>
                            <p className="mt-1 text-lg font-bold">{formatPence(accepted.amountPence)} <span className="text-xs font-normal text-[var(--text-muted)]">for the whole request</span></p>
                            <p className="mt-2 text-sm whitespace-pre-wrap break-words text-[var(--text-secondary)]">{accepted.message || "No additional scope supplied."}</p>
                        </div>}
                        {job.status === "ACCEPTED" && accepted && (
                            <Button className="w-full min-h-12 h-auto whitespace-normal py-3" disabled={busy !== null || job.payment?.status !== "PENDING"}
                                onClick={() => void startCheckout(accepted, true)}>
                                {busy === accepted.id ? <Loader2 className="animate-spin" size={16} /> : <><Banknote size={16} className="mr-2" /> Continue to payment · {formatPence(accepted.amountPence)}</>}
                            </Button>
                        )}
                        {isInspection && job.inspectionOutcome === "FAULTS_FOUND" && job.sourceAuctionId && ["COMPLETED", "RELEASED"].includes(job.status) && (
                            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
                                <p className="font-black text-sm">Refuse this auction purchase</p>
                                <p className="text-[11px] text-[var(--text-muted)] mt-1 mb-3">
                                    This cancels the auction sale, refunds any buyer fee paid (up to £125), and returns the vehicle to the seller so it can be repaired or relisted.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full border-amber-500/40"
                                    disabled={busy !== null}
                                    onClick={() => {
                                        if (!confirm("Refuse this vehicle because the linked inspection found faults? This will cancel the auction sale and refund any buyer fee you paid (up to £125).")) return
                                        const note = prompt("Optional note for the seller about the refusal:", job.inspectionSummary ?? "") ?? undefined
                                        void run(
                                            "refuse-auction",
                                            async () => {
                                                const result = await refuseAuctionAfterInspection(job.sourceAuctionId!, note?.trim() || undefined)
                                                if (!result.refused) throw new Error("Vehicle refusal could not be confirmed. Refresh the auction purchase for its status.")
                                                setFlash(inspectionRefusalNotice(result.refundedAmount))
                                            },
                                        )
                                    }}
                                >
                                    {busy === "refuse-auction" ? <Loader2 className="animate-spin" size={16} /> : "Refuse vehicle & review refund"}
                                </Button>
                            </div>
                        )}

                        {job.status === "COMPLETED" && (
                            <>
                                <Button className="w-full" disabled={busy !== null || !completionReview}
                                    onClick={() => {
                                        if (!window.confirm(`Confirm this ${completionLabel} is complete and release the recorded provider payment? Only confirm after reviewing the work. If something is wrong, raise a dispute instead.`)) return
                                        void run("confirm", () => confirmCompletion(job.id), `Completion confirmed. Provider payout recorded.`)
                                    }}>
                                    {busy === "confirm" ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle size={16} className="mr-2" /> Confirm {completionLabel}</>}
                                </Button>
                                <p className="text-[11px] text-[var(--text-muted)] text-center">
                                    {completionReview
                                        ? completionReview.elapsed
                                            ? "The 48-hour review period has elapsed. Automatic confirmation may still be processing; check the recorded payment status."
                                            : `Automatic confirmation becomes eligible after ${formatUkServiceDateTime(completionReview.dueAt)} if no dispute blocks release.`
                                        : "Completion is awaiting verification. Do not rely on an automatic payout deadline until the payment state is confirmed."}
                                </p>
                            </>
                        )}
                        {isPaidState && (
                            <button type="button" disabled={busy !== null}
                                onClick={() => {
                                    const warning = job.status === "RELEASED"
                                        ? "What went wrong? This opens a post-payout review. It does not automatically reverse the provider's transfer."
                                        : "What went wrong? A dispute pauses the normal provider payout while CarMazium reviews."
                                    const reason = window.prompt(warning)
                                    if (reason !== null) void run("dispute", () => disputeJob(job.id, reason.trim() || undefined), "Dispute raised. CarMazium will review the job.")
                                }}
                                className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
                                Something is wrong — raise a dispute
                            </button>
                        )}
                        {job.status === "OPEN" && (
                            <button type="button" disabled={busy !== null}
                                onClick={() => { if (confirm("Cancel this job? Any quotes will be withdrawn.")) run("cancel", () => cancelJob(job.id), "Job cancelled.") }}
                                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-muted)] hover:text-red-500">
                                <XCircle size={14} /> Cancel job
                            </button>
                        )}
                        {job.status === "DISPUTED" && (
                            <p className="text-sm text-[var(--text-muted)] text-center">Under review by CarMazium. We will email you.</p>
                        )}
                        {job.status === "RELEASED" && (
                            <div className="space-y-4">
                                <p className="text-sm text-[var(--text-muted)] text-center inline-flex items-center gap-2 w-full justify-center"><ShieldCheck size={16} className="text-emerald-500" /> Complete</p>
                                {job.review ? (
                                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Verified service review</p>
                                        <div className="flex items-center gap-1 mt-2" aria-label={`${job.review.rating} out of 5 stars`}>
                                            {[1,2,3,4,5].map(star => <Star key={star} size={16} className={star <= job.review!.rating ? "text-amber-500 fill-amber-500" : "text-[var(--text-muted)]"} />)}
                                        </div>
                                        {job.review.comment && <p className="text-sm mt-3 whitespace-pre-line">{job.review.comment}</p>}
                                        <p className="text-[11px] text-[var(--text-muted)] mt-2">{new Date(job.review.createdAt).toLocaleDateString("en-GB")}</p>
                                    </div>
                                ) : job.canReview ? (
                                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                                        <p className="font-bold text-sm">Review your {providerLabel}</p>
                                        <p className="text-[11px] text-[var(--text-muted)] mt-1">Only customers from a completed, paid TradeXchange job can leave this review.</p>
                                        <div className="flex gap-1 mt-3">
                                            {[1,2,3,4,5].map(star => (
                                                <button key={star} type="button" disabled={busy !== null} aria-pressed={star <= reviewRating} onClick={() => setReviewRating(star)} aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`} className="p-2">
                                                    <Star size={22} className={star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-[var(--text-muted)]"} />
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            aria-label="Service review comment"
                                            disabled={busy !== null}
                                            value={reviewComment}
                                            onChange={e => setReviewComment(e.target.value)}
                                            maxLength={2000}
                                            placeholder="Optional comment about the service"
                                            className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm mt-3 min-h-24 outline-none focus:border-primary"
                                        />
                                        <Button type="button" className="w-full mt-3" disabled={busy !== null || reviewRating === 0} onClick={() => void submitReview()}>
                                            {busy === "review" ? <Loader2 className="animate-spin" size={16} /> : "Submit verified review"}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                {canMessageProvider && <Button type="button" variant="outline" className="mt-3 min-h-12" disabled={busy !== null} onClick={() => void openJobChat()}>
                    {busy === "chat" ? <Loader2 className="animate-spin" size={16} /> : <><MessageSquare size={16} /> Message {providerLabel}</>}
                </Button>}
            </section>
            <div className="mb-8">                    {job.status === "OPEN" && (
                        <section>
                            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
                                Quotes ({activeQuotes.length})
                            </h2>
                            {activeQuotes.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-10 text-center">
                                    <Clock size={28} className="mx-auto text-[var(--text-muted)] mb-3" />
                                    {job.eligibleProviderCount === 0 ? (
                                        <>
                                            <p className="text-sm font-bold">No verified {isInspection ? "inspectors" : "transporters"} currently match this job.</p>
                                            <p className="text-sm text-[var(--text-muted)] mt-2">Your job remains open. If a provider becomes verified for this service and area before it expires, it will automatically appear in their available-jobs feed.</p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-[var(--text-muted)]">
                                            No quotes yet. {job.eligibleProviderCount != null
                                                ? `${job.eligibleProviderCount} verified ${isInspection ? "inspector" : "transporter"}${job.eligibleProviderCount === 1 ? "" : "s"} currently match this job.`
                                                : `Matching verified ${isInspection ? "inspectors" : "transporters"} can quote while the job remains open.`}
                                        </p>
                                    )}
                                    <p className="text-xs text-[var(--text-muted)] mt-2">Open until {new Date(job.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activeQuotes.map((q, i) => (
                                        <QuoteCard key={q.id} quote={q} cheapest={i === 0}
                                            busy={busy === q.id} disabled={busy !== null}
                                            onAccept={() => void startCheckout(q)} />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}</div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8">
                <div>
                    <h2 className="text-lg font-bold mb-4">Request details</h2>
                    <section className="mb-8">
                        <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Vehicles</h2>
                        <JobVehicles vehicles={job.vehicles} />
                    </section>

                    {job.description && (
                        <section className="mb-8">
                            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Notes</h2>
                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">{job.description}</p>
                        </section>
                    )}


                </div>

                <aside className="space-y-4">
                    {job.contractor && (
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Your {providerLabel}</p>
                            <p className="font-heading font-bold text-lg">{job.contractor.businessName || job.contractor.user.firstName}</p>
                            <Rating c={job.contractor} />
                            {contactUnlocked ? (
                                <div className="mt-4 space-y-2 text-sm">
                                    {job.contractor.phone || job.contractor.user.phone ? (
                                        <a href={`tel:${job.contractor.phone || job.contractor.user.phone}`} className="flex items-center gap-2 break-all text-primary hover:underline">
                                            <Phone size={14} /> {job.contractor.phone || job.contractor.user.phone}
                                        </a>
                                    ) : null}
                                    {job.contractor.user.email && (
                                        <a href={`mailto:${job.contractor.user.email}`} className="flex items-center gap-2 break-all text-primary hover:underline">
                                            <Mail size={14} /> {job.contractor.user.email}
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-[var(--text-muted)]">Contact details unlock once you have paid.</p>
                            )}

                        </div>
                    )}

                    {job.agreedAmountPence != null && (
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Price</p>
                            <p className="text-3xl font-black font-heading">{formatPence(job.agreedAmountPence)}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {servicePaymentStatusText(job.payment?.status)}
                            </p>
                            {paymentEvidence ? (
                                <dl className="mt-4 border-t border-[var(--border-default)] pt-3 space-y-2 text-xs">
                                    <div className="flex justify-between gap-3"><dt>Recorded customer amount</dt><dd className="font-semibold">{formatPence(paymentEvidence.grossPence)}</dd></div>
                                    {paymentEvidence.refundPence > 0 && <>
                                        <div className="flex justify-between gap-3"><dt>Recorded customer refund</dt><dd className="font-semibold">{formatPence(paymentEvidence.refundPence)}</dd></div>
                                        <div className="flex justify-between gap-3"><dt>Remaining service amount</dt><dd className="font-semibold">{formatPence(paymentEvidence.netServicePence)}</dd></div>
                                    </>}
                                    <div className="flex justify-between gap-3"><dt>CarMazium service fee (9%)</dt><dd className="font-semibold">{formatPence(paymentEvidence.platformFeePence)}</dd></div>
                                    <div className="flex justify-between gap-3"><dt>Provider allocation (91%)</dt><dd className="font-semibold">{formatPence(paymentEvidence.contractorPence)}</dd></div>
                                </dl>
                            ) : (
                                <p role="status" className="text-xs text-amber-600 dark:text-amber-300 mt-3">
                                    Payment breakdown is not yet verified. Refresh or contact support before relying on these amounts.
                                </p>
                            )}
                        </div>
                    )}


                </aside>
            </div>
            <div className="mt-8">
                <ServiceJobChanges job={job} role="customer" onChange={load} disabled={busy !== null} onBusyChange={value => { actionPending.current = value; setBusy(value ? "support" : null) }} />
            </div>
        </div>
    )
}

function AccountJobDetail() {
    const { user } = useAuth()
    const { id } = useParams<{ id: string }>()
    return user ? <JobDetail key={`${user.id}:${id}`} id={id} /> : null
}

function Rating({ c }: { c: { rating: number; totalReviews: number } }) {
    if (!c.totalReviews) return <p className="text-xs text-[var(--text-muted)]">New to CarMazium</p>
    return (
        <p className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1">
            <Star size={12} className="text-amber-500 fill-amber-500" /> {c.rating.toFixed(1)} · {c.totalReviews} review{c.totalReviews === 1 ? "" : "s"}
        </p>
    )
}

function QuoteCard({ quote, cheapest, busy, disabled, onAccept }: { quote: ServiceQuote; cheapest: boolean; busy: boolean; disabled: boolean; onAccept: () => void }) {
    const c = quote.contractor
    return <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><h3 className="font-heading font-bold text-lg break-words">{c?.businessName || c?.user.firstName || "Service provider"}</h3>
                {c && <Rating c={c} />}{c?.serviceArea && <p className="mt-1 text-sm text-[var(--text-secondary)]">Service area: {c.serviceArea}</p>}
            </div>
            <div className="text-right"><p className="text-2xl font-black font-heading">{formatPence(quote.amountPence)}</p><p className="text-xs text-[var(--text-muted)]">Total for the whole request</p>{cheapest && <p className="text-xs font-semibold text-[var(--text-secondary)]">Lowest current quote</p>}</div>
        </div>
        <div className="mt-4 border-t border-[var(--border-default)] pt-3"><p className="text-sm font-semibold">Proposed scope and availability</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">{quote.message || "No additional details supplied. Confirm the scope and report requirements before accepting."}</p>
            {quote.validUntil && <p className="mt-2 text-xs text-[var(--text-muted)]">Valid until {new Date(quote.validUntil).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })} UK time</p>}
        </div>
        <Button className="mt-4 min-h-12 w-full sm:w-auto" disabled={disabled} onClick={onAccept}>{busy ? <Loader2 className="animate-spin" size={16} /> : "Choose & continue to payment"}</Button>
    </article>
}

export default function ServiceJobPage() {
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>
            <RequireAuth title="Sign in to view this request" message="Sign in to view the quotes and actions available to your account.">
                <React.Suspense fallback={<div className="flex justify-center py-32"><Loader2 className="animate-spin text-primary" /></div>}>
                    <AccountJobDetail />
                </React.Suspense>
            </RequireAuth>
        </div>
    )
}
