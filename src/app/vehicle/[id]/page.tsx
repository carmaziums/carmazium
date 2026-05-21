"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AccordionItem } from "@/components/ui/Accordion"
import dynamic from "next/dynamic"
const FinanceCalculator = dynamic(() => import("@/components/features/FinanceCalculator").then(mod => mod.FinanceCalculator), { ssr: false })
import {
    ArrowLeft, Camera, CheckCircle, ShieldCheck, Cog, Music, Car as CarIcon,
    MapPin, Share2, Heart, Scale, Loader2, AlertTriangle, X, Tag,
    Clock, XCircle, MessageCircle, ThumbsUp, Lock, FileSearch, BadgeCheck, Star, Sparkles, Zap, CreditCard, Info, Phone, Globe, Wrench,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { SellerBadge } from "@/components/ui/SellerBadge"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { EnquireModal } from "@/components/listing/EnquireModal"
import { getListingBySlug, makeOffer, getMyOfferForListing, respondToCounterOffer, addToWatchlist, removeFromWatchlist, isInWatchlist as checkWatchlist, formatPrice, type Listing, type LatestOffer } from "@/lib/listingApi"
import { createChatRoom } from "@/lib/chatApi"
import { useRouter } from "next/navigation"

// ─── Offer Status Chip ───────────────────────────────────────────────────────

function OfferStatusChip({ offer, viewerRole }: { offer: LatestOffer; viewerRole: 'buyer' | 'seller' | 'public' }) {
    const amountDisplay = `£${Number(offer.amount).toLocaleString('en-GB')}`

    if (viewerRole === 'buyer') {
        if (offer.status === 'PENDING') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>Your offer of <strong>{amountDisplay}</strong> is awaiting the seller&apos;s response.</span>
            </div>
        )
        if (offer.status === 'REJECTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>Your offer of <strong>{amountDisplay}</strong> was declined. You may submit a new one.</span>
            </div>
        )
        if (offer.status === 'ACCEPTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <ThumbsUp size={14} className="shrink-0" />
                <span>🎉 Your offer of <strong>{amountDisplay}</strong> was accepted! Contact the seller to proceed.</span>
            </div>
        )
        if (offer.status === 'WITHDRAWN') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-500/10 border border-gray-500/30 text-gray-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>Your previous offer of <strong>{amountDisplay}</strong> was withdrawn. You can make a new offer.</span>
            </div>
        )
        if (offer.status === 'COUNTERED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>The seller countered your offer. Please review it in your dashboard.</span>
            </div>
        )
    }

    if (viewerRole === 'seller') {
        if (offer.status === 'PENDING') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>An offer of <strong>{amountDisplay}</strong> is awaiting your response. Manage it in your <strong>Seller Dashboard</strong>.</span>
            </div>
        )
        if (offer.status === 'ACCEPTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <ThumbsUp size={14} className="shrink-0" />
                <span>You accepted an offer of <strong>{amountDisplay}</strong> on this listing.</span>
            </div>
        )
        if (offer.status === 'REJECTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>An offer of <strong>{amountDisplay}</strong> was declined.</span>
            </div>
        )
        if (offer.status === 'COUNTERED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>You countered an offer on this listing. Awaiting buyer's response.</span>
            </div>
        )
    }

    const statusLabel =
        offer.status === 'PENDING' ? 'pending review' :
            offer.status === 'ACCEPTED' ? 'accepted' :
                offer.status === 'REJECTED' ? 'declined' :
                    offer.status === 'COUNTERED' ? 'countered' :
                        offer.status === 'WITHDRAWN' ? 'withdrawn' : ''

    return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
            <Tag size={14} className="shrink-0" />
            <span>An offer of <strong className="text-white">{amountDisplay}</strong> has been made on this listing{statusLabel ? ` — ${statusLabel}` : ''}.</span>
        </div>
    )
}

// ─── eBay-Style Proxy Bidding System ─────────────────────────────────────────

/**
 * Calculate the minimum bid increment based on the current bid level.
 * Follows eBay-style tier-based increments.
 */
function getBidIncrement(currentBid: number): number {
    if (currentBid < 1000) return 50
    if (currentBid < 5000) return 100
    if (currentBid < 15000) return 250
    if (currentBid < 50000) return 500
    if (currentBid < 100000) return 1000
    return 2500
}

/** Simulated bid history for demo — in production this comes from the API */
interface BidEntry {
    id: string
    bidder: string
    amount: number
    isProxy: boolean
    timestamp: string
}

