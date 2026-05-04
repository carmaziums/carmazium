"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getSellerPerformance, formatPrice, type PerformanceStats } from "@/lib/listingApi"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { Loader2, TrendingUp, Eye, BarChart3, Target, AlertCircle } from "lucide-react"

export default function SellerPerformancePage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [performance, setPerformance] = React.useState<PerformanceStats | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!user || authLoading) return
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await getSellerPerformance()
                setPerformance(data)
            } catch (err) {
                console.error("Failed to fetch performance:", err)
                setError("Could not load performance data")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [user, authLoading])

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const metricCards = [
        { label: "Total Revenue", value: formatPrice(performance?.totalRevenue || 0), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        { label: "Profile Views", value: (performance?.totalViews || 0).toLocaleString(), icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
        { label: "Total Listings", value: (performance?.totalListings || 0).toString(), icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
        { label: "Conversion Rate", value: `${performance?.conversionRate || 0}%`, icon: Target, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    ]

    const maxViews = Math.max(...(performance?.recentListingViews?.map(l => l.views) || [1]), 1)

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" userName={userName} userType="Seller" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Performance</h1>

                    {error && (
                        <div className="glass-card p-4 border border-red-500/30 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {metricCards.map(card => (
                            <MetricCard 
                                key={card.label}
                                label={card.label}
                                value={card.value}
                                icon={card.icon}
                                color={card.color}
                                bg={card.bg}
                                border={card.border}
                                loading={loading}
                            />
                        ))}
                    </div>

                    <div className="glass-card p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Listing Views</h2>
                        {!performance?.recentListingViews?.length ? (
                            <div className="text-center py-12 text-gray-400">
                                <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg">No listing data yet</p>
                                <p className="text-sm mt-1">Create listings to see view analytics here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {performance.recentListingViews.map(listing => (
                                    <div key={listing.id} className="flex items-center gap-4">
                                        <div className="w-40 text-sm text-gray-300 truncate shrink-0" title={listing.title}>
                                            {listing.title}
                                        </div>
                                        <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary/80 to-primary rounded transition-all duration-500"
                                                style={{ width: `${Math.max((listing.views / maxViews) * 100, 2)}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-gray-400 w-16 text-right shrink-0">{listing.views} views</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
