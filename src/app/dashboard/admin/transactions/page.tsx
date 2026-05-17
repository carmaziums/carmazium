"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Receipt, Loader2, ArrowLeft } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminTransactions } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

const TYPE_LABELS: Record<string, string> = {
    DEPOSIT: "Deposit",
    FULL_PAYMENT: "Full Payment",
    COMMISSION: "Auction Fee",
    REFUND: "Refund",
    HPI_REPORT: "HPI Report",
    LISTING_FEE: "Listing Fee",
    BOOST: "Boost",
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    REFUNDED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

export default function AdminTransactionsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [transactions, setTransactions] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 20

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    React.useEffect(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        getAdminTransactions(page, limit)
            .then(r => { setTransactions(r.data || []); setTotal(r.meta?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load transactions'))
            .finally(() => setLoading(false))
    }, [profile, page])

    if (authLoading || (user && !profile) || (loading && transactions.length === 0)) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <Link href="/dashboard/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back to Overview
                        </Link>
                        <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                            <Receipt className="text-emerald-400 hidden sm:block" size={28} />
                            Transaction Ledger
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm">{total} total transactions</p>
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Type</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {transactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-xs">
                                                <p className="text-white font-medium">{t.user?.firstName} {t.user?.lastName}</p>
                                                <p className="text-gray-400">{t.user?.email}</p>
                                            </td>
                                            <td className="px-6 py-4 text-xs max-w-[160px]">
                                                {t.listing ? (
                                                    <div>
                                                        <p className="text-white truncate">{t.listing.title}</p>
                                                        <p className="text-gray-400">{t.listing.year} {t.listing.make}</p>
                                                    </div>
                                                ) : <span className="text-gray-500">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex px-2 py-1 rounded border border-white/10 bg-white/5 text-[10px] font-bold text-gray-300">
                                                    {TYPE_LABELS[t.type] || t.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded border text-[10px] font-bold ${STATUS_STYLES[t.status] || STATUS_STYLES.PENDING}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-sm">
                                                <span className={t.type === 'REFUND' ? 'text-red-400' : 'text-white'}>
                                                    {t.type === 'REFUND' ? '-' : ''}{formatPrice(Number(t.amount))}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-gray-400">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-white/10 bg-slate-800/30 flex items-center justify-between text-xs font-medium text-gray-400">
                            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                                <button className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
