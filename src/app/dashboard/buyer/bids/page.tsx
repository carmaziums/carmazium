"use client"

import * as React from "react"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getMyBids, formatPrice, type Bid } from "@/lib/listingApi"
import { Loader2 } from "lucide-react"

export default function MyBidsPage() {
    const { user, loading: authLoading } = useAuth()
    const [bids, setBids] = React.useState<Bid[]>([])
    const [loading, setLoading] = React.useState(true)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)

    React.useEffect(() => {
        async function fetchBids() {
            if (!user) return
            try {
                setLoading(true)
                const data = await getMyBids(page, 10)
                setBids(data.data || [])
                setTotalPages(data.pagination?.totalPages || 1)
            } catch (err) {
                console.error('Failed to fetch bids:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchBids()
        }
    }, [user, authLoading, page])

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white">My Bids</h1>
                    </div>

                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Your Bid</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : bids.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No bids yet. <Link href="/cars" className="text-primary hover:underline">Browse auctions</Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        bids.map((bid) => (
                                            <tr key={bid.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {bid.listing.images?.[0] && (
                                                            <img src={bid.listing.images[0]} alt="" className="w-14 h-10 rounded object-cover" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-white">{bid.listing.title}</div>
                                                            <div className="text-xs text-gray-400">{bid.listing.year} {bid.listing.make}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold">{formatPrice(bid.amount)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bid.isWinning
                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        }`}>
                                                        {bid.isWinning ? "Winning" : "Outbid"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {new Date(bid.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/cars/${bid.listing.slug}`} className="text-primary hover:text-white text-sm font-bold transition-colors">
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-4 border-t border-white/10 flex justify-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 rounded text-sm bg-slate-800 text-white disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-gray-400 text-sm">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-1 rounded text-sm bg-slate-800 text-white disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
