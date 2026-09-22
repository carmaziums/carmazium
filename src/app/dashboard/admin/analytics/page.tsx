"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    TrendingUp, Loader2, ArrowLeft, Users, Car, DollarSign, RefreshCw,
    Eye, Search, Globe, Monitor, Smartphone, Tablet, MousePointerClick,
    Clock, BarChart3, Calendar, ShieldCheck, UserX, Building2, CheckCircle2, CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getAdminAnalytics, getAdminStats, getTrafficAnalytics, getAccountVerificationStats,
    getLiveValuationAnalytics,
    type AnalyticsMonth, type AdminStats, type TrafficAnalytics, type AccountVerificationStats,
    type ValuationLiveAnalytics,
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
                        <div className="flex-1 h-2 bg-[var(--bg-input)] rounded-full overflow-hidden">
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
        <div className="glass-card p-5 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
            <div className={`inline-flex p-2 ${color} rounded-lg mb-3`}>
                <Icon size={16} className="" />
            </div>
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest font-bold">{label}</p>
            <h3 className="text-3xl font-black font-heading mt-1 text-[var(--text-primary)]">{typeof value === "number" ? value.toLocaleString() : value}</h3>
        </div>
    )
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function DeviceIcon({ device }: { device: string }) {
    const d = device.toLowerCase()
    if (d === "mobile") return <Smartphone size={12} className="text-blue-600 dark:text-blue-400" />
    if (d === "tablet") return <Tablet size={12} className="text-purple-600 dark:text-purple-400" />
    return <Monitor size={12} className="text-emerald-600 dark:text-emerald-400" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    // Platform stats (6-month + account verification)
    const [analytics, setAnalytics] = React.useState<AnalyticsMonth[]>([])
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [verification, setVerification] = React.useState<AccountVerificationStats | null>(null)
    const [platformLoading, setPlatformLoading] = React.useState(true)
    const [platformError, setPlatformError] = React.useState<string | null>(null)

    // Traffic analytics
    const [traffic, setTraffic] = React.useState<TrafficAnalytics | null>(null)
    const [trafficLoading, setTrafficLoading] = React.useState(true)
    const [dateRange, setDateRange] = React.useState<DateRangePreset>("30d")
    const [customStart, setCustomStart] = React.useState("")
    const [customEnd, setCustomEnd] = React.useState("")

    // Live vehicle valuation analytics
    const [valuationLive, setValuationLive] = React.useState<ValuationLiveAnalytics | null>(null)
    const [valuationLoading, setValuationLoading] = React.useState(true)
    const [valuationError, setValuationError] = React.useState<string | null>(null)

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
        Promise.all([getAdminAnalytics(), getAdminStats(), getAccountVerificationStats()])
            .then(([a, s, v]) => { setAnalytics(a); setStats(s); setVerification(v) })
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

    const fetchValuationData = React.useCallback((showSpinner = false) => {
        if (profile?.role !== "ADMIN") return
        if (showSpinner) setValuationLoading(true)
        setValuationError(null)
        getLiveValuationAnalytics()
            .then(setValuationLive)
            .catch(err => setValuationError(err.message || "Failed to load valuation analytics"))
            .finally(() => setValuationLoading(false))
    }, [profile])

    React.useEffect(() => { fetchPlatformData() }, [fetchPlatformData])
    React.useEffect(() => { fetchTrafficData() }, [fetchTrafficData])
    React.useEffect(() => {
        if (profile?.role !== "ADMIN") return
        fetchValuationData(true)
        const timer = window.setInterval(() => fetchValuationData(false), 15_000)
        return () => window.clearInterval(timer)
    }, [profile, fetchValuationData])

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

    const sellerFunnel7d = valuationLive?.last7Days.reduce((acc, row) => ({
        valuations: acc.valuations + row.valuationJourneys,
        started: acc.started + row.listingStarted,
        created: acc.created + row.listingCreated,
        retailCreated: acc.retailCreated + row.retailListingsCreated,
        auctionCreated: acc.auctionCreated + row.auctionListingsCreated,
        retailFeePaid: acc.retailFeePaid + row.retailFeePaid,
        reachedReview: acc.reachedReview + row.reachedReview,
        retailReachedReview: acc.retailReachedReview + row.retailReachedReview,
        auctionReachedReview: acc.auctionReachedReview + row.auctionReachedReview,
        approvedLive: acc.approvedLive + row.approvedLive,
        rejected: acc.rejected + row.rejected,
    }), {
        valuations: 0,
        started: 0,
        created: 0,
        retailCreated: 0,
        auctionCreated: 0,
        retailFeePaid: 0,
        reachedReview: 0,
        retailReachedReview: 0,
        auctionReachedReview: 0,
        approvedLive: 0,
        rejected: 0,
    }) ?? null

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
                        <Button onClick={() => { fetchPlatformData(); fetchTrafficData(); fetchValuationData(true) }} disabled={platformLoading || trafficLoading || valuationLoading} variant="outline" className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border-[var(--border-default)]">
                            <RefreshCw size={16} className={(platformLoading || trafficLoading || valuationLoading) ? "animate-spin" : ""} /> Refresh
                        </Button>
                    </div>

                    {platformError && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-700 dark:text-red-300"><strong>Error:</strong> {platformError}</div>}

                    {/* ── Live vehicle valuation activity ── */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 px-1">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                    </span>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Car Valuation — Live</p>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Today uses Europe/London time · refreshes automatically every 15 seconds.</p>
                            </div>
                            {valuationLive && (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                    Updated {new Date(valuationLive.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                </p>
                            )}
                        </div>

                        {valuationError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-700 dark:text-red-300">
                                {valuationError}
                            </div>
                        )}

                        {valuationLoading && !valuationLive ? (
                            <div className="h-28 flex items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            </div>
                        ) : valuationLive ? (
                            <>
                                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                                    {([
                                        { label: "Valuations Today", value: valuationLive.today.valuationJourneys, icon: Car, color: "bg-blue-500/20" },
                                        { label: "Started Listing", value: valuationLive.today.listingStarted, icon: MousePointerClick, color: "bg-cyan-500/20" },
                                        { label: "Listings Created", value: valuationLive.today.listingCreated, icon: BarChart3, color: "bg-primary/20" },
                                        { label: "Retail Fees Paid", value: valuationLive.today.retailFeePaid, icon: CreditCard, color: "bg-purple-500/20" },
                                        { label: "Reached Review", value: valuationLive.today.reachedReview, icon: ShieldCheck, color: "bg-orange-500/20" },
                                        { label: "Approved & Live", value: valuationLive.today.approvedLive, icon: CheckCircle2, color: "bg-emerald-500/20" },
                                        { label: "Valuation → Listing", value: `${valuationLive.today.conversionRate.toFixed(1)}%`, icon: TrendingUp, color: "bg-yellow-500/20" },
                                        { label: "Valuation → Live", value: `${valuationLive.today.liveFromValuationRate.toFixed(1)}%`, icon: TrendingUp, color: "bg-slate-500/20" },
                                    ] as StatCardProps[]).map(card => (
                                        <StatCard key={card.label} {...card} />
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Clock size={14} className="text-cyan-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Today by Hour</p>
                                        </div>
                                        {valuationLive.hourly.length > 0 ? (
                                            <SimpleBarChart
                                                data={valuationLive.hourly as unknown as Record<string, unknown>[]}
                                                maxVal={Math.max(...valuationLive.hourly.map(r => r.requests), 1)}
                                                labelKey="hour"
                                                valueKey="requests"
                                                color="bg-cyan-500/70"
                                                unit=""
                                            />
                                        ) : (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold py-8 text-center">No valuations recorded today</p>
                                        )}
                                    </div>

                                    <div className="glass-card p-6 border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Calendar size={14} className="text-emerald-600 dark:text-emerald-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Last 7 Days</p>
                                        </div>
                                        {valuationLive.last7Days.length > 0 ? (
                                            <SimpleBarChart
                                                data={valuationLive.last7Days.map(r => ({ ...r, date: r.date.slice(5) })) as unknown as Record<string, unknown>[]}
                                                maxVal={Math.max(...valuationLive.last7Days.map(r => r.requests), 1)}
                                                labelKey="date"
                                                valueKey="requests"
                                                color="bg-emerald-500/70"
                                                unit=""
                                            />
                                        ) : (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold py-8 text-center">No valuation history yet</p>
                                        )}
                                    </div>
                                </div>

                                <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                    <div className="p-5 border-b border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <TrendingUp size={15} className="text-yellow-400" />
                                                <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Seller Commercial Funnel — Last 7 Days</p>
                                            </div>
                                            <p className="text-[11px] text-[var(--text-muted)] mt-1">Valuation → listing → payment/review → admin approval and live vehicle.</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">30-day attribution window</span>
                                    </div>

                                    {sellerFunnel7d && (
                                        <div className="p-5 border-b border-[var(--border-default)]">
                                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                                                {[
                                                    { label: "Valuations", value: sellerFunnel7d.valuations, sub: "Funnel entry", icon: Car },
                                                    { label: "Started Listing", value: sellerFunnel7d.started, sub: sellerFunnel7d.valuations ? `${((sellerFunnel7d.started / sellerFunnel7d.valuations) * 100).toFixed(1)}% of valuations` : "0.0% of valuations", icon: MousePointerClick },
                                                    { label: "Listings Created", value: sellerFunnel7d.created, sub: sellerFunnel7d.valuations ? `${((sellerFunnel7d.created / sellerFunnel7d.valuations) * 100).toFixed(1)}% of valuations` : "0.0% of valuations", icon: BarChart3 },
                                                    { label: "Reached Review", value: sellerFunnel7d.reachedReview, sub: sellerFunnel7d.created ? `${((sellerFunnel7d.reachedReview / sellerFunnel7d.created) * 100).toFixed(1)}% of listings` : "0.0% of listings", icon: ShieldCheck },
                                                    { label: "Approved & Live", value: sellerFunnel7d.approvedLive, sub: sellerFunnel7d.valuations ? `${((sellerFunnel7d.approvedLive / sellerFunnel7d.valuations) * 100).toFixed(1)}% of valuations` : "0.0% of valuations", icon: CheckCircle2 },
                                                ].map(({ label, value, sub, icon: Icon }) => (
                                                    <div key={label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
                                                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                            <Icon size={14} />
                                                            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
                                                        </div>
                                                        <p className="mt-2 text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
                                                        <p className="mt-1 text-[10px] font-bold text-[var(--text-muted)]">{sub}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                                <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                                                    <div className="flex items-center gap-2">
                                                        <CreditCard size={15} className="text-purple-400" />
                                                        <p className="text-xs font-black uppercase tracking-widest text-purple-400">Retail path</p>
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold">
                                                        {sellerFunnel7d.retailCreated} retail listings → {sellerFunnel7d.retailFeePaid} listing fees paid → {sellerFunnel7d.retailReachedReview} reached review
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">Fee paid is read from completed LISTING_FEE transactions, not just the checkout success page.</p>
                                                </div>
                                                <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-4">
                                                    <div className="flex items-center gap-2">
                                                        <BarChart3 size={15} className="text-orange-400" />
                                                        <p className="text-xs font-black uppercase tracking-widest text-orange-400">Auction path</p>
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold">
                                                        {sellerFunnel7d.auctionCreated} auction listings → {sellerFunnel7d.auctionReachedReview} reached review
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">Auction listings are free, so there is no seller listing-fee stage.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-muted)]">
                                                    <th className="px-4 py-3 font-bold">Date</th>
                                                    <th className="px-4 py-3 font-bold text-right">Valuations</th>
                                                    <th className="px-4 py-3 font-bold text-right">Started</th>
                                                    <th className="px-4 py-3 font-bold text-right">Created</th>
                                                    <th className="px-4 py-3 font-bold text-right">Retail Fee Paid</th>
                                                    <th className="px-4 py-3 font-bold text-right">Auction → Review</th>
                                                    <th className="px-4 py-3 font-bold text-right">Reached Review</th>
                                                    <th className="px-4 py-3 font-bold text-right">Approved / Live</th>
                                                    <th className="px-4 py-3 font-bold text-right">Live / Valuation</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {valuationLive.last7Days.map(row => (
                                                    <tr key={row.date} className="border-b border-[var(--border-default)]/60">
                                                        <td className="px-4 py-3 font-bold whitespace-nowrap">{new Date(`${row.date}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{row.valuationJourneys}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{row.listingStarted}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black">{row.listingCreated}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-purple-400">{row.retailFeePaid}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums text-orange-400">{row.auctionReachedReview}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{row.reachedReview}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black text-emerald-400">{row.approvedLive}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black text-yellow-400">{row.liveFromValuationRate.toFixed(1)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-3 border-t border-[var(--border-default)] text-[11px] text-[var(--text-muted)]">
                                        Admin approval makes a listing live immediately, so “Approved” and “Vehicle Live” are the same lifecycle transition in CarMazium.
                                        {sellerFunnel7d && sellerFunnel7d.rejected > 0 ? ` ${sellerFunnel7d.rejected} attributed listing(s) are currently rejected and need seller corrections.` : ""}
                                    </div>
                                </div>

                                <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                    <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Car size={14} className="text-primary" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Latest Valuation Activity</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-[var(--text-secondary)]">No personal identifiers shown</span>
                                    </div>
                                    {valuationLive.recent.length === 0 ? (
                                        <p className="text-xs text-[var(--text-secondary)] font-bold p-6 text-center">No recent valuations</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-muted)]">
                                                        <th className="px-4 py-3 font-bold">Time</th>
                                                        <th className="px-4 py-3 font-bold">Vehicle</th>
                                                        <th className="px-4 py-3 font-bold">Route</th>
                                                        <th className="px-4 py-3 font-bold">Outcome</th>
                                                        <th className="px-4 py-3 font-bold">Fuel</th>
                                                        <th className="px-4 py-3 font-bold">Device</th>
                                                        <th className="px-4 py-3 font-bold">Location</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {valuationLive.recent.map(item => (
                                                        <tr key={item.id} className="border-b border-[var(--border-default)]/60 hover:bg-[var(--bg-card-hover)]">
                                                            <td className="px-4 py-3 whitespace-nowrap font-bold">
                                                                {new Date(item.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                {[item.year, item.make, item.model].filter(Boolean).join(" ") || "Unknown"}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="rounded-full bg-primary/10 px-2 py-1 font-bold uppercase text-primary">
                                                                    {item.listingType || "—"}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {item.approvedLive ? (
                                                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-black uppercase text-emerald-400">Approved & Live</span>
                                                                ) : item.rejected ? (
                                                                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-black uppercase text-rose-400">Rejected</span>
                                                                ) : item.reachedReview ? (
                                                                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-black uppercase text-cyan-400">In Review</span>
                                                                ) : item.feePaid ? (
                                                                    <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-1 font-black uppercase text-purple-400">Fee Paid</span>
                                                                ) : item.createdListing ? (
                                                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-black uppercase text-blue-400">Listing Created</span>
                                                                ) : item.startedListing ? (
                                                                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-black uppercase text-amber-400">Started</span>
                                                                ) : (
                                                                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-bold uppercase text-[var(--text-muted)]">Valuation Only</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-[var(--text-muted)]">{item.fuelType || "—"}</td>
                                                            <td className="px-4 py-3 capitalize text-[var(--text-muted)]">{item.device || "—"}</td>
                                                            <td className="px-4 py-3 text-[var(--text-muted)]">{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <p className="px-1 text-[11px] leading-5 text-[var(--text-muted)]">
                                    The funnel attributes a listing to a valuation for up to 30 days. New journeys use an exact non-personal valuation ID; older history falls back to same-session matching. Retail payment comes from completed transaction records, and approval/live status comes from the listing lifecycle plus server-side approval telemetry. The valuation denominator still covers first-party analytics-consented journeys, so use these figures as conversion telemetry rather than a census of every visitor.
                                </p>
                            </>
                        ) : null}
                    </div>

                    {/* ── 6-month summary ── */}
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-3 px-1">Platform Overview — Last 6 Months</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {([
                                { label: "Retained Revenue (6m)", value: formatPrice(totalRevenue6m), icon: DollarSign, color: "bg-yellow-500/20" },
                                { label: "New Registrations (6m)", value: totalUsers6m as string | number, icon: Users, color: "bg-blue-500/20" },
                                { label: "New Listings (6m)", value: totalListings6m as string | number, icon: Car, color: "bg-primary/20" },
                            ] as StatCardProps[]).map(c => <StatCard key={c.label} {...c} />)}
                        </div>
                    </div>

                    {/* ── Account verification snapshot ── */}
                    {verification && (
                        <div>
                            <div className="flex items-end justify-between gap-3 mb-3 px-1">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Account Verification</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Unverified accounts remain recoverable in the database but are hidden from public profile surfaces.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {([
                                    { label: "Verified Accounts", value: verification.verifiedAccounts, icon: ShieldCheck, color: "bg-emerald-500/20" },
                                    { label: "Awaiting Email Verification", value: verification.unverifiedAccounts, icon: UserX, color: "bg-amber-500/20" },
                                    { label: "Verified Dealer Businesses", value: verification.verifiedDealerBusinesses, icon: Building2, color: "bg-blue-500/20" },
                                    { label: "Dealer KYC Not Verified", value: verification.unverifiedDealerBusinessRecords, icon: Building2, color: "bg-rose-500/20" },
                                ] as StatCardProps[]).map(c => <StatCard key={c.label} {...c} />)}
                            </div>
                            <p className="mt-3 px-1 text-xs text-[var(--text-muted)]">
                                {verification.publicVerifiedProfiles.toLocaleString()} verified accounts currently allow a public profile · {verification.activeAccounts.toLocaleString()} active account records in total.
                            </p>
                        </div>
                    )}

                    {/* ── Monthly bar charts ── */}
                    {analytics.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {[
                                { key: "revenue" as const, color: "bg-yellow-500/70", label: "Monthly Retained Revenue" },
                                { key: "newUsers" as const, color: "bg-blue-500/70", label: "New Account Registrations" },
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                                {[
                                    { label: "Registered Accounts", value: stats.totalUsers.toLocaleString() },
                                    { label: "Retained Revenue", value: formatPrice(stats.totalRevenue) },
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
                            <p className="text-xs text-[var(--text-muted)] mt-4">Revenue is CarMazium-retained platform income, not customer-to-seller or other pass-through transaction value.</p>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════
                        WEBSITE TRAFFIC & VISITORS
                    ════════════════════════════════════════════════ */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-1 px-1">Public Website Traffic</p>
                                <p className="text-xs text-[var(--text-muted)] px-1">Live first-party CarMazium event data. Dashboard, admin and authentication routes are excluded.</p>
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
                                        { label: "Public Page Views", value: traffic.overview.pageViews.toLocaleString(), icon: Eye, color: "bg-blue-500/20" },
                                        { label: "Unique Sessions", value: traffic.overview.uniqueVisitors.toLocaleString(), icon: Users, color: "bg-emerald-500/20" },
                                        { label: "Pages / Session", value: traffic.overview.pagesPerVisit.toFixed(1), icon: MousePointerClick, color: "bg-purple-500/20" },
                                        { label: "Searches", value: traffic.overview.searches.toLocaleString(), icon: Search, color: "bg-amber-500/20" },
                                    ] as StatCardProps[]).map(card => (
                                        <StatCard key={card.label} {...card} />
                                    ))}
                                </div>

                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-[var(--text-muted)]">
                                    <strong className="text-cyan-700 dark:text-cyan-300">Data quality:</strong> “Unique Sessions” is based on CarMazium&apos;s first-party session ID and is not presented as unique people. {traffic.overview.excludedInternalPageViews.toLocaleString()} internal dashboard/admin/auth page views were excluded from this selected period.
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
                                            <Eye size={13} className="text-blue-600 dark:text-blue-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Top Public Pages</p>
                                        </div>
                                        {traffic.topPages.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No page view data yet</p>
                                        ) : (
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.topPages.slice(0, 10).map((p, i) => (
                                                    <div key={p.url} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
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
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.topSearches.slice(0, 10).map((s, i) => (
                                                    <div key={s.query} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
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
                                            <Globe size={13} className="text-emerald-600 dark:text-emerald-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Where Visitors Come From</p>
                                        </div>
                                        {traffic.referrers.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No referrer data yet</p>
                                        ) : (
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.referrers.slice(0, 10).map((r, i) => (
                                                    <div key={r.referrer} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
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
                                            <Monitor size={13} className="text-purple-600 dark:text-purple-400" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Devices</p>
                                        </div>
                                        {traffic.devices.length === 0 ? (
                                            <p className="text-xs text-[var(--text-secondary)] font-bold p-4 text-center">No device data yet</p>
                                        ) : (
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.devices.map(d => {
                                                    const total = traffic.devices.reduce((s, x) => s + x.count, 0)
                                                    const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                                                    return (
                                                        <div key={d.device} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)] transition-colors">
                                                            <DeviceIcon device={d.device} />
                                                            <span className="flex-1 text-xs text-[var(--text-secondary)] font-bold capitalize">{d.device}</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
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
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.topCities.slice(0, 10).map((c, i) => (
                                                    <div key={c.city} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
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
                                            <div className="divide-y divide-[var(--border-default)]">
                                                {traffic.topCountries.slice(0, 10).map((c, i) => (
                                                    <div key={c.country} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
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
