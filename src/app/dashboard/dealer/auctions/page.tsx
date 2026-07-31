"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gavel, PlusCircle, Loader2, Eye, XCircle, Clock,
    ChevronRight, AlertCircle, CheckCircle2, Calendar, X, Tags, Star,
    Upload, Handshake, Info, CheckCircle, ImageIcon, BarChart2,
} from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useAuth } from "@/context/AuthContext"
import { useSearchParams } from "next/navigation"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"
import {
    getMyAuctions, createAuction, cancelAuction, updateAuctionDigest,
    getCurrentBid, getBidCount,
    type Auction, type CreateAuctionRequest,
} from "@/lib/auctionApi"
import { apiClient } from "@/lib/apiClient"
import { uploadImage } from "@/lib/supabase"
import { createChatRoom } from "@/lib/chatApi"
import { AuctionResultsModal } from "@/components/auctions/AuctionResultsModal"
import { getStripeConnectStatus, type StripeConnectStatus, type Listing } from "@/lib/listingApi"

const STATUS_STYLES: Record<string, string> = {
    SCHEDULED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    ENDED: "bg-gray-500/10 text-[var(--text-muted)] border-gray-500/20",
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

// A plain grey "ENDED" pill hides the one thing a seller actually needs to
// know: whether there's something left to do. Mirrors the same badge on
// /dashboard/seller/auctions so both auction-selling surfaces read the same way.
function AuctionStatusBadge({ auction }: { auction: Auction }) {
    const needsHandover = auction.status === "ENDED" && !!auction.winnerId && !auction.sellerBonusReleased
    const approved = auction.status === "ENDED" && !!auction.winnerId && auction.sellerBonusReleased
    // sellerBonusReleased means the handover was approved — it doesn't guarantee
    // the £100 actually arrived (auto-transfer can fail or be skipped if no
    // payout method is connected), so "Paid" is only shown once it truly has.
    const paidOut = approved && (!!auction.stripePayoutTransferId || !!auction.manualPayoutConfirmedAt)

    if (needsHandover) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/25 animate-pulse">
                <Handshake size={10} /> Action Needed
            </span>
        )
    }
    if (paidOut) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <CheckCircle size={10} /> Ended · Paid
            </span>
        )
    }
    if (approved) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
                <CheckCircle size={10} /> Ended · Payout Processing
            </span>
        )
    }
    return (
        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black tracking-widest border ${STATUS_STYLES[auction.status] ?? STATUS_STYLES.ENDED}`}>
            {auction.status === "ACTIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5 self-center inline-block" />}
            {auction.status}
        </span>
    )
}

export default function DealerAuctionsPageWrapper() {
    return (
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
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
    // Digest — custom tags & self-rating on your own auction
    const [digestAuction,  setDigestAuction]  = React.useState<Auction | null>(null)
    const [digestTagsInput, setDigestTagsInput] = React.useState("")
    const [digestRating,   setDigestRating]   = React.useState<number | null>(null)
    const [digestLoading,  setDigestLoading]  = React.useState(false)
    const [digestError,    setDigestError]    = React.useState<string | null>(null)
    const [payoutStatus, setPayoutStatus] = React.useState<StripeConnectStatus | null>(null)

    // ── Handover proof upload ─────────────────────────────────────────────────
    const [handoverUploading, setHandoverUploading] = React.useState<string | null>(null)
    const [handoverDone, setHandoverDone] = React.useState<Set<string>>(new Set())
    const [handoverError, setHandoverError] = React.useState<Record<string, string>>({})

    // Form state
    const [formListingId, setFormListingId] = React.useState(preselectedListingId)
    const [formStartTime, setFormStartTime] = React.useState("")
    const [formReservePrice, setFormReservePrice] = React.useState("")
    const [formStartingBid, setFormStartingBid] = React.useState("")
    const [formMinIncrement, setFormMinIncrement] = React.useState("100")
    const [formBuyItNowPrice, setFormBuyItNowPrice] = React.useState("")
    const [submitting, setSubmitting] = React.useState(false)
    const [formError, setFormError] = React.useState<string | null>(null)
    const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
    const [resultsAuction, setResultsAuction] = React.useState<Auction | null>(null)
    const [connectingChat, setConnectingChat] = React.useState(false)

    // Countdown tick every second
    React.useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000)
        return () => clearInterval(id)
    }, [])

    React.useEffect(() => {
        if (user) getStripeConnectStatus().then(setPayoutStatus).catch(() => {})
    }, [user])

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
            const url = await uploadImage(file, 'listings', `handover/${auctionId}`)
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
            const [listingsRes, freshAuctions] = await Promise.all([
                apiClient<{ data: Listing[] }>("/listings/my"),
                getMyAuctions(),
            ])
            const listed = listingsRes?.data ?? []
            const auctionListingIds = new Set(
                (freshAuctions ?? [])
                    .filter(a => a.status === "SCHEDULED" || a.status === "ACTIVE")
                    .map(a => a.listingId)
            )
            setEligibleListings(
                listed.filter(l =>
                    l.status === "ACTIVE" &&
                    !auctionListingIds.has(l.id) &&
                    !(l as any).linkedListingId
                )
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
                ...(formBuyItNowPrice && Number(formBuyItNowPrice) > 0
                    ? { buyItNowPrice: Number(formBuyItNowPrice) }
                    : {}),
            }
            await createAuction(dto)
            const endDisplay = addHours(new Date(formStartTime).toISOString(), 24)
            setSuccessMsg(`Auction scheduled! It will run until ${endDisplay}.`)
            setShowForm(false)
            setFormListingId(""); setFormStartTime(""); setFormReservePrice("")
            setFormStartingBid(""); setFormMinIncrement("100"); setFormBuyItNowPrice("")
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

    function openDigest(auction: Auction) {
        setDigestAuction(auction)
        setDigestTagsInput((auction.customTags ?? []).join(', '))
        setDigestRating(auction.sellerSelfRating ?? null)
        setDigestError(null)
    }

    async function handleDigestSubmit() {
        if (!digestAuction) return
        const customTags = digestTagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10)
        setDigestLoading(true)
        setDigestError(null)
        try {
            const updated = await updateAuctionDigest(digestAuction.id, {
                customTags,
                ...(digestRating ? { sellerSelfRating: digestRating } : {}),
            })
            setAuctions(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
            setDigestAuction(null)
        } catch (err: any) {
            setDigestError(err.message ?? 'Failed to save digest')
        } finally {
            setDigestLoading(false)
        }
    }

    async function handleConnectWithWinner(auction: Auction) {
        if (!auction.winnerId) return
        setConnectingChat(true)
        try {
            const room = await createChatRoom(auction.winnerId, auction.listingId)
            window.location.href = `/dashboard/dealer/messages?room=${room.id}`
        } catch (err: any) {
            alert(err.message || "Failed to open chat")
        } finally {
            setConnectingChat(false)
        }
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split("@")[0] || "Dealer")

    const auctionRoute = DEALER_ROUTE_CONFIG.find(r => r.href === "/dashboard/dealer/auctions")

    // Auctions where handover is needed or pending — exclude fully approved ones
    const endedWithWinner = auctions.filter(a => a.status === "ENDED" && a.winnerId && !a.sellerBonusReleased)
    // Auctions where bonus has been approved — show a completion card
    const approvedHandovers = auctions.filter(a => a.status === "ENDED" && a.winnerId && a.sellerBonusReleased)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 space-y-6 min-w-0">
                    {/* Sticky so "Create Auction" stays reachable without scrolling
                        back up from deep inside a long auctions table */}
                    <div className="sticky top-20 z-20 bg-[var(--bg-body)]/95 backdrop-blur-md pt-2 -mt-2">
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
                    </div>

                    {/* Action needed — the single most important thing on this page when it applies,
                        so it sits above everything else instead of being a section you have to scroll
                        past the whole table to discover on your own. */}
                    {endedWithWinner.length > 0 && (
                        <button
                            type="button"
                            onClick={() => document.getElementById('handover-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="w-full flex items-center gap-4 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-colors text-left"
                        >
                            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                <Handshake size={20} className="text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-amber-300 text-base">
                                    {endedWithWinner.length} auction{endedWithWinner.length > 1 ? "s" : ""} waiting on you
                                </p>
                                <p className="text-sm text-amber-300/80 mt-0.5">
                                    Upload handover proof to get your £100 bonus released.
                                </p>
                            </div>
                            <ChevronRight size={18} className="text-amber-400 shrink-0" />
                        </button>
                    )}

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
                                <div className="p-6 border-b border-[var(--border-default)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10">
                                            <Gavel size={18} className="text-primary" />
                                        </div>
                                        <h2 className="font-black text-lg tracking-tight">New Auction</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowForm(false)}
                                        className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors"
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
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Select Listing (AUCTION type)
                                            </label>
                                            <select
                                                value={formListingId}
                                                onChange={e => setFormListingId(e.target.value)}
                                                className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl h-12 px-4 text-sm focus:ring-1 focus:ring-primary/50 focus:outline-none"
                                            >
                                                <option value="">— Select a listing —</option>
                                                {eligibleListings.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.title} — {l.year} {l.make} {l.model}
                                                    </option>
                                                ))}
                                            </select>
                                            {eligibleListings.length === 0 && (
                                                <p className="text-xs text-[var(--text-muted)] mt-1.5">
                                                    No eligible AUCTION-type listings. Create an auction listing first.
                                                </p>
                                            )}
                                        </div>

                                        {/* Start time */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Start Date & Time
                                            </label>
                                            <Input
                                                type="datetime-local"
                                                value={formStartTime}
                                                onChange={e => setFormStartTime(e.target.value)}
                                                min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Duration (read-only) */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Duration
                                            </label>
                                            <div className="flex items-center gap-2 h-12 px-4 bg-white/[0.03] border border-[var(--border-default)] rounded-xl text-[var(--text-muted)] text-sm">
                                                <Clock size={14} className="text-primary" />
                                                24 hours (fixed)
                                                {formStartTime && (
                                                    <span className="ml-auto text-xs text-gray-600">
                                                        ends {addHours(new Date(formStartTime).toISOString(), 24)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Reserve price */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Reserve Price (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 15000"
                                                value={formReservePrice}
                                                onChange={e => setFormReservePrice(e.target.value)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Buy It Now price (optional) */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Buy It Now Price (optional)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="Leave blank to disable"
                                                value={formBuyItNowPrice}
                                                onChange={e => setFormBuyItNowPrice(e.target.value)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                            <p className="text-xs text-gray-600 mt-1">
                                                Buyers can request to buy at this price. Locked once auction goes live.
                                            </p>
                                        </div>

                                        {/* Starting bid */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Starting Bid (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                placeholder="e.g. 10000"
                                                value={formStartingBid}
                                                onChange={e => setFormStartingBid(e.target.value)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Min increment */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                                                Minimum Increment (£)
                                            </label>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={formMinIncrement}
                                                onChange={e => setFormMinIncrement(e.target.value)}
                                                className="bg-[var(--bg-input)] border-[var(--border-default)] h-12 rounded-xl focus:ring-1 focus:ring-primary/50"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowForm(false)}
                                            className="border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-white/10 h-10 px-5 rounded-xl"
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

                        {/* ── Mobile cards (< sm) ── */}
                        <div className="sm:hidden divide-y divide-white/[0.03]">
                            {auctions.map(auction => (
                                <div key={auction.id} className="p-4 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-11 bg-black/40 rounded-xl overflow-hidden border border-[var(--border-default)] shrink-0 relative">
                                            {auction.listing.images?.[0] ? (
                                                <Image src={auction.listing.images[0]} alt="" fill sizes="64px" className="object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]"><Gavel size={18} /></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-sm truncate">{auction.listing.title}</p>
                                            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-widest">{auction.listing.year} · {auction.listing.make}</p>
                                        </div>
                                        <div className="shrink-0"><AuctionStatusBadge auction={auction} /></div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-lg font-black">£{getCurrentBid(auction).toLocaleString()}</p>
                                            <p className="text-xs text-gray-600 font-bold uppercase">{getBidCount(auction) === 0 ? 'Starting bid' : `${getBidCount(auction)} bids`}</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            {auction.status === "ACTIVE" ? (
                                                <p className="text-primary font-black" key={tick}>{formatCountdown(new Date(auction.endTime))}</p>
                                            ) : auction.status === "SCHEDULED" ? (
                                                <p className="text-blue-400 font-bold">Starts in {formatCountdown(new Date(auction.startTime))}</p>
                                            ) : (
                                                <p className="text-[var(--text-muted)] font-bold">{formatDate(auction.endTime)}</p>
                                            )}
                                        </div>
                                    </div>
                                    {auction.status === "ACTIVE" && (
                                        <Link href={`/auctions/live/${auction.id}`} className="w-full min-h-[46px] flex items-center justify-center rounded-xl bg-emerald-500 text-white font-bold text-sm">View live auction</Link>
                                    )}
                                    {(auction.status === "ACTIVE" || auction.status === "SCHEDULED") && (
                                        <button onClick={() => openDigest(auction)} className="w-full min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 text-violet-400 font-bold text-sm">
                                            <Tags size={16} /> Digest
                                        </button>
                                    )}
                                    {auction.status === "SCHEDULED" && (
                                        <button onClick={() => handleCancel(auction.id)} disabled={cancelling === auction.id} className="w-full min-h-[46px] rounded-xl border border-red-500/30 text-red-400 font-bold text-sm disabled:opacity-50">
                                            {cancelling === auction.id ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Cancel auction'}
                                        </button>
                                    )}
                                    {(auction.status === "ENDED" || auction.status === "CANCELLED") && (
                                        <button onClick={() => setResultsAuction(auction)} className="w-full min-h-[46px] flex items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] font-bold text-sm">View results</button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* ── Desktop table (≥ sm) ── */}
                        <div className="hidden sm:block overflow-x-auto border-t border-[var(--border-default)]">
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
                                                <Gavel className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
                                                <p className="text-[var(--text-muted)] font-bold">No auctions yet</p>
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
                                                        <div className="w-20 h-14 bg-black/40 rounded-xl overflow-hidden border border-[var(--border-default)] flex-shrink-0 group-hover:scale-105 transition-transform duration-500 shadow-2xl relative">
                                                            {auction.listing.images?.[0] ? (
                                                                <Image
                                                                    src={auction.listing.images[0]}
                                                                    alt=""
                                                                    fill
                                                                    sizes="80px"
                                                                    className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                                                                    <Gavel size={20} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-base tracking-tight group-hover:text-primary transition-colors">
                                                                {auction.listing.title}
                                                            </p>
                                                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">
                                                                {auction.listing.year} · {auction.listing.make} {auction.listing.model}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Status */}
                                                <td className="px-6 py-6 text-center">
                                                    <AuctionStatusBadge auction={auction} />
                                                </td>

                                                {/* Schedule */}
                                                <td className="px-6 py-6">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
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
                                                        <span className="font-black text-lg tracking-tight">
                                                            £{getCurrentBid(auction).toLocaleString()}
                                                        </span>
                                                        <span className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                                                            {getBidCount(auction) === 0 ? "starting bid" : "current bid"}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Bid count */}
                                                <td className="px-6 py-6 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-black text-sm">{getBidCount(auction)}</span>
                                                        <div className="w-12 h-1 bg-[var(--bg-card)] rounded-full overflow-hidden">
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
                                                        {(auction.status === "ACTIVE" || auction.status === "SCHEDULED") && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openDigest(auction)}
                                                                className="gap-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20"
                                                            >
                                                                <Tags size={14} /> Digest
                                                            </Button>
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
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setResultsAuction(auction)}
                                                                className="gap-1.5 bg-[var(--bg-card)] hover:bg-white/10 text-[var(--text-muted)] border border-[var(--border-default)]"
                                                            >
                                                                <BarChart2 size={14} /> View Results
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}
                    </div>

                    {/* ── Approved Handovers ──────────────────────────────── */}
                    {approvedHandovers.length > 0 && (
                        <div className="space-y-3">
                            {approvedHandovers.map(auction => {
                                const paid = !!auction.stripePayoutTransferId || !!auction.manualPayoutConfirmedAt
                                return (
                                <div key={auction.id} className="dealer-glass-card p-4 flex items-center gap-4 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <CheckCircle size={18} className="text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm">{auction.listing?.title}</p>
                                        <p className="text-xs text-emerald-400 mt-0.5">
                                            {paid ? "Handover verified — £100 seller bonus released" : "Handover verified — £100 bonus is being processed"}
                                        </p>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                                        {paid ? "Complete" : "Processing"}
                                    </span>
                                </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ── Handover Proof Section ──────────────────────────── */}
                    {endedWithWinner.length > 0 && (
                        <div id="handover-section" className="space-y-4 scroll-mt-24">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Handshake size={16} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="font-bold">Handover Completion</h2>
                                    <p className="text-xs text-[var(--text-muted)]">Upload proof to receive your £100 seller bonus</p>
                                </div>
                            </div>

                            {payoutStatus !== null && !payoutStatus.onboardingComplete && (
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div className="text-xs text-amber-300">
                                        <p className="font-bold mb-0.5">Payout method not set up</p>
                                        <p className="text-amber-300/70">
                                            Connect your bank account in{" "}
                                            <a href="/dashboard/dealer/settings" className="underline hover:text-amber-200">Settings → Payouts</a>
                                            {" "}to receive your £100 automatically after handover approval.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {endedWithWinner.map(auction => {
                                const isDone = handoverDone.has(auction.id)
                                const isUploading = handoverUploading === auction.id
                                const err = handoverError[auction.id]
                                const winningBid = Number(auction.winningBidAmount)

                                return (
                                    <div key={auction.id} className="dealer-glass-card p-5 space-y-4">
                                        {/* Auction info */}
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {auction.listing.images?.[0] && (
                                                    <Image src={auction.listing.images[0]} alt="" width={56} height={40} className="w-14 h-10 rounded object-cover shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <p className="font-bold truncate">{auction.listing.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{auction.listing.year} · {auction.listing.make} {auction.listing.model}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Winning Bid</p>
                                                <p className="text-lg font-black font-mono">£{winningBid.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Fee summary — only the seller's own payout, not the
                                            full £125 breakdown (what the buyer pays and what
                                            Carmazium keeps is not the seller's business). */}
                                        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2.5 text-center text-xs">
                                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-widest mb-0.5">Your Bonus</p>
                                            <p className="text-emerald-400 font-black text-base">£100</p>
                                            <p className="text-[var(--text-secondary)] text-xs">after handover verified</p>
                                        </div>

                                        {isDone ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                <CheckCircle size={16} className="shrink-0" />
                                                <div>
                                                    <p className="text-sm font-bold">Handover proof submitted</p>
                                                    <p className="text-xs text-emerald-400/70">Your £100 bonus is pending verification — we&apos;ll notify you once released.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-[var(--text-muted)]">
                                                    <Info size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <span>Upload a photo or document showing the vehicle was handed over — e.g. a signed receipt, photo with the buyer, or logbook transfer confirmation.</span>
                                                </div>

                                                {err && (
                                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                                                        <AlertCircle size={13} className="shrink-0" />
                                                        {err}
                                                    </div>
                                                )}

                                                <label className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none" : "border-[var(--border-default)] hover:border-emerald-500/40 hover:bg-emerald-500/5"}`}>
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
                                                        <p className="text-sm font-bold">
                                                            {isUploading ? "Uploading proof..." : "Upload Handover Proof"}
                                                        </p>
                                                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
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

            {resultsAuction && (
                <AuctionResultsModal
                    auction={resultsAuction}
                    onClose={() => setResultsAuction(null)}
                    onReauction={(a) => {
                        setResultsAuction(null)
                        setFormListingId(a.listingId)
                        openForm()
                    }}
                    onConnectWithWinner={handleConnectWithWinner}
                    connectingChat={connectingChat}
                />
            )}

            {digestAuction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                    <Tags size={16} className="text-violet-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-sm">Digest</p>
                                    <p className="text-[var(--text-muted)] text-xs truncate max-w-[180px]">{digestAuction.listing?.title}</p>
                                </div>
                            </div>
                            <button onClick={() => setDigestAuction(null)} className="text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        <p className="text-xs text-[var(--text-muted)]">Add your own custom tags/batch labels and a self-rating to this listing — shown to buyers on the auction page.</p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">Custom Tags (comma-separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Track Day Ready, One Owner"
                                    value={digestTagsInput}
                                    onChange={e => setDigestTagsInput(e.target.value)}
                                    className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 h-10 text-sm focus:outline-none focus:border-primary/50"
                                />
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">Up to 10 tags, 30 characters each.</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">Self-Rating</label>
                                <div className="flex gap-1.5">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setDigestRating(prev => prev === n ? null : n)}
                                            className="p-1"
                                        >
                                            <Star
                                                size={22}
                                                className={(digestRating ?? 0) >= n ? "text-amber-400 fill-amber-400" : "text-[var(--text-muted)]"}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {digestError && <p className="text-red-400 text-xs">{digestError}</p>}

                        <button
                            onClick={handleDigestSubmit}
                            disabled={digestLoading}
                            className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {digestLoading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Tags size={14} /> Save Digest</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
