"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { getMyListings, deleteListing, boostListing, formatPrice, type Listing } from "@/lib/listingApi"
import { useAuth } from "@/context/AuthContext"
import { PlusCircle, Loader2, Trash2, Eye, Zap, X, AlertCircle, CheckCircle2 } from "lucide-react"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"

export default function MyListingsPage() {
    const { user, loading: authLoading } = useAuth()
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [boosting, setBoosting] = React.useState<string | null>(null)
    const [boostTarget, setBoostTarget] = React.useState<Listing | null>(null)
    const [boostSuccess, setBoostSuccess] = React.useState<string | null>(null)

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
        if (!authLoading && user) fetchListings()
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

    const handleBoostConfirm = async () => {
        if (!boostTarget) return
        try {
            setBoosting(boostTarget.id)
            setBoostTarget(null)
            const result = await boostListing(boostTarget.id)
            if (result.url) {
                window.location.href = result.url
            } else {
                setBoostSuccess(boostTarget.title)
                await fetchListings()
            }
        } catch (err: any) {
            alert('Boost failed: ' + err.message)
        } finally {
            setBoosting(null)
        }
    }

    const getDaysRemaining = (featuredUntil: string | null) => {
        if (!featuredUntil) return 0
        return Math.max(0, Math.ceil((new Date(featuredUntil).getTime() - Date.now()) / 86_400_000))
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" />
                <main className="flex-1 space-y-6">

                    {/* ── Header ─────────────────────────────────── */}
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white">My Listings</h1>
                        <Link href="/sell" className="bg-primary text-white font-bold py-2 px-6 rounded shadow-neon hover:bg-red-600 transition-colors flex items-center gap-2">
                            <PlusCircle size={18} />
                            Create New Listing
                        </Link>
                    </div>

                    {/* ── Boost success banner ─────────────────────── */}
                    {boostSuccess && (
                        <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4 flex items-center gap-3 text-amber-400">
                            <CheckCircle2 size={20} />
                            <span>
                                <strong>{boostSuccess}</strong> is now featured for 28 days! It will appear in the Featured Listings section.
                            </span>
                            <button onClick={() => setBoostSuccess(null)} className="ml-auto text-amber-400/50 hover:text-amber-400">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* ── Boost CTA strip ───────────────────────────── */}
                    <div
                        className="relative overflow-hidden rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                        style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(245,158,11,0.05) 100%)' }}
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] shrink-0">
                                <Zap size={22} className="text-[#1A1A1A] fill-[#1A1A1A]" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-lg tracking-tight mb-0.5">Sell up to 3x faster with Featured</h3>
                                <p className="text-gray-300 text-sm">Pin your inventory to the top of search &amp; homepage. <strong className="text-amber-400">Free during beta!</strong></p>
                            </div>
                        </div>
                        <span className="relative z-10 text-sm font-bold px-4 py-2 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                            Click ⚡ Boost below
                        </span>
                    </div>

                    {/* ── Error banner ─────────────────────────────── */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* ── Table ────────────────────────────────────── */}
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
                                                No listings yet.{" "}
                                                <Link href="/sell" className="text-primary hover:underline">Create your first listing!</Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        listings.map((listing) => {
                                            const daysLeft = getDaysRemaining(listing.featuredUntil)
                                            return (
                                                <tr
                                                    key={listing.id}
                                                    className={`hover:bg-white/5 transition-colors ${listing.isFeatured ? 'border-l-2 border-amber-400/40' : ''}`}
                                                >
                                                    {/* Vehicle */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {listing.images?.[0] && (
                                                                <Image src={listing.images[0]} alt="" width={56} height={40} className="w-14 h-10 rounded object-cover" />
                                                            )}
                                                            <div>
                                                                <div className="font-bold text-white flex items-center gap-2">
                                                                    {listing.title}
                                                                    {listing.isFeatured && (
                                                                        <FeaturedBadge compact daysRemaining={daysLeft} />
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    {listing.year} • {listing.mileage?.toLocaleString() || 0} miles
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${listing.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            listing.status === "SOLD" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                                "bg-slate-700/50 text-gray-400 border-slate-600"
                                                            }`}>
                                                            {listing.status}
                                                        </span>
                                                    </td>

                                                    {/* Price */}
                                                    <td className="px-6 py-4 font-mono font-bold">{formatPrice(listing.price)}</td>

                                                    {/* Views */}
                                                    <td className="px-6 py-4 text-gray-400">{listing.viewCount || 0}</td>

                                                    {/* Actions */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex justify-end items-center gap-2">
                                                            {/* Boost button */}
                                                            {!listing.isFeatured && (
                                                                <button
                                                                    onClick={() => setBoostTarget(listing)}
                                                                    disabled={boosting === listing.id}
                                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-[#1A1A1A] hover:scale-105 hover:shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all disabled:opacity-50 disabled:hover:scale-100"
                                                                    title="Boost this listing to Featured for 28 days"
                                                                >
                                                                    {boosting === listing.id ? (
                                                                        <Loader2 size={12} className="animate-spin text-[#1A1A1A]" />
                                                                    ) : (
                                                                        <Zap size={12} className="fill-[#1A1A1A]" />
                                                                    )}
                                                                    Boost
                                                                </button>
                                                            )}

                                                            <Link href={`/vehicle/${listing.slug}`} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="View">
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
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-white/10 flex justify-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded text-sm bg-slate-800 text-white disabled:opacity-50">
                                    Previous
                                </button>
                                <span className="px-3 py-1 text-gray-400 text-sm">Page {page} of {totalPages}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded text-sm bg-slate-800 text-white disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* ── Boost Confirm Modal ─────────────────────────────────── */}
            {boostTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-amber-400/10">
                                <Zap size={22} className="text-amber-400" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Boost this Listing?</h2>
                        </div>

                        <div className="space-y-3 text-sm text-gray-300 mb-6">
                            <p>
                                Boosting <strong className="text-white">{boostTarget.title}</strong> will:
                            </p>
                            <ul className="space-y-2 list-none">
                                {[
                                    "⭐  Appear in the Featured Listings section on the homepage",
                                    "🔝  Pin to the top of all search results",
                                    "✨  Show a golden Featured badge on your listing",
                                    "📅  Last for 28 days",
                                ].map(item => (
                                    <li key={item} className="flex items-start gap-2 bg-slate-700/50 rounded-lg px-3 py-2">{item}</li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-amber-400/5 border border-amber-400/20 rounded-xl mb-6">
                            <div>
                                <span className="text-white font-medium">Cost</span>
                                <p className="text-xs text-gray-500 mt-0.5">Payment coming soon — free during beta</p>
                            </div>
                            <span className="text-2xl font-bold text-emerald-400">Free</span>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setBoostTarget(null)}
                                className="flex-1 py-2.5 rounded-full border border-white/10 text-gray-400 hover:bg-white/5 transition-colors text-sm font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBoostConfirm}
                                disabled={boosting === boostTarget?.id}
                                className="flex-1 py-2.5 rounded-full font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(245,158,11,0.5)] bg-gradient-to-r from-amber-400 to-orange-500 text-[#1A1A1A] hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {boosting === boostTarget?.id ? <Loader2 size={16} className="animate-spin text-[#1A1A1A]" /> : <Zap size={16} className="fill-[#1A1A1A]" />}
                                Confirm Boost
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
