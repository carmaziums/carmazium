"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Car, Search, Filter, PlusCircle, MoreVertical,
    Loader2, Upload, TrendingUp, BarChart3, ShieldCheck
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { BulkImportModal } from "@/components/dealer/BulkImportModal"
import { CheckCircle2 } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DRAFT: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    SOLD: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    IN_PREP: "bg-amber-500/10 text-amber-400 border-amber-500/20",
}

export default function DealerInventoryPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [listings, setListings] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [statusFilter, setStatusFilter] = React.useState("ALL")
    const [isBulkImportOpen, setIsBulkImportOpen] = React.useState(false)

    React.useEffect(() => {
        if (!authLoading && user) {
            fetchListings(searchQuery)
        }
    }, [user, authLoading, searchQuery])

    async function fetchListings(search = "") {
        setLoading(true)
        try {
            const query = new URLSearchParams()
            if (search.trim()) query.set("search", search.trim())
            const suffix = query.toString() ? `?${query.toString()}` : ""
            const res = await apiClient<{ data: any[] }>(`/listings/my${suffix}`)
            setListings(res?.data ?? [])
        } catch (err) {
            console.error('Failed to load listings:', err)
            setListings([])
        } finally {
            setLoading(false)
        }
    }

    async function publishListing(id: string) {
        try {
            await apiClient(`/listings/${id}/status`, { 
                method: 'PATCH',
                body: JSON.stringify({ status: 'ACTIVE' })
            });
            // Refresh listings
            fetchListings(searchQuery);
        } catch (err) {
            console.error('Failed to publish listing:', err);
            alert('Failed to publish listing. Please try again.');
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    const filteredListings = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return listings.filter(listing => {
            const matchesStatus = statusFilter === "ALL" ? true : listing.status === statusFilter
            const haystack = `${listing.title || ""} ${listing.make || ""} ${listing.model || ""} ${listing.vrm || ""}`.toLowerCase()
            const matchesSearch = !q || haystack.includes(q)
            return matchesStatus && matchesSearch
        })
    }, [listings, searchQuery, statusFilter])

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    {/* Header */}
                    <PageHeader 
                        title={DEALER_ROUTE_CONFIG[1].title} 
                        subHeader={DEALER_ROUTE_CONFIG[1].subHeader}
                    >
                        <Button 
                            variant="outline" 
                            className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 gap-2 h-11 px-6 rounded-xl transition-all"
                            onClick={() => setIsBulkImportOpen(true)}
                        >
                            <Upload size={16} /> Bulk Import
                        </Button>
                        <Link href="/dashboard/dealer/add-listing">
                            <Button className="gap-2 h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(237,28,36,0.3)] bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-transform">
                                <PlusCircle size={18} /> Add Vehicle
                            </Button>
                        </Link>
                    </PageHeader>

                    {/* Filters */}
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <Input
                                placeholder="Search by make, model, VRM..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-12 bg-[#0A0A0C] border-white/5 text-white placeholder:text-gray-500 h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                        <div className="flex gap-2 p-1 bg-[#0A0A0C] border border-white/5 rounded-xl w-full lg:w-auto overflow-x-auto">
                            {["ALL", "ACTIVE", "DRAFT", "SOLD"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                        statusFilter === s
                                            ? 'vip-tab-active'
                                            : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="dealer-glass-card overflow-hidden">
                        <div className="overflow-x-auto border-t border-white/5">
                            <table className="w-full text-left border-collapse">
                                <thead className="vip-table-header">
                                    <tr>
                                        <th className="px-8 py-5">Vehicle Showcase</th>
                                        <th className="px-6 py-5">Market Price</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-6 py-5 text-center">Engagement</th>
                                        <th className="px-6 py-5 text-center">Hot Leads</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : !filteredListings.length ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <Car className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                                <p className="text-gray-500 font-bold">No vehicles in stock</p>
                                                <p className="text-gray-600 text-sm mt-1">Add your first vehicle to start selling</p>
                                                <Link href="/dashboard/dealer/add-listing">
                                                    <Button className="mt-4 gap-2" shape="default">
                                                        <PlusCircle size={16} /> Add Vehicle
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredListings.map((listing: any) => (
                                            <tr key={listing.id} className="group hover:bg-white/[0.02] transition-colors relative">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-20 h-14 bg-black/40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-2xl relative">
                                                            {listing.images?.[0] ? (
                                                                <img src={listing.images[0]} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                                                    <Car size={20} />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-white text-base tracking-tight group-hover:text-primary transition-colors">{listing.title}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded border border-white/5">{listing.vrm || "PRIVATE"}</span>
                                                                <span className="text-[10px] font-bold text-primary italic uppercase tracking-widest">{listing.make}</span>
                                                                <span className="text-[10px] text-gray-600 font-bold">• {listing.mileage?.toLocaleString()} mi</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white text-lg tracking-tight">£{listing.price?.toLocaleString()}</span>
                                                        <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest inline-flex items-center gap-1">
                                                            <TrendingUp size={8} /> Market Value Plus
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border shadow-sm ${STATUS_COLORS[listing.status] || STATUS_COLORS.DRAFT}`}>
                                                        {listing.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-white font-black text-sm">{listing.viewCount || 0}</span>
                                                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500/50" style={{ width: `${Math.min((listing.viewCount || 0) / 10, 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-red-400 font-black text-sm">0</span>
                                                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-red-500/50 pulse-glow" style={{ width: '0%' }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2 opactiy-0 group-hover:opacity-100 transition-opacity">
                                                        {listing.status === 'DRAFT' && (
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                title="Publish Listing"
                                                                onClick={() => publishListing(listing.id)}
                                                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                            >
                                                                <CheckCircle2 size={16} />
                                                            </Button>
                                                        )}
                                                        <Link href={`/dashboard/dealer/inventory/${listing.id}`}>
                                                            <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5">
                                                                <BarChart3 size={16} />
                                                            </Button>
                                                        </Link>
                                                        <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5">
                                                            <MoreVertical size={16} />
                                                        </Button>
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
            
            <BulkImportModal 
                isOpen={isBulkImportOpen} 
                onClose={() => setIsBulkImportOpen(false)} 
                onComplete={() => fetchListings()} 
            />
        </div>
    )
}
