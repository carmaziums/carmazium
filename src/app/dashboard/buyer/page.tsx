"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { Gavel, Heart, DollarSign, TrendingUp, Loader2, Trophy } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getBuyerStats, getMyBids, getWatchlist, formatPrice, type BuyerStats, type Bid, type WatchlistItem } from "@/lib/listingApi"

export default function BuyerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const [stats, setStats] = React.useState<BuyerStats | null>(null)
    const [recentBids, setRecentBids] = React.useState<Bid[]>([])
    const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return
            try {
                setLoading(true)
                const [statsData, bidsData, watchlistData] = await Promise.all([
                    getBuyerStats().catch(() => null),
                    getMyBids(1, 3).catch(() => ({ data: [] })),
                    getWatchlist(1, 3).catch(() => ({ data: [] })),
                ])
                setStats(statsData)
                setRecentBids(bidsData.data || [])
                setWatchlist(watchlistData.data || [])
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err)
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

                <DashboardSidebar role="buyer" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Buyer Account"} />

                <main className="flex-1 space-y-8">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/20 rounded-lg"><Gavel size={18} className="text-primary" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Active Bids</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.activeBids || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-pink-500/20 rounded-lg"><Heart size={18} className="text-pink-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Watchlist</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.watchlistCount || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><Trophy size={18} className="text-emerald-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Won</p>
                            <h3 className="text-3xl font-black font-heading text-emerald-400">
                                {loading ? "..." : stats?.wonAuctions || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-500/20 rounded-lg"><DollarSign size={18} className="text-yellow-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Total Spent</p>
                            <h3 className="text-2xl font-black font-heading text-white">
                                {loading ? "..." : formatPrice(stats?.totalSpent || 0)}
                            </h3>
                        </div>
                    </div>

                    {/* Recent Bids */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
                                <TrendingUp size={24} className="text-primary" /> Active Bids
                            </h2>
                            <Link href="/dashboard/buyer/bids" className="text-primary hover:text-white text-sm font-bold transition-colors">View All</Link>
                        </div>
                        <div className="space-y-4">
                            {loading ? (
                                <div className="glass-card p-8 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                </div>
                            ) : recentBids.length === 0 ? (
                                <div className="glass-card p-8 text-center text-gray-500">
                                    No active bids yet. <Link href="/cars" className="text-primary hover:underline">Browse auctions</Link>
                                </div>
                            ) : (
                                recentBids.map((bid) => (
                                    <div key={bid.id} className="glass-card p-4 flex flex-col md:flex-row gap-6 items-center group hover:bg-white/5 transition-colors">
                                        <div className="relative w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0 bg-slate-800">
                                            {bid.listing.images?.[0] ? (
                                                <Image src={bid.listing.images[0]} alt={bid.listing.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                                            )}
                                        </div>
                                        <div className="flex-1 w-full text-center md:text-left">
                                            <h3 className="font-bold text-lg mb-1 text-white">{bid.listing.title}</h3>
                                            <p className="text-gray-400 text-sm mb-3">{bid.listing.year} • {bid.listing.make} {bid.listing.model}</p>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded text-sm font-medium border ${bid.isWinning
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                                }`}>
                                                {bid.isWinning ? "Highest Bidder" : "Outbid"}
                                            </div>
                                        </div>
                                        <div className="text-right w-full md:w-auto flex flex-col items-center md:items-end gap-2">
                                            <p className="text-sm text-gray-400">Your Bid</p>
                                            <p className="text-2xl font-bold text-white">{formatPrice(bid.amount)}</p>
                                            <Link href={`/cars/${bid.listing.slug}`}>
                                                <Button size="sm" className="shadow-neon">View Auction</Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Watchlist Preview */}
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
                                <Heart size={24} className="text-pink-400" /> Watchlist
                            </h2>
                            <Link href="/dashboard/buyer/watchlist" className="text-primary hover:text-white text-sm font-bold transition-colors">View All</Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {loading ? (
                                <div className="col-span-3 glass-card p-8 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                </div>
                            ) : watchlist.length === 0 ? (
                                <div className="col-span-3 glass-card p-8 text-center text-gray-500">
                                    Your watchlist is empty. <Link href="/cars" className="text-primary hover:underline">Browse cars</Link>
                                </div>
                            ) : (
                                watchlist.map((item) => (
                                    <Link key={item.id} href={`/cars/${item.listing.slug}`} className="glass-card p-4 group hover:bg-white/5 transition-colors">
                                        <div className="relative w-full h-32 rounded-lg overflow-hidden mb-3 bg-slate-800">
                                            {item.listing.images?.[0] ? (
                                                <Image src={item.listing.images[0]} alt={item.listing.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-white truncate">{item.listing.title}</h3>
                                        <p className="text-primary font-bold">{formatPrice(item.listing.price)}</p>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
