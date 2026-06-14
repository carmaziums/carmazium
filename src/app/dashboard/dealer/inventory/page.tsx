"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Car, Search, Filter, PlusCircle, MoreVertical,
    Loader2, Upload, TrendingUp, ShieldCheck, Trash2, Eye, RefreshCcw, Pencil, AlertTriangle,
    Star, Zap, X, BadgeCheck, Shield
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { publishListing, createListingCheckoutSession } from "@/lib/listingApi"
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
    const router = useRouter()
    const [listings, setListings] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [statusFilter, setStatusFilter] = React.useState("ALL")
    const [isBulkImportOpen, setIsBulkImportOpen] = React.useState(false)
    const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null)
    const [publishing, setPublishing] = React.useState<string | null>(null)
    const [publishBlockedId, setPublishBlockedId] = React.useState<string | null>(null)
    const [planSelectListing, setPlanSelectListing] = React.useState<any | null>(null)
    const [detailsBlockedId, setDetailsBlockedId] = React.useState<string | null>(null)

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
            query.set("includeSold", "true")  // always include SOLD for dealer inventory tabs
            const res = await apiClient<{ data: any[] }>(`/listings/my?${query.toString()}`)
            setListings(res?.data ?? [])
        } catch (err) {
            console.error('Failed to load listings:', err)
            setListings([])
        } finally {
            setLoading(false)
        }
    }

    async function handlePublish(listing: any) {
        // Gate 1: listing must have at least one photo before going live
        if (!listing.images || listing.images.length === 0) {
            setPublishBlockedId(listing.id)
            return
        }
        setPublishBlockedId(null)

        // Gate 2: bulk-imported listings are missing fields DVLA can't provide.
        // Require the dealer to complete the form before selecting a plan.
        const missingDetails = !listing.transmission || !listing.bodyType || !listing.description?.trim()
        if (missingDetails) {
            setDetailsBlockedId(listing.id)
            return
        }
        setDetailsBlockedId(null)

        // Show plan selection modal
        setPlanSelectListing(listing)
    }

    async function handlePlanConfirm(tier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM') {
        if (!planSelectListing) return
        const listing = planSelectListing
        setPlanSelectListing(null)
        try {
            setPublishing(listing.id)
            if (tier === 'FREE') {
                // Free tier: publish directly without payment
                await publishListing(listing.id)
                fetchListings(searchQuery)
            } else {
                // Paid tier: update badge and redirect to Stripe
                const checkout = await createListingCheckoutSession(listing.id, tier)
                window.location.href = checkout.url
            }
        } catch (err: any) {
            alert('Failed to publish: ' + err.message)
        } finally {
            setPublishing(null)
        }
    }

    async function deleteListing(id: string) {
        if (!window.confirm("Are you sure you want to delete this listing?")) return;
        try {
            await apiClient(`/listings/${id}`, { method: 'DELETE' });
            fetchListings(searchQuery);
        } catch (err) {
            console.error('Failed to delete listing:', err);
            alert('Failed to delete listing. Please try again.');
        }
    }

    async function handleMarkSold(id: string) {
        if (!window.confirm("Mark this vehicle as Sold? It will remain in your inventory but be hidden from search.")) return;
        try {
            await apiClient(`/listings/${id}/status`, { 
                method: 'PATCH',
                body: JSON.stringify({ status: 'SOLD' })
            });
            fetchListings(searchQuery);
        } catch (err) {
            console.error('Failed to mark sold:', err);
            alert('Failed to update listing status.');
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
                                                <p className="text-gray-500 font-bold">No vehicles found</p>
                                                <p className="text-gray-600 text-sm mt-1">Try adjusting your filters or add a new vehicle using the button above</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredListings.map((listing: any) => (
                                            <tr key={listing.id} className="group hover:bg-white/[0.02] transition-colors relative">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-20 h-14 bg-black/40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-2xl relative">
                                                            {listing.images?.[0] ? (
                                                                <img src={listing.images[0]} alt="" className={`w-full h-full object-cover transition-opacity ${listing.status === 'SOLD' ? 'opacity-40' : 'opacity-80 group-hover:opacity-100'}`} />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                                                    <Car size={20} />
                                                                </div>
                                                            )}
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            {listing.status === 'SOLD' && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <span className="bg-red-600/90 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rotate-[-20deg] shadow-lg border border-red-400/40">
                                                                        SOLD
                                                                    </span>
                                                                </div>
                                                            )}
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
                                                    <div className="flex flex-col items-end gap-2">
                                                    {/* Incomplete listing warning */}
                                                    {publishBlockedId === listing.id && (
                                                        <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 max-w-[180px] text-left">
                                                            <AlertTriangle size={11} className="shrink-0" />
                                                            <span>Add photos first. <button onClick={() => router.push(`/dashboard/dealer/add-listing?editId=${listing.id}&editSlug=${encodeURIComponent(listing.slug)}&returnPublish=true`)} className="underline hover:text-amber-300">Complete listing</button></span>
                                                        </div>
                                                    )}
                                                    {detailsBlockedId === listing.id && (
                                                        <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 max-w-[180px] text-left">
                                                            <AlertTriangle size={11} className="shrink-0" />
                                                            <span>Missing details. <button onClick={() => router.push(`/dashboard/dealer/add-listing?editId=${listing.id}&editSlug=${encodeURIComponent(listing.slug)}&returnPublish=true`)} className="underline hover:text-blue-300">Complete listing</button></span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {listing.status === 'DRAFT' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                title={(!listing.images || listing.images.length === 0) ? "Add photos before publishing" : "Publish Listing"}
                                                                onClick={() => handlePublish(listing)}
                                                                disabled={publishing === listing.id}
                                                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                            >
                                                                {publishing === listing.id
                                                                    ? <Loader2 size={16} className="animate-spin" />
                                                                    : <CheckCircle2 size={16} />
                                                                }
                                                            </Button>
                                                        )}

                                                        <div className="relative group">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </Button>
                                                            
                                                            {/* Dropdown menu */}
                                                            <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 flex flex-col py-1">
                                                                <Link href={`/dashboard/dealer/add-listing?editId=${listing.id}&editSlug=${listing.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                                                    <Pencil size={14} /> Edit
                                                                </Link>
                                                                <Link href={`/buy-cars/${listing.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                                                    <Eye size={14} /> View
                                                                </Link>
                                                                {listing.status === 'ACTIVE' && (
                                                                    <button 
                                                                        onClick={async (e) => {
                                                                            e.preventDefault();
                                                                            try {
                                                                                const res = await apiClient<{ data: { url: string } }>(`/featured-boost/${listing.id}`, { method: 'POST' });
                                                                                if (res.data.url) window.location.href = res.data.url;
                                                                            } catch (err) {
                                                                                alert("Failed to start boost payment.");
                                                                            }
                                                                        }} 
                                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors w-full text-left"
                                                                    >
                                                                        <TrendingUp size={14} /> Boost to Featured
                                                                    </button>
                                                                )}
                                                                {listing.status !== 'SOLD' && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            handleMarkSold(listing.id);
                                                                        }} 
                                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors w-full text-left"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Mark Sold
                                                                    </button>
                                                                )}
                                                                {listing.status === 'SOLD' && (
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            publishListing(listing.id);
                                                                        }} 
                                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-blue-500/10 hover:text-blue-400 transition-colors w-full text-left"
                                                                    >
                                                                        <RefreshCcw size={14} /> Relist
                                                                    </button>
                                                                )}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        deleteListing(listing.id);
                                                                    }}
                                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full text-left"
                                                                >
                                                                    <Trash2 size={14} /> Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
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

            {/* ─── Plan Selection Modal ────────────────────────────────────── */}
            {planSelectListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="relative w-full max-w-lg bg-[#0A0A0C] border border-white/10 rounded-2xl p-6 shadow-2xl">
                        <button
                            onClick={() => setPlanSelectListing(null)}
                            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <h2 className="text-lg font-black text-white font-heading uppercase tracking-tight mb-1">
                            Choose a Listing Plan
                        </h2>
                        <p className="text-xs text-gray-500 mb-5">
                            Select a tier for <span className="text-gray-300 font-semibold">{planSelectListing.title || `${planSelectListing.make} ${planSelectListing.model}`}</span>
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* FREE */}
                            <button
                                onClick={() => handlePlanConfirm('FREE')}
                                className="flex flex-col p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/5 transition-all text-left"
                            >
                                <p className="text-white font-bold text-sm mb-1">Free</p>
                                <p className="text-2xl font-black text-white mb-3">£0</p>
                                <ul className="space-y-1 text-[11px] text-gray-400">
                                    <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-400" /> Basic listing</li>
                                    <li className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-400" /> Offer system</li>
                                    <li className="flex items-center gap-1.5 text-gray-600"><X size={11} /> No trust badges</li>
                                </ul>
                            </button>

                            {/* STANDARD */}
                            <button
                                onClick={() => handlePlanConfirm('STANDARD')}
                                className="relative flex flex-col p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60 hover:bg-blue-500/10 transition-all text-left"
                            >
                                <p className="text-blue-400 font-bold text-sm mb-1 flex items-center gap-1"><Shield size={12} /> Standard</p>
                                <p className="text-2xl font-black text-white mb-3">£10</p>
                                <ul className="space-y-1 text-[11px] text-gray-400">
                                    <li className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-blue-400" /> VIN Report badge</li>
                                    <li className="flex items-center gap-1.5"><BadgeCheck size={11} className="text-blue-400" /> Verified Seller badge</li>
                                    <li className="flex items-center gap-1.5 text-gray-600"><X size={11} /> No featured boost</li>
                                </ul>
                            </button>
                        </div>

                        {/* PREMIUM */}
                        <button
                            onClick={() => handlePlanConfirm('PREMIUM')}
                            className="relative w-full flex items-center gap-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10 transition-all text-left"
                        >
                            <span className="absolute -top-2.5 left-4 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-0.5 rounded-full flex items-center gap-1">
                                <Star size={9} /> Best Value
                            </span>
                            <div className="flex-1">
                                <p className="text-amber-400 font-bold text-sm flex items-center gap-1"><Star size={12} /> Premium</p>
                                <p className="text-lg font-black text-white">£25</p>
                            </div>
                            <ul className="space-y-1 text-[11px] text-gray-400">
                                <li className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /> Featured boost (28 days)</li>
                                <li className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /> Priority in search results</li>
                                <li className="flex items-center gap-1.5"><Zap size={11} className="text-amber-400" /> Featured badge</li>
                            </ul>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
