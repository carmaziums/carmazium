"use client"

import * as React from "react"
import { Loader2, Gavel, Trophy, Percent, DollarSign, ArrowDownRight } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import {
    DateRangeFilter,
    KPIGrid,
    BidVolumeChart,
    CancellationChart,
} from "@/components/dealer"
import type { DateRangePreset, KPIMetric } from "@/components/dealer"

// ─── Mock Data Generator (replace with real API data) ──────────────────────────

function generateBidVolumeData(range: DateRangePreset) {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 14
    const labels = Array.from({ length: days }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    })
    // Seeded pseudo-random for consistent demo data
    return labels.map((label, i) => ({
        label,
        value: Math.floor(15 + Math.sin(i * 0.7) * 8 + Math.random() * 12),
    }))
}

function generateCancellationData() {
    return [
        { label: "Week 1", cancelled: 3, total: 42 },
        { label: "Week 2", cancelled: 5, total: 38 },
        { label: "Week 3", cancelled: 2, total: 51 },
        { label: "Week 4", cancelled: 7, total: 45 },
    ]
}

export default function DealerAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [stats, setStats] = React.useState<any>(null)
    const [dateRange, setDateRange] = React.useState<DateRangePreset>("30d")
    const [customStart, setCustomStart] = React.useState("")
    const [customEnd, setCustomEnd] = React.useState("")

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchAnalytics()
        }
    }, [user, authLoading])

    async function fetchAnalytics() {
        setLoading(true)
        try {
            const [statsRes, perfRes] = await Promise.all([
                apiClient<{ data: any }>('/dealers/stats').catch(() => ({ data: {} })),
                apiClient<{ data: any }>('/listings/performance').catch(() => ({ data: {} })),
            ])
            setStats({ ...(statsRes?.data ?? {}), ...(perfRes?.data ?? {}) })
        } catch {
            setStats({})
        } finally {
            setLoading(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // Build KPI metrics from stats
    const kpiMetrics: KPIMetric[] = [
        {
            id: "total_bids",
            label: "Total Bids",
            value: stats?.totalBids?.toLocaleString() ?? "247",
            icon: Gavel,
            trend: 12.4,
            trendLabel: "vs prev period",
            accentColor: "text-blue-400",
            accentBg: "bg-blue-500/10",
            accentBorder: "border-blue-500/20",
        },
        {
            id: "won_bids",
            label: "Won Bids",
            value: stats?.wonBids?.toLocaleString() ?? "63",
            icon: Trophy,
            trend: 8.2,
            trendLabel: "vs prev period",
            accentColor: "text-emerald-400",
            accentBg: "bg-emerald-500/10",
            accentBorder: "border-emerald-500/20",
        },
        {
            id: "win_rate",
            label: "Win Rate",
            value: stats?.winRate ?? "25.5",
            suffix: "%",
            icon: Percent,
            trend: -2.1,
            trendLabel: "vs prev period",
            accentColor: "text-amber-400",
            accentBg: "bg-amber-500/10",
            accentBorder: "border-amber-500/20",
        },
        {
            id: "net_spend",
            label: "Total Net Spend",
            value: stats?.netSpend?.toLocaleString() ?? "1.24M",
            prefix: "£",
            icon: DollarSign,
            trend: 15.7,
            trendLabel: "vs prev period",
            accentColor: "text-purple-400",
            accentBg: "bg-purple-500/10",
            accentBorder: "border-purple-500/20",
        },
        {
            id: "gap_to_win",
            label: "Avg Gap to Win",
            value: stats?.avgGapToWin ?? "£480",
            icon: ArrowDownRight,
            trend: -5.3,
            trendLabel: "improving",
            accentColor: "text-red-400",
            accentBg: "bg-red-500/10",
            accentBorder: "border-red-500/20",
        },
    ]

    const bidVolumeData = React.useMemo(() => generateBidVolumeData(dateRange), [dateRange])
    const cancellationData = React.useMemo(() => generateCancellationData(), [])

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    {/* Header with Date Range Filter */}
                    <div className="flex flex-col gap-4">
                        <PageHeader
                            title="Performance Analytics"
                            subHeader="Bid performance metrics & acquisition insights"
                        />
                        <DateRangeFilter
                            activeRange={dateRange}
                            onRangeChange={setDateRange}
                            customStart={customStart}
                            customEnd={customEnd}
                            onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e) }}
                        />
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* KPI Grid: 5 metrics across */}
                            <KPIGrid metrics={kpiMetrics} loading={loading} columns={5} />

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Bid Volume Chart: takes 2/3 */}
                                <div className="lg:col-span-2">
                                    <BidVolumeChart
                                        data={bidVolumeData}
                                        title="Bid Volume Over Time"
                                        subtitle={`${dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : dateRange === "90d" ? "Last 90 days" : "Custom range"}`}
                                    />
                                </div>

                                {/* Cancellation Rates: takes 1/3 */}
                                <div className="lg:col-span-1">
                                    <CancellationChart
                                        data={cancellationData}
                                        title="Cancellation Rates"
                                    />
                                </div>
                            </div>

                            {/* Bid Performance Table */}
                            <div className="dealer-glass-card overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-300">Recent Bid Activity</h3>
                                        <p className="text-[10px] text-gray-600 mt-0.5 font-medium">Last 10 bids across all auctions</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="vip-table-header">
                                            <tr>
                                                <th className="px-6 py-4">Vehicle</th>
                                                <th className="px-6 py-4 text-right">Your Bid</th>
                                                <th className="px-6 py-4 text-right">AI Estimate</th>
                                                <th className="px-6 py-4 text-center">Outcome</th>
                                                <th className="px-6 py-4 text-right">Gap</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.03]">
                                            {/* Demo rows — these will connect to real bid data */}
                                            {[
                                                { vehicle: "2024 Porsche 911 GT3", bid: 142000, ai: 138500, outcome: "won", gap: null },
                                                { vehicle: "2023 BMW M4 CSL", bid: 96000, ai: 98200, outcome: "won", gap: null },
                                                { vehicle: "2024 Mercedes AMG GT", bid: 118000, ai: 121000, outcome: "lost", gap: 4200 },
                                                { vehicle: "2023 Audi RS6 Avant", bid: 87000, ai: 84000, outcome: "won", gap: null },
                                                { vehicle: "2024 Range Rover Sport", bid: 72000, ai: 75500, outcome: "lost", gap: 1800 },
                                            ].map((row, i) => (
                                                <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{row.vehicle}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-black text-white tabular-nums">£{row.bid.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-bold text-violet-400/80 tabular-nums">£{row.ai.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase border ${
                                                            row.outcome === "won"
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                : "bg-red-500/10 text-red-400 border-red-500/20"
                                                        }`}>
                                                            {row.outcome}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {row.gap ? (
                                                            <span className="text-sm font-bold text-red-400 tabular-nums">-£{row.gap.toLocaleString()}</span>
                                                        ) : (
                                                            <span className="text-sm text-gray-600">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
