"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getSellerStats, getMyListings, formatPrice, type SellerStats, type Listing } from "@/lib/listingApi"
import { Loader2, DollarSign, TrendingUp, AlertCircle, Car } from "lucide-react"
import { MetricCard } from "@/components/dashboard/MetricCard"

export default function SellerEarningsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [stats, setStats] = React.useState<SellerStats | null>(null)
    const [soldItems, setSoldItems] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!user || authLoading) return
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)
                const [statsData, listingsData] = await Promise.all([
                    getSellerStats(),
                    getMyListings({ limit: 100 }), // Fetch more to find sold items
                ])
                setStats(statsData)
                
                // Extract sold listings
                const sold = (listingsData.data || [])
                    .filter(l => l.status === 'SOLD')
                    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
                
                setSoldItems(sold)
            } catch (err) {
                console.error("Failed to fetch earnings:", err)
                setError("Could not load earnings data")
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        <MetricCard 
                            label="Total Earnings (YTD)" 
                            value={formatPrice(stats?.totalRevenue || 0)} 
                            icon={TrendingUp} 
                            color="text-emerald-400" 
                            bg="bg-emerald-500/10" 
                            border="border-emerald-500/20" 
                            loading={loading} 
                        />
                        <MetricCard 
                            label="Vehicles Sold" 
                            value={soldItems.length} 
                            icon={Car} 
                            color="text-blue-400" 
                            bg="bg-blue-500/10" 
                            border="border-blue-500/20" 
                            loading={loading} 
                        />
                    </div>

                    <div className="glass-card p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Sold Listings</h2>
                        {soldItems.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <DollarSign size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-lg">No sales yet</p>
                                <p className="text-sm mt-1">Cars you mark as sold will appear here</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="border-b border-white/10">
                                        <tr>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Vehicle</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Date Sold</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm">Listed Price</th>
                                            <th className="pb-3 text-gray-400 font-medium text-sm text-right">Estimated Sold Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {soldItems.map(item => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 text-white font-medium">{item.title}</td>
                                                <td className="py-3 text-gray-400 text-sm">{new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</td>
                                                <td className="py-3 text-gray-300 font-medium">{formatPrice(Number(item.price))}</td>
                                                <td className="py-3 text-emerald-400 font-bold text-right">{formatPrice(Number(item.price))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}
