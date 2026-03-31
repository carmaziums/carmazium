"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Users, Car, DollarSign, Activity, Eye, ShieldAlert, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminStats, type AdminStats } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

export default function AdminDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [stats, setStats] = React.useState<AdminStats | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        // Enforce Admin Access
        if (!authLoading) {
            if (!user) {
                router.replace('/auth/login')
                return
            }
            if (profile?.role !== 'ADMIN') {
                router.replace('/dashboard')
                return
            }
        }
    }, [user, profile, authLoading, router])

    const fetchStats = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await getAdminStats()
            setStats(data)
        } catch (err: any) {
            console.error('Failed to fetch admin stats:', err)
            setError(err.message || "Failed to load system statistics.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') {
            fetchStats()
        }
    }, [profile])


    if (authLoading || (user && !profile) || (!stats && loading)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null;

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div>
                            <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                                <ShieldAlert className="text-primary hidden sm:block" size={28} />
                                System Overview
                            </h1>
                            <p className="text-gray-400 mt-1">Super Admin Dashboard</p>
                        </div>
                        <Button 
                            onClick={fetchStats} 
                            disabled={loading}
                            className="flex items-center gap-2 shadow-[0_0_15px_rgba(237,28,36,0.2)] bg-slate-800 hover:bg-slate-700 border-white/10 text-white" 
                            variant="outline"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
                        </Button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                            <strong>System Error:</strong> {error}
                        </div>
                    )}

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Users size={64} />
                            </div>
                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="p-2 bg-blue-500/20 rounded-lg"><Users size={18} className="text-blue-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Total Users</p>
                            <h3 className="text-4xl font-black font-heading text-white relative z-10">
                                {loading ? "..." : stats?.totalUsers?.toLocaleString() || 0}
                            </h3>
                        </div>

                        <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Car size={64} />
                            </div>
                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="p-2 bg-primary/20 rounded-lg"><Car size={18} className="text-primary" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Total Listings</p>
                            <h3 className="text-4xl font-black font-heading text-white relative z-10">
                                {loading ? "..." : stats?.totalListings?.toLocaleString() || 0}
                            </h3>
                        </div>

                        <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CheckCircle2 size={64} />
                            </div>
                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><CheckCircle2 size={18} className="text-emerald-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Vehicles Sold</p>
                            <h3 className="text-4xl font-black font-heading text-emerald-400 relative z-10">
                                {loading ? "..." : stats?.soldListings?.toLocaleString() || 0}
                            </h3>
                        </div>

                        <div className="glass-card p-6 border border-white/5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <DollarSign size={64} />
                            </div>
                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                <div className="p-2 bg-yellow-500/20 rounded-lg"><DollarSign size={18} className="text-yellow-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Platform Trx. Value</p>
                            <h3 className="text-3xl font-black font-heading text-white relative z-10 truncate" title={formatPrice(stats?.totalRevenue || 0)}>
                                {loading ? "..." : formatPrice(stats?.totalRevenue || 0)}
                            </h3>
                        </div>
                    </div>

                    {/* Quick Access Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="glass-card p-8 border border-white/5 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                <Users size={32} className="text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold font-heading uppercase mb-2">User Management</h3>
                            <p className="text-sm text-gray-400 mb-6">View, suspend, or elevate permissions for all registered accounts on the platform.</p>
                            <Link href="/dashboard/admin/users" className="mt-auto w-full">
                                <Button className="w-full bg-blue-600 hover:bg-blue-700">Manage Users</Button>
                            </Link>
                         </div>

                         <div className="glass-card p-8 border border-white/5 bg-white/5 hover:bg-white/10 transition-colors rounded-2xl flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                                <Car size={32} className="text-primary" />
                            </div>
                            <h3 className="text-xl font-bold font-heading uppercase mb-2">Listing Moderation</h3>
                            <p className="text-sm text-gray-400 mb-6">Review active inventory, investigate reports, and forcefully withdraw rule-breaking listings.</p>
                            <Link href="/dashboard/admin/listings" className="mt-auto w-full">
                                <Button className="w-full h-12 shadow-neon" shape="default">Moderate Listings</Button>
                            </Link>
                         </div>
                    </div>

                </main>
            </div>
        </div>
    )
}
