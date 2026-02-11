"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getEarningsStats, getMyTransactions, formatPrice, type Transaction, type EarningsStats } from "@/lib/listingApi"
import { Loader2, DollarSign, Clock, TrendingUp, AlertCircle } from "lucide-react"

export default function SellerEarningsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [earnings, setEarnings] = React.useState<EarningsStats | null>(null)
    const [transactions, setTransactions] = React.useState<Transaction[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!user || authLoading) return
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
                const [earningsData, txData] = await Promise.all([
                    getEarningsStats(),
                    getMyTransactions(1, 10),
                ])
                setEarnings(earningsData)
                setTransactions(txData.data || [])
            } catch (err) {
                console.error("Failed to fetch earnings:", err)
                setError("Could not load earnings data")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [user, authLoading])

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const statCards = [
        { label: "Available for Payout", value: formatPrice(earnings?.available || 0), icon: DollarSign, color: "text-emerald-400" },
        { label: "Pending Clearance", value: formatPrice(earnings?.pendingClearance || 0), icon: Clock, color: "text-amber-400" },
        { label: "Total Earnings (YTD)", value: formatPrice(earnings?.totalYTD || 0), icon: TrendingUp, color: "text-blue-400" },
    ]

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" userName={userName} userType="Seller" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Earnings</h1>

                    {error && (
                        <div className="glass-card p-4 border border-red-500/30 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {statCards.map(card => (
                            <div key={card.label} className="glass-card p-6 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center ${card.color}`}>
                                    <card.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">{card.label}</p>
                                    <p className="text-2xl font-bold text-white">{card.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="glass-card p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Recent Transactions</h2>
                        {transactions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg">No transactions yet</p>
                                <p className="text-sm mt-1">Your transaction history will appear here once you make sales</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-white/10">
                                        <tr>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">ID</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Vehicle</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Date</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Type</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Amount</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 text-gray-300 text-sm font-mono">{tx.id.slice(0, 8)}</td>
                                                <td className="py-3 text-white font-medium">{tx.listing?.title || "—"}</td>
                                                <td className="py-3 text-gray-400 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                                <td className="py-3">
                                                    <span className="text-xs font-medium px-2 py-1 rounded bg-slate-800 text-gray-300">{tx.type.replaceAll('_', ' ')}</span>
                                                </td>
                                                <td className="py-3 text-white font-medium">{formatPrice(Number(tx.amount))}</td>
                                                <td className="py-3">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded ${tx.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" :
                                                            tx.status === "PENDING" ? "bg-amber-500/20 text-amber-400" :
                                                                tx.status === "FAILED" ? "bg-red-500/20 text-red-400" :
                                                                    "bg-gray-500/20 text-gray-400"
                                                        }`}>{tx.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
