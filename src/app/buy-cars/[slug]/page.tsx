"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { AccordionItem } from "@/components/ui/Accordion"
import dynamic from "next/dynamic"
const FinanceCalculator = dynamic(() => import("@/components/features/FinanceCalculator").then(mod => mod.FinanceCalculator), { ssr: false })
const ThreeDVehicleViewer = dynamic(() => import("@/components/listing/ThreeDVehicleViewer").then(m => m.ThreeDVehicleViewer), { ssr: false })
import { ThreeDErrorBoundary } from "@/components/listing/ThreeDErrorBoundary"
import { ArrowLeft, Camera, CheckCircle, ShieldCheck, Cog, Music, Car as CarIcon, MapPin, Share2, Heart, Scale, Loader2, MessageCircle, Tag, X, Clock, ThumbsUp, XCircle, AlertTriangle, BadgeCheck, Star, Sparkles, Info, Phone, Globe, Fuel, Gavel, Truck } from "lucide-react"
import { getListingBySlug, makeOffer, getMyOfferForListing, addToWatchlist, removeFromWatchlist, isInWatchlist as checkWatchlist, getDamageRecords, type Listing, type LatestOffer, formatPrice } from "@/lib/listingApi"
import { triggerBuyItNow } from "@/lib/auctionApi"
import { createChatRoom } from "@/lib/chatApi"
import { useAuth } from "@/context/AuthContext"
import { useRouter, useSearchParams } from "next/navigation"
import { VehicleJsonLd } from "@/components/seo/JsonLd"
import { Input } from "@/components/ui/Input"
import { SellerBadge } from "@/components/ui/SellerBadge"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { HpiReportModal } from "@/components/hpi/HpiReportModal"
import { BODY_TYPE_LABELS, FUEL_TYPE_LABELS } from '@/lib/vehicleLabels'
import { useLocation } from '@/context/LocationContext'
import { haversineDistanceMiles } from '@/lib/distance'
import { useCompare } from '@/context/CompareContext'

// ─── Offer Status Chip ───────────────────────────────────────────────────────
// viewerRole: 'buyer' = the person who made the offer
//              'seller' = the listing owner
//              'public' = anyone else (logged in or not)

function OfferStatusChip({ offer, viewerRole }: { offer: LatestOffer; viewerRole: 'buyer' | 'seller' | 'public' }) {
    const amountDisplay = `£${Number(offer.amount).toLocaleString('en-GB')}`

    // — Buyer view: personalised with status-specific wording —
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
    }

    // — Seller view: they can see the amount + status, but no action here —
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
    }

    // — Public view: show amount + neutral status wording, no personal details —
    const statusLabel =
        offer.status === 'PENDING' ? 'pending review' :
            offer.status === 'ACCEPTED' ? 'accepted' :
                offer.status === 'REJECTED' ? 'declined' :
                    offer.status === 'WITHDRAWN' ? 'withdrawn' : ''

    return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
            <Tag size={14} className="shrink-0" />
            <span>An offer of <strong className="text-white">{amountDisplay}</strong> has been made on this listing{statusLabel ? ` — ${statusLabel}` : ''}.</span>
        </div>
    )
}

// ─── Offer Modal ─────────────────────────────────────────────────────────────

