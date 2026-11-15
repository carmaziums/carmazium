"use client"

import * as React from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/buttonVariants"
import {
    Briefcase,
    CheckCircle,
    ChevronRight,
    Inbox,
    Loader2,
    PoundSterling,
    ShieldCheck,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { JobListCard } from "@/components/services/JobBits"
import { useAuth } from "@/context/AuthContext"
import {
    formatPence,
    getAssignedJobsPage,
    getJobFeedPage,
    getMyCapabilities,
    type MyCapabilities,
    type ServiceJob,
} from "@/lib/servicesApi"

import { loadAllProviderJobs, loadProviderJobLists } from "@/lib/tradeXchangeProviderJobLoad"

/**
 * TradeXchange provider overview.
 *
 * This page intentionally uses the new service marketplace APIs. The legacy
 * ServiceRequest dashboard was removed because it could show stale counts and
 * actions that were unrelated to the live Delivery/Inspection job engine and
 * Finance/Warranty lead inbox.
 */
export default function ServiceDashboard() {
    const { user, loading } = useAuth()
    if (loading || !user) return <div className="p-12 text-center">Loading your provider dashboard…</div>
    return <ProviderOverview key={user.id} />
}

function ProviderOverview() {
    const { user, profile, loading: authLoading } = useAuth()
    const [capabilities, setCapabilities] = React.useState<MyCapabilities | null>(null)
    const [feed, setFeed] = React.useState<ServiceJob[] | null>(null)
    const [assigned, setAssigned] = React.useState<ServiceJob[] | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const [refresh, setRefresh] = React.useState(0)
    const [approvalRequired, setApprovalRequired] = React.useState(false)
    const [assignedError, setAssignedError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (authLoading || !user) return

        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError(null)

            const [capResult, listsResult] = await Promise.allSettled([
                getMyCapabilities(),
                loadProviderJobLists(
                    () => loadAllProviderJobs(cursor => getJobFeedPage(undefined, cursor, 50)),
                    () => loadAllProviderJobs(cursor => getAssignedJobsPage(cursor, 50)),
                ),
            ])
            if (cancelled) return
            setCapabilities(capResult.status === "fulfilled" ? capResult.value : null)
            const lists = listsResult.status === "fulfilled" ? listsResult.value : null
            setFeed(lists?.available?.items ?? null)
            setAssigned(lists?.assigned?.items ?? null)
            setApprovalRequired(lists?.approvalRequired ?? false)
            setAssignedError(lists?.assignedError ?? (lists ? null : "Could not load assigned jobs."))
            const failures = [
                capResult.status === "rejected" ? "Could not load your service approvals." : null,
                lists?.availableError,
                lists?.assignedError,
                !lists ? "Could not load service jobs." : null,
            ].filter(Boolean)
            setError(failures.length ? failures.join(" ") : null)
            setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [authLoading, user, refresh])

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`.trim()
        : user?.email?.split("@")[0] || "Provider"

    const approvedCount = capabilities?.capabilities.filter(c => c.status === "APPROVED" && (c.serviceType === "DELIVERY" || c.serviceType === "INSPECTION")).length ?? 0
    const activeAssigned = (assigned ?? []).filter(j => !["RELEASED", "CANCELLED", "EXPIRED"].includes(j.status))
    const releasedEarnings = (assigned ?? [])
        .filter(j => j.status === "RELEASED")
        .reduce((sum, job) => sum + (job.contractorAmountPence ?? 0), 0)
    const recentAssigned = [...(assigned ?? [])]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />

                <main className="flex-1 min-w-0 space-y-8">
                    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
                        <div>
                            <p className="text-primary text-xs font-black uppercase tracking-[0.18em] mb-2">TradeXchange Services</p>
                            <h1 className="text-3xl md:text-4xl font-black font-heading mb-2">Provider overview</h1>
                            <p className="text-sm text-[var(--text-muted)] max-w-2xl">
                                Delivery and Inspection jobs, approvals and earnings in one place. Contact our team about finance and warranty partnerships.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link href="/dashboard/service/capabilities" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:border-primary/40 transition-colors">
                                <ShieldCheck size={15} /> Service setup & payouts
                            </Link>
                            <Link href="/dashboard/service/jobs" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-colors">
                                Find jobs <ChevronRight size={15} />
                            </Link>
                        </div>
                    </div>

                    <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)} className="text-sm font-bold text-primary underline disabled:opacity-50">{loading ? "Refreshing…" : "Refresh dashboard"}</button>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                        <StatCard icon={ShieldCheck} label="Approved services" value={loading ? "…" : capabilities ? String(approvedCount) : "Unavailable"} />
                        <StatCard icon={Inbox} label="Available jobs" value={loading ? "…" : feed ? String(feed.length) : approvalRequired ? "Setup needed" : "Unavailable"} />
                        <StatCard icon={Briefcase} label="My active jobs" value={loading ? "…" : assigned ? String(activeAssigned.length) : "Unavailable"} />
                        <StatCard icon={PoundSterling} label="Released earnings" value={loading ? "…" : assigned ? formatPence(releasedEarnings) : "Unavailable"} />
                    </section>

                    <section className="grid lg:grid-cols-2 gap-5">
                        <Link href="/dashboard/service/jobs" className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 hover:border-primary/40 transition-colors">
                            <div className="flex items-start justify-between gap-5">
                                <div className="flex gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0"><Briefcase size={20} /></div>
                                    <div>
                                        <h2 className="font-heading font-bold text-lg">Delivery & Inspection jobs</h2>
                                        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">See open jobs in your approved service areas, submit quotes and manage jobs you win.</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-[var(--text-muted)] group-hover:text-primary transition-colors shrink-0" size={20} />
                            </div>
                        </Link>

                        <Link href="/dashboard/service/jobs?tab=mine" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 hover:border-primary/40">
                            <h2 className="font-heading font-bold text-lg">My work</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Continue jobs assigned to your business and review completed work. Existing jobs remain accessible when approval for new work needs renewal.</p>
                        </Link>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                        <div className="p-5 md:p-6 border-b border-[var(--border-default)] flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold font-heading">My recent assigned jobs</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Delivery and Inspection jobs assigned to your business.</p>
                            </div>
                            <Link href="/dashboard/service/jobs?tab=mine" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>View all</Link>
                        </div>

                        {loading ? (
                            <div className="py-14 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                        ) : assignedError || assigned === null ? (<p role="status" className="p-6 text-sm">Assigned jobs are unavailable. Refresh the dashboard to try again.</p>) : recentAssigned.length === 0 ? (
                            <div className="p-8 md:p-10 text-center">
                                <Briefcase size={28} className="mx-auto text-[var(--text-muted)] mb-3" />
                                <p className="text-sm text-[var(--text-muted)]">No assigned jobs yet. Approved Delivery or Inspection providers can quote on open jobs.</p>
                                <Link href="/dashboard/service/jobs" className={buttonVariants({ size: "sm", className: "mt-4" })}>Browse open jobs <ChevronRight size={14} /></Link>
                            </div>
                        ) : (
                            <div className="p-4 md:p-5 space-y-3">
                                {recentAssigned.map(job => (
                                    <JobListCard
                                        key={job.id}
                                        job={job}
                                        href={`/dashboard/service/jobs/${job.id}`}
                                        trailing={job.contractorAmountPence != null
                                            ? <span className="text-xs font-bold">{formatPence(job.contractorAmountPence)} to you</span>
                                            : undefined}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex gap-3">
                                <CheckCircle size={21} className="text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <h2 className="font-bold">What you need before taking jobs</h2>
                                    <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                                        Complete business verification, verified payouts and the declaration. Collection, delivery and recovery require trade insurance. Inspections need no inspection documents. Your original £1 dealer verification is reused; no further £1 service verification is required. CarMazium retains 9% of the agreed job price and your business receives 91% after release. Finance, warranty and insurance providers should contact CarMazium directly about partnerships.
                                    </p>
                                </div>
                            </div>
                            <Link href="/dashboard/service/capabilities" className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>Complete service setup</Link>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    )
}

function StatCard({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>
    label: string
    value: string
}) {
    return (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:p-5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4"><Icon size={17} /></div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
            <p className="text-xl md:text-2xl font-black font-heading mt-1 break-words">{value}</p>
        </div>
    )
}
