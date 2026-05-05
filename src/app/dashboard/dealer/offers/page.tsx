"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Loader2, Trophy, XCircle, Clock, ArrowUpDown, Tag, Mail
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { MetricCard } from "@/components/dashboard/MetricCard"

export default function DealerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({})

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchOffers()
        }
    }, [user, authLoading])

    async function fetchOffers() {
        setLoading(true)
        try {
            const res = await apiClient<{ data: any[] }>('/offers/received')
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
            // Refresh list
            fetchOffers()
        } catch (err) {
            console.error('Failed to respond to offer:', err)
        } finally {
            setActionLoading(prev => ({ ...prev, [offerId]: false }))
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    // Stats
    const pendingCount = offers.filter(o => o.status === "PENDING").length
    const acceptedCount = offers.filter(o => o.status === "ACCEPTED").length
    const totalOffers = offers.length

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title="Direct Offers"
                        subHeader="Manage offers received from buyers on your listings"
                    />

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <MetricCard
                            label="Pending Offers"
                            value={pendingCount}
                            icon={Clock}
                            color="text-amber-400"
                            bg="bg-amber-500/10"
                            border="border-amber-500/20"
                            statusLabel="Action Required"
                            loading={loading}
                        />
                        <MetricCard
                            label="Accepted"
                            value={acceptedCount}
                            icon={Trophy}
                            color="text-emerald-400"
                            bg="bg-emerald-500/10"
                            border="border-emerald-500/20"
                            statusLabel="Closed"
                            loading={loading}
                        />
                        <MetricCard
                            label="Total Received"
                            value={totalOffers}
                            icon={Tag}
                            color="text-blue-400"
                            bg="bg-blue-500/10"
                            border="border-blue-500/20"
                            loading={loading}
                        />
                    </div>

                    {/* Offers Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : offers.length === 0 ? (
                        <div className="dealer-glass-card p-16 text-center">
                            <Mail className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 font-bold">No offers received yet</p>
                            <p className="text-gray-600 text-sm mt-1">Offers from buyers on your listings will appear here</p>
                        </div>
                    ) : (
                        <div className="dealer-glass-card overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-black/20">
                                <h3 className="text-sm font-black uppercase tracking-widest text-gray-300">Offers Registry</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="vip-table-header text-[10px] uppercase font-black tracking-widest text-gray-400 border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-5">Buyer Identification</th>
                                            <th className="px-6 py-5">Linked Vehicle</th>
                                            <th className="px-6 py-5 text-right">Offer Amount</th>
                                            <th className="px-6 py-5 text-center">Current Status</th>
                                            <th className="px-6 py-5 text-right">Executive Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {offers.map((offer: any) => {
                                            const isActioning = !!actionLoading[offer.id]
                                            const isPending = offer.status === 'PENDING'
                                            
                                            return (
                                                <tr key={offer.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-6">
                                                        <p className="font-black text-white text-sm tracking-tight">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{offer.buyer?.email}</p>
                                                    </td>
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-white group-hover:text-primary transition-colors">{offer.listing?.title}</span>
                                                            <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest mt-0.5">VRM: {offer.listing?.vrm || 'Private'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <span className="text-xl font-black text-white tabular-nums">£{offer.amount?.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-6 text-center">
                                                        <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${
                                                            offer.status === "PENDING" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                            offer.status === "ACCEPTED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            offer.status === "REJECTED" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                        }`}>
                                                            {offer.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isPending ? (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={isActioning}
                                                                        onClick={() => handleRespond(offer.id, 'ACCEPTED')}
                                                                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-[9px] uppercase tracking-widest h-9 px-4 border border-emerald-500/20 rounded-xl transition-all"
                                                                    >
                                                                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'Accept'}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        disabled={isActioning}
                                                                        onClick={() => handleRespond(offer.id, 'REJECTED')}
                                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-[9px] uppercase tracking-widest h-9 px-4 border border-red-500/20 rounded-xl transition-all"
                                                                    >
                                                                        {isActioning ? <Loader2 size={14} className="animate-spin" /> : 'Reject'}
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-600 uppercase tracking-widest font-black italic">
                                                                    Decision Finalized
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
        </div>
    )
}