function OfferModal({
    listing, onClose, onSuccess,
}: {
    listing: Listing
    onClose: () => void
    onSuccess: (offer: LatestOffer) => void
}) {
    const askingPrice = Number(listing.price)
    const minAllowedOffer = Math.floor(askingPrice * 0.7)

    const [offerAmountStr, setOfferAmountStr] = React.useState(String(Math.round(askingPrice * 0.9)))
    const offerAmount = Number(offerAmountStr)
    const [message, setMessage] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const isInvalid = !offerAmountStr || offerAmount < minAllowedOffer

    const handleSubmit = async () => {
        if (isInvalid) return
        setLoading(true); setError(null)
        try {
            const offer = await makeOffer(listing.id, offerAmount, message || undefined)
            onSuccess(offer as unknown as LatestOffer)
        } catch (err: any) {
            setError(err.message || "Failed to submit offer.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={onClose}>
            <div className="glass-card p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-red-800 rounded-t-2xl" />
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary"><Tag size={18} /></div>
                    <div>
                        <h2 className="text-xl font-bold font-heading text-white">Make an Offer</h2>
                        <p className="text-xs text-gray-400">{listing.title}</p>
                    </div>
                </div>

                <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Seller&apos;s Asking Price</span>
                        <span className="text-white font-semibold">£{askingPrice.toLocaleString('en-GB')}</span>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">Your Offer</label>
                    <p className="text-xs text-gray-500 mb-3">Set the amount you&apos;re willing to pay.</p>
                    <div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">£</span>
                            <Input type="number" value={offerAmountStr} step={100}
                                min={minAllowedOffer}
                                onChange={(e) => setOfferAmountStr(e.target.value)}
                                placeholder="0"
                                className="bg-slate-900/50 border-white/10 text-white pl-8 focus:border-primary" />
                        </div>
                        {offerAmountStr && offerAmount < minAllowedOffer && (
                            <p className="text-red-400 text-xs mt-2">
                                Offer must be at least £{minAllowedOffer.toLocaleString('en-GB')} (70% of asking price).
                            </p>
                        )}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">
                        Message <span className="text-gray-600 font-normal normal-case">(optional)</span>
                    </label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. I can collect this weekend..."
                        rows={3} maxLength={500}
                        className="w-full bg-slate-900/50 border border-white/10 text-white placeholder:text-gray-600 rounded-md p-3 text-sm resize-none focus:outline-none focus:border-primary" />
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white" onClick={onClose}>Cancel</Button>
                    <Button className="flex-1 shadow-neon" disabled={loading || isInvalid} onClick={handleSubmit}>
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Submitting...</> : `Submit Offer`}
                    </Button>
                </div>
            </div>
        </div>
    )
}

function getYouTubeEmbedId(url: string): string | null {
    try {
        const u = new URL(url)
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0]
        if (u.hostname.includes('youtube.com')) return u.searchParams.get('v')
        return null
    } catch { return null }
}

function getVideoPlatform(url: string): 'youtube' | 'instagram' | 'facebook' | 'x' | 'other' {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook'
    if (url.includes('x.com') || url.includes('twitter.com')) return 'x'
    return 'other'
}

