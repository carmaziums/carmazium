"use client"

import * as React from "react"
import Image from "next/image"
import {
    Loader2, DollarSign, TrendingUp, Clock, Percent, Users, Eye,
    Car, Download, ArrowUpRight, Tag, BarChart3, MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import {
    DateRangeFilter, KPIGrid, RevenueAreaChart, LeadFunnelChart,
    OfferDonutChart, InventoryAgingChart,
    TopModelsChart, MoversList, LeadSourceChart,
    SalespersonTable, SalesByTypeChart, CustomerAreaTable,
} from "@/components/dealer"
import type { DateRangePreset, KPIMetric } from "@/components/dealer"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsData {
    kpis: {
        totalRevenue: number; totalRevenueTrend: number
        totalUnitsSold: number; totalUnitsSoldTrend: number
        avgDaysToSell: number; avgDaysToSellTrend: number
        offerConversionRate: number; offerConversionRateTrend: number
        leadConversionRate: number; leadConversionRateTrend: number
        avgViewsPerListing: number; avgViewsPerListingTrend: number
        avgSoldPrice: number
        stockValue: number
        marginVsListed: number
    }
    revenueTrend: Array<{ month: string; revenue: number; unitsSold: number }>
    leadFunnel: { NEW: number; CONTACTED: number; QUALIFIED: number; NEGOTIATING: number; WON: number; LOST: number }
    offerBreakdown: {
        PENDING: number; ACCEPTED: number; REJECTED: number; COUNTERED: number; WITHDRAWN: number
        avgAcceptedAmount: number; avgTimeToRespond: number
    }
    inventoryHealth: {
        DRAFT: number; ACTIVE: number; OFFER_ACCEPTED: number; SOLD: number; WITHDRAWN: number
        avgAge: number; staleCount: number
        agingBuckets: { '0-7d': number; '8-30d': number; '31-60d': number; '60d+': number }
    }
    topVehicles: Array<{
        id: string; title: string; image: string | null; views: number
        offerCount: number; price: number; status: string; daysListed: number
    }>
    topSellingModels: Array<{ make: string; model: string; units: number; revenue: number; avgPrice: number }>
    fastMovers: Array<{ make: string; model: string; units: number; avgDays: number }>
    slowMovers: Array<{ make: string; model: string; count: number; avgDays: number }>
    leadSourceBreakdown: Array<{ source: string; count: number }>
    salespersonPerformance: Array<{ name: string; total: number; won: number; active: number; conversionRate: number }>
    salesByType: { AUCTION: { units: number; revenue: number }; CLASSIFIED: { units: number; revenue: number } }
    customersByArea: Array<{ postcode: string; count: number; revenue: number }>
}

function formatPrice(val: number): string {
    if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `£${(val / 1_000).toFixed(1)}k`
    return `£${val.toFixed(0)}`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DealerAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null)
    const [dateRange, setDateRange] = React.useState<DateRangePreset>("30d")
    const [customStart, setCustomStart] = React.useState("")
    const [customEnd, setCustomEnd] = React.useState("")

    React.useEffect(() => {
        if (!authLoading && user) fetchAnalytics()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading, dateRange, customStart, customEnd])

    async function fetchAnalytics() {
        setLoading(true)
        try {
            const rangeParam = dateRange === "custom"
                ? `range=custom&from=${customStart}&to=${customEnd}`
                : `range=${dateRange}`
            const res = await apiClient<{ data: AnalyticsData }>(`/dealers/analytics?${rangeParam}`)
            setAnalytics(res.data)
        } catch (err) {
            console.error("Failed to load analytics:", err)
        } finally {
            setLoading(false)
        }
    }

    function handleExportReport() {
        if (!analytics) return
        const a = analytics
        const kpiRows = [
            ["Metric", "Value"],
            ["Total Revenue", a.kpis.totalRevenue],
            ["Units Sold", a.kpis.totalUnitsSold],
            ["Avg Sold Price", a.kpis.avgSoldPrice],
            ["Avg Days to Sell", a.kpis.avgDaysToSell],
            ["Active Stock", a.inventoryHealth.ACTIVE],
            ["Stock Value", a.kpis.stockValue],
            ["Margin vs Listed (%)", a.kpis.marginVsListed],
            ["Aging Stock (60d+)", a.inventoryHealth.staleCount],
            ["Offer Win Rate (%)", a.kpis.offerConversionRate],
            ["Lead Conversion (%)", a.kpis.leadConversionRate],
            ["Avg Views / Listing", a.kpis.avgViewsPerListing],
        ]
        const topModelsRows = [
            ["\nTop Selling Models"],
            ["Make + Model", "Units", "Revenue", "Avg Price"],
            ...a.topSellingModels.map(r => [`${r.make} ${r.model}`, r.units, r.revenue, r.avgPrice]),
        ]
        const csvContent = "data:text/csv;charset=utf-8," +
            [...kpiRows, ...topModelsRows].map(r => r.join(",")).join("\n")
        const link = document.createElement("a")
        link.setAttribute("href", encodeURI(csvContent))
        link.setAttribute("download", `dealer_analytics_${new Date().toISOString().split("T")[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    // ── KPI cards — Row 1: Revenue ──
    const kpiRow1: KPIMetric[] = analytics ? [
        {
            id: "total_revenue", label: "Total Revenue", value: formatPrice(analytics.kpis.totalRevenue),
            icon: DollarSign, trend: analytics.kpis.totalRevenueTrend, trendLabel: "vs prev period",
            accentColor: "text-emerald-400", accentBg: "bg-emerald-500/10", accentBorder: "border-emerald-500/20",
        },
        {
            id: "units_sold", label: "Units Sold", value: analytics.kpis.totalUnitsSold,
            icon: TrendingUp, trend: analytics.kpis.totalUnitsSoldTrend, trendLabel: "vs prev period",
            accentColor: "text-blue-400", accentBg: "bg-blue-500/10", accentBorder: "border-blue-500/20",
        },
        {
            id: "avg_sold_price", label: "Avg Sold Price", value: formatPrice(analytics.kpis.avgSoldPrice),
            icon: Tag,
            accentColor: "text-violet-400", accentBg: "bg-violet-500/10", accentBorder: "border-violet-500/20",
        },
    ] : []

    // ── KPI cards — Row 2: Inventory ──
    const kpiRow2: KPIMetric[] = analytics ? [
        {
            id: "avg_days_sell", label: "Avg Days to Sell", value: analytics.kpis.avgDaysToSell,
            suffix: "d", icon: Clock, trend: analytics.kpis.avgDaysToSellTrend, trendLabel: "lower is better",
            accentColor: "text-amber-400", accentBg: "bg-amber-500/10", accentBorder: "border-amber-500/20",
        },
        {
            id: "active_stock", label: "Active Stock", value: analytics.inventoryHealth.ACTIVE,
            icon: Car,
            accentColor: "text-sky-400", accentBg: "bg-sky-500/10", accentBorder: "border-sky-500/20",
        },
        {
            id: "stock_value", label: "Stock Value", value: formatPrice(analytics.kpis.stockValue),
            icon: BarChart3,
            accentColor: "text-indigo-400", accentBg: "bg-indigo-500/10", accentBorder: "border-indigo-500/20",
        },
    ] : []

    // ── KPI cards — Row 3: Performance ──
    const kpiRow3: KPIMetric[] = analytics ? [
        {
            id: "offer_conv", label: "Offer Win Rate", value: analytics.kpis.offerConversionRate, suffix: "%",
            icon: Percent, trend: analytics.kpis.offerConversionRateTrend, trendLabel: "vs prev period",
            accentColor: "text-purple-400", accentBg: "bg-purple-500/10", accentBorder: "border-purple-500/20",
        },
        {
            id: "lead_conv", label: "Lead Conversion", value: analytics.kpis.leadConversionRate, suffix: "%",
            icon: Users, trend: analytics.kpis.leadConversionRateTrend, trendLabel: "vs prev period",
            accentColor: "text-cyan-400", accentBg: "bg-cyan-500/10", accentBorder: "border-cyan-500/20",
        },
        {
            id: "margin_vs_listed", label: "Margin vs Listed",
            value: (analytics.kpis.marginVsListed >= 0 ? "+" : "") + analytics.kpis.marginVsListed,
            suffix: "%", icon: TrendingUp,
            accentColor: analytics.kpis.marginVsListed >= 0 ? "text-emerald-400" : "text-red-400",
            accentBg: analytics.kpis.marginVsListed >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
            accentBorder: analytics.kpis.marginVsListed >= 0 ? "border-emerald-500/20" : "border-red-500/20",
        },
    ] : []

    // Combine all KPI rows for the extra metrics strip
    const kpiRow4: KPIMetric[] = analytics ? [
        {
            id: "aging_stock", label: "Aging Stock (60d+)", value: analytics.inventoryHealth.staleCount,
            icon: Clock,
            accentColor: analytics.inventoryHealth.staleCount > 0 ? "text-red-400" : "text-[var(--text-muted)]",
            accentBg: analytics.inventoryHealth.staleCount > 0 ? "bg-red-500/10" : "bg-gray-500/10",
            accentBorder: analytics.inventoryHealth.staleCount > 0 ? "border-red-500/20" : "border-gray-500/20",
        },
        {
            id: "avg_views", label: "Avg Views / Listing", value: analytics.kpis.avgViewsPerListing,
            icon: Eye, trend: analytics.kpis.avgViewsPerListingTrend, trendLabel: "vs prev period",
            accentColor: "text-primary", accentBg: "bg-primary/10", accentBorder: "border-primary/20",
        },
        {
            id: "customers_area", label: "Buyer Postcodes Captured", value: analytics.customersByArea.length,
            icon: MapPin,
            accentColor: "text-rose-400", accentBg: "bg-rose-500/10", accentBorder: "border-rose-500/20",
        },
    ] : []

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <PageHeader
                            title="Performance Analytics"
                            subHeader="Real-time dealership performance metrics & strategic insights"
                        />
                        <Button onClick={handleExportReport} disabled={!analytics} className="flex items-center gap-2 shadow-neon h-11 shrink-0" variant="outline" size="sm">
                            <Download size={16} /> Export Report
                        </Button>
                    </div>

                    {/* Date Range Filter */}
                    <DateRangeFilter
                        activeRange={dateRange}
                        onRangeChange={setDateRange}
                        customStart={customStart}
                        customEnd={customEnd}
                        onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e) }}
                    />

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest">Crunching your dealership data…</p>
                        </div>
                    ) : analytics ? (
                        <>
                            {/* ── Section 1: Sales & Stock Overview ── */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-1">Sales & Stock Overview</p>
                                <div className="space-y-3">
                                    <KPIGrid metrics={kpiRow1} loading={loading} columns={3} />
                                    <KPIGrid metrics={kpiRow2} loading={loading} columns={3} />
                                    <KPIGrid metrics={kpiRow3} loading={loading} columns={3} />
                                    <KPIGrid metrics={kpiRow4} loading={loading} columns={3} />
                                </div>
                            </div>

                            {/* ── Section 2: Revenue Trend + Offer Donut ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <RevenueAreaChart
                                        data={analytics.revenueTrend}
                                        title="Revenue & Sales Trend"
                                        subtitle="Monthly revenue and units sold over the past year"
                                    />
                                </div>
                                <div className="lg:col-span-1">
                                    <OfferDonutChart data={analytics.offerBreakdown} title="Offer Performance" />
                                </div>
                            </div>

                            {/* ── Section 3: Lead Funnel + Inventory Health ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <LeadFunnelChart data={analytics.leadFunnel} title="Lead Conversion Funnel" />
                                <InventoryAgingChart data={analytics.inventoryHealth} title="Inventory Health" />
                            </div>

                            {/* ── Section 4: Inventory Performance ── */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-1">Inventory Performance</p>
                                <div className="space-y-4">
                                    <TopModelsChart data={analytics.topSellingModels} title="Top Selling Models" />
                                    <MoversList fastMovers={analytics.fastMovers} slowMovers={analytics.slowMovers} />
                                </div>
                            </div>

                            {/* ── Section 5: Sales Mix & Customers ── */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-1">Sales Mix & Customers</p>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <LeadSourceChart data={analytics.leadSourceBreakdown} title="Lead Sources" />
                                    <SalesByTypeChart data={analytics.salesByType} title="Sales Channel Mix" />
                                    <CustomerAreaTable data={analytics.customersByArea} title="Customers by Area" />
                                </div>
                            </div>

                            {/* ── Section 6: Salesperson Performance ── */}
                            {analytics.salespersonPerformance.length > 0 && (
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-1">Team Performance</p>
                                    <SalespersonTable data={analytics.salespersonPerformance} />
                                </div>
                            )}

                            {/* ── Section 7: Top Performing Vehicles ── */}
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600 mb-3 px-1">Vehicle Engagement</p>
                                <div className="dealer-glass-card overflow-hidden">
                                    <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between bg-black/20">
                                        <div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">Top Performing Vehicles</h3>
                                            <p className="text-xs text-gray-600 mt-0.5 font-medium">Ranked by total views and engagement</p>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-[var(--border-default)]">
                                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Showing</span>
                                            <span className="text-xs font-black">{analytics.topVehicles.length}</span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                                                <tr>
                                                    <th className="px-6 py-4 w-8">#</th>
                                                    <th className="px-6 py-4">Vehicle</th>
                                                    <th className="px-6 py-4 text-right">Views</th>
                                                    <th className="px-6 py-4 text-right">Offers</th>
                                                    <th className="px-6 py-4 text-right">Price</th>
                                                    <th className="px-6 py-4 text-center">Status</th>
                                                    <th className="px-6 py-4 text-right">Age</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/[0.03]">
                                                {analytics.topVehicles.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="px-6 py-16 text-center text-[var(--text-muted)]">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <Car size={40} className="opacity-10" />
                                                                <p className="text-sm font-bold">No vehicles in your inventory yet.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : analytics.topVehicles.map((v, i) => (
                                                    <tr key={v.id} className="group hover:bg-white/[0.02] transition-colors">
                                                        <td className="px-6 py-4">
                                                            <span className={`text-xs font-black tabular-nums ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-[var(--text-secondary)]' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>{i + 1}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--border-default)] group-hover:border-primary/40 transition-colors">
                                                                    {v.image ? (
                                                                        <Image src={v.image} alt="" fill className="object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-muted)]"><Car size={16} /></div>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-bold group-hover:text-primary transition-colors truncate max-w-[200px]">{v.title}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Eye size={12} className="text-gray-600" />
                                                                <span className="text-sm font-black tabular-nums">{v.views.toLocaleString()}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`text-sm font-black tabular-nums ${v.offerCount > 0 ? 'text-amber-400' : 'text-gray-600'}`}>{v.offerCount}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-sm font-black tabular-nums">{formatPrice(v.price)}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black tracking-widest uppercase border ${
                                                                v.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                v.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                v.status === 'OFFER_ACCEPTED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                v.status === 'DRAFT' ? 'bg-gray-500/10 text-[var(--text-muted)] border-gray-500/20' :
                                                                'bg-red-500/10 text-red-400 border-red-500/20'
                                                            }`}>{v.status.replace('_', ' ')}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={`text-sm font-bold tabular-nums ${v.daysListed > 60 ? 'text-red-400' : v.daysListed > 30 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>{v.daysListed}d</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-20 h-20 bg-[var(--bg-card)] rounded-3xl flex items-center justify-center border border-[var(--border-default)]">
                                <ArrowUpRight size={32} className="opacity-10" />
                            </div>
                            <p className="text-[var(--text-muted)] text-sm font-bold">Unable to load analytics data.</p>
                            <Button onClick={fetchAnalytics} variant="outline" size="sm">Retry</Button>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
