"use client"

import * as React from "react"
import { Loader2, ClipboardList, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getInsuranceQuotes,
    updateInsuranceStatus,
    formatCurrency,
    type InsuranceQuote,
} from "@/lib/partnerApi"

export default function InsuranceQuotesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [quotes, setQuotes] = React.useState<InsuranceQuote[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updating, setUpdating] = React.useState<string | null>(null)
    const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 15

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return
            try {
                setLoading(true)
                const res = await getInsuranceQuotes(page, limit)
                setQuotes(res.data || [])
                setTotal(res.total || 0)
            } catch (err) {
                console.error('Failed to fetch quotes:', err)
            } finally {
                setLoading(false)
            }
        }
        if (!authLoading && user) fetchData()
    }, [user, authLoading, page])

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            setUpdating(id)
            const updated = await updateInsuranceStatus(id, status)
            setQuotes(prev => prev.map(q => q.id === id ? updated : q))
        } catch (err) {
            console.error('Failed to update status:', err)
        } finally {
            setUpdating(null)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    const filtered = statusFilter === "ALL"
        ? quotes
        : quotes.filter(q => q.status === statusFilter)

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="insurance" userName={userName} userType="Insurance Partner" />

                <main className="flex-1 space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h1 className="text-2xl font-black font-heading flex items-center gap-2">
                            <ClipboardList className="text-primary" /> Insurance Quotes
                        </h1>

                        <div className="flex gap-2 flex-wrap">
                            {["ALL", "PENDING", "QUOTED", "ACCEPTED", "EXPIRED", "REJECTED"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s
                                        ? 'bg-primary text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Applicant</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Driver Age</th>
                                        <th className="px-6 py-4 text-center">NCB Years</th>
                                        <th className="px-6 py-4 text-center">Convictions</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {loading ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">No quotes found.</td></tr>
                                    ) : (
                                        filtered.map((quote) => (
                                            <tr key={quote.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white">{quote.user?.firstName} {quote.user?.lastName}</div>
                                                    <div className="text-xs text-gray-400">{quote.user?.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">{quote.listing?.title || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-400">{formatCurrency(quote.listing?.price || 0)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">{quote.driverAge}</td>
                                                <td className="px-6 py-4 text-center">{quote.ncbYears}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {quote.hasConvictions ? (
                                                        <span className="text-red-400 flex items-center justify-center gap-1"><AlertCircle size={12} /> Yes</span>
                                                    ) : (
                                                        <span className="text-emerald-400">No</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${quote.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                        quote.status === 'QUOTED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                            quote.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                quote.status === 'EXPIRED' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                                                    'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                        {quote.status === 'PENDING' && <Clock size={10} />}
                                                        {quote.status === 'ACCEPTED' && <CheckCircle size={10} />}
                                                        {quote.status === 'REJECTED' && <XCircle size={10} />}
                                                        {quote.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">
                                                    {new Date(quote.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {updating === quote.id ? (
                                                        <Loader2 size={16} className="animate-spin text-primary inline" />
                                                    ) : quote.status === 'PENDING' ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button size="sm" className="bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 h-8 text-xs"
                                                                onClick={() => handleStatusUpdate(quote.id, 'QUOTED')}>Quote</Button>
                                                            <Button size="sm" variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 h-8 text-xs"
                                                                onClick={() => handleStatusUpdate(quote.id, 'REJECTED')}>Reject</Button>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-4 border-t border-white/10 flex justify-between items-center">
                                <span className="text-sm text-gray-400">Page {page} of {totalPages} ({total} total)</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-xs">Previous</Button>
                                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="text-xs">Next</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
