"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { AccordionItem } from "@/components/ui/Accordion"
import dynamic from "next/dynamic"
const FinanceCalculator = dynamic(() => import("@/components/features/FinanceCalculator").then(mod => mod.FinanceCalculator), { ssr: false })
import { ArrowLeft, Camera, CheckCircle, ShieldCheck, Cog, Music, Car as CarIcon, MapPin, Share2, Heart, Scale, Loader2, MessageCircle, Tag, X, Clock, ThumbsUp, XCircle, AlertTriangle } from "lucide-react"
import { useCompare } from "@/context/CompareContext"
import { getListingBySlug, makeOffer, type Listing, type LatestOffer, formatPrice } from "@/lib/listingApi"
import { createChatRoom } from "@/lib/chatApi"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { VehicleJsonLd } from "@/components/seo/JsonLd"
import { Input } from "@/components/ui/Input"

// ─── Offer Status Chip ───────────────────────────────────────────────────────

function OfferStatusChip({ offer }: { offer: LatestOffer }) {
    const amount = `£${Number(offer.amount).toLocaleString('en-GB')}`
    if (offer.status === 'PENDING') return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            <Clock size={14} className="shrink-0" />
            <span>Your offer of <strong>{amount}</strong> is awaiting the seller&apos;s response.</span>
        </div>
    )
    if (offer.status === 'REJECTED') return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <XCircle size={14} className="shrink-0" />
            <span>Your offer of <strong>{amount}</strong> was declined. Try a different amount.</span>
        </div>
    )
    if (offer.status === 'ACCEPTED') return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            <ThumbsUp size={14} className="shrink-0" />
            <span>🎉 Your offer of <strong>{amount}</strong> was accepted!</span>
        </div>
    )
    return null
}

// ─── Offer Modal ─────────────────────────────────────────────────────────────

