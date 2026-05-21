"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { PlusCircle, Loader2, Eye, TrendingUp, Car, DollarSign } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { useAuth } from "@/context/AuthContext"
import { getSellerStats, getMyListings, formatPrice, type SellerStats, type Listing } from "@/lib/listingApi"

export default function SellerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const [stats, setStats] = React.useState<SellerStats | null>(null)
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return

            try {
                setLoading(true)
                const [statsData, listingsData] = await Promise.all([
                    getSellerStats(),
                    getMyListings({ limit: 5 })
                ])
                setStats(statsData)
                setListings(listingsData.data || [])
            } catch (err: any) {
                console.error('Failed to fetch dashboard data:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchData()
        }
    }, [user, authLoading])

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="seller" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Seller Account"}>
                    <Link href="/sell">
                        <Button className="w-full flex items-center gap-2 shadow-neon h-12" shape="default"><PlusCircle size={18} /> Create New Listing</Button>
                    </Link>
                </DashboardSidebar>

                <main className="flex-1 space-y-8 min-w-0">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                            label="Active Listings"
                            value={stats?.activeListings || 0}
                            icon={Car}
                            color="text-primary"
                            bg="bg-primary/10"
                            border="border-primary/20"
                            loading={loading}
                            href="/dashboard/seller/listings?status=ACTIVE"
                        />
                        <MetricCard 
                            label="Total Views" 
                            value={stats?.totalViews?.toLocaleString() || 0} 
                            icon={Eye} 
                            color="text-blue-400" 
                            bg="bg-blue-500/10" 
                            border="border-blue-500/20" 
                            loading={loading} 
                        />
                        <MetricCard
                            label="Sold"
                            value={stats?.soldListings || 0}
                            icon={TrendingUp}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            loading={loading}
                            href="/dashboard/seller/listings?status=SOLD"
                        />
                        <MetricCard 
                            label="Revenue" 
                            value={formatPrice(stats?.totalRevenue || 0)} 
                            icon={DollarSign} 
                            color="text-yellow-400" 
                            bg="bg-yellow-500/10" 
                            border="border-yellow-500/20" 
                            loading={loading} 
                        />
                    </div>

                    {/* Active Listings Table */}
                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-black font-heading text-white uppercase tracking-tight">Your Inventory</h2>
                            <Link href="/dashboard/seller/listings" className="text-primary hover:text-white text-sm font-black transition-colors uppercase">Manage All</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4 text-center">Views</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white/80">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : listings.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                                No listings found. <Link href="/sell" className="text-primary hover:underline">Create your first listing!</Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        listings.map((listing) => (
                                            <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {listing.images?.[0] && (
                                                            <Image src={listing.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                                                        )}
                                                        <div>
                                                            <p className="font-bold text-white">{listing.title}</p>
                                                            <p className="text-xs text-gray-400">{listing.year} • {listing.mileage?.toLocaleString() || 0} miles</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${listing.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        listing.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                            'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                        }`}>
                                                        {listing.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold">{formatPrice(listing.price)}</td>
                                                <td className="px-6 py-4 text-center text-gray-400">{listing.viewCount || 0}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/buy-cars/${listing.slug}`} className="text-primary hover:text-white text-xs font-bold transition-colors">
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
