"use client"

import * as React from "react"
import Link from "next/link"
import {
    Briefcase,
    CheckCircle,
    ChevronRight,
    ClipboardList,
    Inbox,
    Loader2,
    PoundSterling,
    ShieldCheck,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { JobListCard } from "@/components/services/JobBits"
import { useAuth } from "@/context/AuthContext"
import {
    SERVICE_LABELS,
    formatPence,
    getAssignedJobs,
    getJobFeed,
    getLeadInbox,
    getMyCapabilities,
    type MyCapabilities,
    type ServiceJob,
    type ServiceLead,
} from "@/lib/servicesApi"

/**
 * TradeXchange provider overview.
 *
 * This page intentionally uses the new service marketplace APIs. The legacy
 * ServiceRequest dashboard was removed because it could show stale counts and
 * actions that were unrelated to the live Delivery/Inspection job engine and
 * Finance/Warranty lead inbox.
 */
export default function ServiceDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const [capabilities, setCapabilities] = React.useState<MyCapabilities | null>(null)
    const [feed, setFeed] = React.useState<ServiceJob[]>([])
    const [assigned, setAssigned] = React.useState<ServiceJob[]>([])
    const [leads, setLeads] = React.useState<ServiceLead[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (authLoading || !user) return

        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError(null)

            const [capResult, feedResult, assignedResult, leadResult] = await Promise.allSettled([
                getMyCapabilities(),
                getJobFeed(),
                getAssignedJobs(),
                getLeadInbox(),
            ])

            if (cancelled) return

            if (capResult.status === "fulfilled") setCapabilities(capResult.value)
            else setCapabilities({ profile: null, capabilities: [], stripeConnect: { connected: false, complete: false } })

            setFeed(feedResult.status === "fulfilled" ? feedResult.value : [])
            setAssigned(assignedResult.status === "fulfilled" ? assignedResult.value : [])
            setLeads(leadResult.status === "fulfilled" ? leadResult.value : [])

            // A provider may legitimately get 403 from one marketplace if they
            // are approved only for the other. Only show an error when even the
            // capability summary itself cannot be loaded.
            if (capResult.status === "rejected") {
                setError(capResult.reason?.message || "Could not load your service provider profile.")
            }
            setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [authLoading, user])

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

    const approvedCount = capabilities?.capabilities.filter(c => c.status === "APPROVED").length ?? 0
    const activeAssigned = assigned.filter(j => !["RELEASED", "CANCELLED", "EXPIRED"].includes(j.status))
    const releasedEarnings = assigned
        .filter(j => j.status === "RELEASED")
        .reduce((sum, job) => sum + (job.contractorAmountPence ?? 0), 0)
    const recentAssigned = [...assigned]
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
                                Delivery and Inspection jobs, Finance and Warranty enquiries, approvals and earnings in one place.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link href="/dashboard/service/capabilities" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-xs font-black uppercase tracking-widest hover:border-primary/40 transition-colors">
                                <ShieldCheck size={15} /> Service areas
                            </Link>
                            <Link href="/services" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-colors">
                                Service hub <ChevronRight size={15} />
                            </Link>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-500">
                            {error}
                        </div>
                    )}

                    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                        <StatCard icon={ShieldCheck} label="Approved areas" value={loading ? "…" : String(approvedCount)} />
                        <StatCard icon={Inbox} label="Open paid jobs" value={loading ? "…" : String(feed.length)} />
                        <StatCard icon={Briefcase} label="My active jobs" value={loading ? "…" : String(activeAssigned.length)} />
                        <StatCard icon={PoundSterling} label="Released earnings" value={loading ? "…" : formatPence(releasedEarnings)} />
                    </section>

                    <section className="grid lg:grid-cols-2 gap-5">
                        <Link href="/dashboard/service/jobs" className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 hover:border-primary/40 transition-colors">
                            <div className="flex items-start justify-between gap-5">
                                <div className="flex gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0"><Briefcase size={20} /></div>
                                    <div>
                                        <h2 className="font-heading font-bold text-lg">Delivery & Inspection jobs</h2>
                                        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">See open jobs in your approved paid service areas, submit quotes and manage jobs you win.</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-[var(--text-muted)] group-hover:text-primary transition-colors shrink-0" size={20} />
                            </div>
                        </Link>

                        <Link href="/dashboard/service/leads" className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 hover:border-primary/40 transition-colors">
                            <div className="flex items-start justify-between gap-5">
                                <div className="flex gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><ClipboardList size={20} /></div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="font-heading font-bold text-lg">Finance & Warranty inbox</h2>
                                            {leads.length > 0 && <span className="rounded-full bg-primary text-white text-[10px] font-black min-w-5 h-5 px-1.5 inline-flex items-center justify-center">{leads.length > 99 ? "99+" : leads.length}</span>}
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">Open customer enquiries matched to your approved lead-service capabilities and send provider responses.</p>
                                    </div>
                                </div>
                                <ChevronRight className="text-[var(--text-muted)] group-hover:text-primary transition-colors shrink-0" size={20} />
                            </div>
                        </Link>
                    </section>

                    <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                        <div className="p-5 md:p-6 border-b border-[var(--border-default)] flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold font-heading">My recent paid jobs</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Delivery and Inspection jobs assigned to your business.</p>
                            </div>
                            <Link href="/dashboard/service/jobs" className="text-xs font-black uppercase tracking-widest text-primary hover:underline shrink-0">View all</Link>
                        </div>

                        {loading ? (
                            <div className="py-14 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
                        ) : recentAssigned.length === 0 ? (
                            <div className="p-8 md:p-10 text-center">
                                <Briefcase size={28} className="mx-auto text-[var(--text-muted)] mb-3" />
                                <p className="text-sm text-[var(--text-muted)]">No assigned paid jobs yet. Approved Delivery or Inspection providers can quote on open jobs.</p>
                                <Link href="/dashboard/service/jobs" className="inline-flex items-center gap-1 text-sm font-bold text-primary mt-4">Browse open jobs <ChevronRight size={14} /></Link>
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
                                    <h2 className="font-bold">How your service areas work</h2>
                                    <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
                                        Delivery & Recovery and Vehicle Inspections use competitive quotes with the 9% / 91% job-payment split. Vehicle Finance and Warranty Providers use matched customer enquiries and do not use the service-job payment flow.
                                    </p>
                                </div>
                            </div>
                            <Link href="/dashboard/service/capabilities" className="text-xs font-black uppercase tracking-widest text-primary hover:underline shrink-0">Manage approvals</Link>
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
            <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[var(--text-muted)] truncate">{label}</p>
            <p className="text-xl md:text-2xl font-black font-heading mt-1 truncate">{value}</p>
        </div>
    )
}
