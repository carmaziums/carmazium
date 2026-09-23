"use client"

import * as React from "react"
import { DollarSign, FileText, Loader2, Clock, CheckCircle, XCircle, TrendingUp, Activity, ShieldCheck } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { DealerPermissionGate } from "@/components/dealer/DealerPermissionGate"

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
        <DealerPermissionGate
            permission="VIEW_ANALYTICS"
            title="Finance view restricted"
            description="Your dealership role does not include business reporting."
        >
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader 
                        title={DEALER_ROUTE_CONFIG[5].title}
                        subHeader="Read-only view of finance enquiries and provider decisions"
                    />

                    <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-300">
                        <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">Provider-controlled decisions</p>
                            <p className="mt-1 text-blue-300/80">
                                Dealers can monitor finance applications linked to their vehicles. Approval, review and rejection decisions are made by the finance provider, so this page is intentionally read-only.
                            </p>
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
                        <div className="p-8 border-b border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-black font-heading uppercase tracking-tight">Active Applications</h2>
                                <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Live underwriting ledger</p>
                            </div>
                            <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-widest p-2 bg-primary/5 rounded-lg border border-primary/10">
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
                                        <th className="px-8 py-5 text-center">Provider Status</th>
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
                                                <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                                                <p className="text-[var(--text-muted)] font-bold">No finance applications</p>
                                                <p className="text-gray-600 text-sm mt-1">Applications will appear when buyers apply for finance on your vehicles</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        applications.map((app: any) => (
                                            <tr key={app.id} className="group hover:bg-white/[0.02] transition-colors relative">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-black/60 rounded-xl flex items-center justify-center border border-[var(--border-default)] group-hover:border-primary/30 transition-colors">
                                                            <Activity size={18} className="text-[var(--text-muted)] group-hover:text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-sm tracking-tight">{app.user?.firstName} {app.user?.lastName}</p>
                                                            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">ID: {app.id.slice(0, 8)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 font-bold tracking-tight uppercase text-xs">{app.listing?.title}</td>
                                                <td className="px-6 py-6 text-right font-black text-sm tracking-tighter">£{app.depositAmount?.toLocaleString()}</td>
                                                <td className="px-6 py-6 text-center text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{app.termMonths} Months</td>
                                                <td className="px-6 py-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black tracking-tighter">{app.monthlyPayment ? `£${app.monthlyPayment}` : '—'}</span>
                                                        <span className="text-xs text-[var(--text-muted)] uppercase tracking-widest leading-none mt-1">Estim. P&I</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center">
                                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase border ${STATUS_BADGES[app.status] || STATUS_BADGES.PENDING}`}>
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
        </DealerPermissionGate>
    )
}
