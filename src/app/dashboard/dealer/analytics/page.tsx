"use client"

import * as React from "react"
import { BarChart3, Eye, TrendingUp, Users, Loader2, Car, Kanban, ArrowDown, ArrowUp } from "lucide-react"
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
                    <div>
                        <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Analytics</h1>
                        <p className="text-gray-400 text-sm">Performance insights for your dealership</p>
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex gap-2">
                        {["7d", "30d", "90d", "All"].map((range, i) => (
                            <button
                                key={range}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                                    i === 1 ? 'bg-primary text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
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
                                    { label: "Total Views", value: String(stats?.totalViews ?? 0), change: stats?.viewsChange ? `${stats.viewsChange > 0 ? '+' : ''}${stats.viewsChange}%` : "+0%", icon: Eye, color: "text-blue-400", bg: "bg-blue-500/20", up: (stats?.viewsChange ?? 0) >= 0 },
                                    { label: "New Leads", value: String(stats?.newLeads ?? 0), change: stats?.leadsChange ? `${stats.leadsChange > 0 ? '+' : ''}${stats.leadsChange}%` : "+0%", icon: Kanban, color: "text-amber-400", bg: "bg-amber-500/20", up: (stats?.leadsChange ?? 0) >= 0 },
                                    { label: "Conversion Rate", value: `${stats?.conversionRate ?? 0}%`, change: stats?.conversionChange ? `${stats.conversionChange > 0 ? '+' : ''}${stats.conversionChange}%` : "+0%", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/20", up: (stats?.conversionChange ?? 0) >= 0 },
                                    { label: "Revenue", value: `£${(stats?.revenue ?? 0).toLocaleString()}`, change: stats?.revenueChange ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange}%` : "+0%", icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/20", up: (stats?.revenueChange ?? 0) >= 0 },
                                ].map(metric => (
                                    <div key={metric.label} className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/10 transition-colors">
                                        <div className={`p-2 ${metric.bg} rounded-lg w-fit mb-3`}>
                                            <metric.icon size={16} className={metric.color} />
                                        </div>
                                        <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">{metric.label}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <p className="text-2xl font-black text-white">{metric.value}</p>
                                            <span className={`text-xs font-bold flex items-center gap-0.5 ${metric.up ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {metric.up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                                {metric.change}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts Placeholder */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Views Over Time</h3>
                                    <div className="h-64 flex items-center justify-center text-gray-700">
                                        <div className="text-center">
                                            <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-800" />
                                            <p className="text-gray-600 text-sm">Charts will populate with data</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Lead Sources</h3>
                                    <div className="h-64 flex items-center justify-center text-gray-700">
                                        <div className="text-center">
                                            <Users className="h-12 w-12 mx-auto mb-3 text-gray-800" />
                                            <p className="text-gray-600 text-sm">Lead source breakdown will appear here</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Performing Vehicles */}
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Top Performing Vehicles</h3>
                                <div className="h-48 flex items-center justify-center text-gray-700">
                                    <div className="text-center">
                                        <Car className="h-12 w-12 mx-auto mb-3 text-gray-800" />
                                        <p className="text-gray-600 text-sm">Add vehicles to see performance data</p>
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
