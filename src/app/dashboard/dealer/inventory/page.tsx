"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Car, Search, Filter, PlusCircle, MoreVertical,
    Loader2, Upload, TrendingUp, ShieldCheck, Trash2, Eye, RefreshCcw, Pencil, AlertTriangle,
    Star, Zap, X, BadgeCheck, Shield, CheckCircle2, ChevronRight, Gavel, Tag
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { apiClient } from "@/lib/apiClient"
import { publishListing, createListingCheckoutSession, alsoListRetail, alsoAuction, createListingCheckout } from "@/lib/listingApi"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import { BulkImportModal } from "@/components/dealer/BulkImportModal"
import { ImportListingModal } from "@/components/features/ImportListingModal"
import { ExternalLink } from "lucide-react"

// ─── Completeness helper ────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
    { key: 'images',       label: 'Photos',       check: (l: any) => Array.isArray(l.images) && l.images.length >= 1 },
    { key: 'transmission', label: 'Transmission',  check: (l: any) => !!l.transmission },
    { key: 'bodyType',     label: 'Body Type',     check: (l: any) => !!l.bodyType },
    { key: 'description',  label: 'Description',   check: (l: any) => !!l.description?.trim() },
    { key: 'condition',    label: 'Condition',      check: (l: any) => !!l.condition },
]

function getListingCompleteness(listing: any) {
    const missing = REQUIRED_FIELDS.filter(f => !f.check(listing)).map(f => f.label)
    const complete = REQUIRED_FIELDS.length - missing.length
    return {
        isComplete: missing.length === 0,
        missing,
        complete,
        total: REQUIRED_FIELDS.length,
        percent: Math.round((complete / REQUIRED_FIELDS.length) * 100),
    }
}

