"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { DollarSign, FileText, Loader2, Clock, CheckCircle, XCircle, AlertCircle, ShieldCheck, TrendingUp, Activity, BarChart3 } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"

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
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)
    const [toast, setToast] = React.useState<string | null>(null)

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

    async function updateStatus(id: string, status: string) {
        setUpdatingId(id)
        try {
            const res = await apiClient<{ data: any }>(`/finance/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            })
            const updated = res?.data
            setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
            setToast(`✓ Application marked as ${status.toLowerCase()}`)
            setTimeout(() => setToast(null), 3500)
        } catch (err: any) {
            setToast(err.message || 'Failed to update status')
            setTimeout(() => setToast(null), 3500)
        } finally {
            setUpdatingId(null)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-white/10 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4">
                    {toast}
                </div>
            )}
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader 
                        title={DEALER_ROUTE_CONFIG[4].title} 
                        subHeader={DEALER_ROUTE_CONFIG[4].subHeader}
                    />

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Pending Underwriting", short: "Pending", value: applications.filter(a => a.status === "PENDING").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                            { label: "Approved (Pre-Funding)", short: "Approved", value: applications.filter(a => a.status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                            { label: "Total Funded", short: "Funded", value: applications.filter(a => a.status === "FUNDED").length, icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                            { label: "Declined", short: "Rejected", value: applications.filter(a => a.status === "REJECTED").length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
                        ].map(stat => (
                            <MetricCard 
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                                bg={stat.bg}
                                border={stat.border}
                                statusLabel={stat.short}
                                loading={loading}
                            />
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
                                        <th className="px-6 py-5 text-center">Actions</th>
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
                                                {/* Action Buttons */}
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        {updatingId === app.id ? (
                                                            <Loader2 size={16} className="animate-spin text-primary" />
                                                        ) : (
                                                            <>
                                                                {app.status !== 'APPROVED' && app.status !== 'FUNDED' && (
                                                                    <button
                                                                        onClick={() => updateStatus(app.id, 'APPROVED')}
                                                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                )}
                                                                {app.status === 'PENDING' && (
                                                                    <button
                                                                        onClick={() => updateStatus(app.id, 'REVIEWING')}
                                                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                                                                    >
                                                                        Review
                                                                    </button>
                                                                )}
                                                                {app.status !== 'REJECTED' && app.status !== 'FUNDED' && (
                                                                    <button
                                                                        onClick={() => updateStatus(app.id, 'REJECTED')}
                                                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
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
