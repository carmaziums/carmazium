"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Tag, CheckCircle, XCircle,
    Loader2, Clock, ArrowUpDown, Activity
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { MetricCard } from "@/components/dashboard/MetricCard"

const STATUS_BADGES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    ACCEPTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20 opacity-60",
    COUNTERED: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    EXPIRED: "bg-gray-500/10 text-gray-400 border-gray-500/20 opacity-40",
}

export default function DealerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
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

    async function handleRespond(offerId: string, status: 'ACCEPTED' | 'REJECTED') {
        setActionLoading(prev => ({ ...prev, [offerId]: true }))
        try {
            await apiClient(`/offers/${offerId}/respond`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            })
            // Optimistic update — reflect new status immediately without a full refetch
            setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status } : o))
        } catch (err) {
            console.error('Failed to respond to offer:', err)
            alert('Action failed. Please try again.')
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    function handleCounter() {
        setCounterToast(true)
        setTimeout(() => setCounterToast(false), 3000)
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title={DEALER_ROUTE_CONFIG[3].title}
                        subHeader={DEALER_ROUTE_CONFIG[3].subHeader}
                    />

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Active Review", short: "Pending", value: offers.filter(o => o.status === "PENDING").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
                            { label: "Closed Deals", short: "Resolved", value: offers.filter(o => o.status === "ACCEPTED").length, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                            { label: "In Counter", short: "Active", value: offers.filter(o => o.status === "COUNTERED").length, icon: ArrowUpDown, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                            { label: "Archived", short: "Closed", value: offers.filter(o => o.status === "REJECTED").length, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
                        ].map(stat => (
                            <MetricCard
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                icon={stat.icon}
                                color={stat.color}
                                bg={stat.bg}
                                border={stat.border}
                                statusLabel={stat.short}
                                loading={loading}
                            />
                        ))}
                    </div>

                    {/* Offers Table */}
                    <div className="dealer-glass-card overflow-hidden">
                        <div className="overflow-x-auto border-t border-white/5">
                            <table className="w-full text-left border-collapse">
                                <thead className="vip-table-header">
                                    <tr>
                                        <th className="px-8 py-5">Elite Buyer Profile</th>
                                        <th className="px-6 py-5">Vehicle Identification</th>
                                        <th className="px-6 py-5 text-right">Offer Valuation</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-right">Review Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : !offers.length ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <Tag className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                                <p className="text-gray-500 font-bold">No offers yet</p>
                                                <p className="text-gray-600 text-sm mt-1">When buyers make offers on your vehicles, they&apos;ll appear here</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        offers.map((offer: any) => {
                                            const isActioning = !!actionLoading[offer.id]
                                            const isPending = offer.status === 'PENDING'
                                            return (
                                                <tr key={offer.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-black/60 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                                                                <Activity size={18} className="text-gray-500 group-hover:text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-white text-sm tracking-tight">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{offer.buyer?.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-primary/50 pl-2 py-0.5">{offer.listing?.title}</span>
                                                            <span className="text-[9px] text-gray-600 font-bold ml-2 mt-1">Ref ID: {offer.id.slice(0, 8)}</span>
                                                            <span className="text-[9px] text-gray-500 ml-2 mt-0.5">
                                                                {new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xl font-black metallic-foil tracking-tighter">£{offer.amount?.toLocaleString()}</span>
                                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest leading-none mt-1">+ Match Range</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-center">
                                                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${STATUS_BADGES[offer.status] || STATUS_BADGES.PENDING}`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {isPending ? (
                                                                <>
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
                                                                        onClick={handleCounter}
                                                                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-blue-500/20 rounded-lg disabled:opacity-40"
                                                                    >
                                                                        Counter
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
                                                            ) : (
                                                                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">
                                                                    {offer.status === 'ACCEPTED' ? '✓ Deal Closed' : offer.status === 'REJECTED' ? '✗ Declined' : '—'}
                                                                </span>
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
