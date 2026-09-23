"use client"

import * as React from "react"
import {
    CheckCircle,
    Clock,
    DollarSign,
    FileText,
    Loader2,
    XCircle,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"

const STATUS_BADGES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    COMPLETED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
}

const financeRoute = DEALER_ROUTE_CONFIG.find(
    (route) => route.href === "/dashboard/dealer/finance",
)

export default function DealerFinancePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [applications, setApplications] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    const fetchFinance = React.useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await apiClient<{ data: any[] }>("/finance/my?page=1&limit=100")
            setApplications(res?.data ?? [])
        } catch (err: any) {
            setApplications([])
            setError(err?.message || "Could not load dealership finance applications.")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchFinance()
        }
    }, [user, authLoading, fetchFinance])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title={financeRoute?.title || "Finance"}
                        subHeader="Finance applications submitted by your dealership"
                    />

                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm text-[var(--text-secondary)]">
                        Finance providers control underwriting decisions. This dealership view is read-only and shows the live status returned by the provider.
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between gap-4">
                            <span>{error}</span>
                            <button className="font-bold hover:underline" onClick={fetchFinance}>
                                Retry
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Pending", value: applications.filter(a => a.status === "PENDING").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                            { label: "Approved", value: applications.filter(a => a.status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                            { label: "Completed", value: applications.filter(a => a.status === "COMPLETED").length, icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                            { label: "Rejected", value: applications.filter(a => a.status === "REJECTED").length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
                        ].map(stat => (
                            <MetricCard
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                                bg={stat.bg}
                                border={stat.border}
                                loading={loading}
                            />
                        ))}
                    </div>

                    <div className="dealer-glass-card overflow-hidden">
                        <div className="p-6 border-b border-[var(--border-default)] bg-[var(--bg-input)]">
                            <h2 className="text-base font-black font-heading uppercase tracking-tight">Dealership Applications</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                One shared finance history for the dealership owner, Admin and Finance Manager.
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="vip-table-header">
                                    <tr>
                                        <th className="px-6 py-5">Vehicle</th>
                                        <th className="px-6 py-5 text-right">Deposit</th>
                                        <th className="px-6 py-5 text-center">Term</th>
                                        <th className="px-6 py-5 text-right">Monthly</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-6 py-5">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : applications.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                                                <p className="text-[var(--text-muted)] font-bold">No finance applications</p>
                                                <p className="text-gray-600 text-sm mt-1">
                                                    Applications your dealership submits for vehicle purchases will appear here.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        applications.map((app: any) => (
                                            <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-5">
                                                    <p className="font-bold text-sm">{app.listing?.title || "Vehicle"}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">
                                                        {[app.listing?.make, app.listing?.model].filter(Boolean).join(" ")}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-sm">
                                                    £{Number(app.depositAmount || 0).toLocaleString("en-GB")}
                                                </td>
                                                <td className="px-6 py-5 text-center text-sm">{app.termMonths} months</td>
                                                <td className="px-6 py-5 text-right text-sm font-bold">
                                                    {app.monthlyPayment != null
                                                        ? `£${Number(app.monthlyPayment).toLocaleString("en-GB")}`
                                                        : "—"}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-black tracking-widest uppercase border ${STATUS_BADGES[app.status] || STATUS_BADGES.PENDING}`}>
                                                        {app.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm text-[var(--text-muted)]">
                                                    {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-GB") : "—"}
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
