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
    Clock, XCircle, ThumbsUp,
} from "lucide-react"
import { useCompare } from "@/context/CompareContext"
import { useAuth } from "@/context/AuthContext"
import { getListingBySlug, makeOffer, getMyOfferForListing, addToWatchlist, removeFromWatchlist, isInWatchlist as checkWatchlist, formatPrice, type Listing, type LatestOffer } from "@/lib/listingApi"
import { useRouter } from "next/navigation"

// ─── Offer Status Chip ───────────────────────────────────────────────────────

function OfferStatusChip({ offer, viewerRole }: { offer: LatestOffer; viewerRole: 'buyer' | 'seller' | 'public' }) {
    const amount = `£${Number(offer.amount).toLocaleString('en-GB')}`

    if (viewerRole === 'buyer') {
        if (offer.status === 'PENDING') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>Your offer of <strong>{amount}</strong> is awaiting the seller&apos;s response.</span>
            </div>
        )
        if (offer.status === 'REJECTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>Your offer of <strong>{amount}</strong> was declined. You may submit a new one.</span>
            </div>
        )
        if (offer.status === 'ACCEPTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <ThumbsUp size={14} className="shrink-0" />
                <span>🎉 Your offer of <strong>{amount}</strong> was accepted! Contact the seller to proceed.</span>
            </div>
        )
        if (offer.status === 'WITHDRAWN') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-500/10 border border-gray-500/30 text-gray-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>Your previous offer of <strong>{amount}</strong> was withdrawn. You can make a new offer.</span>
            </div>
        )
    }

    if (viewerRole === 'seller') {
        if (offer.status === 'PENDING') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                <Clock size={14} className="shrink-0" />
                <span>An offer of <strong>{amount}</strong> is awaiting your response. Manage it in your <strong>Seller Dashboard</strong>.</span>
            </div>
        )
        if (offer.status === 'ACCEPTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <ThumbsUp size={14} className="shrink-0" />
                <span>You accepted an offer of <strong>{amount}</strong> on this listing.</span>
            </div>
        )
        if (offer.status === 'REJECTED') return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <XCircle size={14} className="shrink-0" />
                <span>An offer of <strong>{amount}</strong> was declined.</span>
            </div>
        )
    }

    const statusLabel =
        offer.status === 'PENDING' ? 'pending review' :
            offer.status === 'ACCEPTED' ? 'accepted' :
                offer.status === 'REJECTED' ? 'declined' :
                    offer.status === 'WITHDRAWN' ? 'withdrawn' : ''

    return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">
            <Tag size={14} className="shrink-0" />
            <span>An offer of <strong className="text-white">{amount}</strong> has been made on this listing{statusLabel ? ` — ${statusLabel}` : ''}.</span>
        </div>
    )
}

// ─── Offer Modal ─────────────────────────────────────────────────────────────

