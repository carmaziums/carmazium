"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import {
    Loader2, AlertTriangle, Tag, CheckCircle, XCircle,
    Clock, ChevronRight, Car, MessageSquare,
} from "lucide-react"
import { getOffersForListing, getMyListings, respondToOffer, type Offer, type Listing } from "@/lib/listingApi"
import Image from "next/image"
import Link from "next/link"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Offer['status'] }) {
    const styles: Record<string, string> = {
        PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        ACCEPTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
        WITHDRAWN: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    }
    const icons: Record<string, React.ReactNode> = {
        PENDING: <Clock size={11} />,
        ACCEPTED: <CheckCircle size={11} />,
        REJECTED: <XCircle size={11} />,
        WITHDRAWN: <XCircle size={11} />,
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

// ─── Offer Row ────────────────────────────────────────────────────────────────

function OfferRow({
    offer,
    onRespond,
    responding,
}: {
    offer: Offer
    onRespond: (id: string, status: 'ACCEPTED' | 'REJECTED') => void
    responding: string | null
}) {
    const buyer = offer.buyer
    const isPending = offer.status === 'PENDING'
    const isResponding = responding === offer.id

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
                <p className="text-2xl font-bold text-primary font-mono">{formatGBP(offer.amount)}</p>
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
            {isPending && (
                <div className="flex gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 gap-1"
                        disabled={isResponding}
                        onClick={() => onRespond(offer.id, 'REJECTED')}
                    >
                        {isResponding ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Decline
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 gap-1 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                        disabled={isResponding}
                        onClick={() => onRespond(offer.id, 'ACCEPTED')}
                    >
                        {isResponding ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        Accept
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
    const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
    const [toast, setToast] = React.useState<string | null>(null)

    // Load all seller's listings
    React.useEffect(() => {
        const load = async () => {
            try {
                setLoadingListings(true)
                const res = await getMyListings({ limit: 50 })
                setListings(res.data)
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
        if (offers[listingId]) return // already loaded
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

    const handleRespond = async (offerId: string, listingId: string, status: 'ACCEPTED' | 'REJECTED') => {
        setResponding(offerId)
        try {
            await respondToOffer(offerId, status)
            // Refresh offers for this listing
            const updated = await getOffersForListing(listingId)
            setOffers(prev => ({ ...prev, [listingId]: updated }))
            setToast(status === 'ACCEPTED' ? '✓ Offer accepted! Buyer has been notified.' : 'Offer declined.')
            setTimeout(() => setToast(null), 4000)
        } catch (err: any) {
            setToast(`Error: ${err.message}`)
            setTimeout(() => setToast(null), 4000)
        } finally {
            setResponding(null)
        }
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-white/10 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-4">
                    {toast}
                </div>
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
                                                    onRespond={(id, status) => handleRespond(id, listing.id, status)}
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
    )
}