function VehicleDetailsContent({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = React.use(params)
    const router = useRouter()
    const searchParams = useSearchParams()
    const isEditMode = searchParams.get('editOffer') === 'true'
    const { user } = useAuth()
    const [listing, setListing] = React.useState<Listing | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeImage, setActiveImage] = React.useState(0)
    const [isDescExpanded, setIsDescExpanded] = React.useState(false)
    const [enquiring, setEnquiring] = React.useState(false)
    const [showOfferModal, setShowOfferModal] = React.useState(false)
    const [latestOffer, setLatestOffer] = React.useState<LatestOffer | null>(null)
    const [myOffer, setMyOffer] = React.useState<LatestOffer | null>(null)
    const [offerSuccess, setOfferSuccess] = React.useState(false)
    const [isWatchlisted, setIsWatchlisted] = React.useState(false)
    const [watchlistLoading, setWatchlistLoading] = React.useState(false)
    const [shareToast, setShareToast] = React.useState(false)
    const [showHpiModal, setShowHpiModal] = React.useState(false)
    const [damageRecords, setDamageRecords] = React.useState<any[]>([])
    const [selectedDamageZone, setSelectedDamageZone] = React.useState<string | null>(null)
    const [deliveryDistanceInfo, setDeliveryDistanceInfo] = React.useState<{ distanceMiles: number } | null>(null)

    const { location: userLoc } = useLocation()
    const { addToCompare } = useCompare()
    const distanceFromUser = React.useMemo(() => {
        if (!userLoc.lat || !userLoc.lng || !listing?.latitude || !listing?.longitude) return null
        return haversineDistanceMiles(userLoc.lat, userLoc.lng, listing.latitude, listing.longitude)
    }, [userLoc, listing])

    // Auto-open offer modal if navigated with ?editOffer=true
    React.useEffect(() => {
        if (isEditMode) setShowOfferModal(true)
    }, [isEditMode])

    React.useEffect(() => {
        async function fetchListing() {
            try {
                setLoading(true)
                const data = await getListingBySlug(slug)
                setListing(data)
                if (data.offers && data.offers.length > 0) {
                    setLatestOffer(data.offers[0])
                }
            } catch (err) {
                console.error('Failed to fetch listing:', err)
                setError('Failed to load vehicle details')
            } finally {
                setLoading(false)
            }
        }
        if (slug) fetchListing()
    }, [slug])

    // Separately fetch the current user's own offer for this listing
    // This runs after the listing is loaded so we have the listing ID
    React.useEffect(() => {
        if (!user || !listing) return
        // Don't fetch for the seller — they can't make offers on their own listing
        if (listing.sellerId === user.id) return
        getMyOfferForListing(listing.id).then(setMyOffer).catch(() => { })
    }, [user, listing])

    // Check if listing is in user's watchlist
    React.useEffect(() => {
        if (!user || !listing) return
        checkWatchlist(listing.id).then(setIsWatchlisted).catch(() => { })
    }, [user, listing])

    // Fetch damage records (publicly visible — builds buyer trust)
    React.useEffect(() => {
        if (!listing) return
        getDamageRecords(listing.id).then(setDamageRecords).catch(() => { })
    }, [listing])

    // Delivery distance check — informational only, used to show greyed out-of-radius hint
    React.useEffect(() => {
        if (!listing?.deliveryAvailable || !listing?.deliveryMaxMiles || !listing?.latitude || !listing?.longitude || !userLoc?.postcode) return
        fetch(`/api/delivery-distance?originLat=${listing.latitude}&originLng=${listing.longitude}&postcode=${userLoc.postcode}&pricePerMile=0`)
            .then(r => r.ok ? r.json() : null)
            .then(data => data && setDeliveryDistanceInfo(data))
            .catch(() => {})
    }, [listing?.id, userLoc?.postcode])

    // Determine the current viewer's relationship to the offer
    // Uses myOffer (not latestOffer) so third-party buyers aren't misidentified as 'public'
    const offerViewerRole: 'buyer' | 'seller' | 'public' = React.useMemo(() => {
        if (!user || !latestOffer) return 'public'
        if (listing?.sellerId === user.id) return 'seller'
        if (myOffer) return 'buyer'   // I have made an offer on this listing
        return 'public'
    }, [user, latestOffer, myOffer, listing])

    // Client-side document.title for SEO
    React.useEffect(() => {
        if (listing) {
            document.title = `${listing.title} — ${formatPrice(listing.price)} | CarMazium`
        }
        return () => { document.title = 'CarMazium — Buy & Sell Cars in London' }
    }, [listing])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        )
    }

    if (error || !listing) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col">
                <h1 className="text-2xl text-white mb-4">Vehicle not found</h1>
                <Link href="/search">
                    <Button>Back to Inventory</Button>
                </Link>
            </div>
        )
    }

    // Filter out invalid/placeholder image URLs
    const validImages = listing.images.filter(img =>
        img && !img.includes('example.com') && (img.startsWith('https://') || img.startsWith('/')))

    const vehicle = {
        id: listing.id,
        title: listing.title,
        subtitle: `${listing.engineSize ? `${listing.engineSize}cc` : ''} ${listing.bhp ? `${listing.bhp} BHP` : ''} | ${listing.transmission || ''} | ${listing.fuelType || ''}`,
        price: formatPrice(listing.price),
        images: validImages.length > 0 ? validImages : ["/assets/images/placeholder-car.png"],
        specs: {
            year: listing.year?.toString() || "-",
            mileage: listing.mileage ? `${listing.mileage.toLocaleString()} miles` : "-",
            engine: listing.bhp ? `${listing.bhp} bhp` : "-",
            transmission: listing.transmission || "-",
            doors: listing.doors?.toString() || "-",
            seats: listing.seats?.toString() || "-",
            color: listing.color || "-",
            mpg: "-",
        }
    }

    // BIN availability for auction listings
    const reserveMet = listing
        ? !!(listing.auction?.reservePrice && listing.bids?.[0]?.amount &&
              Number(listing.bids[0].amount) >= Number(listing.auction.reservePrice))
        : false

    const handleBinFromDetail = async () => {
        if (!listing?.auction?.id) return
        try {
            await triggerBuyItNow(listing.auction.id)
            router.push(`/auctions/live/${listing.auction.id}`)
        } catch {
            // BIN trigger failed — stay on page, user can try from live room
        }
    }

    const handleCompareAndNavigate = () => {
        if (!listing) return
        addToCompare(listing)
        router.push(`/compare?slug=${listing.slug}`)
    }

    const handleEnquire = async () => {
        // Must be logged in
        if (!user) {
            router.push('/auth/login?redirect=' + encodeURIComponent(`/buy-cars/${listing.slug}`))
            return
        }

        // Can't message yourself
        if (listing.sellerId && user.id === listing.sellerId) {
            alert("This is your own listing.")
            return
        }

        if (!listing.sellerId) {
            alert("Unable to contact the seller for this listing.")
            return
        }

        try {
            setEnquiring(true)
            // Create or find existing chat room with the seller about this listing
            const room = await createChatRoom(listing.sellerId, listing.id)
            router.push(`/dashboard/buyer/messages?room=${room.id}`)
        } catch (err: any) {
            console.error('Failed to create chat room:', err)
            alert(err.message || 'Failed to start enquiry. Please try again.')
        } finally {
            setEnquiring(false)
        }
    }

    const handleShare = async () => {
        const url = window.location.href
        const shareData = {
            title: listing.title,
            text: `Check out this ${listing.title} — ${formatPrice(listing.price)} on CarMazium`,
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
            // User cancelled share dialog — no-op
        }
    }

    const handleWatchlist = async () => {
        if (!user) {
            router.push('/auth/login?redirect=' + encodeURIComponent(`/buy-cars/${listing.slug}`))
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

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-36 lg:pb-12 relative">
            {/* Background gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            {/* Offer Modal */}
            {showOfferModal && listing && (
                <OfferModal
                    listing={listing}
                    onClose={() => setShowOfferModal(false)}
                    onSuccess={(offer) => {
                        setMyOffer(offer)            // update buyer's own offer
                        setLatestOffer(offer)         // also update the public display
                        setShowOfferModal(false)
                        setOfferSuccess(true)
                    }}
                />
            )}

            {/* Success toast */}
            {offerSuccess && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                    <CheckCircle size={18} />
                    <span className="text-sm font-semibold">Offer submitted! The seller will respond soon.</span>
                    <button onClick={() => setOfferSuccess(false)} className="ml-2"><X size={14} /></button>
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

            {/* HPI Report Modal */}
            {showHpiModal && listing && (
                <HpiReportModal listingId={listing.id} onClose={() => setShowHpiModal(false)} />
            )}
            {/* Vehicle JSON-LD */}
            <VehicleJsonLd
                name={listing.title}
                description={`${listing.year} ${listing.make} ${listing.model} — ${formatPrice(listing.price)}. ${listing.mileage?.toLocaleString() || 0} miles, ${listing.fuelType || 'N/A'}, ${listing.transmission || 'N/A'}.`}
                image={validImages[0]}
                url={`https://carmazium.co.uk/buy-cars/${listing.slug}`}
                make={listing.make || 'Unknown'}
                model={listing.model || 'Unknown'}
                year={listing.year ?? 0}
                mileage={listing.mileage ?? undefined}
                fuelType={listing.fuelType ?? undefined}
                transmission={listing.transmission ?? undefined}
                color={listing.color ?? undefined}
                price={Number(listing.price)}
                condition={listing.condition ?? undefined}
                vin={listing.vin ?? undefined}
                engineSize={listing.engineSize ?? undefined}
            />

            <div className="container mx-auto px-5">
                {/* Breadcrumb & Header */}
                <div className="mb-8">
                    <Link href="/search" className="text-gray-400 hover:text-primary text-sm flex items-center mb-4 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Back to Inventory
                    </Link>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            {/* Category badge eyebrow — above H1 */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {listing.bodyType && BODY_TYPE_LABELS[listing.bodyType] && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1 bg-slate-700 border border-white/10 text-gray-200">
                                        <CarIcon size={11} /> {BODY_TYPE_LABELS[listing.bodyType]}
                                    </span>
                                )}
                                {listing.fuelType && FUEL_TYPE_LABELS[listing.fuelType] && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1 bg-slate-700 border border-white/10 text-gray-200">
                                        <Fuel size={11} /> {FUEL_TYPE_LABELS[listing.fuelType]}
                                    </span>
                                )}
                                {listing.type === 'AUCTION' && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400">
                                        <Gavel size={11} /> Auction
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl md:text-5xl font-bold font-heading text-white mb-2">{vehicle.title}</h1>
                            <p className="text-gray-300 text-lg">{vehicle.subtitle}</p>
                            {/* Badges Row */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                {/* SOLD pill — shown prominently when listing is closed */}
                                {String(listing.status) === 'SOLD' && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/40 px-3 py-1.5 rounded-full">
                                        <XCircle size={12} /> Sold
                                    </span>
                                )}
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
                                {/* Deceased Estate badge */}
                                {listing.isDepartedSale && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
                                        <span>Deceased Estate</span>
                                        {listing.departedRelationship && (
                                            <span className="text-purple-400/70">· Listed by {listing.departedRelationship}</span>
                                        )}
                                    </div>
                                )}
                                {/* Original platform listing link */}
                                {listing.importedFromUrl && (
                                    <a
                                        href={listing.importedFromUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-500/10 text-slate-300 border border-slate-500/30 px-2.5 py-1 rounded-full hover:bg-slate-500/20 transition-colors"
                                    >
                                        <Globe size={10} /> See on {listing.importedSource ? { AUTOTRADER: 'AutoTrader', CARGURUS: 'CarGurus', CARWOW: 'CarWow' }[listing.importedSource] ?? listing.importedSource : 'Original Platform'}
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="hidden lg:flex gap-4">
                            <Button
                                variant="outline"
                                className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white"
                                onClick={handleCompareAndNavigate}
                            >
                                <Scale size={20} className="mr-2" /> Compare
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white" onClick={handleShare}>
                                <Share2 size={20} />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className={`rounded-full transition-all ${isWatchlisted ? 'bg-red-500/20 border-red-500/50 text-red-500' : 'border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-500'}`}
                                onClick={handleWatchlist}
                                disabled={watchlistLoading}
                            >
                                <Heart size={20} className={isWatchlisted ? 'fill-red-500' : ''} />
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
                                    src={vehicle.images[activeImage] || vehicle.images[0]}
                                    alt={vehicle.title}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 66vw"
                                    className={`object-cover transition-all duration-300 ${String(listing.status) === 'SOLD' ? 'opacity-50 grayscale' : ''}`}
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
                                    <Camera size={16} /> {activeImage + 1}/{vehicle.images.length}
                                </div>
                                {/* SOLD watermark */}
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
                                {vehicle.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImage(idx)}
                                        className={`relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${activeImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    >
                                        <Image src={img} alt={`Thumb ${idx}`} fill sizes="96px" className="object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mobile Buy Car Box — shown below gallery on small screens */}
                        <div className="block lg:hidden space-y-6">
                            <div className="bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                                <div className="h-1 bg-primary w-full absolute top-0" />
                                <div className="p-6">
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

                                    {listing.linkedListingId && listing.linkedListing?.auction?.status === 'ACTIVE' && (
                                        <Link
                                            href={`/auctions/live/${listing.linkedListing.auction.id}`}
                                            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group"
                                        >
                                            <Gavel size={16} className="text-amber-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-amber-300 font-bold text-xs uppercase tracking-wide">Also in Live Auction</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">
                                                    Closes {new Date(listing.linkedListing.auction.endTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <span className="text-amber-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform">View →</span>
                                        </Link>
                                    )}
                                    <div className="mb-6">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <Info size={14} className="text-gray-500" />
                                            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Policies</span>
                                        </div>
                                        <div>
                                            <div className="text-4xl font-bold text-white mb-2">{formatPrice(listing.price)}</div>
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-full mb-4">
                                                Offers Welcome
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-3">Price includes VAT. Financing available from 19% APR.</p>
                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                            <Clock size={12} /> Listed on {new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>

                                    {(offerViewerRole === 'buyer' ? myOffer : latestOffer) && (
                                        <div className="mb-4">
                                            <OfferStatusChip
                                                offer={(offerViewerRole === 'buyer' ? myOffer : latestOffer)!}
                                                viewerRole={offerViewerRole}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {String(listing.status) === 'SOLD' ? (
                                            <div className="bg-slate-800/80 border-2 border-red-500/30 rounded-2xl p-6 text-center">
                                                <XCircle size={48} className="text-red-500 mx-auto mb-3 opacity-80" />
                                                <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">Vehicle Sold</h3>
                                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">This listing is closed</p>
                                            </div>
                                        ) : listing.sellerId !== user?.id && (
                                            <>
                                                <Button
                                                    className="w-full py-6 text-lg shadow-neon"
                                                    onClick={() => setShowOfferModal(true)}
                                                    disabled={offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'}
                                                >
                                                    {offerViewerRole === 'buyer' && myOffer?.status === 'PENDING'
                                                        ? 'Edit My Offer'
                                                        : offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'
                                                            ? '✓ Offer Accepted'
                                                            : 'Make an Offer'}
                                                </Button>
                                                <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10" onClick={handleEnquire} disabled={enquiring}>
                                                    {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Starting Chat...</> : <><MessageCircle className="w-5 h-5 mr-2" />Enquire</>}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
                                    <MapPin size={14} />
                                    <span>{listing.location || 'Location not specified'}</span>
                                </div>
                            </div>

                        </div>

                        {/* Vehicle Description */}
                        {listing.description && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Vehicle Description</h3>
                                <div className={`text-gray-300 leading-relaxed whitespace-pre-wrap relative ${!isDescExpanded ? 'line-clamp-4 overflow-hidden' : ''}`}>
                                    {listing.description}
                                    {!isDescExpanded && (
                                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-800/90 to-transparent"></div>
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

                        {/* Video Embeds */}
                        {listing.videoUrls && listing.videoUrls.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Videos</h3>
                                <div className="space-y-4">
                                    {(listing.videoUrls as string[]).map((url, idx) => {
                                        const platform = getVideoPlatform(url)
                                        const ytId = platform === 'youtube' ? getYouTubeEmbedId(url) : null
                                        if (ytId) {
                                            return (
                                                <div key={idx} className="aspect-video rounded-xl overflow-hidden bg-black">
                                                    <iframe
                                                        src={`https://www.youtube.com/embed/${ytId}`}
                                                        title={`Video ${idx + 1}`}
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        className="w-full h-full"
                                                    />
                                                </div>
                                            )
                                        }
                                        const platformLabel = platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : platform === 'x' ? 'X (Twitter)' : 'External Video'
                                        return (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                                            >
                                                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                                                    <Camera size={20} className="text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black uppercase tracking-wider text-primary mb-0.5">{platformLabel}</p>
                                                    <p className="text-sm text-gray-400 truncate">{url}</p>
                                                </div>
                                                <ArrowLeft size={16} className="text-gray-500 rotate-180 shrink-0 group-hover:text-primary transition-colors" />
                                            </a>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Features */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Vehicle Features</h3>
                            {listing.features && Array.isArray(listing.features) && listing.features.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {listing.features.map((feature, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-gray-300">
                                            <CheckCircle size={16} className="text-primary shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-400 italic">No features listed.</p>
                            )}
                        </div>

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
                                        {listing.owners && (
                                            <div className="flex justify-between py-0.5">
                                                <span className="text-gray-400 text-sm">Previous Owners</span>
                                                <span className="text-white font-semibold text-sm">
                                                    {listing.owners === '1' ? '1 Owner' : listing.owners === '5+' ? '5+ Owners' : `${listing.owners} Owners`}
                                                </span>
                                            </div>
                                        )}
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

                        {/* Damage Report Section */}
                        {damageRecords.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-2 border-l-4 border-amber-500 pl-4">Reported Damage</h3>
                                <p className="text-xs text-gray-500 mb-4 pl-5">{damageRecords.length} zone{damageRecords.length !== 1 ? 's' : ''} marked by seller — click a zone to see details</p>

                                {/* WebGL isn't guaranteed on every device (in-app
                                    browsers, low-power mode, older phones) — wrap
                                    in an error boundary so a renderer init failure
                                    here can't crash the whole listing page. */}
                                <ThreeDErrorBoundary
                                    fallback={
                                        <div className="w-full rounded-2xl border border-white/8 bg-slate-950/80 flex flex-col items-center justify-center gap-2 text-center px-6" style={{ height: 400 }}>
                                            <AlertTriangle className="text-amber-400" size={22} />
                                            <p className="text-sm font-bold text-white">3D preview isn&apos;t available on this device</p>
                                            <p className="text-xs text-gray-500 max-w-xs">No problem — the damage details are listed below.</p>
                                        </div>
                                    }
                                >
                                    <ThreeDVehicleViewer
                                        bodyType={listing.bodyType ?? undefined}
                                        markedZones={damageRecords.map((r: any) => r.part)}
                                        selectedZone={selectedDamageZone}
                                        onZoneClick={(id) => setSelectedDamageZone(prev => prev === id ? null : id)}
                                    />
                                </ThreeDErrorBoundary>

                                {/* Damage list */}
                                <div className="mt-4 space-y-2">
                                    {damageRecords.map((record: any, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDamageZone(prev => prev === record.part ? null : record.part)}
                                            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${selectedDamageZone === record.part ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/50 border-white/5 hover:border-white/10'}`}
                                        >
                                            {record.imageUrl && (
                                                <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 border border-white/10">
                                                    <Image src={record.imageUrl} alt={record.part} fill className="object-cover" sizes="48px" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white">{record.part.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                                                <p className="text-xs text-gray-400">{record.type}{record.size ? ` — ${record.size}` : ''}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* HPI Report Section */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                        <ShieldCheck size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">HPI History Check</p>
                                        <p className="text-xs text-gray-400">Comprehensive vehicle history report — stolen, finance, write-off & more</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowHpiModal(true)}
                                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors"
                                >
                                    <ShieldCheck size={13} /> View Report
                                </button>
                            </div>
                        </div>

                        {/* Finance Calculator */}
                        <FinanceCalculator vehiclePrice={Number(listing.price)} />
                    </div>

                    {/* Right Column: Sticky Sidebar — desktop only */}
                    <div className="lg:col-span-1 hidden lg:block">
                        <div className="sticky top-28 space-y-6">
                            <div className="bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                            <div className="h-1 bg-primary w-full absolute top-0" />
                            <div className="p-6">
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

                                {/* Trust panel */}
                                <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                        <ShieldCheck size={15} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-emerald-400 leading-tight">Verified</p>
                                        {listing.seller?.listingCount != null && (
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                {listing.seller.listingCount} active listing{listing.seller.listingCount !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>

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

                                {String(listing.status) === 'SOLD' ? (
                                    <>
                                        <div className="mb-6 p-6 rounded-xl border-2 border-red-500/30 bg-red-500/10 text-center relative overflow-hidden">
                                            <span className="block text-4xl font-black text-red-500 tracking-tighter mb-1">SOLD</span>
                                            <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">This vehicle is no longer available</p>
                                        </div>
                                        <div className="bg-slate-800/80 border-2 border-red-500/30 rounded-2xl p-6 text-center">
                                            <XCircle size={48} className="text-red-500 mx-auto mb-3 opacity-80" />
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">Vehicle Sold</h3>
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">This listing is closed</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {listing.linkedListingId && listing.linkedListing?.auction?.status === 'ACTIVE' && (
                                            <Link
                                                href={`/auctions/live/${listing.linkedListing.auction.id}`}
                                                className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group"
                                            >
                                                <Gavel size={16} className="text-amber-400 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-amber-300 font-bold text-xs uppercase tracking-wide">Also in Live Auction</div>
                                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                                        Closes {new Date(listing.linkedListing.auction.endTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <span className="text-amber-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform">View →</span>
                                            </Link>
                                        )}
                                        <div className="mb-6">
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
                                            <p className="text-xs text-gray-400 mt-3">Price includes VAT. Financing available from 19% APR.</p>
                                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                <Clock size={12} /> Listed on {new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>

                                        {/* Offer Status */}
                                        {/* Buyer sees their own offer chip; seller/public see the listing's latest offer chip */}
                                        {(offerViewerRole === 'buyer' ? myOffer : latestOffer) && (
                                            <div className="mb-4">
                                                <OfferStatusChip
                                                    offer={(offerViewerRole === 'buyer' ? myOffer : latestOffer)!}
                                                    viewerRole={offerViewerRole}
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {listing.sellerId !== user?.id && (
                                                <>
                                                    <Button
                                                        className="w-full py-6 text-lg shadow-neon"
                                                        onClick={() => setShowOfferModal(true)}
                                                        disabled={offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'}
                                                    >
                                                        {offerViewerRole === 'buyer' && myOffer?.status === 'PENDING'
                                                            ? 'Edit My Offer'
                                                            : offerViewerRole === 'buyer' && myOffer?.status === 'ACCEPTED'
                                                                ? '✓ Offer Accepted'
                                                                : 'Make an Offer'}
                                                    </Button>
                                                    <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10" onClick={handleEnquire} disabled={enquiring}>
                                                        {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Starting Chat...</> : <><MessageCircle className="w-5 h-5 mr-2" />Enquire</>}
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        {/* Buy It Now section — auction listings only, reserve not met */}
                                        {listing.type === 'AUCTION' &&
                                         listing.auction?.status === 'ACTIVE' &&
                                         listing.auction?.buyItNowPrice &&
                                         !reserveMet && (
                                            <div className="rounded-xl border border-primary/40 bg-slate-900/60 p-4 mt-4">
                                                <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Buy It Now</p>
                                                <p className="text-2xl font-mono font-bold text-white mb-3">
                                                    £{Number(listing.auction.buyItNowPrice).toLocaleString('en-GB')}
                                                </p>
                                                <button
                                                    onClick={handleBinFromDetail}
                                                    className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors"
                                                >
                                                    Buy Now
                                                </button>
                                                <p className="text-xs text-slate-500 mt-2 text-center">Seller must confirm within 24h</p>
                                            </div>
                                        )}

                                        {/* Delivery availability section */}
                                        {listing.deliveryAvailable && (() => {
                                            const isOutsideRadius = listing.deliveryMaxMiles && deliveryDistanceInfo
                                                ? deliveryDistanceInfo.distanceMiles > listing.deliveryMaxMiles
                                                : false
                                            return isOutsideRadius ? (
                                                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 opacity-60 space-y-1 mt-4">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={16} className="text-gray-500" />
                                                        <span className="text-sm font-semibold text-gray-400">Delivery not available to your location</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500">Outside the seller&apos;s {listing.deliveryMaxMiles}-mile radius</p>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 mt-4">
                                                    <div className="flex items-center gap-2">
                                                        <Truck size={16} className="text-emerald-400" />
                                                        <span className="text-sm font-semibold text-emerald-300">Delivery available</span>
                                                    </div>
                                                    {listing.deliveryPricePerMile ? (
                                                        <p className="text-xs text-gray-400">
                                                            £{Number(listing.deliveryPricePerMile).toFixed(2)} per mile · Request delivery after making an offer
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-gray-400">Cost to be discussed · Request delivery after making an offer</p>
                                                    )}
                                                    {listing.deliveryMaxMiles && (
                                                        <p className="text-xs text-gray-500">Max radius: {listing.deliveryMaxMiles} miles</p>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </>
                                )}
                            </div>

                            {/* Location Display */}
                            <div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
                                <MapPin size={14} />
                                <span>
                                    {listing.location || 'Location not specified'}
                                    {distanceFromUser != null && (
                                        <> · <span className="text-primary font-semibold">{Math.round(distanceFromUser)} miles away</span></>
                                    )}
                                </span>
                            </div>
                        </div>

                    </div>
                    </div>
                </div>
            </div>

            {/* Mobile sticky action bar — lg:hidden */}
            <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900/95 backdrop-blur-md border-t border-white/10 p-3 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-center gap-2">
                    <Button
                        className="flex-1 py-5"
                        onClick={() => setShowOfferModal(true)}
                    >
                        Make an Offer
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 border-white/10 text-gray-400"
                        onClick={handleEnquire}
                        title="Enquire"
                    >
                        <MessageCircle size={18} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className={`h-11 w-11 shrink-0 transition-all ${isWatchlisted ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'border-white/10 text-gray-400'}`}
                        onClick={handleWatchlist}
                        title="Save"
                    >
                        <Heart size={18} className={isWatchlisted ? 'fill-red-400' : ''} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 border-white/10 text-gray-400"
                        onClick={handleShare}
                        title="Share"
                    >
                        <Share2 size={18} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 shrink-0 border-white/10 text-gray-400"
                        onClick={handleCompareAndNavigate}
                        title="Compare"
                    >
                        <Scale size={18} />
                    </Button>
                </div>
            </div>
        </div >
    )
}

export default function VehicleDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <VehicleDetailsContent params={params} />
        </React.Suspense>
    )
}
