"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    TrendingUp, Loader2, ArrowLeft, Users, Car, DollarSign, RefreshCw,
    Eye, Search, Globe, Monitor, Smartphone, Tablet, MousePointerClick,
    Clock, BarChart3, Calendar, ShieldCheck, UserX, Building2, CheckCircle2, CreditCard, AlertTriangle, Download,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getAdminAnalytics, getAdminStats, getTrafficAnalytics, getAccountVerificationStats,
    getLiveValuationAnalytics, getAuctionFirstOfferAnalytics,
    type AnalyticsMonth, type AdminStats, type TrafficAnalytics, type AccountVerificationStats,
    type ValuationLiveAnalytics, type AuctionFirstOfferAnalytics,
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

    // Auction zero-bid / discounted first-offer analytics
    const [firstOfferAnalytics, setFirstOfferAnalytics] = React.useState<AuctionFirstOfferAnalytics | null>(null)
    const [firstOfferLoading, setFirstOfferLoading] = React.useState(true)
    const [firstOfferError, setFirstOfferError] = React.useState<string | null>(null)
    const [firstOfferDays, setFirstOfferDays] = React.useState(30)

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

    const fetchFirstOfferData = React.useCallback((showSpinner = false) => {
        if (profile?.role !== "ADMIN") return
        if (showSpinner) setFirstOfferLoading(true)
        setFirstOfferError(null)
        getAuctionFirstOfferAnalytics(firstOfferDays)
            .then(setFirstOfferAnalytics)
            .catch(err => setFirstOfferError(err.message || "Failed to load auction first-offer analytics"))
            .finally(() => setFirstOfferLoading(false))
    }, [profile, firstOfferDays])

    React.useEffect(() => { fetchPlatformData() }, [fetchPlatformData])
    React.useEffect(() => { fetchTrafficData() }, [fetchTrafficData])
    React.useEffect(() => {
        if (profile?.role !== "ADMIN") return
        fetchValuationData(true)
        const timer = window.setInterval(() => fetchValuationData(false), 15_000)
        return () => window.clearInterval(timer)
    }, [profile, fetchValuationData])

    React.useEffect(() => {
        if (profile?.role !== "ADMIN") return
        fetchFirstOfferData(true)
    }, [profile, fetchFirstOfferData])

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

    const exportValuationAuditCsv = () => {
        if (!valuationLive?.recent.length) return

        const escapeCsv = (value: unknown) => {
            const text = value == null ? "" : String(value)
            return `"${text.replace(/"/g, '""')}"`
        }
        const rows = valuationLive.recent.map((item) => [
            new Date(item.createdAt).toLocaleString("en-GB"),
            item.registration || "",
            item.year || "",
            item.make || "",
            item.model || "",
            item.mileage ?? "",
            item.marketValue ?? "",
            item.valuationLow ?? "",
            item.valuationMid ?? "",
            item.valuationHigh ?? "",
            item.auctionOpeningBid ?? "",
            item.auctionReserveLow ?? "",
            item.auctionReserveHigh ?? "",
            item.auctionSuggestedReserve ?? "",
            item.retailSuggestedAsking ?? "",
            item.retailSuggestedMinimum ?? "",
            item.valuationSource || "",
            item.valuationConfidence || "",
            item.valuationConfidenceScore ?? "",
            item.valuationComparables,
            item.liveMarketStatus || "",
            item.valuationResult || "",
            item.listingType || "",
            item.listingStatus || "",
        ])
        const header = [
            "Date / time",
            "Registration",
            "Year",
            "Make",
            "Model",
            "Mileage",
            "Market value shown",
            "Valuation low",
            "Valuation mid",
            "Valuation high",
            "Auction opening bid",
            "Auction reserve low",
            "Auction reserve high",
            "Auction suggested reserve",
            "Retail suggested asking",
            "Retail suggested minimum",
            "Valuation source",
            "Confidence",
            "Confidence score",
            "Comparables",
            "Live market status",
            "Valuation result",
            "Listing route",
            "Listing status",
        ]
        const csv = [header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `carmazium-valuation-audit-${fmtDate(new Date())}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }

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
                        <Button onClick={() => { fetchPlatformData(); fetchTrafficData(); fetchValuationData(true); fetchFirstOfferData(true) }} disabled={platformLoading || trafficLoading || valuationLoading || firstOfferLoading} variant="outline" className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border-[var(--border-default)]">
                            <RefreshCw size={16} className={(platformLoading || trafficLoading || valuationLoading || firstOfferLoading) ? "animate-spin" : ""} /> Refresh
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

                                <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                    <div className="p-5 border-b border-[var(--border-default)]">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={15} className="text-amber-500" />
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Valuation Reliability — Today</p>
                                        </div>
                                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">Shows whether the valuation problem is isolated or recurring.</p>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <StatCard label="Applied for Valuation" value={valuationLive.today.valuationAttempts} icon={Car} color="bg-blue-500/20" />
                                        <StatCard label="Got Figures" value={valuationLive.today.figuresReturned} icon={CheckCircle2} color="bg-emerald-500/20" />
                                        <StatCard label="No Figures Returned" value={valuationLive.today.withoutFigures} icon={AlertTriangle} color="bg-rose-500/20" />
                                        <StatCard label="Figure Success Rate" value={`${valuationLive.today.figureSuccessRate.toFixed(1)}%`} icon={TrendingUp} color="bg-yellow-500/20" />
                                    </div>
                                    <div className="overflow-x-auto border-t border-[var(--border-default)]">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-muted)]">
                                                    <th className="px-4 py-3 font-bold">Date</th>
                                                    <th className="px-4 py-3 font-bold text-right">Applied</th>
                                                    <th className="px-4 py-3 font-bold text-right">Got Figures</th>
                                                    <th className="px-4 py-3 font-bold text-right">No Figures</th>
                                                    <th className="px-4 py-3 font-bold text-right">Success</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {valuationLive.last7Days.map(row => (
                                                    <tr key={`valuation-health-${row.date}`} className="border-b border-[var(--border-default)]/60">
                                                        <td className="px-4 py-3 font-bold whitespace-nowrap">{new Date(`${row.date}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums">{row.valuationAttempts}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black text-emerald-500">{row.figuresReturned}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black text-rose-500">{row.withoutFigures}</td>
                                                        <td className="px-4 py-3 text-right tabular-nums font-black">{row.figureSuccessRate.toFixed(1)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-3 border-t border-[var(--border-default)] text-[11px] leading-5 text-[var(--text-muted)]">
                                        Reliability tracking starts with this release. “No Figures Returned” counts confirmed customer-visible no-figure results. Very recent attempts can temporarily appear in Applied before their result event arrives.
                                    </div>
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
                                    <div className="p-4 border-b border-[var(--border-default)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Car size={14} className="text-primary" />
                                                <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Valuation Price Audit</p>
                                            </div>
                                            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                                                Latest 100 valuation journeys. New valuations record the registration, mileage and exact guide figures shown to the seller so CarMazium pricing can be benchmarked against the market.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={exportValuationAuditCsv}
                                            disabled={!valuationLive.recent.length}
                                            className="shrink-0"
                                        >
                                            <Download size={14} /> Export CSV
                                        </Button>
                                    </div>
                                    {valuationLive.recent.length === 0 ? (
                                        <p className="text-xs text-[var(--text-secondary)] font-bold p-6 text-center">No recent valuations</p>
                                    ) : (
                                        <div className="max-h-[620px] overflow-auto">
                                            <table className="w-full min-w-[1450px] text-xs">
                                                <thead className="sticky top-0 z-10 bg-[var(--bg-card)]">
                                                    <tr className="border-b border-[var(--border-default)] text-left text-[var(--text-muted)]">
                                                        <th className="px-4 py-3 font-bold">Time</th>
                                                        <th className="px-4 py-3 font-bold">Reg</th>
                                                        <th className="px-4 py-3 font-bold">Vehicle</th>
                                                        <th className="px-4 py-3 font-bold text-right">Mileage</th>
                                                        <th className="px-4 py-3 font-bold text-right">Market Value Shown</th>
                                                        <th className="px-4 py-3 font-bold">Valuation Range</th>
                                                        <th className="px-4 py-3 font-bold text-right">Auction Reserve</th>
                                                        <th className="px-4 py-3 font-bold text-right">Retail Asking</th>
                                                        <th className="px-4 py-3 font-bold">Source</th>
                                                        <th className="px-4 py-3 font-bold">Outcome</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {valuationLive.recent.map(item => (
                                                        <tr key={item.id} className="border-b border-[var(--border-default)]/60 hover:bg-[var(--bg-card-hover)]">
                                                            <td className="px-4 py-3 whitespace-nowrap font-bold">
                                                                <div>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                                                                <div className="text-[10px] text-[var(--text-muted)]">
                                                                    {new Date(item.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                {item.registration ? (
                                                                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono font-black tracking-wider text-amber-500">
                                                                        {item.registration}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[var(--text-muted)]" title="This older valuation was recorded before registration capture was enabled">Legacy —</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="font-bold">{[item.year, item.make, item.model].filter(Boolean).join(" ") || "Unknown"}</div>
                                                                <div className="mt-1 text-[10px] uppercase text-[var(--text-muted)]">{item.fuelType || "—"}</div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                                                                {item.mileage != null ? `${item.mileage.toLocaleString("en-GB")} mi` : "—"}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                                {item.marketValue != null ? (
                                                                    <span className="text-base font-black tabular-nums text-emerald-500">{formatPrice(item.marketValue)}</span>
                                                                ) : item.valuationResult === "figures_returned" ? (
                                                                    <span className="text-[var(--text-muted)]" title="Exact price was not stored for this legacy valuation">Legacy —</span>
                                                                ) : (
                                                                    <span className="font-bold text-rose-500">No figures</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                                                {item.valuationLow != null && item.valuationHigh != null
                                                                    ? `${formatPrice(item.valuationLow)} – ${formatPrice(item.valuationHigh)}`
                                                                    : "—"}
                                                                {item.valuationMid != null && (
                                                                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">Mid {formatPrice(item.valuationMid)}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                                                                {item.auctionSuggestedReserve != null ? formatPrice(item.auctionSuggestedReserve) : "—"}
                                                                {item.auctionReserveLow != null && item.auctionReserveHigh != null && (
                                                                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                                                                        {formatPrice(item.auctionReserveLow)}–{formatPrice(item.auctionReserveHigh)}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">
                                                                {item.retailSuggestedAsking != null ? formatPrice(item.retailSuggestedAsking) : "—"}
                                                                {item.retailSuggestedMinimum != null && (
                                                                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">Min {formatPrice(item.retailSuggestedMinimum)}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold">{item.valuationSource?.replaceAll("_", " ") || "—"}</div>
                                                                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                                                                    {item.valuationComparables} comps
                                                                    {item.valuationConfidence ? ` · ${item.valuationConfidence}` : ""}
                                                                    {item.liveMarketStatus ? ` · ${item.liveMarketStatus}` : ""}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                {item.approvedLive ? (
                                                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-black uppercase text-emerald-400">Approved & Live</span>
                                                                ) : item.rejected ? (
                                                                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 font-black uppercase text-rose-400">Rejected</span>
                                                                ) : item.reachedReview ? (
                                                                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-black uppercase text-cyan-400">In Review</span>
                                                                ) : item.createdListing ? (
                                                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 font-black uppercase text-blue-400">Listing Created</span>
                                                                ) : item.startedListing ? (
                                                                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-black uppercase text-amber-400">Started</span>
                                                                ) : (
                                                                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 font-bold uppercase text-[var(--text-muted)]">Valuation Only</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <p className="px-1 text-[11px] leading-5 text-[var(--text-muted)]">
                                    New valuation journeys now retain the vehicle registration, mileage and exact CarMazium guide figures shown at valuation time for internal pricing QA. Older rows may show “Legacy” because those values were not historically stored; where a legacy valuation later became a listing, registration and mileage are recovered from that listing when available. The funnel still attributes a listing to a valuation for up to 30 days.
                                </p>
                            </>
                        ) : null}
                    </div>

                    {/* ── Auction zero-bid / discounted first-offer analytics ── */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-1">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Auction First-Offer Performance</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    Server-side audit of the zero-bid rule: discounted first offers, competition, cancellations and eventual auction outcome.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {[7, 30, 90].map(days => (
                                    <button
                                        key={days}
                                        onClick={() => setFirstOfferDays(days)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-black transition-colors ${
                                            firstOfferDays === days
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                        }`}
                                    >
                                        {days}d
                                    </button>
                                ))}
                            </div>
                        </div>

                        {firstOfferError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-700 dark:text-red-300">
                                {firstOfferError}
                            </div>
                        )}

                        {firstOfferLoading && !firstOfferAnalytics ? (
                            <div className="h-28 flex items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            </div>
                        ) : firstOfferAnalytics ? (
                            <>
                                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                                    {([
                                        { label: "First Offers", value: firstOfferAnalytics.summary.firstOffers, icon: BarChart3, color: "bg-blue-500/20" },
                                        { label: "Auctions", value: firstOfferAnalytics.summary.uniqueAuctions, icon: Car, color: "bg-cyan-500/20" },
                                        { label: "Got Competition", value: `${firstOfferAnalytics.summary.competitionRate.toFixed(1)}%`, icon: TrendingUp, color: "bg-violet-500/20" },
                                        { label: "Seller Accepted", value: firstOfferAnalytics.summary.sellerAcceptedSales, icon: CheckCircle2, color: "bg-emerald-500/20" },
                                        { label: "Reached Reserve", value: firstOfferAnalytics.summary.reserveMetSales, icon: ShieldCheck, color: "bg-teal-500/20" },
                                        { label: "Sale Rate", value: `${firstOfferAnalytics.summary.saleRate.toFixed(1)}%`, icon: DollarSign, color: "bg-yellow-500/20" },
                                        { label: "First Offer Cancelled", value: firstOfferAnalytics.summary.firstOfferCancellations, icon: AlertTriangle, color: "bg-orange-500/20" },
                                        { label: "Zero-Bid Unsold", value: firstOfferAnalytics.summary.zeroBidUnsold, icon: UserX, color: "bg-rose-500/20" },
                                    ] as StatCardProps[]).map(card => <StatCard key={card.label} {...card} />)}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Average First Offer</p>
                                        <p className="mt-1 text-xl font-black">{firstOfferAnalytics.summary.averageFirstOffer == null ? "—" : formatPrice(firstOfferAnalytics.summary.averageFirstOffer)}</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Average Reserve</p>
                                        <p className="mt-1 text-xl font-black">{firstOfferAnalytics.summary.averageReserveAtFirstOffer == null ? "—" : formatPrice(firstOfferAnalytics.summary.averageReserveAtFirstOffer)}</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Avg Below Reserve</p>
                                        <p className="mt-1 text-xl font-black">{firstOfferAnalytics.summary.averagePercentBelowReserve == null ? "—" : `${firstOfferAnalytics.summary.averagePercentBelowReserve.toFixed(1)}%`}</p>
                                    </div>
                                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Zero-Bid Reserve Changes</p>
                                        <p className="mt-1 text-xl font-black">{firstOfferAnalytics.summary.zeroBidReserveCorrections.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl overflow-hidden">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b border-[var(--border-default)]">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Recent Discounted First Offers</p>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                                                Up to 100 first-offer attempts in the selected window. A cancelled first offer can be followed by another first offer on the same auction.
                                            </p>
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                            {firstOfferAnalytics.summary.pendingAuctions} pending · {firstOfferAnalytics.summary.unsoldAuctions} unsold
                                        </p>
                                    </div>

                                    {firstOfferAnalytics.recent.length === 0 ? (
                                        <p className="p-8 text-center text-sm text-[var(--text-muted)]">No tracked first offers in this period yet.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1180px] text-xs">
                                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Time</th>
                                                        <th className="px-4 py-3 text-left">Vehicle</th>
                                                        <th className="px-4 py-3 text-right">First Offer</th>
                                                        <th className="px-4 py-3 text-right">Reserve</th>
                                                        <th className="px-4 py-3 text-right">Starting Bid</th>
                                                        <th className="px-4 py-3 text-right">Floor</th>
                                                        <th className="px-4 py-3 text-right">Below Reserve</th>
                                                        <th className="px-4 py-3 text-right">Later Bids</th>
                                                        <th className="px-4 py-3 text-left">Outcome</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-default)]">
                                                    {firstOfferAnalytics.recent.map(item => {
                                                        const outcomeLabel =
                                                            item.outcome === "SELLER_ACCEPTED_BELOW_RESERVE" ? "Seller accepted"
                                                            : item.outcome === "RESERVE_MET_SALE" ? "Reached reserve / sold"
                                                            : item.outcome === "BELOW_RESERVE_UNSOLD" ? "Ended below reserve"
                                                            : item.outcome === "SELLER_EARLY_CLOSE_UNSOLD" ? "Seller closed — unsold"
                                                            : item.outcome === "NO_BIDS_UNSOLD" ? "Ended with no bids"
                                                            : "Auction still running / no outcome yet"
                                                        return (
                                                            <tr key={item.id} className="hover:bg-[var(--bg-card-hover)]">
                                                                <td className="px-4 py-3 whitespace-nowrap text-[var(--text-muted)]">
                                                                    {new Date(item.createdAt).toLocaleString("en-GB")}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="font-black text-[var(--text-primary)]">{item.vehicle || "Vehicle"}</div>
                                                                    <div className="text-[10px] text-[var(--text-secondary)]">{item.registration || "No registration"}{item.firstOfferCancelled ? " · first offer cancelled" : ""}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-black">{item.amount == null ? "—" : formatPrice(item.amount)}</td>
                                                                <td className="px-4 py-3 text-right">{item.reservePrice == null ? "—" : formatPrice(item.reservePrice)}</td>
                                                                <td className="px-4 py-3 text-right">{item.startingBid == null ? "—" : formatPrice(item.startingBid)}</td>
                                                                <td className="px-4 py-3 text-right">{item.firstOfferFloor == null ? "—" : formatPrice(item.firstOfferFloor)}</td>
                                                                <td className="px-4 py-3 text-right font-bold">{item.percentBelowReserve == null ? "—" : `${item.percentBelowReserve.toFixed(1)}%`}</td>
                                                                <td className="px-4 py-3 text-right font-black">{item.subsequentBidCount}</td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                                                                        item.outcome === "SELLER_ACCEPTED_BELOW_RESERVE" || item.outcome === "RESERVE_MET_SALE"
                                                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                                                            : item.outcome
                                                                                ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                                                                                : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)]"
                                                                    }`}>
                                                                        {outcomeLabel}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <p className="px-1 text-[11px] leading-5 text-[var(--text-muted)]">
                                    {firstOfferAnalytics.trackingNote} “Sale rate” is based on tracked auctions that received at least one first offer; active auctions without an outcome remain pending rather than being counted as unsold.
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