// ─── Status colours ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DRAFT:  "bg-gray-500/10 text-gray-400 border-gray-500/20",
    SOLD:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
    IN_PREP:"bg-amber-500/10 text-amber-400 border-amber-500/20",
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DealerInventoryPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [listings,          setListings]          = React.useState<any[]>([])
    const [loading,           setLoading]           = React.useState(true)
    const [searchQuery,       setSearchQuery]       = React.useState("")
    const [statusFilter,      setStatusFilter]      = React.useState("ALL")
    const [isBulkImportOpen,  setIsBulkImportOpen]  = React.useState(false)
    const [isImportModalOpen, setIsImportModalOpen] = React.useState(false)
    const [activeDropdown,    setActiveDropdown]    = React.useState<string | null>(null)
    const [publishing,        setPublishing]        = React.useState<string | null>(null)
    // Plan modal
    const [planSelectListing, setPlanSelectListing] = React.useState<any | null>(null)
    const [planModalError,    setPlanModalError]    = React.useState<string[] | null>(null)
    // Also-list-retail modal (for AUCTION listings)
    const [alsoRetailListing, setAlsoRetailListing] = React.useState<any | null>(null)
    const [alsoRetailPrice,   setAlsoRetailPrice]   = React.useState("")
    const [alsoRetailTier,    setAlsoRetailTier]    = React.useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('BASIC')
    const [alsoRetailLoading, setAlsoRetailLoading] = React.useState(false)
    const [alsoRetailError,   setAlsoRetailError]   = React.useState<string | null>(null)
    // Also-auction modal (for CLASSIFIED listings)
    const [alsoAuctionListing,   setAlsoAuctionListing]   = React.useState<any | null>(null)
    const [alsoAuctionStart,     setAlsoAuctionStart]     = React.useState("")
    const [alsoAuctionReserve,   setAlsoAuctionReserve]   = React.useState("")
    const [alsoAuctionStartBid,  setAlsoAuctionStartBid]  = React.useState("")
    const [alsoAuctionIncrement, setAlsoAuctionIncrement] = React.useState("100")
    const [alsoAuctionBinPrice,  setAlsoAuctionBinPrice]  = React.useState("")
    const [alsoAuctionLoading,   setAlsoAuctionLoading]   = React.useState(false)
    const [alsoAuctionError,     setAlsoAuctionError]     = React.useState<string | null>(null)
    const [alsoAuctionSuccess,   setAlsoAuctionSuccess]   = React.useState(false)

    React.useEffect(() => {
        if (!authLoading && user) fetchListings(searchQuery)
    }, [user, authLoading, searchQuery])

    async function fetchListings(search = "") {
        setLoading(true)
        try {
            const query = new URLSearchParams()
            if (search.trim()) query.set("search", search.trim())
            query.set("includeSold", "true")
            const res = await apiClient<{ data: any[] }>(`/listings/my?${query.toString()}`)
            setListings(res?.data ?? [])
        } catch (err) {
            console.error('Failed to load listings:', err)
            setListings([])
        } finally {
            setLoading(false)
        }
    }

    // Green tick → always open the plan modal. Completeness is checked inside.
    function handlePublish(listing: any) {
        setPlanModalError(null)
        setPlanSelectListing(listing)
    }

    function closePlanModal() {
        setPlanSelectListing(null)
        setPlanModalError(null)
    }

    async function handlePlanConfirm(tier: 'BASIC' | 'STANDARD' | 'PREMIUM') {
        if (!planSelectListing) return

        // Gate: must be complete before any money or activation happens
        const { isComplete, missing } = getListingCompleteness(planSelectListing)
        if (!isComplete) {
            setPlanModalError(missing)
            return
        }

        const listing = planSelectListing
        closePlanModal()
        try {
            setPublishing(listing.id)
            const checkout = await createListingCheckoutSession(listing.id, tier)
            window.location.href = checkout.url
        } catch (err: any) {
            alert('Failed to publish: ' + err.message)
        } finally {
            setPublishing(null)
        }
    }

    async function deleteListing(id: string) {
        if (!window.confirm("Are you sure you want to delete this listing?")) return
        try {
            await apiClient(`/listings/${id}`, { method: 'DELETE' })
            fetchListings(searchQuery)
        } catch (err) {
            console.error('Failed to delete listing:', err)
            alert('Failed to delete listing. Please try again.')
        }
    }

    async function handleMarkSold(id: string) {
        if (!window.confirm("Mark this vehicle as Sold?")) return
        try {
            await apiClient(`/listings/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'SOLD' })
            })
            fetchListings(searchQuery)
        } catch (err) {
            console.error('Failed to mark sold:', err)
            alert('Failed to update listing status.')
        }
    }

    async function handleAlsoRetailSubmit() {
        if (!alsoRetailListing || !alsoRetailPrice) return
        setAlsoRetailLoading(true)
        setAlsoRetailError(null)
        try {
            const { linkedListingId } = await alsoListRetail(alsoRetailListing.id, parseFloat(alsoRetailPrice), alsoRetailTier)
            const { url } = await createListingCheckout(linkedListingId, alsoRetailTier)
            window.location.href = url
        } catch (err: any) {
            setAlsoRetailError(err.message ?? 'Failed to create retail listing')
        } finally {
            setAlsoRetailLoading(false)
        }
    }

    async function handleAlsoAuctionSubmit() {
        if (!alsoAuctionListing || !alsoAuctionStart || !alsoAuctionReserve || !alsoAuctionStartBid) return
        setAlsoAuctionLoading(true)
        setAlsoAuctionError(null)
        try {
            await alsoAuction(alsoAuctionListing.id, {
                startTime: new Date(alsoAuctionStart).toISOString(),
                reservePrice: parseFloat(alsoAuctionReserve),
                startingBid: parseFloat(alsoAuctionStartBid),
                minIncrement: parseFloat(alsoAuctionIncrement) || 100,
                ...(alsoAuctionBinPrice ? { buyItNowPrice: parseFloat(alsoAuctionBinPrice) } : {}),
            })
            setAlsoAuctionSuccess(true)
            setTimeout(() => {
                setAlsoAuctionListing(null)
                setAlsoAuctionSuccess(false)
                fetchListings(searchQuery)
            }, 2000)
        } catch (err: any) {
            setAlsoAuctionError(err.message ?? 'Failed to create auction')
        } finally {
            setAlsoAuctionLoading(false)
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
                            onClick={() => setIsImportModalOpen(true)}
                        >
                            <ExternalLink size={16} /> Import Listing
                        </Button>
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
                                        statusFilter === s ? 'vip-tab-active' : 'text-gray-500 hover:text-gray-300'
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
                                                <p className="text-gray-600 text-sm mt-1">Try adjusting your filters or add a new vehicle</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredListings.map((listing: any) => {
                                            const comp = listing.status === 'DRAFT' ? getListingCompleteness(listing) : null
                                            return (
                                                <tr key={listing.id} className="group hover:bg-white/[0.02] transition-colors relative">
                                                    {/* Vehicle Showcase */}
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
                                                                        <span className="bg-red-600/90 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rotate-[-20deg] shadow-lg border border-red-400/40">SOLD</span>
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

                                                    {/* Price */}
                                                    <td className="px-6 py-6">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-white text-lg tracking-tight">£{listing.price?.toLocaleString()}</span>
                                                            <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest inline-flex items-center gap-1">
                                                                <TrendingUp size={8} /> Market Value Plus
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Status + completeness */}
                                                    <td className="px-6 py-6 text-center">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border shadow-sm ${STATUS_COLORS[listing.status] || STATUS_COLORS.DRAFT}`}>
                                                                {listing.status}
                                                            </span>
                                                            {comp && (
                                                                <div
                                                                    title={comp.isComplete ? 'Listing complete — ready to publish' : `Missing: ${comp.missing.join(', ')}`}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border cursor-default ${
                                                                        comp.isComplete
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                            : comp.percent >= 60
                                                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                                    }`}
                                                                >
                                                                    {comp.isComplete
                                                                        ? <><CheckCircle2 size={8} /> Ready</>
                                                                        : <><AlertTriangle size={8} /> {comp.complete}/{comp.total}</>
                                                                    }
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Engagement */}
                                                    <td className="px-6 py-6 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-white font-black text-sm">{listing.viewCount || 0}</span>
                                                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full bg-blue-500/50" style={{ width: `${Math.min((listing.viewCount || 0) / 10, 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Hot leads */}
                                                    <td className="px-6 py-6 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-red-400 font-black text-sm">0</span>
                                                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full bg-red-500/50 pulse-glow" style={{ width: '0%' }} />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-8 py-6 text-right">
                                                        <div className="flex items-center justify-end gap-2 transition-opacity">
                                                            {listing.status === 'DRAFT' && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    title="Publish Listing"
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

                                                            <div className="relative group/menu">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5"
                                                                >
                                                                    <MoreVertical size={16} />
                                                                </Button>

                                                                <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 flex flex-col py-1">
                                                                    <Link href={`/dashboard/dealer/add-listing?editId=${listing.id}&editSlug=${encodeURIComponent(listing.slug)}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                                                        <Pencil size={14} /> Edit
                                                                    </Link>
                                                                    <Link href={`/buy-cars/${listing.slug}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                                                                        <Eye size={14} /> View
                                                                    </Link>
                                                                    {/* Dual-channel: AUCTION listing → add retail listing */}
                                                                    {listing.type === 'AUCTION' && listing.status === 'ACTIVE' && !(listing as any).linkedListing && (
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAlsoRetailListing(listing); setAlsoRetailPrice(""); setAlsoRetailTier('BASIC'); setAlsoRetailError(null) }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors w-full text-left"
                                                                        >
                                                                            <Tag size={14} /> Also List for Retail
                                                                        </button>
                                                                    )}
                                                                    {/* Resume payment if retail listing was created but not paid for */}
                                                                    {listing.type === 'AUCTION' && listing.status === 'ACTIVE' && (listing as any).linkedListing?.status === 'DRAFT' && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.preventDefault(); e.stopPropagation()
                                                                                const linked = (listing as any).linkedListing
                                                                                const { url } = await createListingCheckout(linked.id, linked.badgeTier || 'BASIC')
                                                                                window.location.href = url
                                                                            }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors w-full text-left"
                                                                        >
                                                                            <Tag size={14} /> Resume Retail Payment
                                                                        </button>
                                                                    )}
                                                                    {/* Dual-channel: CLASSIFIED listing → add auction */}
                                                                    {listing.type === 'CLASSIFIED' && listing.status === 'ACTIVE' && !listing.linkedListingId && (
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAlsoAuctionListing(listing); setAlsoAuctionStart(""); setAlsoAuctionReserve(""); setAlsoAuctionStartBid(""); setAlsoAuctionIncrement("100"); setAlsoAuctionError(null); setAlsoAuctionSuccess(false) }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors w-full text-left"
                                                                        >
                                                                            <Gavel size={14} /> Also Put to Auction
                                                                        </button>
                                                                    )}
                                                                    {listing.status === 'ACTIVE' && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.preventDefault()
                                                                                try {
                                                                                    const res = await apiClient<{ data: { url: string } }>(`/featured-boost/${listing.id}`, { method: 'POST' })
                                                                                    if (res.data.url) window.location.href = res.data.url
                                                                                } catch {
                                                                                    alert("Failed to start boost payment.")
                                                                                }
                                                                            }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors w-full text-left"
                                                                        >
                                                                            <TrendingUp size={14} /> Boost to Featured
                                                                        </button>
                                                                    )}
                                                                    {listing.status !== 'SOLD' && (
                                                                        <button
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkSold(listing.id) }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors w-full text-left"
                                                                        >
                                                                            <CheckCircle2 size={14} /> Mark Sold
                                                                        </button>
                                                                    )}
                                                                    {listing.status === 'SOLD' && (
                                                                        <button
                                                                            onClick={async (e) => {
                                                                                e.preventDefault(); e.stopPropagation()
                                                                                // Phase 10: relist via status PATCH (listing was already published)
                                                                                const res = await apiClient(`/listings/${listing.id}/status`, {
                                                                                    method: 'PATCH',
                                                                                    body: JSON.stringify({ status: 'ACTIVE' })
                                                                                }).catch(() => null)
                                                                                if (res !== null) fetchListings(searchQuery)
                                                                            }}
                                                                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-blue-500/10 hover:text-blue-400 transition-colors w-full text-left"
                                                                        >
                                                                            <RefreshCcw size={14} /> Relist
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteListing(listing.id) }}
                                                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full text-left"
                                                                    >
                                                                        <Trash2 size={14} /> Delete
                                                                    </button>
                                                                </div>
                                                            </div>
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

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onComplete={() => fetchListings()}
            />

            {isImportModalOpen && (
                <ImportListingModal
                    onClose={() => setIsImportModalOpen(false)}
                    onImported={() => { setIsImportModalOpen(false); fetchListings() }}
                />
            )}

            {/* ── Also List for Retail modal ──────────────────────────────── */}
            {alsoRetailListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0A0A0C] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                    <Tag size={16} className="text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">Also List for Retail</p>
                                    <p className="text-slate-500 text-xs truncate max-w-[160px]">{alsoRetailListing.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setAlsoRetailListing(null)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Retail Price (£)</label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 18500"
                                    value={alsoRetailPrice}
                                    onChange={e => setAlsoRetailPrice(e.target.value)}
                                    className="bg-slate-800 border-white/10 text-white h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Listing Plan</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([['BASIC', '£1'], ['STANDARD', '£10'], ['PREMIUM', '£25']] as const).map(([tier, price]) => (
                                        <button
                                            key={tier}
                                            onClick={() => setAlsoRetailTier(tier)}
                                            className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${alsoRetailTier === tier ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-slate-800/60 border-white/10 text-slate-400 hover:border-white/20'}`}
                                        >
                                            {tier}<br /><span className="text-[10px] font-normal">{price}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {alsoRetailError && <p className="text-red-400 text-xs">{alsoRetailError}</p>}

                        <button
                            onClick={handleAlsoRetailSubmit}
                            disabled={alsoRetailLoading || !alsoRetailPrice}
                            className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {alsoRetailLoading ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><Tag size={14} /> Create & Pay</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Also Put to Auction modal ───────────────────────────────── */}
            {alsoAuctionListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#0A0A0C] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Gavel size={16} className="text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-white font-bold text-sm">Also Put to Auction</p>
                                    <p className="text-slate-500 text-xs truncate max-w-[160px]">{alsoAuctionListing.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setAlsoAuctionListing(null)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        {alsoAuctionSuccess ? (
                            <div className="py-4 text-center space-y-2">
                                <CheckCircle2 size={28} className="text-emerald-400 mx-auto" />
                                <p className="text-emerald-300 text-sm font-bold">Auction scheduled!</p>
                                <p className="text-slate-500 text-xs">Your retail listing stays active simultaneously.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Auction Start Time</label>
                                    <Input type="datetime-local" value={alsoAuctionStart} onChange={e => setAlsoAuctionStart(e.target.value)} className="bg-slate-800 border-white/10 text-white h-10" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Reserve Price (£)</label>
                                        <Input type="number" placeholder="e.g. 15000" value={alsoAuctionReserve} onChange={e => setAlsoAuctionReserve(e.target.value)} className="bg-slate-800 border-white/10 text-white h-10" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Starting Bid (£)</label>
                                        <Input type="number" placeholder="e.g. 10000" value={alsoAuctionStartBid} onChange={e => setAlsoAuctionStartBid(e.target.value)} className="bg-slate-800 border-white/10 text-white h-10" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Min Bid Increment (£)</label>
                                    <Input type="number" placeholder="100" value={alsoAuctionIncrement} onChange={e => setAlsoAuctionIncrement(e.target.value)} className="bg-slate-800 border-white/10 text-white h-10" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Buy It Now Price (£) <span className="text-slate-600 font-normal normal-case">— optional</span></label>
                                    <Input type="number" placeholder="Leave blank to disable BIN" value={alsoAuctionBinPrice} onChange={e => setAlsoAuctionBinPrice(e.target.value)} className="bg-slate-800 border-white/10 text-white h-10" />
                                </div>

                                {alsoAuctionError && <p className="text-red-400 text-xs">{alsoAuctionError}</p>}

                                <button
                                    onClick={handleAlsoAuctionSubmit}
                                    disabled={alsoAuctionLoading || !alsoAuctionStart || !alsoAuctionReserve || !alsoAuctionStartBid}
                                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {alsoAuctionLoading ? <><Loader2 size={14} className="animate-spin" /> Scheduling…</> : <><Gavel size={14} /> Schedule Auction</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Plan Selection Modal ──────────────────────────────────────── */}
            {planSelectListing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="relative w-full max-w-lg bg-[#0A0A0C] border border-white/10 rounded-2xl p-6 shadow-2xl">
                        <button
                            onClick={closePlanModal}
                            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <h2 className="text-lg font-black text-white font-heading uppercase tracking-tight mb-1">
                            Choose a Listing Plan
                        </h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Select a tier for <span className="text-gray-300 font-semibold">{planSelectListing.title || `${planSelectListing.make} ${planSelectListing.model}`}</span>
                        </p>

                        {/* Completeness status */}
                        {(() => {
                            const comp = getListingCompleteness(planSelectListing)
                            return (
                                <div className={`mb-5 p-3 rounded-xl border ${comp.isComplete ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${comp.isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            Listing completeness — {comp.complete}/{comp.total} required fields
                                        </span>
                                        <span className={`text-[10px] font-black ${comp.isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>{comp.percent}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                                        <div
                                            className={`h-full rounded-full transition-all ${comp.isComplete ? 'bg-emerald-500' : comp.percent >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${comp.percent}%` }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {REQUIRED_FIELDS.map(f => {
                                            const has = f.check(planSelectListing)
                                            return (
                                                <span key={f.key} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold ${has ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                    {has ? <CheckCircle2 size={8} /> : <X size={8} />}
                                                    {f.label}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Inline error when dealer clicks a plan but listing is incomplete */}
                        {planModalError && (
                            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                <div className="flex items-start gap-2 mb-3">
                                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-bold text-red-300 mb-1">Listing not ready to publish</p>
                                        <p className="text-xs text-red-200/70">
                                            The following required details are missing. Complete your listing first so buyers have the information they need to trust this vehicle.
                                        </p>
                                    </div>
                                </div>
                                <ul className="mb-3 space-y-1 pl-6">
                                    {planModalError.map(field => (
                                        <li key={field} className="text-xs text-red-300 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                                            {field}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => {
                                        closePlanModal()
                                        router.push(`/dashboard/dealer/add-listing?editId=${planSelectListing.id}&editSlug=${encodeURIComponent(planSelectListing.slug)}&returnPublish=true`)
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
                                >
                                    Complete Listing <ChevronRight size={13} />
                                </button>
                            </div>
                        )}

                        {/* Plan cards */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* BASIC */}
                            <button
                                onClick={() => handlePlanConfirm('BASIC')}
                                className="flex flex-col p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/5 transition-all text-left"
                            >
                                <p className="text-white font-bold text-sm mb-1">Basic</p>
                                <p className="text-2xl font-black text-white mb-3">£1</p>
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
