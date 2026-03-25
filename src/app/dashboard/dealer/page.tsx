"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Users, Kanban,
    PlusCircle, ArrowUpRight, Loader2, Building2, CheckCircle,
    Mail
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { apiClient } from "@/lib/apiClient"

export default function DealerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [resending, setResending] = React.useState(false)
    const [resendSuccess, setResendSuccess] = React.useState(false)

    const isEmailVerified = !!user?.email_confirmed_at

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchDashboardData()
        }
    }, [user, authLoading])

    async function fetchDashboardData() {
        setLoading(true)
        try {
            const [statsRes, leadsRes] = await Promise.all([
                apiClient<{ data: any }>('/dealers/stats').catch(() => ({ data: null })),
                apiClient<{ data: any[]; meta?: any }>('/dealers/leads?limit=5').catch(() => ({ data: [] })),
            ])

            const s = statsRes?.data || {}
            setStats({
                companyName: profile?.firstName ? `${profile.firstName}'s Dealership` : "Your Dealership",
                isVerified: s.isVerified ?? false,
                activeListings: s.activeListings ?? 0,
                totalViews: s.totalViews ?? 0,
                soldListings: s.soldListings ?? 0,
                activeLeads: s.activeLeads ?? 0,
                totalRevenue: s.totalRevenue ?? 0,
                staffCount: s.staffCount ?? 1,
                recentLeads: leadsRes?.data ?? [],
            })
        } catch (err) {
            console.error('Failed to load dashboard data:', err)
            setStats({
                companyName: profile?.firstName ? `${profile.firstName}'s Dealership` : "Your Dealership",
                isVerified: false,
                activeListings: 0,
                totalViews: 0,
                soldListings: 0,
                activeLeads: 0,
                totalRevenue: 0,
                staffCount: 1,
                recentLeads: [],
            })
        } finally {
            setLoading(false)
        }
    }

    const handleResendEmail = async () => {
        if (!user?.email) return
        setResending(true)
        setResendSuccess(false)
        try {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
                options: { emailRedirectTo: `${baseUrl}/auth/callback?redirect_to=/dashboard/dealer` }
            })
            if (error) throw error
            setResendSuccess(true)
            setTimeout(() => setResendSuccess(false), 5000)
        } catch (err: any) {
            console.error('Resend failed:', err)
        } finally {
            setResending(false)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account">
                    <Link href="/sell">
                        <Button className="w-full flex items-center gap-2 shadow-neon h-12" shape="default">
                            <PlusCircle size={18} /> Add Vehicle
                        </Button>
                    </Link>
                </DashboardSidebar>

                <main className="flex-1 space-y-8 min-w-0">

                    {/* ── Email Verification Panel ── */}
                    {!isEmailVerified && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-slate-800/80 to-slate-900 border border-amber-500/20 rounded-2xl p-8 md:p-12">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                            <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
                                <div className="p-4 bg-amber-500/20 rounded-full mb-5">
                                    <Mail className="h-10 w-10 text-amber-400" />
                                </div>
                                <h2 className="text-2xl font-black font-heading tracking-tight mb-2">Verify Your Email</h2>
                                <p className="text-gray-400 text-sm mb-1">
                                    We&apos;ve sent a verification link to <strong className="text-white">{user?.email}</strong>
                                </p>
                                <p className="text-gray-500 text-sm mb-6">
                                    Please verify your email address to access your dealer dashboard and start managing your dealership.
                                </p>

                                {resendSuccess && (
                                    <div className="mb-4 w-full p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-medium flex items-center justify-center gap-2">
                                        <CheckCircle size={16} /> Verification email sent! Check your inbox.
                                    </div>
                                )}

                                <Button
                                    onClick={handleResendEmail}
                                    disabled={resending}
                                    className="gap-2 h-11 px-6 shadow-neon"
                                    shape="default"
                                >
                                    {resending ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                                    ) : (
                                        <><Mail size={16} /> Resend Verification Email</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Welcome Banner (only when verified) ── */}
                    {isEmailVerified && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-slate-800/80 to-slate-900 border border-white/10 rounded-2xl p-8">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <Building2 className="text-primary" size={24} />
                                    <h1 className="text-2xl md:text-3xl font-black font-heading tracking-tight">
                                        Welcome, {userName}!
                                    </h1>
                                    {stats?.isVerified && (
                                        <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                                            <CheckCircle size={12} /> Verified
                                        </span>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm max-w-xl">
                                    Your central hub for managing inventory, leads, team, and analytics. Everything you need to run your dealership.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── KPI Stats Row ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/20 rounded-lg"><Car size={18} className="text-primary" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Active Stock</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.activeListings || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg"><Eye size={18} className="text-blue-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Total Views</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.totalViews?.toLocaleString() || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-amber-500/20 rounded-lg"><Kanban size={18} className="text-amber-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Active Leads</p>
                            <h3 className="text-3xl font-black font-heading text-amber-400">
                                {loading ? "..." : stats?.activeLeads || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 border border-white/5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><TrendingUp size={18} className="text-emerald-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Sold</p>
                            <h3 className="text-3xl font-black font-heading text-emerald-400">
                                {loading ? "..." : stats?.soldListings || 0}
                            </h3>
                        </div>
                    </div>

                    {/* ── Quick Actions ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link href="/dashboard/dealer/inventory" className="glass-card p-5 border border-white/5 bg-white/[0.03] rounded-2xl hover:bg-white/10 transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 rounded-xl"><Car size={20} className="text-primary" /></div>
                                <div>
                                    <p className="font-bold text-white text-sm">Manage Inventory</p>
                                    <p className="text-gray-500 text-xs">Add, edit, or remove vehicles</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-600 group-hover:text-primary transition-colors" />
                        </Link>
                        <Link href="/dashboard/dealer/crm" className="glass-card p-5 border border-white/5 bg-white/[0.03] rounded-2xl hover:bg-white/10 transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 rounded-xl"><Kanban size={20} className="text-amber-400" /></div>
                                <div>
                                    <p className="font-bold text-white text-sm">View Leads</p>
                                    <p className="text-gray-500 text-xs">Track your sales pipeline</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-600 group-hover:text-amber-400 transition-colors" />
                        </Link>
                        <Link href="/dashboard/dealer/team" className="glass-card p-5 border border-white/5 bg-white/[0.03] rounded-2xl hover:bg-white/10 transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl"><Users size={20} className="text-blue-400" /></div>
                                <div>
                                    <p className="font-bold text-white text-sm">Manage Team</p>
                                    <p className="text-gray-500 text-xs">{stats?.staffCount || 0} staff member{(stats?.staffCount || 0) !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <ArrowUpRight size={16} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                        </Link>
                    </div>

                    {/* ── Recent Leads ── */}
                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-black font-heading text-white uppercase tracking-tight">Recent Leads</h2>
                            <Link href="/dashboard/dealer/crm" className="text-primary hover:text-white text-sm font-black transition-colors uppercase">View All</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Source</th>
                                        <th className="px-6 py-4 text-right">Assigned To</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : !stats?.recentLeads?.length ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                                No leads yet. As buyers interact with your listings, leads will appear here.
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.recentLeads.map((lead: any) => (
                                            <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-white">{lead.buyerName}</p>
                                                    <p className="text-xs text-gray-400">{lead.buyerEmail}</p>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">{lead.listing?.title || '—'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                                        lead.status === 'NEW' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                        lead.status === 'CONTACTED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        lead.status === 'QUALIFIED' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                                        lead.status === 'WON' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        lead.status === 'LOST' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                    }`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-xs text-gray-400">{lead.source || '—'}</td>
                                                <td className="px-6 py-4 text-right text-sm text-gray-300">
                                                    {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
