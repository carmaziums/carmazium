"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TrendingUp, Loader2, ArrowLeft, Users, Car, DollarSign, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminAnalytics, getAdminStats, type AnalyticsMonth, type AdminStats } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

function BarChart({ data, valueKey, color, label }: {
    data: AnalyticsMonth[]
    valueKey: keyof AnalyticsMonth
    color: string
    label: string
}) {
    const max = Math.max(...data.map(d => Number(d[valueKey])), 1)
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">{label}</p>
            <div className="flex items-end gap-2 h-32">
                {data.map((d) => {
                    const val = Number(d[valueKey])
                    const pct = max > 0 ? (val / max) * 100 : 0
                    return (
                        <div key={d.month} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="relative w-full flex items-end justify-center" style={{ height: '100px' }}>
                                <div
                                    className={`w-full rounded-t transition-all ${color}`}
                                    style={{ height: `${Math.max(pct, 2)}%` }}
                                    title={String(val)}
                                />
                            </div>
                            <span className="text-[9px] text-gray-500 group-hover:text-gray-300 transition-colors">{d.month}</span>
                            <span className="text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 text-center">
                                {valueKey === 'revenue' ? formatPrice(val) : val}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function AdminAnalyticsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [analytics, setAnalytics] = React.useState<AnalyticsMonth[]>([])
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchData = React.useCallback(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        Promise.all([getAdminAnalytics(), getAdminStats()])
            .then(([a, s]) => { setAnalytics(a); setStats(s) })
            .catch(err => setError(err.message || 'Failed to load analytics'))
            .finally(() => setLoading(false))
    }, [profile])

    React.useEffect(() => { fetchData() }, [fetchData])

    if (authLoading || (user && !profile) || loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    const totalRevenue6m = analytics.reduce((sum, m) => sum + m.revenue, 0)
    const totalUsers6m = analytics.reduce((sum, m) => sum + m.newUsers, 0)
    const totalListings6m = analytics.reduce((sum, m) => sum + m.newListings, 0)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                                <TrendingUp className="text-yellow-400 hidden sm:block" size={28} />
                                Platform Analytics
                            </h1>
                            <p className="text-gray-400 mt-1 text-sm">Last 6 months performance</p>
                        </div>
                        <Button onClick={fetchData} disabled={loading} variant="outline" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-white/10 text-white">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                        </Button>
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    {/* 6-month summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: "Revenue (6m)", value: formatPrice(totalRevenue6m), icon: DollarSign, color: "text-yellow-400 bg-yellow-500/20" },
                            { label: "New Users (6m)", value: totalUsers6m.toLocaleString(), icon: Users, color: "text-blue-400 bg-blue-500/20" },
                            { label: "New Listings (6m)", value: totalListings6m.toLocaleString(), icon: Car, color: "text-primary bg-primary/20" },
                        ].map((card) => {
                            const Icon = card.icon
                            const [textColor, bgColor] = card.color.split(' ')
                            return (
                                <div key={card.label} className="glass-card p-5 border border-white/5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl">
                                    <div className={`inline-flex p-2 ${bgColor} rounded-lg mb-3`}>
                                        <Icon size={16} className={textColor} />
                                    </div>
                                    <p className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">{card.label}</p>
                                    <h3 className="text-3xl font-black font-heading text-white mt-1">{card.value}</h3>
                                </div>
                            )
                        })}
                    </div>

                    {/* Charts */}
                    {analytics.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl">
                                <BarChart
                                    data={analytics}
                                    valueKey="revenue"
                                    color="bg-yellow-500/70"
                                    label="Monthly Revenue"
                                />
                                <div className="mt-4 space-y-1">
                                    {analytics.map(d => (
                                        <div key={d.month} className="flex justify-between text-xs">
                                            <span className="text-gray-400">{d.month}</span>
                                            <span className="font-bold text-white">{formatPrice(d.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl">
                                <BarChart
                                    data={analytics}
                                    valueKey="newUsers"
                                    color="bg-blue-500/70"
                                    label="New User Registrations"
                                />
                                <div className="mt-4 space-y-1">
                                    {analytics.map(d => (
                                        <div key={d.month} className="flex justify-between text-xs">
                                            <span className="text-gray-400">{d.month}</span>
                                            <span className="font-bold text-white">{d.newUsers}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl">
                                <BarChart
                                    data={analytics}
                                    valueKey="newListings"
                                    color="bg-primary/70"
                                    label="New Listings Created"
                                />
                                <div className="mt-4 space-y-1">
                                    {analytics.map(d => (
                                        <div key={d.month} className="flex justify-between text-xs">
                                            <span className="text-gray-400">{d.month}</span>
                                            <span className="font-bold text-white">{d.newListings}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* All-time stats */}
                    {stats && (
                        <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl">
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">All-Time Platform Stats</h2>
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
                                    <div key={item.label} className="p-3 bg-white/5 rounded-xl">
                                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
                                        <p className="text-2xl font-black font-heading text-white mt-1">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
