"use client"

import * as React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Truck, Plus } from "lucide-react"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { deliveryServiceEnabled, inspectionServiceEnabled } from "@/lib/featureFlags"
import { getMyJobsPage, type ServiceJob } from "@/lib/servicesApi"
import { JobListCard } from "@/components/services/JobBits"

/** Jobs the signed-in customer has posted, any service. */
function MyJobsList() {
    const [jobs, setJobs] = React.useState<ServiceJob[] | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [nextCursor, setNextCursor] = React.useState<string | null>(null)
    const [loadingMore, setLoadingMore] = React.useState(false)

    React.useEffect(() => {
        getMyJobsPage()
            .then(page => { setJobs(page.items); setNextCursor(page.nextCursor) })
            .catch(e => setError(e?.message || "Could not load your jobs"))
    }, [])

    const loadMore = async () => {
        if (!nextCursor || loadingMore) return
        setLoadingMore(true)
        try {
            const page = await getMyJobsPage(nextCursor)
            setJobs(current => [...(current ?? []), ...page.items])
            setNextCursor(page.nextCursor)
        } catch (e: any) {
            setError(e?.message || "Could not load more jobs")
        } finally {
            setLoadingMore(false)
        }
    }

    const active = jobs?.filter(j => !["RELEASED", "CANCELLED", "EXPIRED"].includes(j.status)) ?? []
    const past = jobs?.filter(j => ["RELEASED", "CANCELLED", "EXPIRED"].includes(j.status)) ?? []

    return (
        <div className="container mx-auto px-5 py-12 max-w-4xl">
            <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
                <div>
                    <p className="text-primary text-xs font-black uppercase tracking-[0.18em] mb-2">TradeXchange</p>
                    <h1 className="text-3xl md:text-4xl font-black font-heading tracking-tight mb-1">My Posted Jobs</h1>
                    <p className="text-[var(--text-muted)] text-sm">Track the delivery, recovery and inspection jobs you posted, compare quotes and manage the provider you choose.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link href="/services" className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors">
                        <ArrowLeft size={15} /> TradeXchange Services
                    </Link>
                    <Link href="/services/jobs/new" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors">
                        <Plus size={16} /> Post a Job
                    </Link>
                </div>
            </div>

            <div className="mb-7 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 text-sm leading-6 text-[var(--text-muted)]">
                This is the customer side of TradeXchange. If you run an approved service-provider business and want to compete for open work, use <Link href="/dashboard/service/jobs" className="font-bold text-primary hover:underline">Available Jobs in the provider dashboard</Link>.
            </div>

            {error && <p className="text-red-500 text-sm mb-6">{error}</p>}
            {!jobs && !error && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>}

            {jobs && jobs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
                    <Truck size={32} className="mx-auto text-[var(--text-muted)] mb-4" />
                    <h2 className="font-heading font-bold text-lg mb-2">No jobs yet</h2>
                    <p className="text-sm text-[var(--text-muted)] mb-6">Post a delivery, recovery or inspection job and approved providers can compete for it with quotes.</p>
                    <Link href="/services/jobs/new" className="text-primary font-bold text-sm hover:underline">Post your first job →</Link>
                </div>
            )}

            {active.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Active</h2>
                    <div className="space-y-3">
                        {active.map(j => (
                            <JobListCard key={j.id} job={j} href={`/services/jobs/${j.id}`}
                                trailing={j.status === "OPEN" ? <span className="text-xs font-bold text-primary">{j._count?.quotes ?? 0} quote{(j._count?.quotes ?? 0) === 1 ? "" : "s"}</span> : undefined} />
                        ))}
                    </div>
                </section>
            )}

            {past.length > 0 && (
                <section>
                    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">Past</h2>
                    <div className="space-y-3 opacity-80">
                        {past.map(j => <JobListCard key={j.id} job={j} href={`/services/jobs/${j.id}`} />)}
                    </div>
                </section>
            )}
            {nextCursor && <div className="flex justify-center mt-8">
                <button type="button" onClick={loadMore} disabled={loadingMore}
                    className="rounded-xl border border-[var(--border-default)] px-5 py-2.5 text-sm font-bold hover:border-primary disabled:opacity-50">
                    {loadingMore ? "Loading…" : "Load more jobs"}
                </button>
            </div>}
        </div>
    )
}

export default function MyServiceJobsPage() {
    if (!deliveryServiceEnabled && !inspectionServiceEnabled) notFound()

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-body)' }}>
            <RequireAuth title="Sign in to see your jobs" message="Your posted jobs and their quotes live here.">
                <MyJobsList />
            </RequireAuth>
        </div>
    )
}
