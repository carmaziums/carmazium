"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, PlusCircle, Loader2, Eye, XCircle, Clock,
    ChevronRight, AlertCircle, CheckCircle2, Calendar, X,
    Upload, Handshake, Info, CheckCircle, ImageIcon,
    Trophy, MessageSquare, BarChart2, Users, TrendingUp,
} from "lucide-react"
import { createChatRoom } from "@/lib/chatApi"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuth } from "@/context/AuthContext"
import { useSearchParams } from "next/navigation"
import {
    getMyAuctions, createAuction, cancelAuction,
    getCurrentBid, getBidCount,
    type Auction, type CreateAuctionRequest,
} from "@/lib/auctionApi"
import { apiClient } from "@/lib/apiClient"
import { uploadImage } from "@/lib/supabase"
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

export default function SellerAuctionsPageWrapper() {
    return (
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
            <SellerAuctionsPage />
        </React.Suspense>
    )
}

function SellerAuctionsPage() {
    const { user, loading: authLoading } = useAuth()
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
    const [resultsAuction, setResultsAuction] = React.useState<Auction | null>(null)
    const [connectingChat, setConnectingChat] = React.useState(false)

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
            const endDisplay = addHours(new Date(formStartTime).toISOString(), 24)
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

    // ── Handover proof upload ─────────────────────────────────────────────────
    const [handoverUploading, setHandoverUploading] = React.useState<string | null>(null)
    const [handoverDone, setHandoverDone] = React.useState<Set<string>>(new Set())
    const [handoverError, setHandoverError] = React.useState<Record<string, string>>({})

    // Seed handoverDone from API data whenever auctions load
    React.useEffect(() => {
        const submittedIds = auctions
            .filter(a => a.handoverProofUrl && !a.sellerBonusReleased)
            .map(a => a.id)
        if (submittedIds.length > 0) {
            setHandoverDone(prev => new Set([...prev, ...submittedIds]))
        }
    }, [auctions])

    async function handleHandoverUpload(auctionId: string, file: File) {
        setHandoverUploading(auctionId)
        setHandoverError(prev => ({ ...prev, [auctionId]: "" }))
        try {
            const url = await uploadImage(file, `handover/${auctionId}`)
            await apiClient(`/auctions/${auctionId}/handover-proof`, {
                method: "POST",
                body: JSON.stringify({ proofUrl: url }),
            })
            setHandoverDone(prev => new Set([...prev, auctionId]))
            setSuccessMsg("Handover proof submitted — your £100 bonus will be released after verification.")
        } catch (err: any) {
            setHandoverError(prev => ({ ...prev, [auctionId]: err.message || "Upload failed. Please try again." }))
        } finally {
            setHandoverUploading(null)
        }
    }

    // Auctions where handover is needed or pending — exclude fully approved ones
    const endedWithWinner = auctions.filter(a => a.status === "ENDED" && a.winnerId && !a.sellerBonusReleased)
    // Auctions where bonus has been approved — show a completion card
    const approvedHandovers = auctions.filter(a => a.status === "ENDED" && a.winnerId && a.sellerBonusReleased)

    async function handleConnectWithWinner(auction: Auction) {
        if (!auction.winnerId) return
        setConnectingChat(true)
        try {
            const room = await createChatRoom(auction.winnerId, auction.listingId)
            window.location.href = `/dashboard/seller/messages?room=${room.id}`
        } catch (err: any) {
            alert(err.message || "Failed to open chat")
        } finally {
            setConnectingChat(false)
        }
    }

    return (
        <>
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" />
                <main className="flex-1 space-y-6">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                        <div>
                            <h1 className="text-3xl font-bold font-heading text-white">My Auctions</h1>
                            <p className="text-gray-400 text-sm mt-1">Manage your live vehicle auctions and bidding</p>
                        </div>
                        <button
                            onClick={openForm}
                            className="inline-flex items-center gap-2 bg-primary text-white font-bold py-2.5 px-6 rounded-xl shadow-neon hover:bg-red-600 transition-colors"
                        >
                            <PlusCircle size={18} />
                            Create Auction
                        </button>
                    </div>

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
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                className="glass-card overflow-hidden"
                            >
                                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Gavel size={18} className="text-primary" />
                                        <h2 className="font-bold text-white text-lg">Schedule New Auction</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleCreate} className="p-5 space-y-4">
                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                            <AlertCircle size={16} />
                                            {formError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Listing select */}
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Select Listing
                                            </label>
                                            <select
                                                value={formListingId}
                                                onChange={e => setFormListingId(e.target.value)}
                                                className="w-full bg-slate-800 border border-white/10 text-white rounded-lg h-11 px-3 text-sm focus:ring-1 focus:ring-primary/50 focus:outline-none"
                                            >
                                                <option value="">— Choose an AUCTION-type listing —</option>
                                                {eligibleListings.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.title} — {l.year} {l.make} {l.model}
                                                    </option>
                                                ))}
                                            </select>
                                            {eligibleListings.length === 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    No eligible listings. Create an AUCTION-type listing first.
                                                </p>
                                            )}
                                        </div>

                                        {/* Start time */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Start Date & Time
                                            </label>
                                            <Input
                                                type="datetime-local"
                                                value={formStartTime}
                                                onChange={e => setFormStartTime(e.target.value)}
                                                min={new Date(Date.now() + 30 * 60_000).toISOString().slice(0, 16)}
                                                className="bg-slate-800 border-white/10 text-white h-11 rounded-lg"
                                            />
                                        </div>

                                        {/* Duration read-only */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Duration
                                            </label>
                                            <div className="flex items-center gap-2 h-11 px-3 bg-slate-800/50 border border-white/5 rounded-lg text-gray-400 text-sm">
                                                <Clock size={14} className="text-primary shrink-0" />
                                                <span>24 hours · Open bidding</span>
                                                {formStartTime && (
                                                    <span className="ml-auto text-xs text-gray-600 shrink-0">
                                                        ends {addHours(new Date(formStartTime).toISOString(), 24)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reserve price */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Reserve Price (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 15000"
                                                value={formReservePrice}
                                                onChange={e => setFormReservePrice(e.target.value)}
                                                className="bg-slate-800 border-white/10 text-white h-11 rounded-lg"
                                            />
                                        </div>

                                        {/* Starting bid */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Starting Bid (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 10000"
                                                value={formStartingBid}
                                                onChange={e => setFormStartingBid(e.target.value)}
                                                className="bg-slate-800 border-white/10 text-white h-11 rounded-lg"
                                            />
                                        </div>

                                        {/* Min increment */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                                Minimum Bid Increment (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={formMinIncrement}
                                                onChange={e => setFormMinIncrement(e.target.value)}
                                                className="bg-slate-800 border-white/10 text-white h-11 rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowForm(false)}
                                            className="px-5 py-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 transition-colors text-sm font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 text-sm"
                                        >
                                            {submitting
                                                ? <Loader2 size={15} className="animate-spin" />
                                                : <Gavel size={15} />
                                            }
                                            Schedule Auction
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Auctions table */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Schedule</th>
                                        <th className="px-6 py-4 text-right">Current Bid</th>
                                        <th className="px-6 py-4 text-center">Bids</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center">
                                                <div className="flex items-center justify-center gap-2 text-red-400">
                                                    <AlertCircle size={16} />
                                                    <span className="text-sm">{error}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : auctions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                <Gavel className="h-10 w-10 text-gray-700 mx-auto mb-2" />
                                                <p className="font-bold">No auctions yet.</p>
                                                <button
                                                    onClick={openForm}
                                                    className="mt-3 inline-flex items-center gap-1.5 text-primary hover:underline text-sm font-bold"
                                                >
                                                    <PlusCircle size={14} /> Create your first auction
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        auctions.map(auction => (
                                            <tr key={auction.id} className="hover:bg-white/5 transition-colors">
                                                {/* Vehicle */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {auction.listing.images?.[0] && (
                                                            <img
                                                                src={auction.listing.images[0]}
                                                                alt=""
                                                                className="w-14 h-10 rounded object-cover"
                                                            />
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-white">{auction.listing.title}</div>
                                                            <div className="text-xs text-gray-400">
                                                                {auction.listing.year} · {auction.listing.make} {auction.listing.model}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[auction.status] ?? STATUS_STYLES.ENDED}`}>
                                                        {auction.status === "ACTIVE" && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                                                        )}
                                                        {auction.status}
                                                    </span>
                                                </td>

                                                {/* Schedule */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                            <Calendar size={11} />
                                                            {formatDate(auction.startTime)}
                                                        </div>
                                                        {auction.status === "ACTIVE" ? (
                                                            <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
                                                                <Clock size={11} />
                                                                <span key={tick}>{formatCountdown(new Date(auction.endTime))}</span>
                                                            </div>
                                                        ) : auction.status === "SCHEDULED" ? (
                                                            <div className="text-xs text-blue-400">
                                                                Starts in {formatCountdown(new Date(auction.startTime))}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </td>

                                                {/* Current bid */}
                                                <td className="px-6 py-4 text-right font-mono font-bold">
                                                    £{getCurrentBid(auction).toLocaleString()}
                                                </td>

                                                {/* Bids */}
                                                <td className="px-6 py-4 text-center text-gray-400">
                                                    {getBidCount(auction)}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        {auction.status === "ACTIVE" && (
                                                            <Link
                                                                href={`/auctions/live/${auction.id}`}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                                                            >
                                                                <Eye size={13} /> View Live
                                                            </Link>
                                                        )}
                                                        {auction.status === "SCHEDULED" && (
                                                            <button
                                                                disabled={cancelling === auction.id}
                                                                onClick={() => handleCancel(auction.id)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                            >
                                                                {cancelling === auction.id
                                                                    ? <Loader2 size={13} className="animate-spin" />
                                                                    : <XCircle size={13} />
                                                                }
                                                                Cancel
                                                            </button>
                                                        )}
                                                        {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                                                            <button
                                                                onClick={() => setResultsAuction(auction)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
                                                            >
                                                                <BarChart2 size={13} /> Results
                                                            </button>
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
                    {/* ── Approved Handovers ──────────────────────────────── */}
                    {approvedHandovers.length > 0 && (
                        <div className="space-y-3">
                            {approvedHandovers.map(auction => (
                                <div key={auction.id} className="glass-card p-4 flex items-center gap-4 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <CheckCircle size={18} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm">{auction.listing?.title}</p>
                                        <p className="text-xs text-emerald-400 mt-0.5">Handover verified — £100 seller bonus released</p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">Complete</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Handover Proof Section ──────────────────────────── */}
                    {endedWithWinner.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Handshake size={16} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white">Handover Completion</h2>
                                    <p className="text-xs text-gray-400">Upload proof to receive your £100 seller bonus</p>
                                </div>
                            </div>

                            {endedWithWinner.map(auction => {
                                const isDone = handoverDone.has(auction.id)
                                const isUploading = handoverUploading === auction.id
                                const err = handoverError[auction.id]
                                const winningBid = Number(auction.winningBidAmount)

                                return (
                                    <div key={auction.id} className="glass-card p-5 space-y-4">
                                        {/* Auction info */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {auction.listing.images?.[0] && (
                                                    <img src={auction.listing.images[0]} alt="" className="w-14 h-10 rounded object-cover shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-bold text-white truncate">{auction.listing.title}</p>
                                                    <p className="text-xs text-gray-400">{auction.listing.year} · {auction.listing.make} {auction.listing.model}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Winning Bid</p>
                                                <p className="text-lg font-black text-white font-mono">£{winningBid.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Fee summary */}
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5">
                                                <p className="text-gray-500 text-[9px] uppercase tracking-widest mb-0.5">Your Bonus</p>
                                                <p className="text-emerald-400 font-black text-base">£100</p>
                                                <p className="text-gray-600 text-[9px]">after handover verified</p>
                                            </div>
                                            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                                                <p className="text-gray-500 text-[9px] uppercase tracking-widest mb-0.5">Platform Fee</p>
                                                <p className="text-white font-black text-base">£25</p>
                                                <p className="text-gray-600 text-[9px]">non-refundable</p>
                                            </div>
                                            <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5">
                                                <p className="text-gray-500 text-[9px] uppercase tracking-widest mb-0.5">Buyer Paid</p>
                                                <p className="text-white font-black text-base">£125</p>
                                                <p className="text-gray-600 text-[9px]">total buyer fee</p>
                                            </div>
                                        </div>

                                        {isDone ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                <CheckCircle size={16} className="shrink-0" />
                                                <div>
                                                    <p className="text-sm font-bold">Handover proof submitted</p>
                                                    <p className="text-xs text-emerald-400/70">Your £100 bonus is pending verification — we'll notify you once released.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-gray-400">
                                                    <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <span>Upload a photo or document showing the vehicle was handed over — e.g. a signed receipt, photo with the buyer, or logbook transfer confirmation.</span>
                                                </div>

                                                {err && (
                                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                                        <AlertCircle size={13} className="shrink-0" />
                                                        {err}
                                                    </div>
                                                )}

                                                <label className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none" : "border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5"}`}>
                                                    <input
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        className="sr-only"
                                                        disabled={isUploading}
                                                        onChange={e => {
                                                            const file = e.target.files?.[0]
                                                            if (file) handleHandoverUpload(auction.id, file)
                                                        }}
                                                    />
                                                    {isUploading ? (
                                                        <Loader2 size={24} className="text-emerald-400 animate-spin" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                                            <ImageIcon size={22} className="text-emerald-400" />
                                                        </div>
                                                    )}
                                                    <div className="text-center">
                                                        <p className="text-sm font-bold text-white">
                                                            {isUploading ? "Uploading proof..." : "Upload Handover Proof"}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {isUploading ? "Please wait" : "JPG, PNG or PDF · Click or drag to upload"}
                                                        </p>
                                                    </div>
                                                    {!isUploading && (
                                                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs">
                                                            <Upload size={12} /> Choose File
                                                        </span>
                                                    )}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>

        {/* Auction Results Modal */}

        {resultsAuction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setResultsAuction(null) }}>
                <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <BarChart2 size={16} className="text-primary" />
                            </div>
                            <div>
                                <h2 className="font-bold text-white">Auction Results</h2>
                                <p className="text-xs text-gray-500 truncate max-w-[260px]">{resultsAuction.listing.title}</p>
                            </div>
                        </div>
                        <button onClick={() => setResultsAuction(null)} className="p-2 text-gray-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Status banner */}
                        {resultsAuction.winnerId ? (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Trophy size={20} className="text-amber-400 shrink-0" />
                                <div>
                                    <p className="font-bold text-amber-300 text-sm">Auction Sold</p>
                                    <p className="text-xs text-gray-400">Winner: <span className="text-white font-semibold">
                                        {resultsAuction.winner
                                            ? `${resultsAuction.winner.firstName || ""} ${resultsAuction.winner.lastName || ""}`.trim() || "Anonymous Bidder"
                                            : "Anonymous Bidder"}
                                    </span></p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
                                <XCircle size={20} className="text-gray-400 shrink-0" />
                                <div>
                                    <p className="font-bold text-gray-300 text-sm">No Winner</p>
                                    <p className="text-xs text-gray-500">Reserve price not met or no bids placed</p>
                                </div>
                            </div>
                        )}

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-slate-800/50 border border-white/5 p-3 text-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Winning Bid</p>
                                <p className="text-lg font-black text-white font-mono">
                                    {resultsAuction.winningBidAmount
                                        ? `£${Number(resultsAuction.winningBidAmount).toLocaleString()}`
                                        : "—"}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-800/50 border border-white/5 p-3 text-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Bids</p>
                                <p className="text-lg font-black text-white">
                                    {getBidCount(resultsAuction)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-slate-800/50 border border-white/5 p-3 text-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reserve</p>
                                <p className="text-lg font-black text-white font-mono">
                                    £{Number(resultsAuction.reservePrice).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="space-y-2 text-xs text-gray-400">
                            <div className="flex justify-between">
                                <span>Started</span>
                                <span className="text-white">{formatDate(resultsAuction.startTime)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ended</span>
                                <span className="text-white">{formatDate(resultsAuction.endTime)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Starting Bid</span>
                                <span className="text-white font-mono">£{Number(resultsAuction.startingBid).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-1">
                            <Link
                                href={`/auctions/live/${resultsAuction.id}`}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-gray-300 text-sm font-bold hover:bg-slate-700 transition-colors"
                            >
                                <Eye size={14} /> View Auction
                            </Link>
                            {resultsAuction.winnerId ? (
                                <button
                                    onClick={() => handleConnectWithWinner(resultsAuction)}
                                    disabled={connectingChat}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                                >
                                    {connectingChat
                                        ? <Loader2 size={14} className="animate-spin" />
                                        : <MessageSquare size={14} />
                                    }
                                    Connect with Winner
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setResultsAuction(null)
                                        setFormListingId(resultsAuction.listingId)
                                        openForm()
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-red-600 text-white text-sm font-bold transition-colors"
                                >
                                    <Gavel size={14} /> Re-auction
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
