"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Loader2, Gavel, Trophy, XCircle, Clock, ArrowUpDown, Tag
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { VehicleCard } from "@/components/dealer/VehicleCard"
import type { VehicleCardData } from "@/components/dealer/VehicleCard"

type BidTab = "active" | "under_offer" | "didnt_win"

const TABS: { key: BidTab; label: string; icon: React.ElementType }[] = [
    { key: "active", label: "Active", icon: Gavel },
    { key: "under_offer", label: "Under Offer", icon: Clock },
    { key: "didnt_win", label: "Didn't Win", icon: XCircle },
]

// ─── Demo data (replace with real API) ──────────────────────────────────────

const MOCK_VEHICLES: Record<BidTab, VehicleCardData[]> = {
    active: [
        {
            id: "v1",
            title: "2024 Porsche 911 Carrera S",
            subtitle: "3.0L Twin-Turbo • 3,200 mi • PDK",
            currentBid: 112500,
            aiEstimate: 115000,
            bidCount: 14,
            watchers: 38,
            auctionEndsAt: new Date(Date.now() + 2 * 3600000 + 23 * 60000).toISOString(),
            status: "active",
        },
        {
            id: "v2",
            title: "2023 BMW M4 Competition xDrive",
            subtitle: "3.0L I6 • 8,100 mi • Frozen Black",
            currentBid: 68900,
            aiEstimate: 71200,
            bidCount: 22,
            watchers: 55,
            auctionEndsAt: new Date(Date.now() + 45 * 60000).toISOString(),
            status: "active",
        },
        {
            id: "v3",
            title: "2024 Mercedes-AMG C 63 S E",
            subtitle: "2.0L Hybrid • 1,800 mi • Selenite Grey",
            currentBid: 82400,
            aiEstimate: 79000,
            bidCount: 9,
            watchers: 27,
            auctionEndsAt: new Date(Date.now() + 8 * 3600000).toISOString(),
            status: "active",
        },
    ],
    under_offer: [
        {
            id: "v4",
            title: "2023 Audi RS6 Avant",
            subtitle: "4.0L V8 • 12,450 mi • Nardo Grey",
            currentBid: 89000,
            aiEstimate: 92500,
            bidCount: 18,
            watchers: 42,
            status: "under_offer",
        },
        {
            id: "v5",
            title: "2024 Range Rover Sport SVR",
            subtitle: "5.0L V8 Supercharged • 4,300 mi",
            currentBid: 96700,
            aiEstimate: 98000,
            bidCount: 12,
            watchers: 31,
            status: "under_offer",
        },
    ],
    didnt_win: [
        {
            id: "v6",
            title: "2024 Lamborghini Huracán STO",
            subtitle: "5.2L V10 • 850 mi • Verde Mantis",
            currentBid: 215000,
            myMaxBid: 215000,
            aiEstimate: 228000,
            finalSalePrice: 231500,
            bidCount: 31,
            status: "didnt_win",
        },
        {
            id: "v7",
            title: "2023 Ferrari Roma",
            subtitle: "3.9L V8 • 5,200 mi • Rosso Corsa",
            currentBid: 178000,
            myMaxBid: 178000,
            aiEstimate: 185000,
            finalSalePrice: 182400,
            bidCount: 24,
            status: "didnt_win",
        },
    ],
}

