"use client"

import * as React from "react"
import Link from "next/link"
import { Briefcase, AlertCircle, Inbox, ArrowLeft } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getJobFeedPage, getAssignedJobsPage, formatPence, type ServiceJob } from "@/lib/servicesApi"
import { JobListCard } from "@/components/services/JobBits"
import { subscribeProductSync } from "@/lib/productSync"

/**
 * The provider marketplace: open jobs to quote on, and jobs the business has won.
 *
 * A 403 from the feed means "no approved capability yet"; that is a state, not
 * an error, and it gets a signpost to the capabilities page rather than a red
 * box.
 */
export default function ContractorJobsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [tab, setTab] = React.useState<"open" | "mine">("open")
    const [feed, setFeed] = React.useState<ServiceJob[] | null>(null)
    const [mine, setMine] = React.useState<ServiceJob[] | null>(null)
    const [notApproved, setNotApproved] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [feedCursor, setFeedCursor] = React.useState<string | null>(null)
    const [mineCursor, setMineCursor] = React.useState<string | null>(null)
    const [loadingMore, setLoadingMore] = React.useState(false)

    const loadJobs = React.useCallback(async () => {
        if (authLoading || !user) return
        setError(null)
        setNotApproved(false)
        setFeed(null)
        setMine(null)
        try {
            const [f, m] = await Promise.all([getJobFeedPage(), getAssignedJobsPage()])
            setFeed(f.items); setFeedCursor(f.nextCursor)
            setMine(m.items); setMineCursor(m.nextCursor)
        } catch (e: any) {
            const msg: string = e?.message || ""
            if (/no approved services|approved service providers/i.test(msg)) setNotApproved(true)
            else setError(msg || "Could not load jobs")
            setFeed([]); setMine([])
        }
    }, [authLoading, user])

    React.useEffect(() => {
        void loadJobs()
    }, [loadJobs])

    React.useEffect(() => subscribeProductSync(["services"], () => {
        void loadJobs()
    }), [loadJobs])

    const loadMore = async () => {
        if (loadingMore) return
        const cursor = tab === "open" ? feedCursor : mineCursor
        if (!cursor) return
        setLoadingMore(true)
        try {
            if (tab === "open") {
                const page = await getJobFeedPage(undefined, cursor)
                setFeed(current => [...(current ?? []), ...page.items])
                setFeedCursor(page.nextCursor)
            } else {
                const page = await getAssignedJobsPage(cursor)
                setMine(current => [...(current ?? []), ...page.items])
                setMineCursor(page.nextCursor)
            }
        } catch (e: any) {
            setError(e?.message || "Could not load more jobs")
        } finally {
            setLoadingMore(false)
        }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}`.trim() : user?.email || "Provider"
    const list = tab === "open" ? feed : mine

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 space-y-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <p className="text-primary text-xs font-black uppercase tracking-[0.18em] mb-2">TradeXchange Provider Marketplace</p>
                            <h1 className="text-3xl font-bold font-heading mb-1">Available Jobs</h1>
                            <p className="text-sm text-[var(--text-muted)] max-w-2xl">These are customer-posted Delivery, Recovery and Inspection jobs your approved Partner business can compete for. Send a quote on suitable work; jobs you win stay under My Work.</p>
                        </div>
                        <Link href="/services" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:border-primary/40 transition-colors">
                            <ArrowLeft size={14} /> TradeXchange Services
                        </Link>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                        Looking for the customer side instead? Any signed-in CarMazium user can <Link href="/services/jobs/new" className="font-bold text-primary hover:underline">post a job here</Link> and approved providers will see matching work in this marketplace.
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-1 w-fit max-w-full">
                        {([["open", `Available${feed ? ` (${feed.length})` : ""}`], ["mine", `My Work${mine ? ` (${mine.length})` : ""}`]] as const).map(([k, label]) => (
                            <button key={k} type="button" onClick={() => setTab(k)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${tab === k ? "bg-primary text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    {notApproved && (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                            <AlertCircle size={22} className="text-amber-500 shrink-0" />
                            <div className="flex-1">
                                <p className="font-bold text-sm">No approved service areas yet</p>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Apply for Delivery & Recovery or Vehicle Inspection and connect Stripe. Matching jobs appear here once CarMazium approves that capability.</p>
                            </div>
                            <Link href="/dashboard/service/capabilities" className="text-xs font-black uppercase tracking-widest text-primary hover:underline shrink-0">Apply now →</Link>
                        </div>
                    )}
                    {error && <ErrorState message={error} onRetry={loadJobs} />}
                    {!list && !notApproved && !error && <LoadingState label="Loading service jobs…" />}

                    {list && list.length === 0 && !notApproved && (
                        <EmptyState
                            icon={tab === "open" ? Inbox : Briefcase}
                            title={tab === "open" ? "No matching jobs right now" : "No won jobs yet"}
                            description={tab === "open"
                                ? "New customer jobs appear here automatically when they match one of your approved service areas."
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
                </main>
            </div>
        </div>
    )
}
