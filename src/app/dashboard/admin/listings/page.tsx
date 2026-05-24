"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Car, Loader2, ArrowLeft, Trash2, AlertTriangle, Eye } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminListings, deleteListingForce } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

export default function AdminListingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [listings, setListings] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 20

    React.useEffect(() => {
        // Enforce Admin Access
        if (!authLoading) {
            if (!user) {
                router.replace('/auth/login')
                return
            }
            if (profile?.role !== 'ADMIN') {
                router.replace('/dashboard')
                return
            }
        }
    }, [user, profile, authLoading, router])

    const fetchListings = async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminListings(page, limit)
            setListings(result.data || [])
            setTotal(result.meta?.total || 0)
        } catch (err: any) {
            console.error('Failed to fetch admin listings:', err)
            setError(err.message || "Failed to load system listings.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') {
            fetchListings()
        }
    }, [profile, page])

    const handleDelete = async (listingId: string) => {
        if (!window.confirm("Are you sure you want to forcefully delete this listing? This action cannot be undone.")) return;

        try {
            setDeleting(listingId)
            await deleteListingForce(listingId)
            setListings(listings.filter(l => l.id !== listingId))
            setTotal(t => t - 1)
        } catch (err: any) {
            alert(err.message || 'Failed to delete listing')
        } finally {
            setDeleting(null)
        }
    }

    if (authLoading || (user && !profile) || (loading && listings.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null;

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading text-white uppercase tracking-tight flex items-center gap-3">
                                <Car className="text-primary hidden sm:block" size={28} />
                                Listing Moderation
                            </h1>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                            <strong>System Error:</strong> {error}
                        </div>
                    )}

                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4">Seller</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {listings.map((l) => (
                                        <tr key={l.id} className={`transition-colors ${l.deletedAt ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {l.images?.[0] ? (
                                                        <Image src={l.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                                                            <Car className="text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-white max-w-[200px] truncate">{l.title}</p>
                                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                                            {l.vrm || 'No VRM'} 
                                                            {l.deletedAt && <AlertTriangle size={12} className="text-red-400 ml-1" />}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${
                                                    l.deletedAt ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    l.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                                    l.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                }`}>
                                                    {l.deletedAt ? 'DELETED' : l.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-sm">
                                                {formatPrice(l.price)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    <p className="text-white truncate max-w-[150px]">{l.seller?.firstName} {l.seller?.lastName}</p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[150px]">{l.seller?.email}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link href={`/buy-cars/${l.slug}`} target="_blank" className="p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-400 hover:text-white" title="View Listing">
                                                        <Eye size={18} />
                                                    </Link>
                                                    <button 
                                                        onClick={() => handleDelete(l.id)} 
                                                        disabled={deleting === l.id || !!l.deletedAt}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Force Delete"
                                                    >
                                                        {deleting === l.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination footer */}
                        <div className="p-4 border-t border-white/10 bg-slate-800/30 flex items-center justify-between text-xs font-medium text-gray-400">
                            <span>Showing {(page - 1) * limit + 1 + (listings.length === 0 ? -1 : 0)} to {Math.min(page * limit, total)} of {total}</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >Prev</button>
                                <button 
                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-50"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= total}
                                >Next</button>
                            </div>
                        </div>
                    </div>

                </main>
            </div>
        </div>
    )
}
