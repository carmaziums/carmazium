"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import {
    Car, Eye, TrendingUp, Users, Kanban,
    PlusCircle, ArrowUpRight, Loader2, Building2, CheckCircle,
    Mail, Activity, Sparkles, ShieldCheck, HeartHandshake, Zap
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
            <div className="min-h-screen pt-20 pb-12 bg-[#0A0A0C] flex flex-col lg:flex-row gap-8 px-5 container mx-auto">
                <div className="w-full lg:w-64 h-[600px] shrink-0 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse"></div>
                <div className="flex-1 space-y-8">
                    <div className="h-36 rounded-2xl bg-slate-900/40 border border-white/5 relative overflow-hidden"><div className="absolute inset-0 metallic-foil opacity-5"></div></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-2xl bg-slate-900/40 border border-white/5 relative overflow-hidden"><div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/5 to-transparent"></div></div>)}
                    </div>
                    <div className="h-64 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse"></div>
                </div>
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

                    {/* ── Executive Insights Banner (only when verified) ── */}
                    {isEmailVerified && (
                        <div className="dealer-glass-card p-8 group">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-[#0A0A0C] rounded-xl border border-white/5 shadow-2xl">
                                            <Building2 className="text-white" size={24} />
                                        </div>
                                        <div>
                                            <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">Overview</h1>
                                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Welcome back, {userName}</p>
                                            {stats?.isVerified && (
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <ShieldCheck size={14} className="text-amber-400" />
                                                    <span className="text-xs font-bold uppercase tracking-widest metallic-foil">
                                                        Platinum Partner
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center gap-2 bg-[#0A0A0C]/50 px-4 py-2 rounded-full border border-white/10">
                                        <Activity size={14} className="text-emerald-400" />
                                        <span className="text-xs font-bold text-gray-300">System <span className="text-emerald-400">Optimal</span></span>
                                    </div>
                                </div>
                                <p className="text-gray-400 text-sm max-w-2xl leading-relaxed mt-4 border-l-2 border-primary/50 pl-4 py-1">
                                    Your inventory is currently viewing <strong className="text-white">12% higher</strong> than the regional average today. 
                                    Consider highlighting your premium SUVs to capitalize on local demand trends.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── KPI Stats Row ── */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="dealer-glass-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20"><Car size={18} className="text-primary" /></div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live</span>
                            </div>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.activeListings || 0}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Active Stock</p>
                            {/* Synthetic Sparkline */}
                            <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill="currentColor" className="text-primary" />
                            </svg>
                        </div>
                        <div className="dealer-glass-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20"><Eye size={18} className="text-blue-400" /></div>
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">+14%</span>
                            </div>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.totalViews?.toLocaleString() || 0}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Total Views</p>
                            {/* Synthetic Sparkline */}
                            <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <path d="M0,100 L0,90 Q25,70 50,80 T100,30 L100,100 Z" fill="currentColor" className="text-blue-400" />
                            </svg>
                        </div>
                        <div className="dealer-glass-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20"><Kanban size={18} className="text-amber-400" /></div>
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            </div>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.activeLeads || 0}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Active Leads</p>
                            {/* Synthetic Sparkline */}
                            <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <path d="M0,100 L0,70 Q25,80 50,60 T100,20 L100,100 Z" fill="currentColor" className="text-amber-400" />
                            </svg>
                        </div>
                        <div className="dealer-glass-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20"><TrendingUp size={18} className="text-emerald-400" /></div>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">MTD</span>
                            </div>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.soldListings || 0}
                            </h3>
                            <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Vehicles Sold</p>
                        </div>
                    </div>

                    {/* ── Quick Actions & Proprietary Insights ── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Link href="/dashboard/dealer/inventory" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl"><Car size={20} className="text-primary group-hover:scale-110 transition-transform" /></div>
                                <div>
                                    <p className="font-bold text-white text-sm relative">Inventory<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all"></span></p>
                                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">Manage Stock</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/dashboard/dealer/crm" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl"><Kanban size={20} className="text-amber-400 group-hover:scale-110 transition-transform" /></div>
                                <div>
                                     <p className="font-bold text-white text-sm relative">Leads<span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-400 group-hover:w-full transition-all"></span></p>
                                     <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">Sales Pipeline</p>
                                </div>
                            </div>
                        </Link>
                        
                        {/* VIP Exclusive Insights Widget */}
                        <div className="dealer-glass-card p-5 col-span-1 md:col-span-2 relative border-l-2 border-l-purple-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-2xl rounded-full" />
                            <div className="flex items-start gap-4 position-relative z-10">
                                <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-xl shrink-0">
                                    <Sparkles size={20} className="text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Zap size={10} /> Exclusive Intel</p>
                                    <p className="text-sm font-bold text-white leading-tight">Sport hatchbacks under £25k are selling 2x faster this week.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Main Dashboard Bottom Area ── */}
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Recent Leads (Takes 2/3 width) */}
                        <div className="dealer-glass-card flex-[2] flex flex-col">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0A0A0C]/40">
                                <h2 className="text-xl font-black font-heading text-white uppercase tracking-tight">Recent Leads</h2>
                                <Link href="/dashboard/dealer/crm" className="text-primary hover:text-white text-xs font-bold transition-colors uppercase tracking-widest border border-primary/20 px-3 py-1.5 rounded-md hover:bg-primary/10">View All</Link>
                            </div>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left h-full">
                                    <thead className="bg-[#0A0A0C]/80 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-4">Name</th>
                                            <th className="px-6 py-4">Vehicle</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-white/80 bg-slate-900/20">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-8 text-center">
                                                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                                </td>
                                            </tr>
                                        ) : !stats?.recentLeads?.length ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                    No leads yet. As buyers interact with your listings, leads will appear here.
                                                </td>
                                            </tr>
                                        ) : (
                                            stats.recentLeads.slice(0, 4).map((lead: any) => (
                                                <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-white group-hover:text-primary transition-colors">{lead.buyerName}</p>
                                                        <p className="text-xs text-gray-400 font-medium">{lead.buyerEmail}</p>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">{lead.listing?.title || '—'}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold ${
                                                            lead.status === 'NEW' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                            lead.status === 'CONTACTED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                            lead.status === 'WON' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                            {lead.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Dedicated Concierge (Takes 1/3 width) */}
                        <div className="dealer-glass-card flex-1 flex flex-col p-6 text-center border-t-4 border-t-amber-500">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
                            <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                                <div className="w-16 h-16 rounded-full border-2 border-amber-500/50 p-1 mb-4">
                                    <div className="w-full h-full rounded-full bg-slate-800 overflow-hidden relative">
                                        {/* Mock human avatar */}
                                        <div className="absolute inset-x-0 bottom-0 top-2 bg-slate-700 rounded-t-full"></div>
                                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-600"></div>
                                    </div>
                                </div>
                                <h3 className="text-lg font-black font-heading text-white mb-1">Michael O.</h3>
                                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-1 justify-center"><CheckCircle size={10} /> Dealer Success Partner</p>
                                <p className="text-xs text-gray-400 mb-6 px-4">
                                    I'm here to ensure your inventory performs at its peak. Chat with me anytime for pricing strategies or platform help.
                                </p>
                                <Button className="w-full bg-[#0A0A0C] border border-white/10 hover:border-amber-500/50 text-white font-bold gap-2">
                                    <HeartHandshake size={16} className="text-amber-400" />
                                    Message Michael
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
