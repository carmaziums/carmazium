"use client"

import * as React from "react"
import { BarChart3, Eye, TrendingUp, Users, Loader2, Car, Kanban, ArrowDown, ArrowUp, Zap, Sparkles, ShieldCheck, Activity } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"

export default function DealerAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(true)
    const [stats, setStats] = React.useState<any>(null)

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

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader 
                        title={DEALER_ROUTE_CONFIG[6].title} 
                        subHeader={DEALER_ROUTE_CONFIG[6].subHeader}
                    />

                    {/* Time Range Selector */}
                    <div className="flex gap-2 p-1 bg-[#0A0A0C] border border-white/5 rounded-xl w-fit">
                        {["7d", "30d", "90d", "All"].map((range, i) => (
                            <button
                                key={range}
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    i === 1 ? 'vip-tab-active' : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            {/* Metric Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: "Inventory Velocity", short: "Velocity", value: String(stats?.totalViews ?? 0), icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                                    { label: "Capture Rate", short: "Capture", value: String(stats?.newLeads ?? 0), icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                                    { label: "Engagement Alpha", short: "Alpha", value: `${stats?.conversionRate ?? 0}%`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                                    { label: "Projected ARR", short: "ARR", value: `£${(stats?.revenue ?? 0).toLocaleString()}`, icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                                ].map(metric => (
                                    <MetricCard 
                                        key={metric.label}
                                        label={metric.label}
                                        value={metric.value}
                                        icon={metric.icon}
                                        color={metric.color}
                                        bg={metric.bg}
                                        border={metric.border}
                                        statusLabel={metric.short}
                                        foilValue={true}
                                    />
                                ))}
                            </div>

                            {/* Charts Placeholder */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="dealer-glass-card p-8 bg-slate-900/40 border-white/5">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Market Exposure Curve</h3>
                                        <ShieldCheck size={14} className="text-gray-700" />
                                    </div>
                                    <div className="h-64 flex items-center justify-center relative overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                                        <div className="absolute inset-0 shimmer-bg opacity-20" />
                                        <div className="text-center relative z-10">
                                            <Activity className="h-10 w-10 mx-auto mb-4 text-primary animate-pulse" />
                                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Generating High-Fidelity Data</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="dealer-glass-card p-8 bg-slate-900/40 border-white/5">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Acquisition Source Breakdown</h3>
                                        <TrendingUp size={14} className="text-gray-700" />
                                    </div>
                                    <div className="h-64 flex items-center justify-center relative overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                                        <div className="absolute inset-0 shimmer-bg opacity-20" />
                                        <div className="text-center relative z-10">
                                            <Users className="h-10 w-10 mx-auto mb-4 text-blue-400 opacity-60" />
                                            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Aggregating Demographic Signal</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Performing Vehicles */}
                            <div className="dealer-glass-card p-8 bg-slate-900/40 border-white/5">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Top Performing Inventory</h3>
                                    <div className="flex gap-1 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                                        <Activity size={10} /> Optimized
                                    </div>
                                </div>
                                <div className="h-48 flex items-center justify-center relative overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                                    <div className="absolute inset-0 shimmer-bg opacity-10" />
                                    <div className="text-center relative z-10">
                                        <Car className="h-10 w-10 mx-auto mb-4 text-gray-700" />
                                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Waiting for Live Stock Signal</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
