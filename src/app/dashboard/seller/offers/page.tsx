"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Loader2, AlertTriangle, Tag, CheckCircle, XCircle,
    Clock, ChevronRight, Car, MessageSquare, RefreshCw, X,
    DollarSign, User, Mail
} from "lucide-react"
import { getOffersForListing, getMyListings, respondToOffer, recordSale, type Offer, type Listing } from "@/lib/listingApi"
import { createChatRoom } from "@/lib/chatApi"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Offer['status'] }) {
    const styles: Record<string, string> = {
        PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        ACCEPTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
        WITHDRAWN: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
        COUNTERED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    }
    const icons: Record<string, React.ReactNode> = {
        PENDING: <Clock size={11} />,
        ACCEPTED: <CheckCircle size={11} />,
        REJECTED: <XCircle size={11} />,
        WITHDRAWN: <XCircle size={11} />,
        COUNTERED: <RefreshCw size={11} />,
    }
    return (
        <span className={`inline-flex items-center gap-1 border text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${styles[status] ?? ''}`}>
            {icons[status]} {status}
        </span>
    )
}

function formatGBP(val: string | number) {
    return `£${Number(val).toLocaleString('en-GB')}`
}

// ─── Mark as Sold Modal ───────────────────────────────────────────────────────

function MarkAsSoldModal({
    offer,
    listing,
    onConfirm,
    onClose,
    confirming,
}: {
    offer: Offer
    listing: Listing
    onConfirm: (data: { soldPrice: number; buyerName: string; buyerEmail: string }) => void
    onClose: () => void
    confirming: boolean
}) {
    const agreedPrice = Number(offer.counterAmount ?? offer.amount)
    const [soldPrice, setSoldPrice] = React.useState(agreedPrice)
    const [buyerName, setBuyerName] = React.useState(
        [offer.buyer?.firstName, offer.buyer?.lastName].filter(Boolean).join(' ')
    )
    const [buyerEmail, setBuyerEmail] = React.useState(offer.buyer?.email ?? '')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black font-heading uppercase tracking-tight text-white">Confirm Sale</h2>
                        <p className="text-xs text-gray-500 mt-0.5">This will mark the listing as sold and record it in your earnings.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors ml-4 shrink-0"
                        disabled={confirming}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Vehicle preview */}
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 mb-6">
                    {listing.images?.[0] ? (
                        <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0">
                            <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-12 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                            <Car size={18} className="text-gray-600" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{listing.title}</p>
                        <p className="text-xs text-gray-400">Agreed offer: <span className="text-primary font-bold">{formatGBP(agreedPrice)}</span></p>
                    </div>
                </div>

                {/* Form fields */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                            Final Sale Price
                        </label>
                        <div className="relative">
                            <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="number"
                                min={0}
                                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors"
                                value={soldPrice}
                                onChange={e => setSoldPrice(Number(e.target.value))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                            Buyer Name
                        </label>
                        <div className="relative">
                            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-gray-600"
                                placeholder="Buyer's full name"
                                value={buyerName}
                                onChange={e => setBuyerName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                            Buyer Email <span className="text-gray-600 normal-case font-medium">(optional)</span>
                        </label>
                        <div className="relative">
                            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                className="w-full bg-slate-800 border border-white/20 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-gray-600"
                                placeholder="buyer@example.com"
                                value={buyerEmail}
                                onChange={e => setBuyerEmail(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={confirming}
                        className="flex-1 py-2.5 rounded-xl border border-white/15 text-gray-400 hover:text-white hover:border-white/30 text-sm font-bold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm({ soldPrice, buyerName, buyerEmail })}
                        disabled={confirming || soldPrice <= 0}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(52,211,153,0.2)]"
                    >
                        {confirming
                            ? <><Loader2 size={14} className="animate-spin" /> Recording…</>
                            : <><CheckCircle size={14} /> Confirm Sale</>
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Offer Row ────────────────────────────────────────────────────────────────

function OfferRow({
    offer,
    listingId,
    onRespond,
    onMessage,
    onOpenSaleModal,
    startingChat,
    responding,
}: {
    offer: Offer
    listingId: string
    onRespond: (id: string, status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', amount?: number) => void
    onMessage: (buyerId: string) => void
    onOpenSaleModal: (offer: Offer) => void
    startingChat: string | null
    responding: string | null
}) {
    const buyer = offer.buyer
    const isPending = offer.status === 'PENDING'
    const isResponding = responding === offer.id
    const [isCountering, setIsCountering] = React.useState(false)
    const [counterAmount, setCounterAmount] = React.useState<number>(0)

    return (
        <div className="glass-card p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Buyer avatar */}
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {buyer?.firstName?.[0] ?? '?'}
            </div>

            {/* Offer details */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-bold text-white text-sm">
                        {buyer?.firstName} {buyer?.lastName}
                    </p>
                    <StatusBadge status={offer.status} />
                </div>
                <p className="text-2xl font-bold text-primary font-mono">
                    {(offer as any).amountMin && (offer as any).amountMax && formatGBP((offer as any).amountMin) !== formatGBP((offer as any).amountMax)
                        ? `${formatGBP((offer as any).amountMin)} – ${formatGBP((offer as any).amountMax)}`
                        : formatGBP(offer.amount)
                    }
                </p>
                {offer.counterAmount && (
                    <p className="text-xs text-blue-400 mt-0.5">Counter: {formatGBP(offer.counterAmount)}</p>
                )}
                {offer.message && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-400">
                        <MessageSquare size={11} className="mt-0.5 shrink-0 text-gray-500" />
                        <span className="italic">&ldquo;{offer.message}&rdquo;</span>
                    </div>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                    {new Date(offer.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>

            {/* Accept / Reject (only for pending) */}
            {isPending && !isCountering && (
                <div className="flex gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 gap-1"
                        onClick={() => setIsCountering(true)}
                        disabled={isResponding}
                    >
                        <RefreshCw size={13} /> Counter
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 gap-1"
                        disabled={isResponding}
                        onClick={() => onRespond(offer.id, 'REJECTED')}
                    >
                        {isResponding && !isCountering ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Decline
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 gap-1 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                        disabled={isResponding}
                        onClick={() => onRespond(offer.id, 'ACCEPTED')}
                    >
                        {isResponding && !isCountering ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Accept
                    </Button>
                </div>
            )}

            {isPending && isCountering && (
                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                        <input
                            type="number"
                            className="bg-slate-900 border border-white/20 text-white rounded-md pl-6 pr-3 py-1.5 w-24 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Amount"
                            value={counterAmount || ''}
                            onChange={e => setCounterAmount(Number(e.target.value))}
                        />
                    </div>
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-500 gap-1"
                        disabled={isResponding || !counterAmount || counterAmount <= 0}
                        onClick={() => onRespond(offer.id, 'COUNTERED', counterAmount)}
                    >
                        {isResponding ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} Send
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-gray-400 hover:text-white"
                        disabled={isResponding}
                        onClick={() => setIsCountering(false)}
                    >
                        <X size={13} />
                    </Button>
                </div>
            )}

            {/* Accepted offer actions */}
            {offer.status === 'ACCEPTED' && (
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 gap-1"
                        onClick={() => onMessage(offer.buyerId)}
                        disabled={startingChat === offer.buyerId}
                    >
                        {startingChat === offer.buyerId ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />} Message
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 gap-1 shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                        onClick={() => onOpenSaleModal(offer)}
                    >
                        <CheckCircle size={13} /> Mark as Sold
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 gap-1"
                        disabled={isResponding}
                        onClick={() => {
                            if (confirm("Are you sure you want to cancel this offer and relist?")) {
                                onRespond(offer.id, 'REJECTED');
                            }
                        }}
                    >
                        {isResponding ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Cancel & Relist
                    </Button>
                </div>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellerOffersPage() {
    const [listings, setListings] = React.useState<Listing[]>([])
    const [offers, setOffers] = React.useState<Record<string, Offer[]>>({})
    const [loadingListings, setLoadingListings] = React.useState(true)
    const [loadingOffers, setLoadingOffers] = React.useState<Record<string, boolean>>({})
    const [error, setError] = React.useState<string | null>(null)
    const [responding, setResponding] = React.useState<string | null>(null)
    const [startingChat, setStartingChat] = React.useState<string | null>(null)
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
    const [toast, setToast] = React.useState<string | null>(null)
    // Sale modal state
    const [saleModal, setSaleModal] = React.useState<{ offer: Offer; listing: Listing } | null>(null)
    const [confirmingSale, setConfirmingSale] = React.useState(false)
    const router = useRouter()

    // Load all seller's listings, then eagerly fetch all offers
    React.useEffect(() => {
        const load = async () => {
            try {
                setLoadingListings(true)
                const res = await getMyListings({ limit: 50, includeSold: true })
                const loadedListings = res.data
                setListings(loadedListings)

                // Eagerly expand all and fetch offers so pending counts are visible immediately
                const allIds = new Set(loadedListings.map(l => l.id))
                setExpanded(allIds)
                const offerResults = await Promise.allSettled(
                    loadedListings.map(async (listing) => {
                        const data = await getOffersForListing(listing.id)
                        return { id: listing.id, data }
                    })
                )
                const offersMap: Record<string, Offer[]> = {}
                offerResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        offersMap[result.value.id] = result.value.data
                    }
                })
                setOffers(offersMap)
            } catch (err: any) {
                setError(err.message || "Failed to load listings")
            } finally {
                setLoadingListings(false)
            }
        }
        load()
    }, [])

    // Load offers for a listing when expanded
    const loadOffersFor = async (listingId: string) => {
        if (offers[listingId]) return
        setLoadingOffers(prev => ({ ...prev, [listingId]: true }))
        try {
            const data = await getOffersForListing(listingId)
            setOffers(prev => ({ ...prev, [listingId]: data }))
        } catch {
            // silently fail per listing
        } finally {
            setLoadingOffers(prev => ({ ...prev, [listingId]: false }))
        }
    }

    const toggleExpand = (listingId: string) => {
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(listingId)) {
                next.delete(listingId)
            } else {
                next.add(listingId)
                loadOffersFor(listingId)
            }
            return next
        })
    }

    const handleRespond = async (offerId: string, listingId: string, status: 'ACCEPTED' | 'REJECTED' | 'COUNTERED', counterAmount?: number) => {
        setResponding(offerId)
        try {
            await respondToOffer(offerId, status, counterAmount)
            const updated = await getOffersForListing(listingId)
            setOffers(prev => ({ ...prev, [listingId]: updated }))
            if (status === 'ACCEPTED') {
                setToast('✓ Offer accepted! Contact the buyer, then use "Mark as Sold" once the deal is complete.')
            } else if (status === 'COUNTERED') {
                setToast('✓ Counter offer sent!')
            } else {
                setToast('Offer declined.')
            }
            setTimeout(() => setToast(null), 6000)
        } catch (err: any) {
            setToast(`Error: ${err.message}`)
            setTimeout(() => setToast(null), 4000)
        } finally {
            setResponding(null)
        }
    }

    const handleConfirmSale = async (data: { soldPrice: number; buyerName: string; buyerEmail: string }) => {
        if (!saleModal) return
        setConfirmingSale(true)
        try {
            await recordSale(saleModal.listing.id, {
                soldPrice: data.soldPrice,
                buyerId: saleModal.offer.buyerId,
                buyerName: data.buyerName || undefined,
                buyerEmail: data.buyerEmail || undefined,
            })
            setToast('✓ Sale recorded! Your earnings have been updated.')
            setTimeout(() => setToast(null), 5000)
            setListings(prev => prev.filter(l => l.id !== saleModal.listing.id))
            setSaleModal(null)
        } catch (err: any) {
            setToast(err.message || 'Failed to record sale')
            setTimeout(() => setToast(null), 4000)
        } finally {
            setConfirmingSale(false)
        }
    }

    const handleMessageBuyer = async (buyerId: string, listingId: string) => {
        setStartingChat(buyerId)
        try {
            const room = await createChatRoom(buyerId, listingId)
            router.push(`/dashboard/seller/messages?room=${room.id}`)
        } catch (err: any) {
            setToast(`Error: ${err.message || 'Failed to start chat'}`)
            setTimeout(() => setToast(null), 4000)
        } finally {
            setStartingChat(null)
        }
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" />
                <main className="flex-1 space-y-6">
                    <div className="max-w-4xl mx-auto">
                        {/* Toast */}
                        {toast && (
                            <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-white/10 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4">
                                {toast}
                            </div>
                        )}

                        {/* Sale Modal */}
                        {saleModal && (
                            <MarkAsSoldModal
                                offer={saleModal.offer}
                                listing={saleModal.listing}
                                onConfirm={handleConfirmSale}
                                onClose={() => !confirmingSale && setSaleModal(null)}
                                confirming={confirmingSale}
                            />
                        )}

                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-1 flex items-center gap-3">
                                <Tag className="text-primary" size={24} /> Incoming Offers
                            </h1>
                            <p className="text-gray-400 text-sm">Review and respond to buyer offers on your listings.</p>
                        </div>

                        {loadingListings && (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="animate-spin text-primary w-10 h-10" />
                            </div>
                        )}

                        {error && (
                            <div className="glass-card p-8 text-center">
                                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                                <p className="text-white font-bold mb-2">Failed to load listings</p>
                                <p className="text-gray-400 text-sm">{error}</p>
                            </div>
                        )}

                        {!loadingListings && !error && listings.length === 0 && (
                            <div className="glass-card p-10 text-center">
                                <Car className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                <h2 className="text-xl font-bold text-white mb-2">No Listings Yet</h2>
                                <p className="text-gray-400 mb-6 text-sm">Create your first listing to start receiving offers.</p>
                                <Link href="/sell">
                                    <Button className="shadow-neon">List My Car</Button>
                                </Link>
                            </div>
                        )}

                        {/* Listings list */}
                        <div className="space-y-4">
                            {listings.map(listing => {
                                const isOpen = expanded.has(listing.id)
                                const listingOffers = offers[listing.id] ?? []
                                const pendingCount = listingOffers.filter(o => o.status === 'PENDING').length
                                const image = listing.images?.[0] ?? "/assets/images/featured-sports.png"

                                return (
                                    <div key={listing.id} className="glass-card overflow-hidden">
                                        {/* Listing row (clickable header) */}
                                        <button
                                            onClick={() => toggleExpand(listing.id)}
                                            className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors text-left"
                                        >
                                            <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-800 border border-white/10">
                                                <Image src={image} alt={listing.title} fill className="object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white truncate">{listing.title}</p>
                                                <p className="text-xs text-gray-400">
                                                    {listing.priceMin && listing.priceMax
                                                        ? `£${Number(listing.priceMin).toLocaleString('en-GB')} – £${Number(listing.priceMax).toLocaleString('en-GB')}`
                                                        : `£${Number(listing.price).toLocaleString('en-GB')}`}
                                                </p>
                                            </div>
                                            {pendingCount > 0 && (
                                                <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                                    {pendingCount} pending
                                                </span>
                                            )}
                                            <ChevronRight size={18} className={`text-gray-500 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                                        </button>

                                        {/* Offers section */}
                                        {isOpen && (
                                            <div className="border-t border-white/10 bg-black/20">
                                                {loadingOffers[listing.id] ? (
                                                    <div className="flex justify-center py-8">
                                                        <Loader2 className="animate-spin text-primary w-7 h-7" />
                                                    </div>
                                                ) : listingOffers.length === 0 ? (
                                                    <div className="py-8 text-center text-gray-500 text-sm">
                                                        No offers yet on this listing.
                                                    </div>
                                                ) : (
                                                    <div className="p-4 space-y-3">
                                                        {listingOffers.map(offer => (
                                                            <OfferRow
                                                                key={offer.id}
                                                                offer={offer}
                                                                listingId={listing.id}
                                                                onRespond={(id, status, amount) => handleRespond(id, listing.id, status, amount)}
                                                                onMessage={(buyerId) => handleMessageBuyer(buyerId, listing.id)}
                                                                onOpenSaleModal={(o) => setSaleModal({ offer: o, listing })}
                                                                startingChat={startingChat}
                                                                responding={responding}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
