"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, PlusCircle, Loader2, Eye, XCircle, Clock,
    ChevronUp, AlertCircle, CheckCircle2, Calendar, X
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuth } from "@/context/AuthContext"
import { useSearchParams } from "next/navigation"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import {
    getMyAuctions, createAuction, cancelAuction,
    getCurrentBid, getBidCount,
    type Auction, type CreateAuctionRequest,
} from "@/lib/auctionApi"
import { apiClient } from "@/lib/apiClient"
import type { Listing } from "@/lib/listingApi"

const STATUS_STYLES: Record<string, string> = {
    SCHEDULED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    ENDED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
}

function formatCountdown(target: Date): string {
    const diff = target.getTime() - Date.now()
    if (diff <= 0) return "Ended"
    const h = Math.floor(diff / 3_600_000)
    const m = Math.floor((diff % 3_600_000) / 60_000)
    const s = Math.floor((diff % 60_000) / 1_000)
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
    return `${h}h ${m}m ${s}s`
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    })
}

function addHours(iso: string, hours: number): string {
    return new Date(new Date(iso).getTime() + hours * 3_600_000).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    })
}

export default function DealerAuctionsPageWrapper() {
    return (
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
            <DealerAuctionsPage />
        </React.Suspense>
    )
}

function DealerAuctionsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const preselectedListingId = searchParams.get("listingId") ?? ""
    const [auctions, setAuctions] = React.useState<Auction[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [showForm, setShowForm] = React.useState(false)
    const [eligibleListings, setEligibleListings] = React.useState<Listing[]>([])
    const [cancelling, setCancelling] = React.useState<string | null>(null)
    const [tick, setTick] = React.useState(0)

    // Form state
    const [formListingId, setFormListingId] = React.useState(preselectedListingId)
    const [formStartTime, setFormStartTime] = React.useState("")
    const [formReservePrice, setFormReservePrice] = React.useState("")
    const [formStartingBid, setFormStartingBid] = React.useState("")
    const [formMinIncrement, setFormMinIncrement] = React.useState("100")
    const [submitting, setSubmitting] = React.useState(false)
    const [formError, setFormError] = React.useState<string | null>(null)
    const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

    // Countdown tick every second
    React.useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000)
        return () => clearInterval(id)
    }, [])

    async function fetchAuctions() {
        setLoading(true)
        setError(null)
        try {
            setAuctions(await getMyAuctions())
        } catch (err: any) {
            setError(err.message || "Failed to load auctions")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (!authLoading && user) fetchAuctions()
    }, [user, authLoading])

    // Auto-open form if coming from inventory with a pre-selected listing
    React.useEffect(() => {
        if (preselectedListingId && !authLoading && user) openForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preselectedListingId, authLoading, user])

    async function openForm() {
        setShowForm(true)
        setFormError(null)
        try {
            const res = await apiClient<{ data: Listing[] }>("/listings/my")
            const listed = res?.data ?? []
            const auctionListingIds = new Set(
                auctions
                    .filter(a => a.status === "SCHEDULED" || a.status === "ACTIVE")
                    .map(a => a.listingId)
            )
            setEligibleListings(
                listed.filter(l => l.status === "ACTIVE" && !auctionListingIds.has(l.id))
            )
        } catch {
            setFormError("Failed to load your listings.")
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setFormError(null)
        if (!formListingId) { setFormError("Please select a listing."); return }
        if (!formStartTime) { setFormError("Please set a start date/time."); return }

        const startMs = new Date(formStartTime).getTime()
        if (startMs < Date.now() + 30 * 60 * 1000) {
            setFormError("Start time must be at least 30 minutes in the future.")
            return
        }

        setSubmitting(true)
        try {
            const dto: CreateAuctionRequest = {
                listingId: formListingId,
                startTime: new Date(formStartTime).toISOString(),
                reservePrice: Number(formReservePrice),
                startingBid: Number(formStartingBid),
                minIncrement: Number(formMinIncrement) || 100,
            }
            await createAuction(dto)
            const endDisplay = addHours(new Date(formStartTime).toISOString(), 5)
            setSuccessMsg(`Auction scheduled! It will run until ${endDisplay}.`)
            setShowForm(false)
            setFormListingId(""); setFormStartTime(""); setFormReservePrice("")
            setFormStartingBid(""); setFormMinIncrement("100")
            fetchAuctions()
        } catch (err: any) {
            setFormError(err.message || "Failed to create auction.")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleCancel(id: string) {
        if (!confirm("Cancel this auction? This cannot be undone.")) return
        setCancelling(id)
        try {
            await cancelAuction(id)
            fetchAuctions()
        } catch (err: any) {
            alert(err.message || "Failed to cancel auction.")
        } finally {
            setCancelling(null)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    const auctionRoute = DEALER_ROUTE_CONFIG.find(r => r.href === "/dashboard/dealer/auctions")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    <PageHeader
                        title={auctionRoute?.title ?? "Auctions"}
                        subHeader={auctionRoute?.subHeader ?? "Manage live vehicle auctions & bidding"}
                    >
                        <Button
                            onClick={openForm}
                            className="gap-2 h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(237,28,36,0.3)] bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-transform"
                        >
                            <PlusCircle size={18} /> Create Auction
                        </Button>
                    </PageHeader>

                    {/* Success banner */}
                    <AnimatePresence>
                        {successMsg && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                            >
                                <CheckCircle2 size={18} />
                                <span className="flex-1 text-sm font-bold">{successMsg}</span>
                                <button onClick={() => setSuccessMsg(null)}><X size={16} /></button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Create auction form */}
                    <AnimatePresence>
                        {showForm && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="dealer-glass-card overflow-hidden"
                            >
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Gavel size={18} className="text-primary" />
                                        </div>
                                        <h2 className="font-black text-white text-lg tracking-tight">New Auction</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleCreate} className="p-6 space-y-5">
                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                            <AlertCircle size={16} />
                                            {formError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {/* Listing select */}
                                        <div className="lg:col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Select Listing (AUCTION type)
                                            </label>
                                            <select
                                                value={formListingId}
                                                onChange={e => setFormListingId(e.target.value)}
                                                className="w-full bg-[#0A0A0C] border border-white/5 text-white rounded-xl h-12 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:outline-none"
                                            >
                                                <option value="">— Select a listing —</option>
                                                {eligibleListings.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.title} — {l.year} {l.make} {l.model}
                                                    </option>
                                                ))}
                                            </select>
                                            {eligibleListings.length === 0 && (
                                                <p className="text-xs text-gray-500 mt-1.5">
                                                    No eligible AUCTION-type listings. Create an auction listing first.
                                                </p>
                                            )}
                                        </div>

                                        {/* Start time */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Start Date & Time
                                            </label>
                                            <Input
                                                type="datetime-local"
                                                value={formStartTime}
                                                onChange={e => setFormStartTime(e.target.value)}
                                                min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                                                className="bg-[#0A0A0C] border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Duration (read-only) */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Duration
                                            </label>
                                            <div className="flex items-center gap-2 h-12 px-4 bg-white/[0.03] border border-white/5 rounded-xl text-gray-400 text-sm">
                                                <Clock size={14} className="text-primary" />
                                                5 hours (fixed)
                                                {formStartTime && (
                                                    <span className="ml-auto text-xs text-gray-600">
                                                        ends {addHours(new Date(formStartTime).toISOString(), 5)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reserve price */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Reserve Price (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 15000"
                                                value={formReservePrice}
                                                onChange={e => setFormReservePrice(e.target.value)}
                                                className="bg-[#0A0A0C] border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Starting bid */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Starting Bid (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 10000"
                                                value={formStartingBid}
                                                onChange={e => setFormStartingBid(e.target.value)}
                                                className="bg-[#0A0A0C] border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Min increment */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                Minimum Increment (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={formMinIncrement}
                                                onChange={e => setFormMinIncrement(e.target.value)}
                                                className="bg-[#0A0A0C] border-white/5 text-white h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowForm(false)}
                                            className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 h-10 px-5 rounded-xl"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={submitting}
                                            className="gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                                        >
                                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />}
                                            Schedule Auction
                                        </Button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Auctions table */}
                    <div className="dealer-glass-card overflow-hidden">
                        <div className="overflow-x-auto border-t border-white/5">
                            <table className="w-full text-left border-collapse">
                                <thead className="vip-table-header">
                                    <tr>
                                        <th className="px-8 py-5">Vehicle</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-6 py-5">Schedule</th>
                                        <th className="px-6 py-5 text-right">Current Bid</th>
                                        <th className="px-6 py-5 text-center">Bids</th>
                                        <th className="px-8 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.03]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <div className="flex items-center justify-center gap-2 text-red-400">
                                                    <AlertCircle size={16} />
                                                    <span className="text-sm">{error}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : auctions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center">
                                                <Gavel className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                                                <p className="text-gray-500 font-bold">No auctions yet</p>
                                                <p className="text-gray-600 text-sm mt-1">Create your first auction to start selling</p>
                                                <Button
                                                    onClick={openForm}
                                                    className="mt-4 gap-2 bg-gradient-to-r from-red-600 to-red-700"
                                                >
                                                    <PlusCircle size={16} /> Create Auction
                                                </Button>
                                            </td>
                                        </tr>
                                    ) : (
                                        auctions.map(auction => (
                                            <tr key={auction.id} className="group hover:bg-white/[0.02] transition-colors">
                                                {/* Vehicle */}
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-20 h-14 bg-black/40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-2xl">
                                                            {auction.listing.images?.[0] ? (
                                                                <img
                                                                    src={auction.listing.images[0]}
                                                                    alt=""
                                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                                                    <Gavel size={20} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-white text-base tracking-tight group-hover:text-primary transition-colors">
                                                                {auction.listing.title}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                                                                {auction.listing.year} · {auction.listing.make} {auction.listing.model}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-6 py-6 text-center">
                                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest border ${STATUS_STYLES[auction.status] ?? STATUS_STYLES.ENDED}`}>
                                                        {auction.status === "ACTIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 self-center" />}
                                                        {auction.status}
                                                    </span>
                                                </td>

                                                {/* Schedule */}
                                                <td className="px-6 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                            <Calendar size={11} className="text-gray-600" />
                                                            <span>{formatDate(auction.startTime)}</span>
                                                        </div>
                                                        {auction.status === "ACTIVE" ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-primary font-black">
                                                                <Clock size={11} />
                                                                <span key={tick}>{formatCountdown(new Date(auction.endTime))}</span>
                                                            </div>
                                                        ) : auction.status === "SCHEDULED" ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-blue-400">
                                                                <Clock size={11} />
                                                                <span>Starts in {formatCountdown(new Date(auction.startTime))}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-600">{formatDate(auction.endTime)}</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Current bid */}
                                                <td className="px-6 py-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-white text-lg tracking-tight">
                                                            £{getCurrentBid(auction).toLocaleString()}
                                                        </span>
                                                        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">
                                                            {getBidCount(auction) === 0 ? "starting bid" : "current bid"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Bid count */}
                                                <td className="px-6 py-6 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-black text-white text-sm">{getBidCount(auction)}</span>
                                                        <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-primary/50"
                                                                style={{ width: `${Math.min(getBidCount(auction) * 10, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {auction.status === "ACTIVE" && (
                                                            <Link href={`/auctions/live/${auction.id}`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                                >
                                                                    <Eye size={14} /> View Live
                                                                </Button>
                                                            </Link>
                                                        )}
                                                        {auction.status === "SCHEDULED" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={cancelling === auction.id}
                                                                onClick={() => handleCancel(auction.id)}
                                                                className="gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-50"
                                                            >
                                                                {cancelling === auction.id
                                                                    ? <Loader2 size={14} className="animate-spin" />
                                                                    : <XCircle size={14} />
                                                                }
                                                                Cancel
                                                            </Button>
                                                        )}
                                                        {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                                                            <Link href={`/auctions/live/${auction.id}`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-1.5 bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5"
                                                                >
                                                                    <ChevronUp size={14} /> View Results
                                                                </Button>
                                                            </Link>
                                                        )}
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
