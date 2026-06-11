"use client"
import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { 
    LayoutDashboard, 
    Car, 
    Tag, 
    Gavel, 
    BarChart3, 
    MessageSquare, 
    DollarSign, 
    Settings,
    Loader2,
    PlusCircle,
    TrendingUp,
    Eye,
    ChevronRight,
    Lock,
    ShieldCheck,
    Mail,
    Phone,
    User as UserIcon,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    Download,
    Zap,
    Trash2,
    Pencil,
    MoreVertical,
    CheckCircle2,
    Upload,
    AlertCircle,
    X,
    Clock,
    XCircle,
    Target,
    AlertTriangle,
    RefreshCw,
    Heart,
    CreditCard,
    ExternalLink,
    BadgeCheck
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { RecordSaleModal } from "@/components/dashboard/RecordSaleModal"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow), { ssr: false })

import Link from "next/link"
import Image from "next/image"
import { 
    getUnifiedDashboard, 
    getEarnings,
    resetPassword,
    getMyListings,
    deleteListing,
    boostListing,
    publishListing,
    createListingCheckoutSession,
    getOffersForListing,
    getMyOffers,
    getMyBids,
    respondToOffer,
    withdrawOffer,
    respondToCounterOffer,
    getSellerPerformance,
    getWatchlist,
    removeFromWatchlist,
    formatPrice,
    startStripeConnectOnboarding,
    getStripeConnectStatus,
    type UnifiedDashboardData,
    type EarningsResponse,
    type SaleRecord,
    type Listing,
    type Offer,
    type PerformanceStats,
    type WatchlistItem,
    type StripeConnectStatus
} from "@/lib/listingApi"
import { createChatRoom, type ChatRoom } from "@/lib/chatApi"

export default function UnifiedUserDashboard() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        }>
            <UnifiedUserDashboardContent />
        </React.Suspense>
    )
}

