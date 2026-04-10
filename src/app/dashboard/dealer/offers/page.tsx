"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Tag, DollarSign, CheckCircle, XCircle, MessageSquare,
    Loader2, Clock, ArrowUpDown, TrendingUp, ShieldCheck, Activity
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
                                                <p className="text-gray-600 text-sm mt-1">When buyers make offers on your vehicles, they'll appear here</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        offers.map((offer: any) => (
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
                                                        <Button variant="ghost" size="sm" className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-emerald-500/20 rounded-lg">Accept</Button>
                                                        <Button variant="ghost" size="sm" className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-blue-500/20 rounded-lg">Counter</Button>
                                                        <Button variant="ghost" size="sm" className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black text-[10px] uppercase tracking-widest h-8 px-4 border border-red-500/20 rounded-lg">Reject</Button>
                                                    </div>
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