function OfferModal({
    listing, onClose, onSuccess,
}: {
    listing: Listing
    onClose: () => void
    onSuccess: (offer: LatestOffer) => void
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
        setLoading(true); setError(null)
        try {
            const offer = await makeOffer(listing.id, amount, message || undefined)
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
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Min: <span className="text-white font-semibold">£{min.toLocaleString('en-GB')}</span></span>
                        <span>Max: <span className="text-white font-semibold">£{max.toLocaleString('en-GB')}</span></span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="text-sm font-bold uppercase text-gray-400 mb-2 block">Your Offer (£)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">£</span>
                        <Input type="number" value={amount} min={min} max={max} step={100}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            className="bg-slate-900/50 border-white/10 text-white pl-8 text-lg focus:border-primary" />
                    </div>
                    {isOutOfRange
                        ? <p className="text-red-400 text-xs mt-1">Must be between £{min.toLocaleString('en-GB')} and £{max.toLocaleString('en-GB')}</p>
                        : <p className="text-emerald-400 text-xs mt-1">✓ Within the seller&apos;s accepted range</p>
                    }
                </div>

                <div className="mb-5">
                    <input type="range" min={min} max={max} step={100} value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full accent-primary cursor-pointer" />
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
                    <Button className="flex-1 shadow-neon" disabled={loading || isOutOfRange} onClick={handleSubmit}>
                        {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Submitting...</> : `Submit £${amount.toLocaleString('en-GB')}`}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default function VehicleDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = React.use(params)
    const router = useRouter()
    const { user } = useAuth()
    const [listing, setListing] = React.useState<Listing | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [activeImage, setActiveImage] = React.useState(0)
    const [enquiring, setEnquiring] = React.useState(false)
    const [showOfferModal, setShowOfferModal] = React.useState(false)
    const [myLatestOffer, setMyLatestOffer] = React.useState<LatestOffer | null>(null)
    const [offerSuccess, setOfferSuccess] = React.useState(false)

    const { addToCompare, removeFromCompare, isInCompare } = useCompare()
    const isCompared = listing ? isInCompare(listing.id) : false

    React.useEffect(() => {
        async function fetchListing() {
            try {
                setLoading(true)
                const data = await getListingBySlug(slug)
                setListing(data)
                // Populate latest offer for the current user
                if (data.offers && data.offers.length > 0) {
                    setMyLatestOffer(data.offers[0])
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

    const handleCompare = () => {
        if (!listing) return
        if (isCompared) {
            removeFromCompare(listing.id)
        } else {
            addToCompare({
                id: listing.id,
                title: listing.title,
                price: vehicle.price,
                image: vehicle.images[0],
                specs: {
                    year: vehicle.specs.year,
                    mileage: vehicle.specs.mileage,
                    engine: vehicle.specs.engine,
                    transmission: vehicle.specs.transmission,
                    doors: vehicle.specs.doors,
                    seats: vehicle.specs.seats
                }
            })
        }
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

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12 relative">
            {/* Background gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            {/* Offer Modal */}
            {showOfferModal && listing && (
                <OfferModal
                    listing={listing}
                    onClose={() => setShowOfferModal(false)}
                    onSuccess={(offer) => { setMyLatestOffer(offer); setShowOfferModal(false); setOfferSuccess(true) }}
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
                            <h1 className="text-3xl md:text-5xl font-bold font-heading text-white mb-2">{vehicle.title}</h1>
                            <p className="text-gray-300 text-lg">{vehicle.subtitle}</p>
                        </div>
                        <div className="flex gap-4">
                            <Button
                                variant={isCompared ? "default" : "outline"}
                                className={`rounded-full ${isCompared ? 'bg-primary border-primary text-white' : 'border-gray-600 text-gray-400 hover:text-white hover:border-white'}`}
                                onClick={handleCompare}
                            >
                                <Scale size={20} className="mr-2" /> {isCompared ? "Compared" : "Compare"}
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white">
                                <Share2 size={20} />
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-500">
                                <Heart size={20} />
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
                                    className="object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
                                    <Camera size={16} /> {activeImage + 1}/{vehicle.images.length}
                                </div>
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

                        {/* Key Info */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Key Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { label: "Year", value: vehicle.specs.year },
                                    { label: "Doors", value: vehicle.specs.doors },
                                    { label: "Mileage", value: vehicle.specs.mileage },
                                    { label: "Seats", value: vehicle.specs.seats },
                                    { label: "Engine", value: vehicle.specs.engine },
                                    { label: "Colour", value: vehicle.specs.color },
                                    { label: "Trans", value: vehicle.specs.transmission },
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-gray-400 text-sm">{item.label}</span>
                                        <span className="text-white font-semibold text-sm">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

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

                        {/* Finance Calculator */}
                        <FinanceCalculator vehiclePrice={Number(listing.price)} />
                    </div>

                    {/* Right Column: Sticky Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-28 bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                            <div className="h-1 bg-primary w-full absolute top-0" />
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary font-bold text-xl">CM</div>
                                    <div>
                                        <h4 className="text-white font-bold">CarMazium Premium</h4>
                                        <p className="text-xs text-primary flex items-center gap-1"><CheckCircle size={12} /> Verified Dealer</p>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    {listing.priceMin && listing.priceMax ? (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wide">Offer Range</p>
                                            <div className="text-3xl font-bold text-white mb-1">
                                                £{Number(listing.priceMin).toLocaleString('en-GB')} &ndash; £{Number(listing.priceMax).toLocaleString('en-GB')}
                                            </div>
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 px-2.5 py-1 rounded-full">
                                                Offers Welcome
                                            </span>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-4xl font-bold text-white mb-2">{vehicle.price}</div>
                                            <div className="inline-block bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-xs font-bold mb-4">
                                                Best Price Guarantee
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-3">Price includes VAT. Financing available from 5.9% APR.</p>
                                </div>

                                {/* Latest Offer Status */}
                                {myLatestOffer && (
                                    <div className="mb-4">
                                        <OfferStatusChip offer={myLatestOffer} />
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {listing && listing.priceMin && listing.priceMax ? (
                                        <>
                                            <Button
                                                className="w-full py-6 text-lg shadow-neon"
                                                onClick={() => setShowOfferModal(true)}
                                                disabled={myLatestOffer?.status === 'PENDING' || myLatestOffer?.status === 'ACCEPTED'}
                                            >
                                                {myLatestOffer?.status === 'PENDING'
                                                    ? '⏳ Offer Pending...'
                                                    : myLatestOffer?.status === 'ACCEPTED'
                                                        ? '✓ Offer Accepted'
                                                        : 'Make an Offer'}
                                            </Button>
                                            <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10" onClick={handleEnquire} disabled={enquiring}>
                                                {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Starting Chat...</> : <><MessageCircle className="w-5 h-5 mr-2" />Enquire</>}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button className="w-full py-6 text-lg" shape="default" onClick={handleEnquire} disabled={enquiring}>
                                                {enquiring ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Starting Chat...</> : <><MessageCircle className="w-5 h-5 mr-2" />Enquire Now</>}
                                            </Button>
                                            <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10">Buy Online</Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Location Display */}
                            <div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs">
                                <MapPin size={14} />
                                <span>{listing.location || 'Location not specified'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
