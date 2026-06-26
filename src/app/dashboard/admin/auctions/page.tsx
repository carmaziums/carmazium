"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Gavel, Loader2, ArrowLeft, Eye, Car } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminAuctions } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

const STATUS_STYLES: Record<string, string> = {
    SCHEDULED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    ENDED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
}

export default function AdminAuctionsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [auctions, setAuctions] = React.useState<any[]>([])
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
        getAdminAuctions(page, limit)
            .then(r => { setAuctions(r.data || []); setTotal(r.pagination?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load auctions'))
            .finally(() => setLoading(false))
    }, [profile, page])

    if (authLoading || (user && !profile) || (loading && auctions.length === 0)) {
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
                            <Gavel className="text-purple-400 hidden sm:block" size={28} />
                            Auction Management
                        </h1>
                        <p className="text-gray-400 mt-1 text-sm">{total} total auctions</p>
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-black tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Seller</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Reserve</th>
                                        <th className="px-6 py-4 text-right">Top Bid</th>
                                        <th className="px-6 py-4 text-right">Bids</th>
                                        <th className="px-6 py-4 text-right">Winner</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {auctions.map((a) => (
                                        <tr key={a.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {a.listing?.images?.[0] ? (
                                                        <Image src={a.listing.images[0]} alt="" width={44} height={44} className="w-11 h-11 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center"><Car size={16} className="text-gray-400" /></div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-white text-sm max-w-[180px] truncate">{a.listing?.title}</p>
                                                        <p className="text-xs text-gray-400">{a.listing?.year} · {a.listing?.make}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                <p className="text-white">{a.listing?.seller?.firstName} {a.listing?.seller?.lastName}</p>
                                                <p className="text-gray-400">{a.listing?.seller?.email}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded border text-xs font-bold ${STATUS_STYLES[a.status] || STATUS_STYLES.ENDED}`}>
                                                    {a.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm font-bold">{formatPrice(a.reservePrice)}</td>
                                            <td className="px-6 py-4 text-right text-sm text-emerald-400 font-bold">
                                                {a.listing?.bids?.[0]?.amount ? formatPrice(Number(a.listing.bids[0].amount)) : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm">{a.listing?._count?.bids ?? 0}</td>
                                            <td className="px-6 py-4 text-right text-xs">
                                                {a.winner ? (
                                                    <span className="text-emerald-400">{a.winner.firstName} {a.winner.lastName}</span>
                                                ) : <span className="text-gray-500">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/auctions/live/${a.id}`} target="_blank" className="p-2.5 hover:bg-white/10 rounded-lg transition-colors text-blue-400 hover:text-white inline-flex" title="View Auction">
                                                    <Eye size={16} />
                                                </Link>
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
