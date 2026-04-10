"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { DollarSign, FileText, Loader2, Clock, CheckCircle, XCircle, AlertCircle, ShieldCheck, TrendingUp, Activity, BarChart3 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

const STATUS_BADGES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    FUNDED: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20 opacity-60",
}

export default function DealerFinancePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [applications, setApplications] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchFinance()
        }
    }, [user, authLoading])

    async function fetchFinance() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/finance/my')
            setApplications(res?.data ?? [])
        } catch {
            setApplications([])
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
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">Finance</h1>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Strategic vehicle financing & liquidity oversight</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#0A0A0C] px-4 py-2 rounded-full border border-white/5">
                            <ShieldCheck size={14} className="text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Audited Financial Terminal</span>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Pending Underwriting", short: "Pending", value: applications.filter(a => a.status === "PENDING").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                            { label: "Approved (Pre-Funding)", short: "Approved", value: applications.filter(a => a.status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                            { label: "Total Funded", short: "Funded", value: applications.filter(a => a.status === "FUNDED").length, icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                            { label: "Declined", short: "Rejected", value: applications.filter(a => a.status === "REJECTED").length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
                        ].map(stat => (
                            <div key={stat.label} className="dealer-glass-card p-6 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                    <div className={`p-2 rounded-lg border ${stat.bg} ${stat.border}`}>
                                        <stat.icon size={18} className={stat.color} />
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{stat.short}</span>
                                </div>
                                <h3 className="text-3xl font-black font-heading text-white relative z-10">
                                    {stat.value}
                                </h3>
                                <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold relative z-10">{stat.label}</p>
                                <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill="currentColor" className={stat.color} />
                                </svg>
                            </div>
                        ))}
                    </div>

                    {/* Applications Table */}
                    <div className="dealer-glass-card overflow-hidden">
                        <div className="p-8 border-b border-white/5 bg-[#0A0A0C]/40 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black font-heading text-white uppercase tracking-tight">Active Applications</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Live underwriting ledger</p>
                            </div>
                            <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest p-2 bg-primary/5 rounded-lg border border-primary/10">
                                <TrendingUp size={12} /> Real-time Pricing
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="vip-table-header">
                                    <tr>
                                        <th className="px-8 py-5">Verified Borrower</th>
                                        <th className="px-6 py-5">Vehicle Collateral</th>
                                        <th className="px-6 py-5 text-right">Down Payment</th>
                                        <th className="px-6 py-5 text-center">Contract Term</th>
                                        <th className="px-6 py-5 text-right">P&I Monthly</th>
                                        <th className="px-8 py-5 text-center">Risk Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : !applications.length ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <FileText className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                                <p className="text-gray-500 font-bold">No finance applications</p>
                                                <p className="text-gray-600 text-sm mt-1">Applications will appear when buyers apply for finance on your vehicles</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        applications.map((app: any) => (
                                            <tr key={app.id} className="group hover:bg-white/[0.02] transition-colors relative">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-black/60 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                                                            <Activity size={18} className="text-gray-500 group-hover:text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-white text-sm tracking-tight">{app.user?.firstName} {app.user?.lastName}</p>
                                                            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">ID: {app.id.slice(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 font-bold text-white tracking-tight uppercase text-xs">{app.listing?.title}</td>
                                                <td className="px-6 py-6 text-right font-black text-white text-sm tracking-tighter">£{app.depositAmount?.toLocaleString()}</td>
                                                <td className="px-6 py-6 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">{app.termMonths} Months</td>
                                                <td className="px-6 py-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black text-white tracking-tighter">{app.monthlyPayment ? `£${app.monthlyPayment}` : '—'}</span>
                                                        <span className="text-[9px] text-gray-500 uppercase tracking-widest leading-none mt-1">Estim. P&I</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${STATUS_BADGES[app.status] || STATUS_BADGES.PENDING}`}>
                                                        {app.status}
                                                    </span>
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
