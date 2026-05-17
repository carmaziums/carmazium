"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, PlusCircle, Loader2, Eye, XCircle, Clock,
    ChevronRight, AlertCircle, CheckCircle2, Calendar, X
} from "lucide-react"
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
                listed.filter(l => l.type === "AUCTION" && l.status === "ACTIVE" && !auctionListingIds.has(l.id))
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
        if (startMs < Date.now() + 60 * 60 * 1000) {
            setFormError("Start time must be at least 1 hour in the future.")
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
            const endDisplay = addHours(new Date(formStartTime).toISOString(), 6)
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

    return (
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
                                                min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
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
                                                <span>6 hours · Open bidding</span>
                                                {formStartTime && (
                                                    <span className="ml-auto text-xs text-gray-600 shrink-0">
                                                        ends {addHours(new Date(formStartTime).toISOString(), 6)}
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
                                                            <Link
                                                                href={`/auctions/live/${auction.id}`}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
                                                            >
                                                                <ChevronRight size={13} /> Results
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
