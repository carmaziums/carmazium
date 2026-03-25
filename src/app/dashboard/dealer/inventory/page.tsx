"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Car, Search, Filter, PlusCircle, MoreVertical,
    Loader2, Upload
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"

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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black font-heading uppercase tracking-tight">Inventory</h1>
                            <p className="text-gray-400 text-sm">Manage your dealership's vehicle stock</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/10 gap-2 h-10">
                                <Upload size={16} /> Bulk Import
                            </Button>
                            <Link href="/sell">
                                <Button className="gap-2 h-10 shadow-neon">
                                    <PlusCircle size={16} /> Add Vehicle
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <Input
                                placeholder="Search by make, model, VRM..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-11"
                            />
                        </div>
                        <div className="flex gap-2">
                            {["ALL", "ACTIVE", "DRAFT", "SOLD"].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                                        statusFilter === s
                                            ? 'bg-primary text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="glass-card overflow-hidden border border-white/5 bg-white/5 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Views</th>
                                        <th className="px-6 py-4 text-center">Leads</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
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
                                                <Link href="/sell">
                                                    <Button className="mt-4 gap-2" shape="default">
                                                        <PlusCircle size={16} /> Add Vehicle
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredListings.map((listing: any) => (
                                            <tr key={listing.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-14 h-10 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                                                            {listing.images?.[0] && (
                                                                <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white text-sm">{listing.title}</p>
                                                            <p className="text-xs text-gray-500">{listing.vrm || listing.make} • {listing.mileage?.toLocaleString()} mi</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-white">£{listing.price?.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${STATUS_COLORS[listing.status] || STATUS_COLORS.DRAFT}`}>
                                                        {listing.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-sm text-gray-400">{listing.viewCount || 0}</td>
                                                <td className="px-6 py-4 text-center text-sm text-gray-400">0</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/dashboard/dealer/inventory/${listing.id}`}>
                                                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                                                            <MoreVertical size={16} />
                                                        </Button>
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
        </div>
    )
}
