"use client"

import * as React from "react"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { getMyListings, deleteListing, formatPrice, type Listing } from "@/lib/listingApi"
import { useAuth } from "@/context/AuthContext"
import { PlusCircle, Loader2, Trash2, Eye, Edit, AlertCircle } from "lucide-react"

export default function MyListingsPage() {
    const { user, loading: authLoading } = useAuth()
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [deleting, setDeleting] = React.useState<string | null>(null)

    const fetchListings = React.useCallback(async () => {
        if (!user) return
        try {
            setLoading(true)
            setError(null)
            const data = await getMyListings({ page, limit: 10 })
            setListings(data.data || [])
            setTotalPages(data.pagination?.totalPages || 1)
        } catch (err: any) {
            console.error('Failed to fetch listings:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user, page])

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchListings()
        }
    }, [authLoading, user, fetchListings])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this listing?')) return
        try {
            setDeleting(id)
            await deleteListing(id)
            setListings(prev => prev.filter(l => l.id !== id))
        } catch (err: any) {
            alert('Failed to delete: ' + err.message)
        } finally {
            setDeleting(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white">My Listings</h1>
                        <Link href="/sell" className="bg-primary text-white font-bold py-2 px-6 rounded shadow-neon hover:bg-red-600 transition-colors flex items-center gap-2">
                            <PlusCircle size={18} />
                            Create New Listing
                        </Link>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4">Views</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : listings.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No listings yet. <Link href="/sell" className="text-primary hover:underline">Create your first listing!</Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        listings.map((listing) => (
                                            <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {listing.images?.[0] && (
                                                            <img src={listing.images[0]} alt="" className="w-14 h-10 rounded object-cover" />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-white">{listing.title}</div>
                                                            <div className="text-xs text-gray-400">
                                                                {listing.year} • {listing.mileage?.toLocaleString() || 0} miles
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${listing.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            listing.status === "SOLD" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                                "bg-slate-700/50 text-gray-400 border-slate-600"
                                                        }`}>
                                                        {listing.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-mono font-bold">{formatPrice(listing.price)}</td>
                                                <td className="px-6 py-4 text-gray-400">{listing.viewCount || 0}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/cars/${listing.slug}`} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
                                                            <Eye size={16} />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(listing.id)}
                                                            disabled={deleting === listing.id}
                                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Delete"
                                                        >
                                                            {deleting === listing.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-white/10 flex justify-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 rounded text-sm bg-slate-800 text-white disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-gray-400 text-sm">
                                    Page {page} of {totalPages}
                                </span>
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
