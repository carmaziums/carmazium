"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Tag, DollarSign, CheckCircle, XCircle, MessageSquare,
    Loader2, Clock, ArrowUpDown
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

const STATUS_BADGES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ACCEPTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
    COUNTERED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    EXPIRED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
}

export default function DealerOffersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [offers, setOffers] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        if (!authLoading && user) {
            setOffers([])
            setLoading(false)
        }
    }, [user, authLoading])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <div>
                        <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Offers</h1>
                        <p className="text-gray-400 text-sm">Review and respond to buyer offers on your vehicles</p>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Pending", value: offers.filter(o => o.status === "PENDING").length, icon: Clock, color: "text-amber-400" },
                            { label: "Accepted", value: offers.filter(o => o.status === "ACCEPTED").length, icon: CheckCircle, color: "text-emerald-400" },
                            { label: "Countered", value: offers.filter(o => o.status === "COUNTERED").length, icon: ArrowUpDown, color: "text-blue-400" },
                            { label: "Rejected", value: offers.filter(o => o.status === "REJECTED").length, icon: XCircle, color: "text-red-400" },
                        ].map(stat => (
                            <div key={stat.label} className="bg-white/5 border border-white/5 rounded-2xl p-5">
                                <stat.icon size={18} className={`${stat.color} mb-2`} />
                                <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">{stat.label}</p>
                                <p className="text-2xl font-black text-white">{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Offers Table */}
                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Buyer</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-right">Offer Amount</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
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
                                            <tr key={offer.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-white text-sm">{offer.buyer?.firstName} {offer.buyer?.lastName}</p>
                                                    <p className="text-xs text-gray-500">{offer.buyer?.email}</p>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-300">{offer.listing?.title}</td>
                                                <td className="px-6 py-4 text-right font-bold text-white">£{offer.amount?.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${STATUS_BADGES[offer.status] || STATUS_BADGES.PENDING}`}>
                                                        {offer.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 text-xs">Accept</Button>
                                                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs">Counter</Button>
                                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 text-xs">Reject</Button>
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
