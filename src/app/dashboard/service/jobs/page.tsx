"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { Briefcase, AlertCircle, Inbox, ArrowLeft } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getJobFeedPage, getAssignedJobsPage, formatPence, type ServiceJob } from "@/lib/servicesApi"
import { JobListCard } from "@/components/services/JobBits"
import { loadProviderJobLists } from "@/lib/tradeXchangeProviderJobLoad"

/**
 * The provider marketplace: open jobs to quote on, and jobs the business has won.
 *
 * A 403 from the feed means "no approved capability yet"; that is a state, not
 * an error, and it gets a signpost to the capabilities page rather than a red
 * box.
 */
export default function ContractorJobsPage() {
    const { user, loading } = useAuth()
    if (loading || !user) return <LoadingState label="Loading your account…" />
    return <React.Suspense fallback={<LoadingState label="Loading jobs…" />}><ProviderJobs key={user.id} /></React.Suspense>
}

function ProviderJobs() {
    const { user, profile, loading: authLoading } = useAuth()
    const search = useSearchParams()
    const router = useRouter()
    const tab = search.get("tab") === "mine" ? "mine" : "open"
    const setTab = (value: "open" | "mine") => router.replace(`/dashboard/service/jobs?tab=${value}`, { scroll: false })
    const sequence = React.useRef(0)
    const morePending = React.useRef(false)
    const [feed, setFeed] = React.useState<ServiceJob[] | null>(null)
    const [mine, setMine] = React.useState<ServiceJob[] | null>(null)
    const [notApproved, setNotApproved] = React.useState(false)
    const [availableError, setAvailableError] = React.useState<string | null>(null)
    const [assignedError, setAssignedError] = React.useState<string | null>(null)
    const [feedCursor, setFeedCursor] = React.useState<string | null>(null)
    const [mineCursor, setMineCursor] = React.useState<string | null>(null)
    const [loadingMore, setLoadingMore] = React.useState(false)

    const loadJobs = React.useCallback(async () => {
        if (authLoading || !user) return
        const request = ++sequence.current
        morePending.current = false
        setLoadingMore(false)
        setFeedCursor(null)
        setMineCursor(null)
        setAvailableError(null)
        setAssignedError(null)
        setNotApproved(false)
        setFeed(null)
        setMine(null)

        // Approval gates new quotations, not the right to finish an existing
        // paid job. A 403 on Available must never empty the My Work tab.
        const result = await loadProviderJobLists(getJobFeedPage, getAssignedJobsPage)
        if (request !== sequence.current) return
        setFeed(result.available?.items ?? [])
        setFeedCursor(result.available?.nextCursor ?? null)
        setMine(result.assigned?.items ?? [])
        setMineCursor(result.assigned?.nextCursor ?? null)
        setNotApproved(result.approvalRequired)
        setAvailableError(result.availableError)
        setAssignedError(result.assignedError)
    }, [authLoading, user])

    React.useEffect(() => {
        void loadJobs()
        const currentSequence = sequence
        return () => { currentSequence.current++ }
    }, [loadJobs])

    const loadMore = async () => {
        if (morePending.current) return
        const cursor = tab === "open" ? feedCursor : mineCursor
        if (!cursor) return
        morePending.current = true
        const request = sequence.current
        setLoadingMore(true)
        try {
            if (tab === "open") {
                const page = await getJobFeedPage(undefined, cursor)
                if (request !== sequence.current) return
                setFeed(current => [...new Map([...(current ?? []), ...page.items].map(job => [job.id, job])).values()])
                setFeedCursor(page.nextCursor)
            } else {
                const page = await getAssignedJobsPage(cursor)
                if (request !== sequence.current) return
                setMine(current => [...new Map([...(current ?? []), ...page.items].map(job => [job.id, job])).values()])
                setMineCursor(page.nextCursor)
            }
        } catch (e: unknown) {
            if (request !== sequence.current) return
            const message = e instanceof Error ? e.message : "Could not load more jobs"
            if (tab === "open") setAvailableError(message)
            else setAssignedError(message)
        } finally {
            if (request === sequence.current) { morePending.current = false; setLoadingMore(false) }
        }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"
    const list = tab === "open" ? feed : mine
    const error = tab === "open" ? availableError : assignedError

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <div className="flex-1 min-w-0 space-y-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-primary text-xs font-black uppercase tracking-[0.18em] mb-2">TradeXchange Provider Marketplace</p>
                            <h1 className="text-3xl font-bold font-heading mb-1">{tab === "mine" ? "My Work" : "Available Jobs"}</h1>
                            <p className="text-sm text-[var(--text-muted)] max-w-2xl">These are customer-posted Delivery, Recovery and Inspection jobs your approved Partner business can compete for. Send a quote on suitable work; jobs you win stay under My Work.</p>
                        </div>
                        <button type="button" onClick={loadJobs} disabled={!feed || !mine} className="text-sm font-bold text-primary underline disabled:opacity-50">Refresh jobs</button>
                        <Link href="/dashboard/service" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:border-primary/40 transition-colors">
                            <ArrowLeft size={14} /> Provider overview
                        </Link>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                        Looking for the customer side instead? Any signed-in CarMazium user can <Link href="/services/jobs/new" className="font-bold text-primary hover:underline">post a job here</Link> and approved providers will see matching work in this marketplace.
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-1 w-fit max-w-full">
                        {([["open", `Available${feed ? ` (${feed.length}${feedCursor ? "+" : ""})` : ""}`], ["mine", `My Work${mine ? ` (${mine.length}${mineCursor ? "+" : ""})` : ""}`]] as const).map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${tab === k ? "bg-primary text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {tab === "open" && notApproved && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                            <AlertCircle size={22} className="text-amber-500 shrink-0" />
                            <div className="flex-1">
                                <p className="font-bold text-sm">Verification required for new jobs</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Complete business verification, verified payouts and the declaration. Delivery and recovery require trade insurance; inspections need no inspection documents. Your original £1 dealer verification is reused. Previously accepted jobs remain under My Work.</p>
                            </div>
                            <Link href="/dashboard/service/capabilities" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>Review verification →</Link>
                        </div>
                    )}
                    {error && <ErrorState message={error} onRetry={loadJobs} />}
                    {!list && !(tab === "open" && notApproved) && !error && <LoadingState label="Loading service jobs…" />}

                    {list && list.length === 0 && !error && !(tab === "open" && notApproved) && (
                        <EmptyState
                            icon={tab === "open" ? Inbox : Briefcase}
                            title={tab === "open" ? "No matching jobs right now" : "No won jobs yet"}
                            description={tab === "open"
                                ? "Refresh to check for jobs matching your approved services. Eligible providers also receive account and email notifications for new matching jobs."
                                : "Quote on Available Jobs to start building your completed work history."}
                        />
                    )}

                    {list && list.length > 0 && (
                        <div className="space-y-3">
                            {list.map(j => {
                                const myQuote = j.quotes?.[0]
                                const trailing = tab === "open"
                                    ? myQuote
                                        ? <span className="text-xs font-bold text-emerald-500">Your quote: {formatPence(myQuote.amountPence)}</span>
                                        : <span className="text-xs font-bold text-primary">{j._count?.quotes ?? 0} quote{(j._count?.quotes ?? 0) === 1 ? "" : "s"} so far</span>
                                    : j.agreedAmountPence != null
                                        ? <span className="text-xs font-bold">{formatPence(j.contractorAmountPence ?? j.agreedAmountPence)} to your business</span>
                                        : undefined
                                return <JobListCard key={j.id} job={j} href={`/dashboard/service/jobs/${j.id}`} trailing={trailing} />
                            })}
                        </div>
                    )}
                    {(tab === "open" ? feedCursor : mineCursor) && <div className="flex justify-center">
                        <button type="button" onClick={loadMore} disabled={loadingMore}
                            className="rounded-xl border border-[var(--border-default)] px-5 py-2.5 text-sm font-bold hover:border-primary disabled:opacity-50">
                            {loadingMore ? "Loading…" : "Load more"}
                        </button>
                    </div>}
                </div>
            </div>
        </div>
    )
}
