"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { PlusCircle, Loader2, Eye, TrendingUp, Car, DollarSign, X, ShoppingBag, Gavel } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { PeriodToggle } from "@/components/dashboard/PeriodToggle"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { getMyListings, formatPrice, type SellerStats, type Listing } from "@/lib/listingApi"
import { getNotifications, markNotificationRead, type AppNotification } from "@/lib/notificationsApi"

export default function SellerDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const period = (searchParams.get('period') as '7d' | '30d') ?? '30d'

    function setPeriod(p: '7d' | '30d') {
        const params = new URLSearchParams(searchParams.toString())
        params.set('period', p)
        router.replace(`${pathname}?${params.toString()}`)
    }

    const subLabel = period === '7d' ? 'Last 7 days' : 'Last 30 days'

    const [stats, setStats] = React.useState<SellerStats | null>(null)
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [unsoldAuctionNotice, setUnsoldAuctionNotice] = React.useState<AppNotification | null>(null)

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return

            try {
                setLoading(true)
                const [statsData, listingsData, recentNotifications] = await Promise.all([
                    apiClient<{ data: SellerStats }>(`/dashboard/seller?period=${period}`).then(r => r.data).catch(() => null),
                    getMyListings({ limit: 5 }),
                    getNotifications(20),
                ])
                setStats(statsData)
                setListings(listingsData.data || [])
                setUnsoldAuctionNotice(
                    recentNotifications.find(
                        notification => notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead,
                    ) ?? null,
                )
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
    }, [user, authLoading, period])

    React.useEffect(() => {
        if (!user) return

        const refreshUnsoldNotice = () => {
            getNotifications(20)
                .then((recentNotifications) => {
                    setUnsoldAuctionNotice(
                        recentNotifications.find(
                            notification => notification.type === 'AUCTION_ENDED_NO_SALE' && !notification.isRead,
                        ) ?? null,
                    )
                })
                .catch(() => {})
        }

        const intervalId = window.setInterval(refreshUnsoldNotice, 30_000)
        return () => window.clearInterval(intervalId)
    }, [user])

    async function dismissUnsoldAuctionNotice() {
        const notice = unsoldAuctionNotice
        setUnsoldAuctionNotice(null)
        if (notice) {
            await markNotificationRead(notice.id).catch(() => {})
        }
    }

    function openRetailFromNotice() {
        const notice = unsoldAuctionNotice
        if (!notice) return

        const retailUrl =
            typeof notice.data?.retailUrl === 'string'
                ? notice.data.retailUrl
                : '/dashboard/seller/auctions'

        setUnsoldAuctionNotice(null)
        markNotificationRead(notice.id).catch(() => {})
        router.push(retailUrl)
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="seller" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Seller Account"}>
                    <Link href="/sell">
                        <Button className="w-full flex items-center gap-2 shadow-neon h-12" shape="default"><PlusCircle size={18} /> Create New Listing</Button>
                    </Link>
                </DashboardSidebar>

                <main className="flex-1 space-y-8 min-w-0">
                    {/* Period Toggle Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-2xl font-black font-heading uppercase tracking-tighter">Overview</h2>
                        <PeriodToggle value={period} onChange={setPeriod} />
                    </div>

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
                            subLabel="Current"
                        />
                        <MetricCard
                            label="Total Views"
                            value={stats?.totalViews?.toLocaleString() || 0}
                            icon={Eye}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            loading={loading}
                            subLabel={subLabel}
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
                            subLabel={subLabel}
                        />
                        <MetricCard
                            label="Revenue"
                            value={formatPrice(stats?.totalRevenue || 0)}
                            icon={DollarSign}
                            color="text-yellow-400"
                            bg="bg-yellow-500/10"
                            border="border-yellow-500/20"
                            loading={loading}
                            subLabel={subLabel}
                        />
                    </div>

                    {/* Active Listings Table */}
                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                        <div className="p-6 border-b border-[var(--border-default)] flex justify-between items-center bg-[var(--bg-card)]">
                            <h2 className="text-xl font-black font-heading text-[var(--text-primary)] uppercase tracking-tight">Your Inventory</h2>
                            <Link href="/dashboard/seller/listings" className="text-primary hover:text-primary dark:hover:text-white text-sm font-black transition-colors uppercase">Manage All</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4 text-center">Views</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)] text-[var(--text-secondary)]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : listings.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)] italic">
                                                No listings found. <Link href="/sell" className="text-primary hover:underline">Create your first listing!</Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        listings.map((listing) => (
                                            <tr key={listing.id} className="hover:bg-[var(--bg-card)] transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {listing.images?.[0] && (
                                                            <Image src={listing.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                                                        )}
                                                        <div>
                                                            <p className="font-bold">{listing.title}</p>
                                                            <p className="text-xs text-[var(--text-muted)]">{listing.year} • {listing.mileage?.toLocaleString() || 0} miles</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${listing.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        listing.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                            listing.status === 'PENDING_REVIEW' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                                listing.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                                    'bg-gray-500/10 text-[var(--text-muted)] border border-gray-500/20'
                                                        }`}>
                                                        {listing.status === 'PENDING_REVIEW' ? 'Under Review' : listing.status === 'REJECTED' ? 'Rejected' : listing.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold">{formatPrice(listing.price)}</td>
                                                <td className="px-6 py-4 text-center text-[var(--text-muted)]">{listing.viewCount || 0}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/buy-cars/${listing.slug}`} className="text-primary hover:text-primary dark:hover:text-white text-xs font-bold transition-colors">
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
            {unsoldAuctionNotice && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="unsold-auction-title"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) dismissUnsoldAuctionNotice()
                    }}
                >
                    <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] p-6">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                                    <Gavel size={20} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Auction update</p>
                                    <h2 id="unsold-auction-title" className="mt-1 text-xl font-black">
                                        Give your vehicle a wider audience
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismissUnsoldAuctionNotice}
                                className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
                                aria-label="Close"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="space-y-5 p-6">
                            <p className="text-sm leading-7 text-[var(--text-secondary)]">
                                {unsoldAuctionNotice.message}
                            </p>

                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="flex items-start gap-3">
                                    <ShoppingBag size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                                    <div>
                                        <p className="text-sm font-black text-[var(--text-primary)]">
                                            {unsoldAuctionNotice.data?.retailAlreadyLive
                                                ? 'Your Retail Listing is already working for you'
                                                : 'Retail Listing — £1 until sold'}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                                            {unsoldAuctionNotice.data?.retailAlreadyLive
                                                ? 'Keep the vehicle visible to the wider retail audience and manage the listing from your dashboard.'
                                                : 'Reuse the vehicle details you already entered and move the car into the wider retail marketplace.'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" onClick={dismissUnsoldAuctionNotice}>
                                    Not now
                                </Button>
                                <Button type="button" className="gap-2" onClick={openRetailFromNotice}>
                                    <ShoppingBag size={16} />
                                    {unsoldAuctionNotice.data?.retailAlreadyLive
                                        ? 'Manage Retail Listing'
                                        : 'List in Retail for £1'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