function UnifiedUserDashboardContent() {
    const { user, profile, loading: authLoading } = useAuth()
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const router = useRouter()
    const activeTab = searchParams.get("tab") || "overview"
    
    const [dashboardData, setDashboardData] = React.useState<UnifiedDashboardData | null>(null)
    const [loading, setLoading] = React.useState(true)

    const setTab = (tab: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", tab)
        router.push(`?${params.toString()}`)
    }

    const fetchStats = async () => {
        if (!user) return
        try {
            const unified = await getUnifiedDashboard()
            setDashboardData(unified)
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err)
        }
    }

    React.useEffect(() => {
        if (!authLoading && user) {
            setLoading(true)
            fetchStats().finally(() => setLoading(false))
            refreshRooms()
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
    const userRole = profile?.role || "User"

    const tabs = [
        { id: "overview", label: "Overview", icon: LayoutDashboard },
        { id: "inventory", label: "Inventory", icon: Car },
        { id: "offers", label: "Incoming", icon: Tag, badge: dashboardData?.seller.incomingOffers },
        { id: "bids", label: "My Offers", icon: Gavel },
        { id: "stats", label: "Performance", icon: BarChart3 },
        { id: "messages", label: "Messages", icon: MessageSquare, badge: dashboardData?.unreadMessages },
        { id: "earnings", label: "Earnings", icon: DollarSign },
        { id: "settings", label: "Settings", icon: Settings },
    ]

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                {/* Unified Sidebar */}
                <DashboardSidebar
                    role="seller"
                    userName={userName}
                    userType={`${userRole} Account`}
                    myOffersCounterBadge={dashboardData?.buyer.counteredOffersPending}
                >
                    <Link href="/sell">
                        <Button className="w-full flex items-center gap-2 shadow-neon h-12" shape="default">
                            <PlusCircle size={18} /> Create New Listing
                        </Button>
                    </Link>
                </DashboardSidebar>

                <main className="flex-1 space-y-8 min-w-0">


                    {/* Tab Content */}
                    <div className="min-h-[60vh] w-full min-w-0">
                        {activeTab === "overview" && <OverviewTab data={dashboardData} loading={loading} setTab={setTab} />}
                        {activeTab === "inventory" && <InventoryTab onRefreshStats={fetchStats} />}
                        {activeTab === "offers" && <OffersTab onRefreshStats={fetchStats} />}
                        {activeTab === "bids" && <OutgoingOffersTab onRefreshStats={fetchStats} />}
                        {activeTab === "watchlist" && <WatchlistTab />}
                        {activeTab === "stats" && <StatsTab />}
                        {activeTab === "messages" && <MessagesTab rooms={rooms} refreshRooms={refreshRooms} />}
                        {activeTab === "earnings" && <EarningsTab />}
                        {activeTab === "settings" && <SettingsTab profile={profile} />}
                    </div>
                </main>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ data, loading, setTab }: { data: UnifiedDashboardData | null, loading: boolean, setTab: (t: string) => void }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black font-heading uppercase tracking-tight">Unified Overview</h2>
                    <p className="text-gray-400 text-sm font-medium">Your combined activity as a buyer and seller.</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    label="Active Inventory" 
                    value={data?.seller?.activeListings || 0} 
                    icon={Car} 
                    color="text-primary" 
                    bg="bg-primary/10" 
                    border="border-primary/20" 
                    loading={loading} 
                />
                <MetricCard 
                    label="Total Revenue" 
                    value={formatPrice(data?.seller?.totalRevenue || 0)} 
                    icon={DollarSign} 
                    color="text-emerald-400" 
                    bg="bg-emerald-500/10" 
                    border="border-emerald-500/20" 
                    loading={loading} 
                />
                <MetricCard 
                    label="Watchlist" 
                    value={data?.buyer?.watchlistCount || 0} 
                    icon={Heart} 
                    color="text-pink-400" 
                    bg="bg-pink-500/10" 
                    border="border-pink-500/20" 
                    loading={loading} 
                />
                <MetricCard 
                    label="Total Views" 
                    value={data?.seller?.totalViews || 0} 
                    icon={Eye} 
                    color="text-yellow-400" 
                    bg="bg-yellow-500/10" 
                    border="border-yellow-500/20" 
                    loading={loading} 
                />
            </div>

            {/* Recent Activity / Next Steps */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-card p-6 border-white/10 bg-white/5 rounded-2xl">
                    <h3 className="text-lg font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-6">
                        <TrendingUp className="text-primary" size={20} /> Seller Insights
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary border border-primary/20">
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Incoming Offers</p>
                                    <p className="text-xs text-gray-500">You have {data?.seller?.incomingOffers || 0} pending offers to review.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10" onClick={() => setTab('offers')}>View All</Button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                    <DollarSign size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Earnings Status</p>
                                    <p className="text-xs text-gray-500">Your total realized revenue is {formatPrice(data?.seller?.totalRevenue || 0)}.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => setTab('earnings')}>History</Button>
                        </div>
                    </div>
                </div>

                <div className="glass-card p-6 border-white/10 bg-white/5 rounded-2xl">
                    <h3 className="text-lg font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-6">
                        <Gavel className="text-blue-400" size={20} /> Buyer Insights
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/20">
                                    <Tag size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">My Sent Offers</p>
                                    <p className="text-xs text-gray-500">Track the offers you've made on vehicles.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-blue-400 hover:bg-blue-500/10" onClick={() => setTab('bids')}>Manage</Button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-yellow-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-400 border border-yellow-500/20">
                                    <Heart size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Watchlist</p>
                                    <p className="text-xs text-gray-500">You are tracking {data?.buyer?.watchlistCount || 0} vehicles.</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-yellow-400 hover:bg-yellow-500/10">Browse</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// WATCHLIST TAB
// ─────────────────────────────────────────────────────────────────────────────

function WatchlistTab() {
    const [items, setItems] = React.useState<WatchlistItem[]>([])
    const [loading, setLoading] = React.useState(true)
    const [removing, setRemoving] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)

    const fetchWatchlist = React.useCallback(async () => {
        try {
            setLoading(true)
            const res = await getWatchlist(page, 12)
            setItems(res.data || [])
            setTotalPages(res.pagination?.totalPages || 1)
        } catch (err) {
            console.error('Failed to fetch watchlist:', err)
        } finally {
            setLoading(false)
        }
    }, [page])

    React.useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

    const handleRemove = async (listingId: string) => {
        try {
            setRemoving(listingId)
            await removeFromWatchlist(listingId)
            setItems(prev => prev.filter(i => i.listingId !== listingId))
        } catch (err: any) {
            alert('Failed to remove: ' + err.message)
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black font-heading uppercase tracking-tight">My Watchlist</h2>
                <Link href="/buy-cars">
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                        Browse More
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-white/5 rounded-2xl h-64 animate-pulse border border-white/10" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="glass-card p-20 text-center border-white/10 bg-white/5 rounded-2xl border-dashed">
                    <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-pink-500/20">
                        <Heart size={40} className="text-pink-400/50" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase mb-2">Your Watchlist is Empty</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto mb-8">
                        Save the vehicles you're interested in by clicking the heart icon on any listing.
                    </p>
                    <Link href="/buy-cars">
                        <Button className="shadow-neon px-8 h-12 font-black uppercase tracking-widest">
                            Browse Listings
                        </Button>
                    </Link>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => (
                            <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all group">
                                <div className="relative h-44 bg-slate-800">
                                    {item.listing.images?.[0] ? (
                                        <Image src={item.listing.images[0]} alt={item.listing.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600"><Car size={32} /></div>
                                    )}
                                    {item.listing.status !== 'ACTIVE' && (
                                        <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                                            {item.listing.status === 'SOLD' ? 'Sold' : 'Unavailable'}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleRemove(item.listingId)}
                                        disabled={removing === item.listingId}
                                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-pink-400 hover:bg-red-500/80 hover:text-white transition-all"
                                        title="Remove from watchlist"
                                    >
                                        {removing === item.listingId
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Heart size={14} fill="currentColor" />}
                                    </button>
                                </div>
                                <div className="p-4">
                                    <p className="font-black text-white text-sm uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                                        {item.listing.title}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {[item.listing.year, item.listing.mileage ? `${item.listing.mileage.toLocaleString()} mi` : null].filter(Boolean).join(' · ')}
                                    </p>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-primary font-black text-base">{formatPrice(Number(item.listing.price))}</span>
                                        <Link href={`/buy-cars/${item.listing.slug}`}>
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                                View <ChevronRight size={12} />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                            <span className="text-sm text-gray-400 flex items-center px-2">Page {page} of {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY TAB
// ─────────────────────────────────────────────────────────────────────────────

function InventoryTab({ onRefreshStats }: { onRefreshStats: () => void }) {
    const { profile } = useAuth()
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [page, setPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [boosting, setBoosting] = React.useState<string | null>(null)
    const [saleListing, setSaleListing] = React.useState<Listing | null>(null)
    const [publishing, setPublishing] = React.useState<string | null>(null)

    const auctionDashPath = profile?.role === 'DEALER' ? '/dashboard/dealer/auctions' : '/dashboard/seller/auctions'

    const fetchListings = React.useCallback(async () => {
        try {
            setLoading(true)
            const data = await getMyListings({ page, limit: 10 })
            setListings(data.data || [])
            setTotalPages(data.pagination?.totalPages || 1)
        } catch (err) {
            console.error('Failed to fetch listings:', err)
        } finally {
            setLoading(false)
        }
    }, [page])

    React.useEffect(() => {
        fetchListings()
    }, [fetchListings])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this listing?')) return
        try {
            setDeleting(id)
            await deleteListing(id)
            setListings(prev => prev.filter(l => l.id !== id))
            onRefreshStats()
        } catch (err: any) {
            alert('Failed to delete: ' + err.message)
        } finally {
            setDeleting(null)
        }
    }

    const handlePublish = async (listing: Listing) => {
        try {
            setPublishing(listing.id)
            const result = await publishListing(listing.id)
            if (result.activated) {
                setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: 'ACTIVE' as const } : l))
            } else if (result.requiresPayment) {
                const checkout = await createListingCheckoutSession(listing.id, listing.badgeTier || 'BASIC')
                window.location.href = checkout.url
            }
        } catch (err: any) {
            alert('Failed to publish: ' + err.message)
        } finally {
            setPublishing(null)
        }
    }

    const handleBoost = async (id: string) => {
        try {
            setBoosting(id)
            const result = await boostListing(id)
            if (result.url) {
                window.location.href = result.url
            } else {
                fetchListings()
            }
        } catch (err: any) {
            alert('Boost failed: ' + err.message)
        } finally {
            setBoosting(null)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black font-heading uppercase tracking-tight">My Inventory</h2>
                <Link href="/sell">
                    <Button className="flex items-center gap-2 h-10 shadow-neon-small" size="sm">
                        <PlusCircle size={18} /> New Listing
                    </Button>
                </Link>
            </div>

            <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4">Vehicle</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Stats</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                                    </td>
                                </tr>
                            ) : listings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic">
                                        No listings found. Start selling today!
                                    </td>
                                </tr>
                            ) : (
                                listings.map((listing) => (
                                    <tr key={listing.id} className="hover:bg-white/[0.03] transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-12 h-9 rounded overflow-hidden border border-white/10 shrink-0">
                                                    {listing.images?.[0] ? (
                                                        <Image src={listing.images[0]} alt="" fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Car size={14} className="text-gray-600" /></div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-sm truncate uppercase">{listing.title}</p>
                                                        {listing.isFeatured && <Zap size={12} className="text-amber-400 fill-amber-400" />}
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{listing.year} • {listing.mileage?.toLocaleString()} miles</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                listing.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                listing.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                listing.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                'bg-slate-700/50 text-gray-400 border-white/5'
                                            }`}>
                                                {listing.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-black text-sm">{formatPrice(listing.price)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                                <span className="flex items-center gap-1"><Eye size={12} /> {listing.viewCount || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2 items-center">
                                                {listing.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handlePublish(listing)}
                                                        disabled={publishing === listing.id}
                                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-full bg-emerald-500 text-white hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] disabled:opacity-60"
                                                    >
                                                        {publishing === listing.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                        Publish
                                                    </button>
                                                )}
                                                {listing.status === 'ACTIVE' && !listing.isFeatured && listing.viewCount > 20 && (
                                                    <Button
                                                        size="sm"
                                                        className="h-8 px-3 text-[10px] bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black"
                                                        onClick={() => handleBoost(listing.id)}
                                                        disabled={boosting === listing.id}
                                                    >
                                                        {boosting === listing.id ? <Loader2 size={12} className="animate-spin" /> : 'BOOST'}
                                                    </Button>
                                                )}
                                                <div className="relative group">
                                                    <button className="p-2 text-gray-400 hover:text-white transition-colors">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-2">
                                                        {listing.status === 'DRAFT' && (
                                                            <button
                                                                onClick={() => handlePublish(listing)}
                                                                disabled={publishing === listing.id}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-emerald-500/10 text-emerald-400 w-full text-left font-bold"
                                                            >
                                                                <Upload size={14} /> Publish Listing
                                                            </button>
                                                        )}
                                                        <Link href={`/dashboard/seller/add-listing?editId=${listing.id}`} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5">
                                                            <Pencil size={14} /> Edit
                                                        </Link>
                                                        {listing.status === 'ACTIVE' && (
                                                            <Link href={`${auctionDashPath}?listingId=${listing.id}`} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-500/10 text-orange-400 w-full">
                                                                <Gavel size={14} /> Put to Auction
                                                            </Link>
                                                        )}
                                                        {listing.status !== 'SOLD' && (
                                                            <button 
                                                                onClick={() => setSaleListing(listing)}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-emerald-500/10 text-emerald-400 w-full text-left"
                                                            >
                                                                <CheckCircle2 size={14} /> Mark Sold
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDelete(listing.id)}
                                                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-red-500/10 text-red-400 w-full text-left"
                                                            disabled={deleting === listing.id}
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Page {page} of {totalPages}</p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>Prev</Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>Next</Button>
                        </div>
                    </div>
                )}
            </div>

            {saleListing && (
                <RecordSaleModal 
                    listing={saleListing} 
                    onClose={() => setSaleListing(null)} 
                    onSuccess={() => {
                        fetchListings()
                        onRefreshStats()
                    }} 
                />
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFERS TAB (Incoming)
// ─────────────────────────────────────────────────────────────────────────────

function OffersTab({ onRefreshStats }: { onRefreshStats: () => void }) {
    const [listings, setListings] = React.useState<Listing[]>([])
    const [offersMap, setOffersMap] = React.useState<Record<string, Offer[]>>({})
    const [loading, setLoading] = React.useState(true)
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
    const [responding, setResponding] = React.useState<string | null>(null)
    const [countering, setCountering] = React.useState<{id: string, amount: string} | null>(null)
    const [saleContext, setSaleContext] = React.useState<{ listing: Listing; offer: Offer } | null>(null)
    const router = useRouter()
    const { refreshRooms } = useChat()

    const fetchOffers = async () => {
        try {
            setLoading(true)
            const res = await getMyListings({ limit: 50, includeSold: true })
            const activeListings = res.data
            setListings(activeListings)
            
            const results = await Promise.allSettled(
                activeListings.map(async (l) => {
                    const data = await getOffersForListing(l.id)
                    return { id: l.id, data }
                })
            )
            
            const map: Record<string, Offer[]> = {}
            results.forEach(r => {
                if (r.status === 'fulfilled') map[r.value.id] = r.value.data
            })
            setOffersMap(map)
        } catch (err) {
            console.error('Failed to fetch offers:', err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchOffers()
    }, [])

    const toggleExpand = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleRespond = async (offerId: string, listingId: string, status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', amount?: number) => {
        try {
            setResponding(offerId)
            await respondToOffer(offerId, status, amount)
            const updated = await getOffersForListing(listingId)
            setOffersMap(prev => ({ ...prev, [listingId]: updated }))
            onRefreshStats()
        } catch (err: any) {
            alert('Failed: ' + err.message)
        } finally {
            setResponding(null)
        }
    }

    const handleMessage = async (buyerId: string, listingId: string) => {
        try {
            const room = await createChatRoom(buyerId, listingId)
            await refreshRooms()
            router.push(`/dashboard/user?tab=messages&room=${room.id}`)
        } catch (err: any) {
            alert('Chat failed: ' + err.message)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {saleContext && (
                <RecordSaleModal
                    listing={saleContext.listing}
                    offer={saleContext.offer}
                    onClose={() => setSaleContext(null)}
                    onSuccess={() => {
                        setSaleContext(null)
                        fetchOffers()
                        onRefreshStats()
                    }}
                />
            )}
            <h2 className="text-2xl font-black font-heading uppercase tracking-tight">Incoming Offers</h2>
            
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>
            ) : listings.length === 0 ? (
                <div className="text-center py-20 text-gray-500 italic">No listings to receive offers for.</div>
            ) : (
                <div className="space-y-4">
                    {listings.map(listing => {
                        const listingOffers = offersMap[listing.id] || []
                        const pending = listingOffers.filter(o => o.status === 'PENDING').length
                        const isExpanded = expanded.has(listing.id)
                        
                        return (
                            <div key={listing.id} className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                                <button 
                                    onClick={() => toggleExpand(listing.id)}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-all text-left"
                                >
                                    <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                        <Image src={listing.images?.[0] || ""} alt="" fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white truncate uppercase">{listing.title}</p>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{listingOffers.length} TOTAL OFFERS</p>
                                    </div>
                                    {pending > 0 && <span className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full">{pending} PENDING</span>}
                                    <ChevronRight className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} size={20} />
                                </button>

                                {isExpanded && (
                                    <div className="p-4 bg-black/20 space-y-3 border-t border-white/5">
                                        {listingOffers.length === 0 ? (
                                            <p className="text-center py-6 text-xs text-gray-600 italic">No offers on this vehicle yet.</p>
                                        ) : (
                                            listingOffers.map(offer => (
                                                <div key={offer.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-black">{offer.buyer?.firstName?.[0] || '?'}</div>
                                                        <div>
                                                            <p className="font-bold text-sm text-white uppercase">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                            <p className="text-lg font-black text-primary font-mono">{formatPrice(offer.amount)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {offer.status === 'PENDING' ? (
                                                            <>
                                                                <Button size="sm" variant="outline" className="h-9 border-red-500/30 text-red-400" onClick={() => handleRespond(offer.id, listing.id, 'REJECTED')} disabled={!!responding}>Decline</Button>
                                                                <Button size="sm" variant="outline" className="h-9 border-blue-500/30 text-blue-400" onClick={() => setCountering({ id: offer.id, amount: '' })} disabled={!!responding}>Counter</Button>
                                                                <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-500" onClick={() => handleRespond(offer.id, listing.id, 'ACCEPTED')} disabled={!!responding}>Accept</Button>
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{offer.status}</span>
                                                                {offer.status === 'ACCEPTED' && (
                                                                    <>
                                                                        <Button size="sm" variant="ghost" className="h-8 text-blue-400" onClick={() => handleMessage(offer.buyerId, listing.id)}>Message</Button>
                                                                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => setSaleContext({ listing, offer })}>Mark as Sold</Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {countering?.id === offer.id && (
                                                        <div className="w-full mt-4 flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-blue-500/30 animate-in zoom-in-95 duration-200">
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">£</span>
                                                                <Input 
                                                                    placeholder="Enter counter amount..." 
                                                                    className="pl-8 bg-transparent border-white/10 h-10"
                                                                    value={countering.amount}
                                                                    onChange={(e) => setCountering({ ...countering, amount: e.target.value })}
                                                                    type="number"
                                                                />
                                                            </div>
                                                            <Button 
                                                                size="sm" 
                                                                className="h-10 bg-blue-600 hover:bg-blue-500"
                                                                onClick={() => {
                                                                    handleRespond(offer.id, listing.id, 'COUNTERED', parseFloat(countering.amount))
                                                                    setCountering(null)
                                                                }}
                                                                disabled={!countering.amount || !!responding}
                                                            >
                                                                Send Counter
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-10 text-gray-400" onClick={() => setCountering(null)}>Cancel</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// BIDS TAB (Outgoing)
// ─────────────────────────────────────────────────────────────────────────────

function outgoingOfferStatusClass(status: Offer['status']) {
    switch (status) {
        case 'ACCEPTED': return 'text-emerald-400'
        case 'PENDING': return 'text-amber-400'
        case 'COUNTERED': return 'text-blue-400'
        case 'REJECTED': return 'text-red-400'
        case 'WITHDRAWN': return 'text-gray-500'
        default: return 'text-gray-500'
    }
}

function OutgoingOffersTab({ onRefreshStats }: { onRefreshStats: () => void }) {
    const [offers, setOffers] = React.useState<Offer[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actioning, setActioning] = React.useState<string | null>(null)
    const [accepting, setAccepting] = React.useState<string | null>(null)
    const [declining, setDeclining] = React.useState<string | null>(null)
    const [startingChat, setStartingChat] = React.useState<string | null>(null)
    const router = useRouter()
    const { refreshRooms } = useChat()

    const fetchData = async () => {
        try {
            setLoading(true)
            const o = await getMyOffers()
            setOffers(o)
        } catch (err) {
            console.error('Failed to fetch outgoing activity:', err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchData()
    }, [])

    const handleWithdraw = async (id: string) => {
        if (!confirm('Withdraw this offer?')) return
        try {
            setActioning(id)
            await withdrawOffer(id)
            await fetchData()
            onRefreshStats()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setActioning(null)
        }
    }

    const handleAcceptCounter = async (offerId: string) => {
        if (!confirm("Accept the seller's counter offer? You can then message the seller to finalize the purchase.")) return
        try {
            setAccepting(offerId)
            await respondToCounterOffer(offerId, 'ACCEPTED')
            await fetchData()
            onRefreshStats()
        } catch (err: any) {
            alert(err.message || 'Failed to accept counter offer.')
        } finally {
            setAccepting(null)
        }
    }

    const handleDeclineCounter = async (offerId: string) => {
        if (!confirm('Decline this counter offer?')) return
        try {
            setDeclining(offerId)
            await respondToCounterOffer(offerId, 'REJECTED')
            await fetchData()
            onRefreshStats()
        } catch (err: any) {
            alert(err.message || 'Failed to decline counter offer.')
        } finally {
            setDeclining(null)
        }
    }

    const handleMessageSeller = async (sellerId: string | undefined, listingId: string | undefined) => {
        if (!sellerId || !listingId) {
            alert('Seller or listing information is unavailable.')
            return
        }
        try {
            setStartingChat(listingId)
            const room = await createChatRoom(sellerId, listingId)
            await refreshRooms()
            router.push(`/dashboard/user?tab=messages&room=${room.id}`)
            onRefreshStats()
        } catch (err: any) {
            alert(err.message || 'Failed to open messages.')
        } finally {
            setStartingChat(null)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black font-heading uppercase tracking-tight">My Offers</h2>
            
            {/* Active Offers Section */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Tag size={14} /> Outgoing Offers
                </h3>
                <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800/50 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Vehicle</th>
                                    <th className="px-6 py-4">My Offer</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-6 py-10 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                                ) : offers.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-600 italic">No outgoing offers.</td></tr>
                                ) : (
                                    offers.map(offer => {
                                        const thumb = offer.listing?.images?.[0] || '/assets/images/featured-sports.png'
                                        return (
                                        <tr key={offer.id} className="hover:bg-white/[0.02]">
                                            <td className="px-6 py-4">
                                                <Link href={`/vehicle/${offer.listing?.slug}`} className="flex items-center gap-3 group">
                                                    <div className="relative w-10 h-8 rounded border border-white/10 overflow-hidden shrink-0">
                                                        <Image src={thumb} alt="" fill className="object-cover" />
                                                    </div>
                                                    <span className="font-bold text-sm uppercase group-hover:text-primary transition-colors">{offer.listing?.title}</span>
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-black font-mono text-white">{formatPrice(offer.amount)}</div>
                                                {offer.status === 'COUNTERED' && offer.counterAmount != null && (
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mt-1">
                                                        Seller counter: {formatPrice(offer.counterAmount)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${outgoingOfferStatusClass(offer.status)}`}>
                                                    {offer.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    {offer.status === 'COUNTERED' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 text-emerald-400 text-[10px] font-black"
                                                                onClick={() => handleAcceptCounter(offer.id)}
                                                                disabled={accepting === offer.id || declining === offer.id}
                                                            >
                                                                {accepting === offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ACCEPT COUNTER'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 text-red-400 text-[10px] font-black"
                                                                onClick={() => handleDeclineCounter(offer.id)}
                                                                disabled={accepting === offer.id || declining === offer.id}
                                                            >
                                                                {declining === offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'DECLINE'}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 text-blue-400 text-[10px] font-black"
                                                                onClick={() => handleMessageSeller(offer.listing?.sellerId, offer.listing?.id)}
                                                                disabled={startingChat === offer.listing?.id}
                                                            >
                                                                {startingChat === offer.listing?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'MESSAGE'}
                                                            </Button>
                                                        </>
                                                    )}
                                                    {offer.status === 'PENDING' && (
                                                        <Button size="sm" variant="ghost" className="h-8 text-red-400 text-[10px] font-black" onClick={() => handleWithdraw(offer.id)} disabled={actioning === offer.id}>WITHDRAW</Button>
                                                    )}
                                                    {offer.status === 'ACCEPTED' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-blue-400 text-[10px] font-black"
                                                            onClick={() => handleMessageSeller(offer.listing?.sellerId, offer.listing?.id)}
                                                            disabled={startingChat === offer.listing?.id}
                                                        >
                                                            {startingChat === offer.listing?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'MESSAGE'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS TAB (Performance)
// ─────────────────────────────────────────────────────────────────────────────

function StatsTab() {
    const [performance, setPerformance] = React.useState<PerformanceStats | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        getSellerPerformance().then(setPerformance).finally(() => setLoading(false))
    }, [])

    const maxViews = Math.max(...(performance?.recentListingViews?.map(l => l.views) || [1]), 1)

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-black font-heading uppercase tracking-tight">Performance Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Conversion Rate" value={`${performance?.conversionRate || 0}%`} icon={Target} color="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20" loading={loading} />
                <MetricCard label="Active Listings" value={performance?.totalListings || 0} icon={Car} color="text-primary" bg="bg-primary/10" border="border-primary/20" loading={loading} />
                <MetricCard
                    label="Avg Response Time"
                    value={performance?.avgResponseHours != null
                        ? performance.avgResponseHours < 1
                            ? `${Math.round(performance.avgResponseHours * 60)}m`
                            : `${performance.avgResponseHours}h`
                        : '—'}
                    icon={Clock} color="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20" loading={loading}
                />
                <MetricCard
                    label={`Seller Rating${performance?.totalReviews ? ` (${performance.totalReviews})` : ''}`}
                    value={performance?.sellerRating != null
                        ? `${performance.sellerRating}/5`
                        : performance?.totalReviews === 0 ? 'No reviews' : '—'}
                    icon={ShieldCheck} color="text-emerald-400" bg="bg-emerald-500/10" border="border-emerald-500/20" loading={loading}
                />
            </div>

            <div className="glass-card p-8 border border-white/5 bg-white/5 rounded-2xl">
                <h3 className="text-lg font-black font-heading uppercase tracking-tight mb-8">Top Performing Vehicles</h3>
                {!performance?.recentListingViews?.length ? (
                    <div className="text-center py-10 text-gray-600 italic">No listing data available.</div>
                ) : (
                    <div className="space-y-6">
                        {performance.recentListingViews.map(l => (
                            <div key={l.id} className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-gray-400">{l.title}</span>
                                    <span className="text-white">{l.views} VIEWS</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary rounded-full shadow-neon transition-all duration-1000" 
                                        style={{ width: `${(l.views / maxViews) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES TAB
// ─────────────────────────────────────────────────────────────────────────────

function MessagesTab({ rooms, refreshRooms }: { rooms: ChatRoom[], refreshRooms: () => void }) {
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)
    const searchParams = useSearchParams()
    const targetRoomId = searchParams.get("room")

    React.useEffect(() => {
        if (!targetRoomId) return
        void refreshRooms()
    }, [targetRoomId, refreshRooms])

    React.useEffect(() => {
        if (!targetRoomId) return
        const match = rooms.find(r => r.id === targetRoomId)
        if (match) setSelectedRoom(match)
    }, [rooms, targetRoomId])

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full min-w-0">
            <div className="glass-card overflow-hidden w-full min-w-0 min-h-0 h-[min(900px,calc(100vh-200px))] min-h-[440px] flex flex-col border border-white/5 bg-white/5 rounded-2xl">
                <div className="shrink-0 px-5 py-4 md:px-6 md:py-5 border-b border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <MessageSquare className="text-primary shrink-0" size={22} />
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-xl font-bold font-heading text-white tracking-tight">Messages</h2>
                            <p className="text-[11px] text-gray-500 font-medium truncate">Conversations with buyers and sellers</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={refreshRooms}
                        className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Refresh conversations"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="flex flex-1 flex-row min-h-0 min-w-0">
                    {/* Room list — fixed width on desktop, full width on mobile when visible */}
                    <div
                        className={`flex shrink-0 flex-col min-h-0 min-w-0 w-full max-w-full border-r border-white/10 bg-slate-900/20 lg:w-80 lg:max-w-[20rem] lg:shrink-0 ${
                            selectedRoom ? "hidden lg:flex" : "flex"
                        }`}
                    >
                        <ChatRoomList onSelectRoom={setSelectedRoom} selectedRoomId={selectedRoom?.id} />
                    </div>

                    {/* Chat pane — grows to fill remaining main column */}
                    <div
                        className={`flex min-h-0 min-w-0 flex-1 flex-col bg-slate-900/30 ${
                            !selectedRoom ? "hidden w-full lg:flex lg:items-center lg:justify-center" : "flex w-full"
                        }`}
                    >
                        {selectedRoom ? (
                            <ChatWindow room={selectedRoom} onBack={() => setSelectedRoom(null)} />
                        ) : (
                            <div className="flex max-w-md flex-col items-center justify-center px-6 text-center">
                                <MessageSquare className="mb-4 h-16 w-16 text-gray-600 opacity-40" />
                                <p className="text-base font-semibold text-gray-400">Select a conversation</p>
                                <p className="mt-1 text-sm text-gray-500">Choose a thread from the list to read and reply</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// EARNINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

function EarningsTab() {
    const [data, setData] = React.useState<EarningsResponse | null>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        getEarnings().then(setData).finally(() => setLoading(false))
    }, [])

    const totalRevenue = Number(data?.totalRevenue || 0)
    const totalSales = Number(data?.totalSales || 0)
    const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black font-heading uppercase tracking-tight">Earnings History</h2>
                    <p className="text-gray-400 text-sm font-medium">Detailed tracking of your sold assets and revenue.</p>
                </div>
                <Button className="flex items-center gap-2 h-10 shadow-neon-small" variant="outline" size="sm">
                    <Download size={18} /> Export Ledger
                </Button>
            </div>

            {/* KPI summary — Total Earnings stays in sync with /listings/earnings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-5 border border-white/5 bg-white/5 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Total Earnings</p>
                    <p className="text-3xl font-black text-white tabular-nums">
                        {loading ? "—" : formatPrice(totalRevenue)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                        Sourced from finalized sales
                    </p>
                </div>
                <div className="glass-card p-5 border border-white/5 bg-white/5 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Vehicles Sold</p>
                    <p className="text-3xl font-black text-white tabular-nums">
                        {loading ? "—" : totalSales}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                        Lifetime
                    </p>
                </div>
                <div className="glass-card p-5 border border-white/5 bg-white/5 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Avg. Sale Price</p>
                    <p className="text-3xl font-black text-white tabular-nums">
                        {loading ? "—" : formatPrice(avgSale)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                        Mean across all sales
                    </p>
                </div>
            </div>

            <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/80 text-gray-400 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                            <tr>
                                <th className="px-6 py-5">Vehicle</th>
                                <th className="px-6 py-5">Buyer</th>
                                <th className="px-6 py-5 text-right">Sold Price</th>
                                <th className="px-6 py-5 text-center">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td></tr>
                            ) : !data || data.sales.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-500 italic">
                                        No sales records found.
                                    </td>
                                </tr>
                            ) : (
                                data.sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-white/[0.03] transition-all">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                                                    {sale.listing.images?.[0] ? (
                                                        <Image src={sale.listing.images[0]} alt="" fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center"><Car size={14} className="text-gray-600" /></div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-white truncate uppercase">{sale.listing.title}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{sale.listing.vrm || "N/A"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-sm font-bold text-gray-200 uppercase truncate">
                                                {sale.buyer
                                                    ? `${sale.buyer.firstName} ${sale.buyer.lastName || ""}`.trim()
                                                    : (sale as any).buyerName || "Direct Buyer"}
                                            </p>
                                            <p className="text-[10px] text-gray-500 truncate">
                                                {sale.buyer?.email || (sale as any).buyerEmail || ""}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-emerald-400 text-sm">
                                            {formatPrice(sale.soldPrice)}
                                        </td>
                                        <td className="px-6 py-5 text-center text-xs text-gray-500 font-bold">
                                            {new Date(sale.createdAt).toLocaleDateString('en-GB')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

function SettingsTab({ profile }: { profile: any }) {
    const [oldPassword, setOldPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [status, setStatus] = React.useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' })
    const [connectStatus, setConnectStatus] = React.useState<StripeConnectStatus | null>(null)
    const [connectLoading, setConnectLoading] = React.useState(false)
    const [connectError, setConnectError] = React.useState("")

    React.useEffect(() => {
        getStripeConnectStatus().then(setConnectStatus).catch(() => {})
    }, [])

    React.useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        if (params.get('stripe_connect')) {
            getStripeConnectStatus().then(setConnectStatus).catch(() => {})
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleConnectStripe = async () => {
        setConnectLoading(true)
        setConnectError("")
        try {
            const origin = window.location.origin
            const { url } = await startStripeConnectOnboarding(
                `${origin}/dashboard?tab=settings&stripe_connect=return`,
                `${origin}/dashboard?tab=settings&stripe_connect=refresh`,
            )
            window.location.href = url
        } catch (err: any) {
            setConnectError(err.message || "Failed to start Stripe Connect onboarding.")
        } finally {
            setConnectLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            setStatus({ type: 'error', message: "New passwords don't match" })
            return
        }

        try {
            setStatus({ type: 'loading' })
            await resetPassword(oldPassword, newPassword)
            setStatus({ type: 'success', message: 'Password updated successfully!' })
            setOldPassword("")
            setNewPassword("")
            setConfirmPassword("")
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Failed to update password' })
        }
    }

    return (
        <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-8 border border-white/5 bg-white/5 rounded-2xl">
                <h3 className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-6">
                    <UserIcon className="text-primary" size={24} /> Profile Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Mail size={12} /> Email Address
                        </p>
                        <p className="text-sm font-black text-white">{profile?.email}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Phone size={12} /> Phone Number
                        </p>
                        <p className="text-sm font-black text-white">{profile?.phone || "Not set"}</p>
                    </div>
                </div>
            </div>

            <div className="glass-card p-8 border border-white/5 bg-white/5 rounded-2xl shadow-neon-small">
                <h3 className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-6">
                    <Lock className="text-primary" size={24} /> Security & Password
                </h3>
                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Password</label>
                        <Input 
                            type="password" 
                            placeholder="••••••••" 
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                            className="bg-white/5 border-white/10 focus:border-primary text-white h-12" 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Password</label>
                            <Input 
                                type="password" 
                                placeholder="Min. 8 characters" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 focus:border-primary text-white h-12" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Confirm New Password</label>
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="bg-white/5 border-white/10 focus:border-primary text-white h-12" 
                            />
                        </div>
                    </div>

                    {status.message && (
                        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${
                            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            {status.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                            {status.message}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full md:w-auto px-10 h-12 shadow-neon font-black uppercase tracking-widest text-xs"
                        disabled={status.type === 'loading'}
                    >
                        {status.type === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Update Password'}
                    </Button>
                </form>
            </div>

            {/* Payouts */}
            <div className="glass-card p-8 border border-white/5 bg-white/5 rounded-2xl">
                <h3 className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-2">
                    <CreditCard className="text-primary" size={24} /> Payouts
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                    Connect a bank account to receive your £100 seller bonus after a successful auction handover is verified.
                </p>

                {connectStatus?.onboardingComplete ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <BadgeCheck size={20} className="text-emerald-400 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-emerald-300">Bank account connected</p>
                            <p className="text-xs text-gray-400 mt-0.5">Payouts are enabled. Your bonuses will transfer automatically after handover approval.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {connectStatus?.connected && !connectStatus?.onboardingComplete && (
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300">Your Stripe account was created but onboarding is incomplete. Click below to finish.</p>
                            </div>
                        )}
                        {connectError && (
                            <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={13} /> {connectError}</p>
                        )}
                        <Button
                            onClick={handleConnectStripe}
                            disabled={connectLoading}
                            className="gap-2 shadow-neon"
                        >
                            {connectLoading
                                ? <><Loader2 size={16} className="animate-spin" /> Redirecting...</>
                                : <><ExternalLink size={16} /> Connect Bank Account</>
                            }
                        </Button>
                        <p className="text-xs text-gray-500">You will be taken to Stripe's secure onboarding — this takes about 2 minutes.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
