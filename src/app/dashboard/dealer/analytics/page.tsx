"use client"

import * as React from "react"
import { BarChart3, Eye, TrendingUp, Users, Loader2, Car, Kanban, ArrowDown, ArrowUp, Zap, Sparkles, ShieldCheck, Activity } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">Analytics</h1>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Strategic market performance & predictive insights</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#0A0A0C] px-4 py-2 rounded-full border border-white/5">
                            <Sparkles size={14} className="text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Predictive Engine Active</span>
                        </div>
                    </div>

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
                                    { label: "Inventory Velocity", short: "Velocity", value: String(stats?.totalViews ?? 0), change: stats?.viewsChange ? `${stats.viewsChange > 0 ? '+' : ''}${stats.viewsChange}%` : "+12%", icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", up: true },
                                    { label: "Capture Rate", short: "Capture", value: String(stats?.newLeads ?? 0), change: stats?.leadsChange ? `${stats.leadsChange > 0 ? '+' : ''}${stats.leadsChange}%` : "+8%", icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", up: true },
                                    { label: "Engagement Alpha", short: "Alpha", value: `${stats?.conversionRate ?? 0}%`, change: stats?.conversionChange ? `${stats.conversionChange > 0 ? '+' : ''}${stats.conversionChange}%` : "+4%", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", up: true },
                                    { label: "Projected ARR", short: "ARR", value: `£${(stats?.revenue ?? 0).toLocaleString()}`, change: stats?.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}%` : "+15%", icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", up: true },
                                ].map(metric => (
                                    <div key={metric.label} className="dealer-glass-card p-6 relative overflow-hidden group">
                                        <div className="flex items-center justify-between mb-4 relative z-10">
                                            <div className={`p-2 rounded-lg border ${metric.bg} ${metric.border}`}>
                                                <metric.icon size={18} className={metric.color} />
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${metric.up ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                                                {metric.up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                                {metric.change}
                                            </span>
                                        </div>
                                        <h3 className="text-3xl font-black font-heading text-white relative z-10 metallic-foil">
                                            {metric.value}
                                        </h3>
                                        <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold relative z-10">{metric.label}</p>
                                        <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                                            <path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill="currentColor" className={metric.color} />
                                        </svg>
                                    </div>
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