function OfferModal({
    listing,
    onClose,
    onSuccess,
}: {
    listing: Listing,
    onClose: () => void,
    onSuccess: (offer: LatestOffer) => void,
}) {
    const min = listing.priceMin ? Number(listing.priceMin) : Number(listing.price) * 0.9
    const max = listing.priceMax ? Number(listing.priceMax) : Number(listing.price)

    const [amount, setAmount] = React.useState(min)
    const [message, setMessage] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const pct = Math.min(100, Math.max(0, ((amount - min) / (max - min)) * 100))
    const isOutOfRange = amount < min || amount > max

    const handleSubmit = async () => {
        if (isOutOfRange) return
        setLoading(true)
        setError(null)
        try {
            const offer = await makeOffer(listing.id, amount, message || undefined)
            onSuccess(offer as unknown as LatestOffer)
        } catch (err: any) {
            setError(err.message || "Failed to submit offer. Please try again.")
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
                className="glass-card p-6 sm:p-8 max-w-md w-full relative my-auto h-fit"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glow accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-red-800 rounded-t-2xl" />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                        <Tag size={18} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-heading text-white">Make an Offer</h2>
                        <p className="text-xs text-gray-400">{listing.title}</p>
                    </div>
                </div>

                {/* Price Range indicator */}
                <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Min: <span className="text-white font-semibold">£{min.toLocaleString('en-GB')}</span></span>
                        <span>Max: <span className="text-white font-semibold">£{max.toLocaleString('en-GB')}</span></span>
                    </div>
                    {/* Track */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-200"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                    <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">Your Offer (£)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">£</span>
                        <Input
                            type="number"
                            value={amount}
                            min={min}
                            max={max}
                            step={100}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="bg-slate-900/50 border-white/10 text-white pl-8 text-lg focus:border-primary"
                        />
                    </div>
                    {isOutOfRange && (
                        <p className="text-red-400 text-xs mt-1">
                            Must be between £{min.toLocaleString('en-GB')} and £{max.toLocaleString('en-GB')}
                        </p>
                    )}
                    {!isOutOfRange && (
                        <p className="text-emerald-400 text-xs mt-1">
                            ✓ Within the seller&apos;s accepted range
                        </p>
                    )}
                </div>

                {/* Optional range slider */}
                <div className="mb-5">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={100}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                    />
                </div>

                {/* Message */}
                <div className="mb-6">
                    <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">
                        Message to Seller <span className="text-gray-600 font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. I can collect this weekend and have cash ready."
                        rows={3}
                        maxLength={500}
                        className="w-full bg-slate-900/50 border border-white/10 text-white placeholder:text-gray-600 rounded-md p-3 text-sm resize-none focus:outline-none focus:border-primary"
                    />
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 shadow-neon"
                        disabled={loading || isOutOfRange}
                        onClick={handleSubmit}
                    >
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" /> Submitting...</> : `Submit £${amount.toLocaleString('en-GB')}`}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VehicleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const { user } = useAuth()
    const { addToCompare, removeFromCompare, isInCompare } = useCompare()

    const [listing, setListing] = React.useState<Listing | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeImage, setActiveImage] = React.useState(0)
    const [showOfferModal, setShowOfferModal] = React.useState(false)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [latestOffer, setLatestOffer] = React.useState<LatestOffer | null>(null)   // most recent offer on listing (any buyer) — public display
    const [myOffer, setMyOffer] = React.useState<LatestOffer | null>(null)            // this user's own offer — drives button state
    const [offerSuccess, setOfferSuccess] = React.useState(false)
    const [isWatchlisted, setIsWatchlisted] = React.useState(false)
    const [watchlistLoading, setWatchlistLoading] = React.useState(false)
    const [shareToast, setShareToast] = React.useState(false)

    const router = useRouter()

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

    const isCompared = listing ? isInCompare(listing.id) : false
    const hasOfferRange = listing && listing.priceMin && listing.priceMax

    const handleCompare = () => {
        if (!listing) return
        if (isCompared) {
            removeFromCompare(listing.id)
        } else {
            addToCompare({
                id: listing.id,
                title: listing.title,
                price: formatPrice(listing.price),
                image: listing.images?.[0] ?? "",
                specs: {
                    year: String(listing.year ?? ""),
                    mileage: listing.mileage ? `${listing.mileage.toLocaleString()} mi` : "",
                    engine: listing.bhp ? `${listing.bhp} bhp` : "",
                    transmission: listing.transmission ?? "",
                    doors: String(listing.doors ?? ""),
                    seats: String(listing.seats ?? ""),
                }
            })
        }
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
    const priceDisplay = hasOfferRange
        ? `£${Number(listing.priceMin).toLocaleString('en-GB')} – £${Number(listing.priceMax).toLocaleString('en-GB')}`
        : formatPrice(listing.price)

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12 relative">
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            <LoginModal />

            {/* Offer Modal */}
            {showOfferModal && (
                <OfferModal
                    listing={listing}
                    onClose={() => setShowOfferModal(false)}
                    onSuccess={handleOfferSuccess}
                />
            )}

            {/* Success toast */}
            {offerSuccess && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
                    <CheckCircle size={18} />
                    <span className="text-sm font-semibold">Offer submitted! The seller will respond soon.</span>
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
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant={isCompared ? "default" : "outline"}
                                className={`rounded-full ${isCompared ? 'bg-primary border-primary text-white' : 'border-gray-600 text-gray-400 hover:text-white hover:border-white'}`}
                                onClick={handleCompare}
                            >
                                <Scale size={18} className="mr-2" /> {isCompared ? "Compared" : "Compare"}
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
                                    className="object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
                                    <Camera size={16} /> {activeImage + 1}/{images.length}
                                </div>
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

                        {/* Description */}
                        {listing.description && (
                            <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                                <h3 className="text-xl font-bold text-white mb-4 border-l-4 border-primary pl-4">Description</h3>
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                            </div>
                        )}

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
                                    <AccordionItem title="Specifications" icon={<Cog size={18} />}>
                                        <div className="text-sm text-gray-400">
                                            {listing.fuelType && <p>Fuel: {listing.fuelType}</p>}
                                            {listing.transmission && <p>Transmission: {listing.transmission}</p>}
                                            {listing.engineSize && <p>Engine: {listing.engineSize}cc</p>}
                                            {listing.bhp && <p>Power: {listing.bhp} bhp</p>}
                                            {listing.co2Emissions && <p>CO₂: {listing.co2Emissions} g/km</p>}
                                        </div>
                                    </AccordionItem>
                                    {listing.ulezCompliant !== null && (
                                        <AccordionItem title="UK Compliance" icon={<ShieldCheck size={18} />}>
                                            <div className="text-sm text-gray-400 space-y-1">
                                                <p>ULEZ Compliant: {listing.ulezCompliant ? "Yes ✓" : "No ✗"}</p>
                                                {listing.euroStandard && <p>Euro Standard: {listing.euroStandard.replace('_', ' ')}</p>}
                                            </div>
                                        </AccordionItem>
                                    )}
                                    <AccordionItem title="Entertainment" icon={<Music size={18} />}>
                                        <p className="text-sm text-gray-400">See listing description for included infotainment and sound system details.</p>
                                    </AccordionItem>
                                </div>
                            </div>
                        )}

                        {/* Finance Calculator */}
                        <FinanceCalculator vehiclePrice={Number(listing.price)} />
                    </div>

                    {/* Right Column: Sticky Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-28 bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                            <div className="h-1 bg-gradient-to-r from-primary to-red-800 w-full absolute top-0" />
                            <div className="p-6">
                                {/* Price */}
                                <div className="mb-5">
                                    {hasOfferRange ? (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wide">Offer Range</p>
                                            <div className="text-3xl font-bold text-white mb-1">{priceDisplay}</div>
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-full">
                                                Offers Welcome
                                            </span>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-4xl font-bold text-white mb-2">{priceDisplay}</div>
                                            <div className="inline-block bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-xs font-bold">
                                                Best Price Guarantee
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-3">Price includes VAT. Financing available from 5.9% APR.</p>
                                </div>

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
                                    ) : hasOfferRange ? (
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
                                        </>
                                    ) : (
                                        <>
                                            <Button className="w-full py-6 text-lg" shape="default">Enquire Now</Button>
                                            <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10">Buy Online</Button>
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
