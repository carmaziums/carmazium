"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    TrendingUp, Loader2, ArrowLeft, Users, Car, DollarSign, RefreshCw,
    Eye, Search, Globe, Monitor, Smartphone, Tablet, MousePointerClick,
    Clock, BarChart3, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getAdminAnalytics, getAdminStats, getTrafficAnalytics,
    type AnalyticsMonth, type AdminStats, type TrafficAnalytics,
} from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"
import { DateRangeFilter } from "@/components/dealer"
import type { DateRangePreset } from "@/components/dealer"

function fmtDate(d: Date): string {
    return d.toISOString().split("T")[0]
}
function subDaysNative(d: Date, days: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() - days)
    return r
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function BarChart({ data, valueKey, color, label }: {
    data: AnalyticsMonth[]
    valueKey: keyof AnalyticsMonth
    color: string
    label: string
}) {
    const max = Math.max(...data.map(d => Number(d[valueKey])), 1)
    return (
        <div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">{label}</p>
            <div className="flex items-end gap-2 h-32">
                {data.map((d) => {
                    const val = Number(d[valueKey])
                    const pct = max > 0 ? (val / max) * 100 : 0
                    return (
                        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="relative w-full flex items-end justify-center" style={{ height: "100px" }}>
                                <div className={`w-full rounded-t transition-all ${color}`} style={{ height: `${Math.max(pct, 2)}%` }} title={String(val)} />
                            </div>
                            <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">{d.month}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function SimpleBarChart({ data, maxVal, labelKey, valueKey, color, unit = "" }: {
    data: Record<string, unknown>[]
    maxVal: number
    labelKey: string
    valueKey: string
    color: string
    unit?: string
}) {
    return (
        <div className="space-y-2">
            {data.map((row, i) => {
                const val = Number(row[valueKey] ?? 0)
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                return (
                    <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)] font-bold w-16 shrink-0 truncate text-right">{String(row[labelKey] ?? "")}</span>
                        <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-black tabular-nums w-12 text-right shrink-0">{val.toLocaleString()}{unit}</span>
                    </div>
                )
            })}
        </div>
    )
}

interface StatCardProps { label: string; value: string | number; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
    return (
        <div className="glass-card p-5 border border-[var(--border-default)] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl">
            <div className={`inline-flex p-2 ${color} rounded-lg mb-3`}>
                <Icon size={16} className="" />
            </div>
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{label}</p>
            <h3 className="text-3xl font-black font-heading mt-1">{typeof value === "number" ? value.toLocaleString() : value}</h3>
        </div>
    )
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function DeviceIcon({ device }: { device: string }) {
    const d = device.toLowerCase()
    if (d === "mobile") return <Smartphone size={12} className="text-blue-400" />
    if (d === "tablet") return <Tablet size={12} className="text-purple-400" />
    return <Monitor size={12} className="text-emerald-400" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    // Platform stats (6-month)
    const [analytics, setAnalytics] = React.useState<AnalyticsMonth[]>([])
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [platformLoading, setPlatformLoading] = React.useState(true)
    const [platformError, setPlatformError] = React.useState<string | null>(null)

    // Traffic analytics
    const [traffic, setTraffic] = React.useState<TrafficAnalytics | null>(null)
    const [trafficLoading, setTrafficLoading] = React.useState(true)
    const [dateRange, setDateRange] = React.useState<DateRangePreset>("30d")
    const [customStart, setCustomStart] = React.useState("")
    const [customEnd, setCustomEnd] = React.useState("")

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace("/auth/login"); return }
            if (profile?.role !== "ADMIN") { router.replace("/dashboard"); return }
        }
    }, [user, profile, authLoading, router])

    const fetchPlatformData = React.useCallback(() => {
        if (profile?.role !== "ADMIN") return
        setPlatformLoading(true)
        setPlatformError(null)
        Promise.all([getAdminAnalytics(), getAdminStats()])
            .then(([a, s]) => { setAnalytics(a); setStats(s) })
            .catch(err => setPlatformError(err.message || "Failed to load platform stats"))
            .finally(() => setPlatformLoading(false))
    }, [profile])

    const fetchTrafficData = React.useCallback(() => {
        if (profile?.role !== "ADMIN") return
        setTrafficLoading(true)
        let fromDate: string | undefined
        let toDate: string | undefined
        const now = new Date()
        if (dateRange === "custom") {
            fromDate = customStart
            toDate = customEnd
        } else {
            const days = dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30
            fromDate = fmtDate(subDaysNative(now, days))
            toDate = fmtDate(now)
        }
        getTrafficAnalytics(fromDate, toDate)
            .then(setTraffic)
            .catch(console.error)
            .finally(() => setTrafficLoading(false))
    }, [profile, dateRange, customStart, customEnd])

    React.useEffect(() => { fetchPlatformData() }, [fetchPlatformData])
    React.useEffect(() => { fetchTrafficData() }, [fetchTrafficData])

    if (authLoading || (user && !profile) || platformLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== "ADMIN") return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split("@")[0] || "Admin")
    const totalRevenue6m = analytics.reduce((s, m) => s + m.revenue, 0)
    const totalUsers6m = analytics.reduce((s, m) => s + m.newUsers, 0)
    const totalListings6m = analytics.reduce((s, m) => s + m.newListings, 0)

    // Enrich DOW data with labels
    const dowData = traffic?.busyDayOfWeek.map(r => ({
        day: DOW_LABELS[r.dow] ?? String(r.dow),
        sessions: r.sessions,
    })) ?? []
    const maxDowSessions = Math.max(...dowData.map(r => r.sessions), 1)

    // Enrich hour data
    const hourData = traffic?.busyHour.map(r => ({
        hour: `${String(r.hour).padStart(2, "0")}:00`,
        sessions: r.sessions,
    })) ?? []
    const maxHourSessions = Math.max(...hourData.map(r => r.sessions), 1)

    // Traffic by day
    const maxDaySessions = Math.max(...(traffic?.trafficByDay.map(r => r.sessions) ?? []), 1)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-[var(--text-muted)] hover:text-primary dark:hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                                <TrendingUp className="text-yellow-400 hidden sm:block" size={28} />
                                Platform Analytics
                            </h1>
                        </div>
                        <Button onClick={() => { fetchPlatformData(); fetchTrafficData() }} disabled={platformLoading || trafficLoading} variant="outline" className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border-[var(--border-default)]">
                            <RefreshCw size={16} className={(platformLoading || trafficLoading) ? "animate-spin" : ""} /> Refresh
                        </Button>
                    </div>

                    {platformError && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {platformError}</div>}

                    {/* ── 6-month summary ── */}
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 px-1">Platform Overview — Last 6 Months</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {([
                                { label: "Revenue (6m)", value: formatPrice(totalRevenue6m), icon: DollarSign, color: "bg-yellow-500/20" },
                                { label: "New Users (6m)", value: totalUsers6m as string | number, icon: Users, color: "bg-blue-500/20" },
                                { label: "New Listings (6m)", value: totalListings6m as string | number, icon: Car, color: "bg-primary/20" },
                            ] as StatCardProps[]).map(c => <StatCard key={c.label} {...c} />)}
                        </div>
                    </div>

                    {/* ── Monthly bar charts ── */}
                    {analytics.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {[
                                { key: "revenue" as const, color: "bg-yellow-500/70", label: "Monthly Revenue" },
                                { key: "newUsers" as const, color: "bg-blue-500/70", label: "New User Registrations" },
                                { key: "newListings" as const, color: "bg-primary/70", label: "New Listings Created" },
                            ].map(({ key, color, label }) => (
                                <div key={key} className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                    <BarChart data={analytics} valueKey={key} color={color} label={label} />
                                    <div className="mt-4 space-y-1">
                                        {analytics.map(d => (
                                            <div key={d.month} className="flex justify-between text-xs">
                                                <span className="text-[var(--text-muted)]">{d.month}</span>
                                                <span className="font-bold">{key === "revenue" ? formatPrice(Number(d[key])) : d[key]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── All-time stats ── */}
                    {stats && (
                        <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">All-Time Platform Stats</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                {[
                                    { label: "Total Users", value: stats.totalUsers.toLocaleString() },
                                    { label: "Total Listings", value: stats.totalListings.toLocaleString() },
                                    { label: "Active Listings", value: stats.activeListings.toLocaleString() },
                                    { label: "Vehicles Sold", value: stats.soldListings.toLocaleString() },
                                    { label: "Total Auctions", value: stats.totalAuctions.toLocaleString() },
                                    { label: "Active Auctions", value: stats.activeAuctions.toLocaleString() },
                                    { label: "Ended Auctions", value: stats.endedAuctions.toLocaleString() },
                                    { label: "Total Bids", value: stats.totalBids.toLocaleString() },
                                ].map(item => (
                                    <div key={item.label} className="p-3 bg-[var(--bg-card)] rounded-xl">
                                        <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{item.label}</p>
                                        <p className="text-2xl font-black font-heading mt-1">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════
                        WEBSITE TRAFFIC & VISITORS
                    ════════════════════════════════════════════════ */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-1 px-1">Website Traffic & Visitors</p>
                                <p className="text-xs text-gray-700 px-1">Derived from on-site event tracking. Geo data enriches over time.</p>
                            </div>
                        </div>

                        {/* Date range for traffic */}
                        <div className="mb-5">
                            <DateRangeFilter
                                activeRange={dateRange}
                                onRangeChange={setDateRange}
                                customStart={customStart}
                                customEnd={customEnd}
                                onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e) }}
                            />
                        </div>

                        {trafficLoading ? (
                            <div className="flex items-center justify-center py-16 gap-3">
                                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                                <span className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Loading traffic data…</span>
                            </div>
                        ) : traffic ? (
                            <div className="space-y-5">
                                {/* ── Traffic KPI overview ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {([
                                        { label: "Page Views", value: traffic.overview.pageViews.toLocaleString(), icon: Eye, color: "bg-blue-500/20" },
                                        { label: "Unique Visitors", value: traffic.overview.uniqueVisitors.toLocaleString(), icon: Users, color: "bg-emerald-500/20" },
                                        { label: "Pages / Visit", value: traffic.overview.pagesPerVisit.toFixed(1), icon: MousePointerClick, color: "bg-purple-500/20" },
                                        { label: "Searches", value: traffic.overview.searches.toLocaleString(), icon: Search, color: "bg-amber-500/20" },
                                    ] as StatCardProps[]).map(card => (
                                        <StatCard key={card.label} {...card} />
                                    ))}
                                </div>

                                {/* ── Traffic by day ── */}
                                {traffic.trafficByDay.length > 0 && (
                                    <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Calendar size={14} className="text-[var(--text-muted)]" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Traffic by Day</p>
                                        </div>
                                        <div className="flex items-end gap-1 h-28">
                                            {traffic.trafficByDay.map(d => {
                                                const pct = (d.sessions / maxDaySessions) * 100
                                                return (
                                                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                                                        <div className="relative w-full flex items-end" style={{ height: "88px" }}>
                                                            <div
                                                                className="w-full rounded-t bg-primary/60 group-hover:bg-primary transition-all duration-300"
                                                                style={{ height: `${Math.max(pct, 2)}%` }}
                                                                title={`${d.date}: ${d.sessions} sessions, ${d.pageviews} views`}
                                                            />
                                                        </div>
                                                        <span className="text-[7px] text-[var(--text-secondary)] group-hover:text-[var(--text-muted)] transition-colors rotate-90 origin-center hidden xl:block">
                                                            {d.date.slice(5)}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)] mt-2 font-medium">{traffic.trafficByDay.length} days · bars = unique sessions</p>
                                    </div>
                                )}

                                {/* ── Busiest day of week + Busiest hour ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <BarChart3 size={14} className="text-amber-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Busiest Days of Week</p>
                                        </div>
                                        <SimpleBarChart
                                            data={dowData as Record<string, unknown>[]}
                                            maxVal={maxDowSessions}
                                            labelKey="day"
                                            valueKey="sessions"
                                            color="bg-amber-500/70"
                                            unit=" sessions"
                                        />
                                    </div>
                                    <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Clock size={14} className="text-cyan-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Busiest Hours of Day</p>
                                        </div>
                                        <SimpleBarChart
                                            data={hourData as Record<string, unknown>[]}
                                            maxVal={maxHourSessions}
                                            labelKey="hour"
                                            valueKey="sessions"
                                            color="bg-cyan-500/70"
                                            unit=" sessions"
                                        />
                                    </div>
                                </div>

                                {/* ── Top pages + Top searches ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Eye size={13} className="text-blue-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Top Pages</p>
                                        </div>
                                        {traffic.topPages.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No page view data yet</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.topPages.slice(0, 10).map((p, i) => (
                                                    <div key={p.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-xs font-black text-[var(--text-secondary)] w-4 shrink-0">{i + 1}</span>
                                                        <span className="flex-1 text-xs text-[var(--text-secondary)] truncate font-medium">{p.url}</span>
                                                        <span className="text-xs font-black tabular-nums">{p.views.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Search size={13} className="text-amber-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">What Visitors Search For</p>
                                        </div>
                                        {traffic.topSearches.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No search data yet</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.topSearches.slice(0, 10).map((s, i) => (
                                                    <div key={s.query} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-xs font-black text-[var(--text-secondary)] w-4 shrink-0">{i + 1}</span>
                                                        <span className="flex-1 text-xs text-[var(--text-secondary)] truncate font-medium">"{s.query}"</span>
                                                        <span className="text-xs font-black tabular-nums">{s.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Referrers + Devices ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Globe size={13} className="text-emerald-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Where Visitors Come From</p>
                                        </div>
                                        {traffic.referrers.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No referrer data yet</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.referrers.slice(0, 10).map((r, i) => (
                                                    <div key={r.referrer} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-xs font-black text-[var(--text-secondary)] w-4 shrink-0">{i + 1}</span>
                                                        <span className="flex-1 text-xs text-[var(--text-secondary)] truncate font-medium">{r.referrer}</span>
                                                        <span className="text-xs font-black tabular-nums">{r.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Monitor size={13} className="text-purple-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Devices</p>
                                        </div>
                                        {traffic.devices.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No device data yet</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.devices.map(d => {
                                                    const total = traffic.devices.reduce((s, x) => s + x.count, 0)
                                                    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                                                    return (
                                                        <div key={d.device} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                                                            <DeviceIcon device={d.device} />
                                                            <span className="flex-1 text-xs text-[var(--text-secondary)] font-bold capitalize">{d.device}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                                                                </div>
                                                                <span className="text-xs text-[var(--text-muted)] font-bold w-8 text-right">{pct}%</span>
                                                            </div>
                                                            <span className="text-xs font-black tabular-nums w-12 text-right">{d.count.toLocaleString()}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Top cities + Top countries ── */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Globe size={13} className="text-rose-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Top Cities</p>
                                        </div>
                                        {traffic.topCities.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No city data yet — geo enriches over time</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.topCities.slice(0, 10).map((c, i) => (
                                                    <div key={c.city} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-xs font-black text-[var(--text-secondary)] w-4 shrink-0">{i + 1}</span>
                                                        <span className="flex-1 text-xs text-[var(--text-secondary)] truncate font-medium">{c.city}</span>
                                                        <span className="text-xs font-black tabular-nums">{c.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-2">
                                            <Globe size={13} className="text-indigo-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Top Countries</p>
                                        </div>
                                        {traffic.topCountries.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No country data yet — geo enriches over time</p>
                                        ) : (
                                            <div className="divide-y divide-white/[0.03]">
                                                {traffic.topCountries.slice(0, 10).map((c, i) => (
                                                    <div key={c.country} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                        <span className="text-xs font-black text-[var(--text-secondary)] w-4 shrink-0">{i + 1}</span>
                                                        <span className="flex-1 text-xs text-[var(--text-secondary)] truncate font-medium">{c.country}</span>
                                                        <span className="text-xs font-black tabular-nums">{c.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </main>
            </div>
        </div>
    )
}
