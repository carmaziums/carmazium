"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { DollarSign, FileText, Loader2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

const STATUS_BADGES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FUNDED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
}

export default function DealerFinancePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [applications, setApplications] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        if (!authLoading && user) {
            setApplications([])
            setLoading(false)
        }
    }, [user, authLoading])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div>
                        <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Finance Hub</h1>
                        <p className="text-gray-400 text-sm">Track finance applications on your dealership vehicles</p>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Pending", value: applications.filter(a => a.status === "PENDING").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/20" },
                            { label: "Approved", value: applications.filter(a => a.status === "APPROVED").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
                            { label: "Funded", value: applications.filter(a => a.status === "FUNDED").length, icon: DollarSign, color: "text-blue-400", bg: "bg-blue-500/20" },
                            { label: "Rejected", value: applications.filter(a => a.status === "REJECTED").length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/20" },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                <div className={`p-2 ${stat.bg} rounded-lg w-fit mb-2`}>
                                    <stat.icon size={16} className={stat.color} />
                                </div>
                                <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">{stat.label}</p>
                                <p className="text-2xl font-black text-white">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Applications Table */}
                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="p-6 border-b border-white/10 bg-white/5">
                            <h2 className="text-lg font-black font-heading text-white uppercase tracking-tight">Finance Applications</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Applicant</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-right">Deposit</th>
                                        <th className="px-6 py-4 text-center">Term</th>
                                        <th className="px-6 py-4 text-right">Monthly</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
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
                                            <tr key={app.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-white text-sm">{app.user?.firstName} {app.user?.lastName}</p>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">{app.listing?.title}</td>
                                                <td className="px-6 py-4 text-right text-sm text-white">£{app.depositAmount?.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center text-sm text-gray-400">{app.termMonths} months</td>
                                                <td className="px-6 py-4 text-right text-sm text-white">{app.monthlyPayment ? `£${app.monthlyPayment}` : '—'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${STATUS_BADGES[app.status] || STATUS_BADGES.PENDING}`}>
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
