"use client"

import * as React from "react"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getWatchlist, removeFromWatchlist, formatPrice, type WatchlistItem } from "@/lib/listingApi"
import { Loader2, Heart, Trash2 } from "lucide-react"

export default function WatchlistPage() {
    const { user, loading: authLoading } = useAuth()
    const [items, setItems] = React.useState<WatchlistItem[]>([])
    const [loading, setLoading] = React.useState(true)
    const [removing, setRemoving] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)

    React.useEffect(() => {
        async function fetchWatchlist() {
            if (!user) return
            try {
                setLoading(true)
                const data = await getWatchlist(page, 12)
                setItems(data.data || [])
                setTotalPages(data.pagination?.totalPages || 1)
            } catch (err) {
                console.error('Failed to fetch watchlist:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchWatchlist()
        }
    }, [user, authLoading, page])

    const handleRemove = async (listingId: string) => {
        try {
            setRemoving(listingId)
            await removeFromWatchlist(listingId)
            setItems(prev => prev.filter(item => item.listingId !== listingId))
        } catch (err) {
            console.error('Failed to remove:', err)
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white flex items-center gap-3">
                            <Heart className="text-pink-400" /> Watchlist
                        </h1>
                    </div>

                    {loading ? (
                        <div className="glass-card p-12 text-center">
                            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="glass-card p-12 text-center text-gray-500">
                            Your watchlist is empty. <Link href="/cars" className="text-primary hover:underline">Browse cars to add some!</Link>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {items.map((item) => (
                                    <div key={item.id} className="glass-card overflow-hidden group relative">
                                        <button
                                            onClick={() => handleRemove(item.listingId)}
                                            disabled={removing === item.listingId}
                                            className="absolute top-3 right-3 z-10 bg-slate-900/80 p-2 rounded-full text-pink-400 hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50"
                                            title="Remove from watchlist"
                                        >
                                            {removing === item.listingId ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <Heart size={18} fill="currentColor" />
                                            )}
                                        </button>
                                        <Link href={`/cars/${item.listing.slug}`}>
                                            <div className="relative h-48 w-full bg-slate-800">
                                                {item.listing.images?.[0] ? (
                                                    <img
                                                        src={item.listing.images[0]}
                                                        alt={item.listing.title}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                                                )}
                                                <div className={`absolute bottom-3 left-3 px-2 py-1 rounded text-xs font-bold ${item.listing.status === 'ACTIVE' ? 'bg-emerald-500/80 text-white' :
                                                        item.listing.status === 'SOLD' ? 'bg-blue-500/80 text-white' :
                                                            'bg-gray-500/80 text-white'
                                                    }`}>
                                                    {item.listing.status}
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h3 className="text-lg font-bold text-white mb-1 truncate">{item.listing.title}</h3>
                                                <p className="text-xs text-gray-400 mb-2">
                                                    {item.listing.year} • {item.listing.mileage?.toLocaleString() || 0} miles
                                                </p>
                                                <div className="flex justify-between items-end">
                                                    <p className="text-xl font-bold text-primary">{formatPrice(item.listing.price)}</p>
                                                    <span className="text-xs text-gray-400">{item.listing.viewCount} views</span>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 pt-6">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded bg-slate-800 text-white disabled:opacity-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-4 py-2 text-gray-400">Page {page} of {totalPages}</span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-4 py-2 rounded bg-slate-800 text-white disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
