"use client"

import * as React from "react"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { Shield, ShieldCheck, Lock, CreditCard, ArrowLeft, Loader2, Car, CheckCircle, Check, BadgeCheck, Gavel, Wallet, RefreshCcw, Receipt } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { getListingBySlug, type Listing, formatPrice } from "@/lib/listingApi"
import { createCheckoutSession } from "@/lib/paymentApi"
import { useAuth } from "@/context/AuthContext"

const AUCTION_BUYER_FEE = 125 // £125 total: £100 seller bonus + £25 platform
const AUCTION_SELLER_BONUS = 100 // released to seller after handover proof
const AUCTION_PLATFORM_FEE = 25 // non-refundable Carmazium fee

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    )
}

function CheckoutContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    const listingId = searchParams.get("listing_id")
    const mode = searchParams.get("mode") as "auction_fee" | null

    const isAuctionFee = mode === "auction_fee"

    const [listing, setListing] = useState<Listing | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!listingId) return
        const load = async () => {
            try {
                const data = await getListingBySlug(listingId)
                setListing(data)
            } catch {
                setError("Vehicle not found")
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [listingId])

    const handleCheckout = async () => {
        if (!listing || !user) return
        setIsProcessing(true)
        setError(null)

        try {
            if (!isAuctionFee) {
                throw new Error("Vehicle purchase money is paid directly to the seller. CarMazium checkout only handles platform fees.")
            }
            const result = await createCheckoutSession(listing.id, AUCTION_BUYER_FEE, "COMMISSION", "gbp")
            if (result.url) {
                window.location.href = result.url
            }
        } catch (err: any) {
            setError(err.message || "Failed to start checkout. Please try again.")
            setIsProcessing(false)
        }
    }

    const getListingImage = (l: Listing) => {
        if (l.images?.length > 0) {
            const valid = l.images.find(img => !img.includes('example.com'))
            if (valid) return valid
        }
        return "/assets/images/featured-sports.png"
    }

    if (isLoading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={40} />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <Lock size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                    <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Sign In Required</h2>
                    <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Please sign in to proceed with the purchase.</p>
                    <Button asChild><Link href="/auth/signup">Sign In / Sign Up</Link></Button>
                </div>
            </div>
        )
    }

    if (!listing || error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <Car size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                    <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Vehicle Not Found</h2>
                    <p className="mb-6" style={{ color: 'var(--text-muted)' }}>{error || "The vehicle you're looking for doesn't exist."}</p>
                    <Button asChild variant="outline"><Link href="/search">Browse Vehicles</Link></Button>
                </div>
            </div>
        )
    }

    const fullPrice = parseFloat(String(listing.price))

    if (isAuctionFee) {
        const winningBid = listing.auction?.winningBidAmount != null
            ? Number(listing.auction.winningBidAmount)
            : (listing.auction?.buyItNowPrice != null ? Number(listing.auction.buyItNowPrice) : fullPrice)
        const auctionRef = listing.auction?.id
            ? `AUC-${listing.auction.id.replace(/-/g, '').slice(0, 5).toUpperCase()}`
            : '—'
        const specs = [
            listing.year,
            listing.mileage ? `${listing.mileage.toLocaleString()} miles` : null,
            listing.fuelType ? listing.fuelType.charAt(0) + listing.fuelType.slice(1).toLowerCase() : null,
            listing.transmission ? listing.transmission.charAt(0) + listing.transmission.slice(1).toLowerCase() : null,
        ].filter(Boolean).join(' • ')

        const steps = [
            { n: 1, label: 'Auction Won', sub: 'Congratulations!', done: true },
            { n: 2, label: 'Secure Checkout', sub: 'Buyer Fee Payment', done: false, active: true },
            { n: 3, label: 'Next Steps', sub: 'Handover & Collection', done: false },
        ]

        return (
            <div className="min-h-screen pb-20 pt-24">
                <div className="container mx-auto px-5 max-w-2xl">
                    {/* Stepper */}
                    <div className="flex items-center justify-between mb-10">
                        {steps.map((step, i) => (
                            <React.Fragment key={step.n}>
                                <div className="flex flex-col items-center text-center gap-1.5 shrink-0">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 font-bold text-sm shrink-0 ${step.done
                                            ? 'border-[var(--border-default)] text-[var(--text-muted)]'
                                            : step.active
                                                ? 'bg-primary border-primary text-white'
                                                : 'border-[var(--border-default)] text-[var(--text-muted)]'
                                            }`}
                                    >
                                        {step.done ? <Check size={16} /> : step.n}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-bold whitespace-nowrap ${step.active ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{step.label}</p>
                                        <p className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>{step.sub}</p>
                                    </div>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className="flex-1 h-px mx-2 mt-[-20px]" style={{ background: 'var(--border-default)' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Heading */}
                    <div className="flex items-center gap-2 mb-1.5">
                        <Shield size={22} className="text-primary" />
                        <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>Secure Checkout</h1>
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                        You&apos;ve won the auction! Complete your payment below to confirm your purchase and move to the next step.
                    </p>

                    {/* Vehicle card */}
                    <div className="rounded-2xl border p-4 flex items-center gap-4 mb-6"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        <div className="w-28 h-20 relative rounded-xl overflow-hidden shrink-0">
                            <Image src={getListingImage(listing)} alt={listing.title} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{listing.title}</h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wide shrink-0">
                                    <Gavel size={10} /> Auction Win
                                </span>
                            </div>
                            <p className="text-xs mb-2 truncate" style={{ color: 'var(--text-muted)' }}>{specs}</p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p style={{ color: 'var(--text-faint)' }}>Winning Bid</p>
                                    <p className="font-bold text-primary">{formatPrice(winningBid)}</p>
                                </div>
                                <div>
                                    <p style={{ color: 'var(--text-faint)' }}>Auction Reference</p>
                                    <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{auctionRef}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Auction Buyer Fee */}
                    <div className="rounded-2xl border p-6 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Wallet size={18} className="text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Auction Buyer Fee</h2>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>A one-time fee required to secure your winning vehicle.</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-5">
                            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Total Due Today</span>
                            <span className="text-2xl font-black text-primary font-mono">£{AUCTION_BUYER_FEE}</span>
                        </div>

                        <div className="border-t pt-5" style={{ borderColor: 'var(--border-default)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <ShieldCheck size={14} className="text-primary" />
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>What this fee covers</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { icon: ShieldCheck, label: 'Secure your win', desc: 'Confirms your commitment to complete the purchase' },
                                    { icon: Lock, label: 'Serious buyers only', desc: 'Helps keep our marketplace trusted and reliable' },
                                    { icon: Shield, label: 'Safe & secure', desc: 'Your payment is protected by Stripe' },
                                ].map(({ icon: Icon, label, desc }) => (
                                    <div key={label} className="text-xs">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                                            <Icon size={14} className="text-emerald-400" />
                                        </div>
                                        <p className="font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{label}</p>
                                        <p style={{ color: 'var(--text-faint)' }}>{desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Refund policy */}
                    <div className="rounded-2xl p-4 flex items-start gap-3 mb-6 bg-blue-500/5 border border-blue-500/15">
                        <RefreshCcw size={18} className="text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-blue-400 mb-1">Refund Policy</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                If the vehicle sale does not complete for any reason, <span className="text-[var(--text-primary)] font-bold">£{AUCTION_SELLER_BONUS} is refunded</span> to you.
                                The £{AUCTION_PLATFORM_FEE} platform fee is non-refundable.
                            </p>
                        </div>
                    </div>

                    {/* Order summary */}
                    <div className="rounded-2xl border p-6 mb-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Receipt size={16} className="text-primary" />
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Order Summary</h2>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span style={{ color: 'var(--text-muted)' }}>Auction Buyer Fee</span>
                                <span style={{ color: 'var(--text-primary)' }}>£{AUCTION_BUYER_FEE}.00</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between" style={{ borderColor: 'var(--border-default)' }}>
                                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Total Due</span>
                                <span className="text-lg font-black text-primary font-mono">£{AUCTION_BUYER_FEE}.00</span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
                            {error}
                        </div>
                    )}

                    <p className="flex items-center justify-center gap-1.5 text-xs mb-4" style={{ color: 'var(--text-faint)' }}>
                        <Lock size={12} /> Secure payment powered by <span className="font-bold" style={{ color: 'var(--text-muted)' }}>Stripe</span>
                    </p>

                    <Button
                        onClick={handleCheckout}
                        disabled={isProcessing}
                        className="w-full h-14 text-lg font-bold gap-3 bg-gradient-to-r from-primary to-[#ff4d4d] hover:from-[#ff4d4d] hover:to-primary shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Connecting to Stripe...
                            </>
                        ) : (
                            <>
                                <Lock size={20} />
                                Pay £{AUCTION_BUYER_FEE} Buyer Fee
                            </>
                        )}
                    </Button>

                    <p className="text-center text-xs mt-4" style={{ color: 'var(--text-faint)' }}>
                        By proceeding, you agree to our <Link href="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
                    </p>
                    <p className="flex items-center justify-center gap-1.5 text-center text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                        <Shield size={11} /> Your payment information is encrypted and secure. We never store your card details.
                    </p>
                </div>
            </div>
        )
    }

    if (!isAuctionFee) {
        return (
            <div className="min-h-screen pt-28 pb-20">
                <div className="container mx-auto px-5 max-w-2xl">
                    <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10">
                        <ShieldCheck className="text-emerald-500 mb-5" size={38} />
                        <h1 className="text-3xl font-heading font-bold mb-3">Pay the seller directly</h1>
                        <p className="text-[var(--text-muted)] leading-7 mb-6">
                            CarMazium does not collect or hold the vehicle purchase price or a vehicle deposit. Agree the final amount with the seller and settle the vehicle payment directly with them.
                        </p>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-5 mb-6 text-sm text-[var(--text-muted)]">
                            CarMazium checkout is used only for CarMazium platform charges such as the £125 auction buyer fee, listing fees and optional add-ons.
                        </div>
                        <Button asChild className="w-full h-12">
                            <Link href={listing ? `/buy-cars/${listing.slug}` : "/buy-cars"}>
                                <ArrowLeft size={17} className="mr-2" /> Return to vehicle
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
