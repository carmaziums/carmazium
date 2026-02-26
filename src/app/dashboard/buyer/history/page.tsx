"use client"

import * as React from "react"
import Image from "next/image"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getMyTransactions, formatPrice, type Transaction } from "@/lib/listingApi"
import { Loader2, ShoppingBag, AlertCircle } from "lucide-react"

export default function BuyerHistoryPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [transactions, setTransactions] = React.useState<Transaction[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!user || authLoading) return
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await getMyTransactions(1, 20)
                setTransactions(data.data || [])
            } catch (err) {
                console.error("Failed to fetch history:", err)
                setError("Could not load order history")
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

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" userName={userName} userType="Buyer" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Purchase History</h1>

                    {error && (
                        <div className="glass-card p-4 border border-red-500/30 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    <div className="glass-card p-6">
                        {transactions.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <ShoppingBag size={56} className="mx-auto mb-4 opacity-30" />
                                <p className="text-xl font-medium">No purchases yet</p>
                                <p className="text-sm mt-2 max-w-md mx-auto">When you win an auction or complete a purchase, your order history will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-white/10">
                                        <tr>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Order</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Vehicle</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Date</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Amount</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {transactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 text-gray-300 font-mono text-sm">{tx.id.slice(0, 8)}</td>
                                                <td className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        {tx.listing?.images?.[0] && (
                                                            <Image src={tx.listing.images[0]} alt="" width={48} height={32} className="w-12 h-8 rounded object-cover bg-slate-800" />
                                                        )}
                                                        <span className="text-white font-medium">{tx.listing?.title || "Vehicle"}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-gray-400 text-sm">{new Date(tx.createdAt).toLocaleDateString()}</td>
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