export default function DealerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [activeTab, setActiveTab] = React.useState<BidTab>("active")
    const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})
    const [counterToast, setCounterToast] = React.useState(false)

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchOffers()
        }
    }, [user, authLoading])

    async function fetchOffers() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/offers/my')
            setOffers(res?.data ?? [])
        } catch {
            setOffers([])
        } finally {
            setLoading(false)
        }
    }

    async function handleRespond(offerId: string, status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', counterAmount?: number) {
        setActionLoading(prev => ({ ...prev, [offerId]: true }))
        try {
            await apiClient(`/offers/${offerId}/respond`, {
                method: 'PATCH',
                body: JSON.stringify({ status, counterAmount }),
            })
            // Optimistic update
            setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status, counterAmount: counterAmount || o.counterAmount, isCountering: false } : o))
        } catch (err) {
            console.error('Failed to respond to offer:', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    function handlePlaceBid(vehicleId: string, amount: number) {
        console.log("Place bid:", vehicleId, amount)
        // Hook into real-time bidding engine
    }

    function handleSetProxyBid(vehicleId: string, amount: number) {
        console.log("Set proxy bid:", vehicleId, amount)
        // Hook into proxy bid system
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // Get vehicle data for current tab
    const currentVehicles = MOCK_VEHICLES[activeTab]

    // Count stats from combined sources
    const activeCount = MOCK_VEHICLES.active.length
    const underOfferCount = MOCK_VEHICLES.under_offer.length
    const didntWinCount = MOCK_VEHICLES.didnt_win.length
    const pendingOffers = offers.filter(o => o.status === "PENDING").length

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title="Bids & Offers"
                        subHeader="Acquisition management & real-time bidding"
                    />

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Active Bids"
                            value={activeCount}
                            icon={Gavel}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Live"
                            loading={loading}
                        />
                        <MetricCard
                            label="Under Offer"
                            value={underOfferCount}
                            icon={Clock}
                            color="text-amber-400"
                            bg="bg-amber-500/10"
                            border="border-amber-500/20"
                            statusLabel="Pending"
                            loading={loading}
                        />
                        <MetricCard
                            label="Won This Month"
                            value={offers.filter(o => o.status === "ACCEPTED").length || 12}
                            icon={Trophy}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            statusLabel="MTD"
                            loading={loading}
                        />
                        <MetricCard
                            label="Didn't Win"
                            value={didntWinCount}
                            icon={XCircle}
                            color="text-red-400"
                            bg="bg-red-500/10"
                            border="border-red-500/20"
                            loading={loading}
                        />
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 p-1 bg-slate-800/80 border border-white/[0.06] rounded-xl w-fit">
                        {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                                    activeTab === key
                                        ? "bg-gradient-to-r from-primary to-red-700 text-white shadow-lg shadow-primary/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                            >
                                <Icon size={14} />
                                {label}
                                {/* Count Badge */}
                                <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-md text-[9px] font-black tabular-nums ${
                                    activeTab === key
                                        ? "bg-white/20 text-white"
                                        : "bg-white/5 text-gray-500"
                                }`}>
                                    {key === "active" ? activeCount : key === "under_offer" ? underOfferCount : didntWinCount}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Vehicle Cards Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : currentVehicles.length === 0 ? (
                        <div className="dealer-glass-card p-16 text-center">
                            <Tag className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 font-bold">No vehicles in this category</p>
                            <p className="text-gray-600 text-sm mt-1">Vehicles will appear here as you participate in auctions</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {currentVehicles.map((vehicle) => (
                                <VehicleCard
                                    key={vehicle.id}
                                    vehicle={vehicle}
                                    variant={activeTab}
                                    onPlaceBid={handlePlaceBid}
                                    onSetProxyBid={handleSetProxyBid}
                                />
                            ))}
                        </div>
                    )}

                    {/* Traditional Offers Table (from existing data) */}
                    {offers.length > 0 && (
                        <div className="dealer-glass-card overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-black/20">
                                <h3 className="text-sm font-black uppercase tracking-widest text-gray-300">Direct Offers Received</h3>
                                <p className="text-[10px] text-gray-600 mt-0.5 font-medium">Offers from buyers on your listed inventory</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="vip-table-header">
                                        <tr>
                                            <th className="px-6 py-4">Buyer</th>
                                            <th className="px-6 py-4">Vehicle</th>
                                            <th className="px-6 py-4 text-right">Offer</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {offers.map((offer: any) => {
                                            const isActioning = !!actionLoading[offer.id]
                                            const isPending = offer.status === 'PENDING'
                                            return (
                                                <tr key={offer.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-5">
                                                        <p className="font-bold text-white text-sm">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                        <p className="text-[10px] text-gray-600 font-medium">{offer.buyer?.email}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-xs font-bold text-white border-l-2 border-primary/50 pl-2">{offer.listing?.title}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <span className="text-lg font-black metallic-foil tabular-nums">£{offer.amount?.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${
                                                            offer.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                            offer.status === "ACCEPTED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            offer.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                        }`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isPending ? (
                                                                <div className="flex items-center gap-2">
                                                                    {offer.isCountering ? (
                                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                                            <div className="relative">
                                                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-[10px]">£</span>
                                                                                <input
                                                                                    type="number"
                                                                                    autoFocus
                                                                                    className="bg-slate-900 border border-white/10 text-white rounded-lg pl-5 pr-2 py-1.5 w-24 text-[11px] font-bold focus:outline-none focus:border-primary/50 transition-colors"
                                                                                    placeholder="Amount"
                                                                                    value={offer.counterValue || ''}
                                                                                    onChange={e => {
                                                                                        const val = Number(e.target.value)
                                                                                        setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, counterValue: val } : o))
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <Button
                                                                                size="sm"
                                                                                disabled={isActioning || !offer.counterValue}
                                                                                onClick={() => handleRespond(offer.id, 'COUNTERED', offer.counterValue)}
                                                                                className="bg-primary hover:bg-red-600 text-white font-black text-[9px] uppercase tracking-widest h-8 px-3 rounded-lg shadow-neon"
                                                                            >
                                                                                {isActioning ? <Loader2 size={12} className="animate-spin" /> : 'Send'}
                                                                            </Button>
                                                                            <button 
                                                                                onClick={() => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, isCountering: false } : o))}
                                                                                className="text-gray-500 hover:text-white p-1"
                                                                            >
                                                                                <XCircle size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                disabled={isActioning}
                                                                                onClick={() => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, isCountering: true } : o))}
                                                                                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-blue-500/20 rounded-lg"
                                                                            >
                                                                                Counter
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                disabled={isActioning}
                                                                                onClick={() => handleRespond(offer.id, 'ACCEPTED')}
                                                                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-emerald-500/20 rounded-lg disabled:opacity-40"
                                                                            >
                                                                                {isActioning ? <Loader2 size={12} className="animate-spin" /> : 'Accept'}
                                                                            </Button>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                disabled={isActioning}
                                                                                onClick={() => handleRespond(offer.id, 'REJECTED')}
                                                                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-red-500/20 rounded-lg disabled:opacity-40"
                                                                            >
                                                                                {isActioning ? <Loader2 size={12} className="animate-spin" /> : 'Reject'}
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                                                                    {offer.status === 'ACCEPTED' ? '✓ Closed' : offer.status === 'REJECTED' ? '✗ Declined' : offer.status === 'COUNTERED' ? '🔄 Countered' : '—'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Counter Coming Soon Toast */}
            {counterToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-blue-500/20 border border-blue-500/40 text-blue-300 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                    <ArrowUpDown size={16} />
                    <span className="text-sm font-semibold">Counter Offers — Coming Soon</span>
                </div>
            )}
        </div>
    )
}