function BidModal({
    listing,
    onClose,
    onSuccess,
}: {
    listing: Listing,
    onClose: () => void,
    onSuccess: (offer: LatestOffer) => void,
}) {
    const askingPrice = Number(listing.price)
    const sellerMin = Number(listing.priceMin) || Math.floor(askingPrice * 0.7)
    const sellerMax = Number(listing.priceMax) || askingPrice

    // Simulated current auction state (in production these come from the bidding API)
    const [currentBid, setCurrentBid] = React.useState(() => Math.floor(askingPrice * 0.85))
    const [bidCount, setBidCount] = React.useState(7)
    const [bidHistory, setBidHistory] = React.useState<BidEntry[]>(() => {
        const base = Math.floor(askingPrice * 0.7)
        const entries: BidEntry[] = []
        let running = base
        for (let i = 0; i < 7; i++) {
            running += getBidIncrement(running)
            entries.push({
                id: `bid-${i}`,
                bidder: i % 2 === 0 ? 'Bidder ***42' : 'Bidder ***87',
                amount: running,
                isProxy: i === 3 || i === 5,
                timestamp: new Date(Date.now() - (7 - i) * 3600000).toISOString(),
            })
        }
        return entries
    })

    const increment = getBidIncrement(currentBid)
    const minimumNextBid = currentBid + increment

    const [bidAmount, setBidAmount] = React.useState(minimumNextBid)
    const [maxBid, setMaxBid] = React.useState<string>('')
    const [showProxySection, setShowProxySection] = React.useState(false)
    const [message, setMessage] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [showHistory, setShowHistory] = React.useState(false)

    const isUnderMin = bidAmount < minimumNextBid
    const isOverMax = sellerMax > 0 && bidAmount > sellerMax
    const proxyAmount = maxBid ? Number(maxBid) : 0
    const isProxyInvalid = showProxySection && proxyAmount > 0 && proxyAmount < bidAmount

    const handleSubmit = async () => {
        if (isUnderMin || isOverMax || isProxyInvalid) return
        setLoading(true)
        setError(null)
        try {
            // The proxy max bid is sent as amountMax — the backend handles automatic incremental bidding
            const offer = await makeOffer(
                listing.id,
                bidAmount,
                message || undefined,
                undefined,
                showProxySection && proxyAmount > bidAmount ? proxyAmount : undefined
            )

            // Simulate the bid being placed — update local state
            const newEntry: BidEntry = {
                id: `bid-${Date.now()}`,
                bidder: 'You',
                amount: bidAmount,
                isProxy: showProxySection && proxyAmount > bidAmount,
                timestamp: new Date().toISOString(),
            }
            setBidHistory(prev => [...prev, newEntry])
            setCurrentBid(bidAmount)
            setBidCount(prev => prev + 1)

            onSuccess(offer as unknown as LatestOffer)
        } catch (err: any) {
            // Surface the backend's incremental-bidding error verbatim so the user sees
            // the actual current highest bid amount and required increment.
            const backendMessage = err?.message || err?.error || ""
            setError(
                backendMessage.toLowerCase().includes("higher")
                    ? backendMessage
                    : (backendMessage || "Failed to place bid. Please try again.")
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center overflow-y-auto p-4 sm:p-5"
            onClick={onClose}
        >
            <div
                className="glass-card p-0 max-w-lg w-full relative my-auto h-fit overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-red-600 to-amber-500 rounded-t-2xl" />

                {/* Header */}
                <div className="p-6 pb-4 border-b border-white/5">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                            <Tag size={18} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-heading text-white">Place a Bid</h2>
                            <p className="text-xs text-gray-400">{listing.title}</p>
                        </div>
                    </div>
                </div>

                {/* Current Auction State */}
                <div className="px-6 py-5 bg-slate-900/50 border-b border-white/5">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Asking Price</p>
                            <p className="text-sm font-bold text-gray-300 tabular-nums">£{askingPrice.toLocaleString('en-GB')}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-1">Current Bid</p>
                            <p className="text-2xl font-black text-white tabular-nums">£{currentBid.toLocaleString('en-GB')}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Bids</p>
                            <p className="text-sm font-bold text-gray-300 tabular-nums">{bidCount}</p>
                        </div>
                    </div>
                    {/* Increment notice */}
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
                        <Info size={10} />
                        <span>Minimum increment: <strong className="text-white">£{increment.toLocaleString('en-GB')}</strong></span>
                    </div>
                </div>

                {/* Bid Input Section */}
                <div className="p-6 space-y-5">
                    {/* Your Bid */}
                    <div>
                        <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">Your Bid</label>
                        <p className="text-xs text-gray-500 mb-3">Enter at least <strong className="text-white">£{minimumNextBid.toLocaleString('en-GB')}</strong> (current bid + £{increment.toLocaleString('en-GB')} increment).</p>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-bold">£</span>
                                <Input
                                    type="number"
                                    value={bidAmount}
                                    step={increment}
                                    min={minimumNextBid}
                                    onChange={(e) => setBidAmount(Number(e.target.value))}
                                    className="bg-slate-900/50 border-white/10 text-white pl-8 text-lg h-14 focus:border-primary font-bold tabular-nums"
                                />
                            </div>
                            {/* Quick increment buttons */}
                            <div className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => setBidAmount(prev => prev + increment)}
                                    className="h-6 px-3 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 rounded-md text-[10px] font-bold text-gray-400 hover:text-primary transition-all"
                                >+£{increment >= 1000 ? `${increment / 1000}k` : increment}</button>
                                <button
                                    type="button"
                                    onClick={() => setBidAmount(prev => Math.max(minimumNextBid, prev - increment))}
                                    className="h-6 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold text-gray-400 hover:text-white transition-all"
                                >-£{increment >= 1000 ? `${increment / 1000}k` : increment}</button>
                            </div>
                        </div>
                        {isUnderMin && (
                            <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                <AlertTriangle size={12} /> Bid must be at least £{minimumNextBid.toLocaleString('en-GB')}.
                            </p>
                        )}
                    </div>

                    {/* Proxy Bid Toggle */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowProxySection(!showProxySection)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                                    <Zap size={14} className="text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-white">Set Proxy Bid (Max Bid)</p>
                                    <p className="text-[10px] text-gray-500">We&apos;ll automatically bid on your behalf up to your max</p>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${showProxySection ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                                {showProxySection && <CheckCircle size={12} className="text-white" />}
                            </div>
                        </button>
                        {showProxySection && (
                            <div className="px-4 pb-4 border-t border-white/5">
                                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 mt-3 mb-3">
                                    <p className="text-[10px] text-blue-300 leading-relaxed">
                                        <strong>How proxy bidding works:</strong> Enter the maximum you&apos;re willing to pay. The system will bid the minimum needed to keep you as the highest bidder, up to your max. Other bidders only see the current bid, not your max.
                                    </p>
                                </div>
                                <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">Your Maximum (Hidden)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">£</span>
                                    <Input
                                        type="number"
                                        value={maxBid}
                                        step={increment}
                                        placeholder={`e.g. ${(bidAmount + increment * 5).toLocaleString('en-GB')}`}
                                        onChange={(e) => setMaxBid(e.target.value)}
                                        className="bg-slate-900/50 border-blue-500/20 text-white pl-8 h-12 focus:border-blue-400 font-bold tabular-nums"
                                    />
                                </div>
                                {isProxyInvalid && (
                                    <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                        <AlertTriangle size={12} /> Max bid must be higher than your current bid of £{bidAmount.toLocaleString('en-GB')}.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Message */}
                    <div>
                        <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">
                            Message <span className="text-gray-600 font-normal normal-case">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="e.g. I can collect this weekend."
                            rows={2}
                            maxLength={500}
                            className="w-full bg-slate-900/50 border border-white/10 text-white placeholder:text-gray-600 rounded-md p-3 text-sm resize-none focus:outline-none focus:border-primary"
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 shadow-neon"
                            disabled={loading || isUnderMin || isOverMax || isProxyInvalid}
                            onClick={handleSubmit}
                        >
                            {loading
                                ? <><Loader2 size={16} className="animate-spin mr-2" /> Placing Bid...</>
                                : <>Place Bid — £{bidAmount.toLocaleString('en-GB')}</>
                            }
                        </Button>
                    </div>
                </div>

                {/* Bid History */}
                <div className="border-t border-white/5">
                    <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full px-6 py-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/[0.02] transition-colors"
                    >
                        <span>Bid History ({bidHistory.length})</span>
                        <span className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {showHistory && (
                        <div className="px-6 pb-4 max-h-48 overflow-y-auto space-y-1.5">
                            {[...bidHistory].reverse().map((entry, i) => (
                                <div key={entry.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${i === 0 ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-white/[0.02]'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold ${i === 0 ? 'text-emerald-400' : 'text-gray-400'}`}>{entry.bidder}</span>
                                        {entry.isProxy && (
                                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">AUTO</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-black tabular-nums ${i === 0 ? 'text-white' : 'text-gray-300'}`}>£{entry.amount.toLocaleString('en-GB')}</span>
                                        <span className="text-gray-600 text-[10px]">
                                            {new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VehicleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const { user } = useAuth()

    const [listing, setListing] = React.useState<Listing | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeImage, setActiveImage] = React.useState(0)
    const [isDescExpanded, setIsDescExpanded] = React.useState(false)
    const [showOfferModal, setShowOfferModal] = React.useState(false)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [showEnquireModal, setShowEnquireModal] = React.useState(false)
    const [latestOffer, setLatestOffer] = React.useState<LatestOffer | null>(null)   // most recent offer on listing (any buyer) — public display
    const [myOffer, setMyOffer] = React.useState<LatestOffer | null>(null)            // this user's own offer — drives button state
    const [offerSuccess, setOfferSuccess] = React.useState(false)
    const [isWatchlisted, setIsWatchlisted] = React.useState(false)
    const [watchlistLoading, setWatchlistLoading] = React.useState(false)
    const [shareToast, setShareToast] = React.useState(false)
    const [enquiring, setEnquiring] = React.useState(false)

    const router = useRouter()

    const handleEnquire = async () => {
        if (!user) {
            router.push('/auth/login?redirect=' + encodeURIComponent(`/vehicle/${listing?.id}`))
            return
        }

        if (listing?.sellerId && user.id === listing.sellerId) {
            alert("This is your own listing.")
            return
        }

        if (!listing?.sellerId) {
            alert("Unable to contact the seller for this listing.")
            return
        }

        try {
            setEnquiring(true)
            const room = await createChatRoom(listing.sellerId, listing.id)
            router.push(`/dashboard/buyer/messages?room=${room.id}`)
        } catch (err: any) {
            console.error('Failed to create chat room:', err)
            alert(err.message || 'Failed to start enquiry. Please try again.')
        } finally {
            setEnquiring(false)
        }
    }

    // Fetch listing by slug/id
    React.useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const data = await getListingBySlug(id)
                setListing(data)
                // Show the global latest offer to everyone
                if (data.offers && data.offers.length > 0) {
                    setLatestOffer(data.offers[0])
                }
            } catch (err: any) {
                setError(err.message || "Failed to load listing")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id, user])

    // Separately fetch the current user's own offer for this listing
    React.useEffect(() => {
        if (!user || !listing) return
        if (listing.sellerId === user.id) return  // sellers can't make offers
        getMyOfferForListing(listing.id).then(setMyOffer).catch(() => { })
    }, [user, listing])

    // Check if listing is in user's watchlist
    React.useEffect(() => {
        if (!user || !listing) return
        checkWatchlist(listing.id).then(setIsWatchlisted).catch(() => { })
    }, [user, listing])


    // Determine the current viewer's relationship to the offer
    const offerViewerRole: 'buyer' | 'seller' | 'public' = React.useMemo(() => {
        if (!user || !latestOffer) return 'public'
        if (latestOffer.buyerId === user.id) return 'buyer'
        if (listing?.sellerId === user.id) return 'seller'
        return 'public'
    }, [user, latestOffer, listing])

    const handleCompare = () => {
        if (!listing) return
        router.push(`/compare?slug=${listing.slug}`)
    }

    const handleOfferSuccess = (offer: LatestOffer) => {
        setMyOffer(offer)        // update buyer's own offer view
        setLatestOffer(offer)    // update public display
        setShowOfferModal(false)
        setOfferSuccess(true)
    }

    const handleShare = async () => {
        const url = window.location.href
        const shareData = {
            title: listing?.title || 'Vehicle',
            text: `Check out this ${listing?.title} — ${formatPrice(listing?.price ?? 0)} on CarMazium`,
            url,
        }
        try {
            if (navigator.share) {
                await navigator.share(shareData)
            } else {
                await navigator.clipboard.writeText(url)
                setShareToast(true)
                setTimeout(() => setShareToast(false), 2500)
            }
        } catch {
            // User cancelled share dialog
        }
    }

    const handleWatchlist = async () => {
        if (!listing) return
        if (!user) {
            router.push('/auth/login?redirect=' + encodeURIComponent(`/vehicle/${id}`))
            return
        }
        if (watchlistLoading) return
        setWatchlistLoading(true)
        try {
            if (isWatchlisted) {
                await removeFromWatchlist(listing.id)
                setIsWatchlisted(false)
            } else {
                await addToWatchlist(listing.id)
                setIsWatchlisted(true)
            }
        } catch (err: any) {
            console.error('Watchlist error:', err)
        } finally {
            setWatchlistLoading(false)
        }
    }

    // ─── Login Modal ─────────────────────────────────────────────────────────────

    const LoginModal = () => !showLoginModal ? null : (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center overflow-y-auto p-4 sm:p-5" onClick={() => setShowLoginModal(false)}>
            <div className="glass-card p-8 max-w-md w-full relative my-auto h-fit" onClick={(e) => e.stopPropagation()}>
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-neon">
                    <CarIcon size={40} />
                </div>
                <h2 className="text-2xl font-bold font-heading mb-3 text-white text-center">Sign In to Make an Offer</h2>
                <p className="text-gray-400 mb-6 text-center text-sm">Create an account or log in to negotiate safely with the seller.</p>
                <div className="space-y-3">
                    <Button onClick={() => { setShowLoginModal(false); router.push(`/auth/login?redirect=/vehicle/${id}`) }} className="w-full shadow-neon">Log In</Button>
                    <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white" onClick={() => { setShowLoginModal(false); router.push(`/auth/signup?redirect=/vehicle/${id}`) }}>Create Account</Button>
                </div>
            </div>
        </div>
    )

    // ─── Loading ─────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
    )

    if (error || !listing) return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <h1 className="text-xl font-bold text-white">{error || "Listing not found"}</h1>
            <Link href="/search">
                <Button variant="outline">← Back to search</Button>
            </Link>
        </div>
    )

    const images = listing.images?.length > 0 ? listing.images : ["/assets/images/featured-sports.png"]
    const SidebarContent = () => (
        <div className="flex flex-col gap-6">
            {/* Price & Actions Card */}
            <div className="bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                <div className="h-1 bg-gradient-to-r from-primary to-primary/80 w-full absolute top-0" />
                <div className="p-6">
                    {/* SOLD status banner */}
                    {String(listing.status) === 'SOLD' ? (
                        <div className="mb-6 p-6 rounded-xl border-2 border-red-500/30 bg-red-500/10 text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-50" />
                            <div className="relative z-10">
                                <span className="block text-4xl font-black text-red-500 tracking-tighter mb-1 drop-shadow-sm">SOLD</span>
                                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">This vehicle is no longer available</p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                                <CarIcon size={100} className="text-red-500" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Price Box */}
                            <div className="mb-4">
                                <div className="text-4xl font-black text-white tracking-tight mb-2">{formatPrice(listing.price)}</div>
                                <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3 border border-red-500/20 bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                    Offers Welcome
                                </span>
                                <p className="text-[11px] text-gray-400 mt-1 pb-5 border-b border-white/10">Price includes VAT. Financing available from 5.9% APR.</p>
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                    <Clock size={12} /> Listed on {new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                {/* Last offer made — visible to public & seller viewers */}
                                {latestOffer && offerViewerRole !== 'buyer' && (
                                    <p className="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1">
                                        <Tag size={12} />
                                        Last offer: <strong className="text-amber-300">£{Number(latestOffer.amount).toLocaleString('en-GB')}</strong>
                                        <span className="text-gray-500 ml-1">
                                            · {new Date(latestOffer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </p>
                                )}
                            </div>

                            {/* Offer Status */}
                            {(offerViewerRole === 'buyer' ? myOffer : latestOffer) && (
                                <div className="mb-4">
                                    <OfferStatusChip
                                        offer={(offerViewerRole === 'buyer' ? myOffer : latestOffer)!}
                                        viewerRole={offerViewerRole}
                                    />
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {String(listing.status) === 'SOLD' ? (
                                    <div className="bg-slate-800/80 border-2 border-red-500/30 rounded-2xl p-6 text-center">
                                        <XCircle size={48} className="text-red-500 mx-auto mb-3 opacity-80" />
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">Vehicle Sold</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">This listing is closed</p>
                                    </div>
                                ) : listing.status !== 'ACTIVE' ? (
                                    <Button className="w-full py-6 text-lg bg-slate-700 text-gray-300 font-black uppercase rounded-xl cursor-not-allowed" disabled>
                                        {listing.status === 'DRAFT' ? 'Preview Only (Draft)' : listing.status}
                                    </Button>
                                ) : listing.sellerId === user?.id ? (
                                    <div className="text-center text-gray-500 text-sm py-2">This is your listing.</div>
                                ) : (
                                    <>
                                        {offerViewerRole === 'buyer' && myOffer?.status === 'COUNTERED' ? (
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    className="w-full py-6 text-[15px] font-black uppercase bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white rounded-xl"
                                                    onClick={() => {
                                                        if (confirm(`Accept counter offer of £${Number(myOffer.counterAmount).toLocaleString()}?`)) {
                                                            respondToCounterOffer(myOffer.id, 'ACCEPTED')
                                                                .then(() => window.location.reload())
                                                                .catch(err => alert(err.message))
                                                        }
                                                    }}
                                                >
                                                    Accept Counter Offer (£{Number(myOffer.counterAmount).toLocaleString()})
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="w-full py-4 text-xs font-black uppercase border-white/10 text-gray-400 hover:text-white rounded-xl"
                                                    onClick={() => {
                                                        if (confirm('Decline this counter offer?')) {
                                                            respondToCounterOffer(myOffer.id, 'REJECTED')
                                                                .then(() => window.location.reload())
                                                                .catch(err => alert(err.message))
                                                        }
                                                    }}
                                                >
                                                    Decline Counter
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                className="w-full py-6 text-[15px] font-black uppercase bg-primary hover:bg-red-600 shadow-neon text-white rounded-xl"
                                                onClick={() => {
                                                    if (!user) setShowLoginModal(true)
                                                    else setShowOfferModal(true)
                                                }}
                                                disabled={
                                                    offerViewerRole === 'buyer' && (
                                                        myOffer?.status === 'PENDING' ||
                                                        myOffer?.status === 'ACCEPTED'
                                                    )
                                                }
                                            >
                                                {offerViewerRole === 'buyer' && myOffer?.status === 'PENDING'
                                                    ? '⏳ Bid Placed'
                                                    : offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'
                                                        ? '✓ Bid Won'
                                                        : 'Place a Bid'}
                                            </Button>
                                        )}
                                        
                                        <Button
                                            variant="outline"
                                            onClick={handleEnquire}
                                            disabled={enquiring}
                                            className="w-full py-6 text-[15px] font-black uppercase bg-transparent hover:bg-slate-700 border-white/10 text-white rounded-xl gap-2"
                                        >
                                            {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Starting Chat...</> : <><MessageCircle size={18} /> ENQUIRE NOW</>}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Seller Profile Card */}
            {listing.seller && (
                <div className="bg-slate-800/80 rounded-xl border border-white/10 overflow-hidden shadow-xl">
                    <div className="p-6">
                        <h3 className="font-bold text-white text-lg mb-4">Seller Profile</h3>

                        {/* Seller Info Block */}
                        <Link href={`/seller/${listing.sellerId}`} className="flex items-center gap-4 mb-5 hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/10 -ml-2 group">
                            {listing.seller.role === 'DEALER' && listing.seller.dealerProfile?.logo ? (
                                <Image src={listing.seller.dealerProfile.logo} alt="Dealer Logo" width={56} height={56} className="w-14 h-14 rounded-full object-cover shrink-0 bg-white shadow-md" />
                            ) : listing.seller.profileImage ? (
                                <Image src={listing.seller.profileImage} alt="Seller Image" width={56} height={56} className="w-14 h-14 rounded-full object-cover shrink-0 shadow-md" />
                            ) : (
                                <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                                    {((listing.seller.role === 'DEALER' ? listing.seller.dealerProfile?.companyName : null) || listing.seller.firstName || "CM").substring(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-base leading-tight mb-1 group-hover:text-primary transition-colors">
                                    {(listing.seller.role === 'DEALER' ? listing.seller.dealerProfile?.companyName : null) || `${listing.seller.firstName || ''} ${listing.seller.lastName || ''}`.trim() || 'Private Seller'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        {listing.seller.role === 'DEALER' && listing.seller.dealerProfile ? (
                                            <>
                                                <BadgeCheck size={14} className="text-blue-500" />
                                                <span className="text-xs text-blue-400 font-medium tracking-wide">Verified Dealer</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={14} className="text-emerald-500" />
                                                <span className="text-xs text-emerald-400 font-medium tracking-wide">Verified Seller</span>
                                            </>
                                        )}
                                    </div>
                                    {listing.sellerId && <SellerBadge score={0} sellerUserId={listing.sellerId} size="sm" showLabel />}
                                </div>
                            </div>
                        </Link>
                        
                        {/* Dealership Info */}
                        {listing.seller.role === 'DEALER' && listing.seller.dealerProfile && (
                            <div className="space-y-4 text-sm text-gray-300 border-t border-white/5 pt-4">
                                {listing.seller.dealerProfile.description && (
                                    <p className="line-clamp-4 text-sm leading-relaxed">{listing.seller.dealerProfile.description}</p>
                                )}
                                <div className="flex flex-col gap-2.5">
                                    {listing.seller.dealerProfile.phone && (
                                        <a href={`tel:${listing.seller.dealerProfile.phone}`} className="flex items-center gap-3 hover:text-white transition-colors bg-slate-900/40 p-2.5 rounded-lg border border-white/5 group">
                                            <div className="bg-slate-800 p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                                                <Phone size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <span className="font-medium">{listing.seller.dealerProfile.phone}</span>
                                        </a>
                                    )}
                                    {listing.seller.dealerProfile.website && (
                                        <a href={listing.seller.dealerProfile.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-white transition-colors bg-slate-900/40 p-2.5 rounded-lg border border-white/5 group">
                                            <div className="bg-slate-800 p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
                                                <Globe size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <span className="font-medium">Visit Website</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Policies */}
                        <div className="mt-5 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                                <span className="relative group/policy inline-flex items-center cursor-help">
                                    <Info size={14} className="text-gray-500 group-hover/policy:text-blue-400 transition-colors" />
                                    <span className="absolute bottom-full -left-2 mb-2 w-56 rounded-lg bg-slate-800 border border-white/10 px-3 py-2.5 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 invisible group-hover/policy:opacity-100 group-hover/policy:visible transition-all duration-200 z-50 pointer-events-none">
                                        <span className="font-bold text-white block mb-1">Policies:</span>
                                        Payment will not be made on our platform.
                                        <span className="absolute top-full left-3 -mt-px border-4 border-transparent border-t-slate-800" />
                                    </span>
                                </span>
                                <span className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Policies</span>
                            </div>
                        </div>

                    </div>
                    
                    {/* Location Footer */}
                    <div className="bg-slate-900/50 p-4 border-t border-white/5 flex items-center justify-center gap-2 text-gray-400 text-xs font-medium">
                        <MapPin size={14} className="text-primary" /> {listing.location || 'Location not specified'}
                    </div>
                </div>
            )}
        </div>
    )

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12 relative">
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            <LoginModal />

            {/* Enquire Modal */}
            {showEnquireModal && listing?.seller?.role === 'DEALER' && listing?.seller?.dealerProfile && (
                <EnquireModal
                    listingId={listing.id}
                    dealerProfileId={listing.seller.dealerProfile.id}
                    isOpen={showEnquireModal}
                    onClose={() => setShowEnquireModal(false)}
                />
            )}

            {/* Bid Modal */}
            {showOfferModal && (
                <BidModal
                    listing={listing}
                    onClose={() => setShowOfferModal(false)}
                    onSuccess={handleOfferSuccess}
                />
            )}

            {/* Success toast */}
            {offerSuccess && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                    <CheckCircle size={18} />
                    <span className="text-sm font-semibold">Bid placed successfully! You're in the lead.</span>
                    <button onClick={() => setOfferSuccess(false)} className="ml-2 text-emerald-400 hover:text-white">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Share toast */}
            {shareToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-blue-500/20 border border-blue-500/40 text-blue-300 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                    <Share2 size={16} />
                    <span className="text-sm font-semibold">Link copied to clipboard!</span>
                    <button onClick={() => setShareToast(false)} className="ml-2"><X size={14} /></button>
                </div>
            )}

            <div className="container mx-auto px-5">
                {/* Breadcrumb & Header */}
                <div className="mb-8">
                    <Link href="/search" className="text-gray-400 hover:text-primary text-sm flex items-center mb-4 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Back to Inventory
                    </Link>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold font-heading text-white mb-2">{listing.title}</h1>
                            {listing.make && listing.model && (
                                <p className="text-gray-300 text-lg">{listing.make} {listing.model} {listing.year}</p>
                            )}
                            {/* Badges Row */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                {/* Featured Badge */}
                                {listing.isFeatured && (
                                    <FeaturedBadge compact />
                                )}
                                {/* Badge Tier */}
                                {listing.badgeTier && listing.badgeTier !== 'FREE' && (
                                    <>
                                        {listing.badgeTier === 'PREMIUM' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                                                <Star size={10} className="fill-amber-400" /> Premium Verified
                                            </span>
                                        )}
                                        {listing.badgeTier === 'STANDARD' && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
                                                <ShieldCheck size={10} /> Standard Verified
                                            </span>
                                        )}
                                    </>
                                )}
                                {/* Trust badges for STANDARD/PREMIUM */}
                                {(listing.badgeTier === 'STANDARD' || listing.badgeTier === 'PREMIUM') && (
                                    <>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                            <ShieldCheck size={10} /> Verified
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
                                            <BadgeCheck size={10} /> VIN Report
                                        </span>
                                    </>
                                )}
                                {/* HPI Check Badges for PREMIUM tier */}
                                {listing.badgeTier === 'PREMIUM' && (
                                    <>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                            <CheckCircle size={10} /> Condition Check
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                            <CheckCircle size={10} /> Stolen Check
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                                            <CheckCircle size={10} /> Finance Check
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white"
                                onClick={handleCompare}
                            >
                                <Scale size={18} className="mr-2" /> Compare
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white" onClick={handleShare}>
                                <Share2 size={18} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className={`rounded-full transition-all ${isWatchlisted ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-500'}`}
                                onClick={handleWatchlist}
                                disabled={watchlistLoading}
                            >
                                <Heart size={18} className={isWatchlisted ? 'fill-red-500' : ''} />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Gallery & Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Gallery */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-4">
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4 group">
                                <Image
                                    src={images[activeImage]}
                                    alt={listing.title}
                                    fill
                                    className={`object-cover transition-all duration-300 ${String(listing.status) === 'SOLD' ? 'opacity-50 grayscale' : ''}`}
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
                                    <Camera size={16} /> {activeImage + 1}/{images.length}
                                </div>
                                {/* SOLD watermark on the main gallery */}
                                {String(listing.status) === 'SOLD' && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span
                                            className="text-[80px] md:text-[110px] font-black uppercase tracking-widest text-red-500/80 select-none rotate-[-15deg] drop-shadow-2xl"
                                            style={{
                                                textShadow: '0 0 40px rgba(239,68,68,0.5)',
                                                WebkitTextStroke: '3px rgba(239,68,68,0.3)',
                                            }}
                                        >
                                            SOLD
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                {images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImage(idx)}
                                        className={`relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${activeImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    >
                                        <Image src={img} alt={`Thumb ${idx}`} fill className="object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Buy Car Box */}
                        <div className="block lg:hidden mb-8">
                            <SidebarContent />
                        </div>

                        {/* Description */}
                        {listing.description && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8 mb-8">
                                <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-primary pl-4">Description</h3>
                                <div className={`text-gray-300 leading-relaxed whitespace-pre-wrap relative ${!isDescExpanded ? 'line-clamp-4 overflow-hidden' : ''}`}>
                                    {listing.description}
                                    {!isDescExpanded && (
                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-800/90 to-transparent pointer-events-none"></div>
                                    )}
                                </div>
                                {(listing.description.length > 300 || listing.description.split('\n').length > 4) && (
                                    <button
                                        onClick={() => setIsDescExpanded(!isDescExpanded)}
                                        className="text-primary font-bold text-sm mt-4 hover:underline focus:outline-none"
                                    >
                                        {isDescExpanded ? "View Less" : "View More"}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Key Information */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Key Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { label: "Year", value: listing.year },
                                    { label: "Mileage", value: listing.mileage ? `${listing.mileage.toLocaleString()} mi` : null },
                                    { label: "Engine", value: listing.engineSize ? `${listing.engineSize}cc` : null },
                                    { label: "Power", value: listing.bhp ? `${listing.bhp} bhp` : null },
                                    { label: "Transmission", value: listing.transmission },
                                    { label: "Colour", value: listing.color },
                                    { label: "Doors", value: listing.doors },
                                    { label: "Seats", value: listing.seats },
                                    { label: "Fuel Type", value: listing.fuelType },
                                    { label: "Body Type", value: listing.bodyType },
                                    { label: "Condition", value: listing.condition },
                                    { label: "VRM", value: listing.vrm },
                                    { label: "MOT Status", value: listing.motStatus ? `${listing.motStatus}${listing.motExpiryDate ? ` (exp. ${listing.motExpiryDate})` : ''}` : null },
                                    { label: "Tax Status", value: listing.taxStatus ? `${listing.taxStatus}${listing.taxDueDate ? ` (due ${listing.taxDueDate})` : ''}` : null },
                                    { label: "First Registered", value: listing.monthOfFirstRegistration },
                                    { label: "Type Approval", value: listing.typeApproval },
                                    { label: "Wheelplan", value: listing.wheelplan },
                                ].filter(i => i.value != null).map((item, i) => (
                                    <div key={i} className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-gray-400 text-sm">{item.label}</span>
                                        <span className="text-white font-semibold text-sm">{String(item.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Features */}
                        {listing.features && Array.isArray(listing.features) && listing.features.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Vehicle Features</h3>
                                <div className="space-y-1">
                                    <AccordionItem title="Included Features" icon={<CarIcon size={18} />}>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(listing.features as string[]).map((feat, i) => (
                                                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                                                    {feat}
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionItem>
                                    {/* HPI Verification Badges in Features */}
                                    {listing.badgeTier === 'PREMIUM' && (
                                        <AccordionItem title="HPI Verification" icon={<ShieldCheck size={18} />}>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex items-center gap-2 text-sm text-emerald-300">
                                                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                                                    Condition Check
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-emerald-300">
                                                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                                                    Stolen Check
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-emerald-300">
                                                    <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                                                    Finance Check
                                                </div>
                                            </div>
                                        </AccordionItem>
                                    )}

                                </div>
                            </div>
                        )}

                        {/* Seller-Reported Damage */}
                        {Array.isArray((listing as any).damageRecords) && (listing as any).damageRecords.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-amber-500/20 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-1 border-l-4 border-amber-500 pl-4 flex items-center gap-2">
                                    <Wrench size={18} className="text-amber-400" />
                                    Seller-Reported Damage
                                </h3>
                                <p className="text-xs text-gray-500 mb-6 pl-6">The seller has disclosed the following known damage areas.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {((listing as any).damageRecords as any[]).map((record: any, i: number) => {
                                        const isKebabId = /^[a-z][a-z-]*$/.test(record.part ?? '')
                                        const zoneLabel = record.part
                                            ? isKebabId
                                                ? record.part.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
                                                : record.part
                                            : 'Unknown Area'
                                        const view = record.coords?.view ?? null
                                        return (
                                            <div key={record.id ?? i} className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                                {record.imageUrl && (
                                                    <div className="w-20 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                                        <img src={record.imageUrl} alt={zoneLabel} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                                            {zoneLabel}
                                                        </span>
                                                        {record.size && record.size !== 'MEDIUM' && (
                                                            <span className="text-[10px] text-gray-600 font-medium">{record.size}</span>
                                                        )}
                                                        {view && (
                                                            <span className="text-[10px] text-gray-700">{view}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-300 leading-snug line-clamp-3">
                                                        {record.type || 'No description provided.'}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Detailed Specifications */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Specifications</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                
                                {/* Overview */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Overview</h4>
                                    <div className="space-y-2">
                                        {listing.make && <div className="flex justify-between"><span className="text-gray-400 text-sm">Make:</span><span className="text-white font-semibold text-sm">{listing.make}</span></div>}
                                        {listing.model && <div className="flex justify-between"><span className="text-gray-400 text-sm">Model:</span><span className="text-white font-semibold text-sm">{listing.model}</span></div>}
                                        {listing.year && <div className="flex justify-between"><span className="text-gray-400 text-sm">Year:</span><span className="text-white font-semibold text-sm">{listing.year}</span></div>}
                                        {listing.bodyType && <div className="flex justify-between"><span className="text-gray-400 text-sm">Body type:</span><span className="text-white font-semibold text-sm">{listing.bodyType}</span></div>}
                                        {listing.color && <div className="flex justify-between"><span className="text-gray-400 text-sm">Exterior colour:</span><span className="text-white font-semibold text-sm">{listing.color}</span></div>}
                                        {listing.mileage !== null && listing.mileage !== undefined && <div className="flex justify-between"><span className="text-gray-400 text-sm">Mileage:</span><span className="text-white font-semibold text-sm">{listing.mileage.toLocaleString('en-GB')} mi</span></div>}
                                        {listing.condition && <div className="flex justify-between"><span className="text-gray-400 text-sm">Condition:</span><span className="text-white font-semibold text-sm">{listing.condition.replace('_', ' ')}</span></div>}
                                        {listing.vrm && <div className="flex justify-between"><span className="text-gray-400 text-sm">Registration:</span><span className="text-white font-semibold text-sm">{listing.vrm}</span></div>}
                                        {listing.monthOfFirstRegistration && <div className="flex justify-between"><span className="text-gray-400 text-sm">Reg. date:</span><span className="text-white font-semibold text-sm">{listing.monthOfFirstRegistration}</span></div>}
                                    </div>
                                </div>

                                {/* Fuel Economy */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Fuel Economy</h4>
                                    <div className="space-y-2">
                                        {listing.fuelType && <div className="flex justify-between"><span className="text-gray-400 text-sm">Fuel type:</span><span className="text-white font-semibold text-sm">{listing.fuelType}</span></div>}
                                        {listing.co2Emissions && <div className="flex justify-between"><span className="text-gray-400 text-sm">CO2 emissions:</span><span className="text-white font-semibold text-sm">{listing.co2Emissions} g/km</span></div>}
                                        {listing.ulezCompliant !== null && <div className="flex justify-between"><span className="text-gray-400 text-sm">ULEZ compliant:</span><span className="text-white font-semibold text-sm">{listing.ulezCompliant ? "Yes" : "No"}</span></div>}
                                        {listing.euroStandard && <div className="flex justify-between"><span className="text-gray-400 text-sm">Euro standard:</span><span className="text-white font-semibold text-sm">{listing.euroStandard.replace('_', ' ')}</span></div>}
                                    </div>
                                </div>

                                {/* Performance */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Performance</h4>
                                    <div className="space-y-2">
                                        {listing.transmission && <div className="flex justify-between"><span className="text-gray-400 text-sm">Gearbox:</span><span className="text-white font-semibold text-sm">{listing.transmission}</span></div>}
                                        {listing.engineSize && <div className="flex justify-between"><span className="text-gray-400 text-sm">Engine size:</span><span className="text-white font-semibold text-sm">{listing.engineSize} cc</span></div>}
                                        {listing.bhp && <div className="flex justify-between"><span className="text-gray-400 text-sm">Horsepower:</span><span className="text-white font-semibold text-sm">{listing.bhp} bhp</span></div>}
                                    </div>
                                </div>

                                {/* Measurements */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">Measurements</h4>
                                    <div className="space-y-2">
                                        {listing.doors && <div className="flex justify-between"><span className="text-gray-400 text-sm">Doors:</span><span className="text-white font-semibold text-sm">{listing.doors}</span></div>}
                                        {listing.seats && <div className="flex justify-between"><span className="text-gray-400 text-sm">Maximum seating:</span><span className="text-white font-semibold text-sm">{listing.seats}</span></div>}
                                        {listing.wheelplan && <div className="flex justify-between"><span className="text-gray-400 text-sm">Wheelplan:</span><span className="text-white font-semibold text-sm">{listing.wheelplan}</span></div>}
                                    </div>
                                </div>

                                {/* DVLA History */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">History & Status</h4>
                                    <div className="space-y-2">
                                        {listing.motStatus && <div className="flex justify-between"><span className="text-gray-400 text-sm">MOT Status:</span><span className={`font-semibold text-sm ${listing.motStatus === 'Valid' ? 'text-emerald-400' : 'text-amber-400'}`}>{listing.motStatus}</span></div>}
                                        {listing.motExpiryDate && <div className="flex justify-between"><span className="text-gray-400 text-sm">MOT Expiry:</span><span className="text-white font-semibold text-sm">{listing.motExpiryDate}</span></div>}
                                        {listing.taxStatus && <div className="flex justify-between"><span className="text-gray-400 text-sm">Tax Status:</span><span className={`font-semibold text-sm ${listing.taxStatus === 'Taxed' ? 'text-emerald-400' : 'text-amber-400'}`}>{listing.taxStatus}</span></div>}
                                        {listing.taxDueDate && <div className="flex justify-between"><span className="text-gray-400 text-sm">Tax Due:</span><span className="text-white font-semibold text-sm">{listing.taxDueDate}</span></div>}
                                        {listing.markedForExport !== null && <div className="flex justify-between"><span className="text-gray-400 text-sm">Exported:</span><span className="text-white font-semibold text-sm">{listing.markedForExport ? "Yes" : "No"}</span></div>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* HPI Check Report */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white border-l-4 border-primary pl-4 flex items-center gap-2">
                                    <FileSearch className="text-primary" size={20} />
                                    Comprehensive Vehicle Check
                                </h3>
                                <div className="text-xs font-semibold px-2.5 py-1 bg-white/10 text-gray-300 rounded-md border border-white/10">
                                    Powered by CarMazium
                                </div>
                            </div>
                            
                            {/* Badges Summary */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                    <span className="text-sm text-emerald-300 font-medium">Finance Clear</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                    <span className="text-sm text-emerald-300 font-medium">Not Stolen</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                    <span className="text-sm text-emerald-300 font-medium">Not Scrapped</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                    <span className="text-sm text-emerald-300 font-medium">Mileage Checked</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                    <span className="text-sm text-emerald-300 font-medium">Not Written Off</span>
                                </div>
                                {listing.markedForExport ? (
                                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                                        <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                                        <span className="text-sm text-amber-300 font-medium">Exported</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                                        <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                                        <span className="text-sm text-emerald-300 font-medium">UK Supplied</span>
                                    </div>
                                )}
                            </div>

                            {/* Blurred Report Section */}
                            <div className="relative rounded-xl border border-white/10 overflow-hidden bg-white/5">
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-[3px] p-6 text-center">
                                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-4 shadow-neon">
                                        <Lock size={28} />
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Detailed Report Locked</h4>
                                    <p className="text-sm text-gray-300 max-w-sm mb-6">
                                        Unlock the full 50+ point vehicle history check including MOT history, keeper changes, and hidden issues.
                                    </p>
                                    <Button className="shadow-neon px-8 hover:scale-105 transition-transform">
                                        Unlock Full Report for £9.99
                                    </Button>
                                </div>
                                <div className="h-56 relative opacity-40 pointer-events-none grayscale-[0.2]">
                                    <Image
                                        src="/assets/images/hpi_report_mockup.png"
                                        alt="HPI Report Mockup"
                                        fill
                                        className="object-cover object-top"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/20 to-slate-900/50" />
                                </div>
                            </div>
                        </div>

                        {/* Finance Calculator */}
                        <FinanceCalculator vehiclePrice={Number(listing.price)} />
                    </div>

                    {/* Right Column: Sticky Sidebar — desktop only */}
                    <div className="lg:col-span-1 hidden lg:block">
                        <div className="sticky top-28 bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                            <div className="h-1 bg-gradient-to-r from-primary to-red-800 w-full absolute top-0" />
                            <div className="p-6">
                                {/* Price */}
                                <div className="mb-5">
                                    {/* Policies tooltip */}
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <span className="relative group/policy inline-flex items-center cursor-help">
                                            <Info size={14} className="text-gray-500 group-hover/policy:text-blue-400 transition-colors" />
                                            <span className="absolute bottom-full -left-2 mb-2 w-56 rounded-lg bg-slate-800 border border-white/10 px-3 py-2.5 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 invisible group-hover/policy:opacity-100 group-hover/policy:visible transition-all duration-200 z-50 pointer-events-none">
                                                <span className="font-bold text-white block mb-1">Policies:</span>
                                                Payment will not be made on our platform.
                                                <span className="absolute top-full left-3 -mt-px border-4 border-transparent border-t-slate-800" />
                                            </span>
                                        </span>
                                        <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Policies</span>
                                    </div>
                                    <div>
                                        <div className="text-4xl font-bold text-white mb-2">{formatPrice(listing.price)}</div>
                                        <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-full mb-4">
                                            Offers Welcome
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-3">Price includes VAT. Financing available from 5.9% APR.</p>
                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                        <Clock size={12} /> Listed on {new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>

                                {/* Seller Info Block */}
                                {listing.seller && (
                                    <Link href={`/seller/${listing.sellerId}`} className="flex items-center gap-3 mb-6 hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/10 -ml-2 group">
                                        {listing.seller.role === 'DEALER' && listing.seller.dealerProfile?.logo ? (
                                            <Image src={listing.seller.dealerProfile.logo} alt="Dealer Logo" width={48} height={48} className="w-12 h-12 rounded-full object-cover shrink-0 bg-white" />
                                        ) : listing.seller.profileImage ? (
                                            <Image src={listing.seller.profileImage} alt="Seller Image" width={48} height={48} className="w-12 h-12 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary font-black text-lg shadow-sm shrink-0">
                                                {((listing.seller.role === 'DEALER' ? listing.seller.dealerProfile?.companyName : null) || listing.seller.firstName || "CM").substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white text-[15px] leading-tight group-hover:text-primary transition-colors">
                                                {(listing.seller.role === 'DEALER' ? listing.seller.dealerProfile?.companyName : null) || `${listing.seller.firstName || ''} ${listing.seller.lastName || ''}`.trim() || 'Private Seller'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <div className="flex items-center gap-1">
                                                    {listing.seller.role === 'DEALER' && listing.seller.dealerProfile ? (
                                                        <>
                                                            <CheckCircle size={10} className="text-blue-500" />
                                                            <span className="text-[10px] text-blue-500 font-medium">Verified Dealer</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle size={10} className="text-emerald-500" />
                                                            <span className="text-[10px] text-emerald-500 font-medium">Verified Seller</span>
                                                        </>
                                                    )}
                                                </div>
                                                {listing.sellerId && <SellerBadge score={0} sellerUserId={listing.sellerId} size="sm" showLabel />}
                                            </div>
                                        </div>
                                    </Link>
                                )}
                                
                                {/* Dealership Info */}
                                {listing.seller?.role === 'DEALER' && listing.seller?.dealerProfile && (
                                    <div className="mb-6 space-y-2 text-sm text-gray-300">
                                        {listing.seller.dealerProfile.description && (
                                            <p className="line-clamp-3 text-xs">{listing.seller.dealerProfile.description}</p>
                                        )}
                                        <div className="flex flex-col gap-1 pt-2">
                                            {listing.seller.dealerProfile.phone && (
                                                <a href={`tel:${listing.seller.dealerProfile.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
                                                    <Phone size={14} className="text-gray-500" /> {listing.seller.dealerProfile.phone}
                                                </a>
                                            )}
                                            {listing.seller.dealerProfile.website && (
                                                <a href={listing.seller.dealerProfile.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                                                    <Globe size={14} className="text-gray-500" /> Visit Website
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Offer Status */}
                                {/* Buyer sees own offer chip; seller/public see the listing's latest offer */}
                                {(offerViewerRole === 'buyer' ? myOffer : latestOffer) && (
                                    <div className="mb-4">
                                        <OfferStatusChip
                                            offer={(offerViewerRole === 'buyer' ? myOffer : latestOffer)!}
                                            viewerRole={offerViewerRole}
                                        />
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    {listing.status !== 'ACTIVE' ? (
                                        <Button className="w-full py-6 text-lg bg-slate-700 text-gray-300 cursor-not-allowed uppercase" disabled>
                                            {listing.status === 'DRAFT' ? 'Preview Only (Draft)' : listing.status}
                                        </Button>
                                    ) : listing.sellerId === user?.id ? (
                                        // Seller sees no offer/enquire buttons on their own listing
                                        <div className="text-center text-gray-500 text-sm py-2">This is your listing.</div>
                                    ) : (
                                        <>
                                            <Button
                                                className="w-full py-6 text-lg shadow-neon"
                                                onClick={() => {
                                                    if (!user) setShowLoginModal(true)
                                                    else setShowOfferModal(true)
                                                }}
                                                disabled={offerViewerRole === 'buyer' && (myOffer?.status === 'PENDING' || myOffer?.status === 'ACCEPTED')}
                                            >
                                                {offerViewerRole === 'buyer' && myOffer?.status === 'PENDING'
                                                    ? '⏳ Offer Pending...'
                                                    : offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'
                                                        ? '✓ Offer Accepted'
                                                        : 'Make an Offer'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={handleEnquire}
                                                disabled={enquiring}
                                                className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10 gap-2"
                                            >
                                                {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2 inline" /> Starting Chat...</> : <><MessageCircle size={18} /> Enquire Now</>}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {listing.location && (
                                <div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs hover:text-white cursor-pointer transition-colors border-t border-white/5">
                                    <MapPin size={14} /> {listing.location}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
