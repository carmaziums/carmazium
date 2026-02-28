"use client"

import * as React from "react"
import { getMyOffers, type Offer } from "@/lib/listingApi"
import { Loader2, AlertTriangle, Tag, Clock, CheckCircle, XCircle, ChevronRight } from "lucide-react"
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

function StatusMessage({ status, amount }: { status: Offer['status'], amount: string | number }) {
    const formatted = `£${Number(amount).toLocaleString('en-GB')}`
    if (status === 'PENDING') return (
        <p className="text-xs text-amber-300 mt-1">
            ⏳ Awaiting seller response for your offer of {formatted}
        </p>
    )
    if (status === 'ACCEPTED') return (
        <p className="text-xs text-emerald-300 mt-1">
            🎉 Your offer of {formatted} was accepted! Contact the seller to complete the purchase.
        </p>
    )
    if (status === 'REJECTED') return (
        <p className="text-xs text-red-300 mt-1">
            Your offer of {formatted} was declined. You may visit the listing to make a new offer.
        </p>
    )
    return null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuyerOffersPage() {
    const [offers, setOffers] = React.useState<Offer[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const data = await getMyOffers()
                setOffers(data)
            } catch (err: any) {
                setError(err.message || "Failed to load offers")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-1 flex items-center gap-3">
                    <Tag className="text-primary" size={24} /> My Offers
                </h1>
                <p className="text-gray-400 text-sm">Track all offers you&apos;ve submitted on listings.</p>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary w-10 h-10" />
                </div>
            )}

            {error && (
                <div className="glass-card p-8 text-center">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <p className="text-white font-bold mb-2">Failed to load offers</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                </div>
            )}

            {!loading && !error && offers.length === 0 && (
                <div className="glass-card p-10 text-center">
                    <Tag className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Offers Yet</h2>
                    <p className="text-gray-400 mb-6 text-sm">Browse listings with offer ranges and make your first offer.</p>
                    <Link href="/search">
                        <button className="bg-primary text-white font-bold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors">
                            Browse Cars
                        </button>
                    </Link>
                </div>
            )}

            <div className="space-y-4">
                {offers.map(offer => {
                    const listing = offer.listing
                    const image = listing?.images?.[0] ?? "/assets/images/featured-sports.png"
                    const slug = listing?.slug ?? ""

                    return (
                        <div key={offer.id} className="glass-card p-5">
                            <div className="flex items-start gap-4">
                                {/* Listing image */}
                                <Link href={`/buy-cars/${slug}`} className="shrink-0">
                                    <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-slate-800 border border-white/10">
                                        <Image src={image} alt={listing?.title ?? ""} fill className="object-cover" />
                                    </div>
                                </Link>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <Link
                                            href={`/buy-cars/${slug}`}
                                            className="font-bold text-white text-sm hover:text-primary transition-colors truncate"
                                        >
                                            {listing?.title ?? "Listing"}
                                        </Link>
                                        <StatusBadge status={offer.status} />
                                    </div>
                                    <p className="text-2xl font-bold text-primary font-mono">
                                        £{Number(offer.amount).toLocaleString('en-GB')}
                                    </p>
                                    <StatusMessage status={offer.status} amount={offer.amount} />
                                    <p className="text-[10px] text-gray-600 mt-2">
                                        Submitted {new Date(offer.createdAt).toLocaleDateString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                        })}
                                    </p>
                                </div>

                                {/* Go to listing */}
                                <Link href={`/buy-cars/${slug}`} className="shrink-0">
                                    <button className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/30 transition-colors">
                                        <ChevronRight size={16} />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
