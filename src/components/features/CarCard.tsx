import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Calendar, Gauge, Fuel, Car, BadgeCheck, ShieldCheck, Star, MapPin, Gavel, Truck } from "lucide-react"
import { SellerBadge } from "@/components/ui/SellerBadge"
import { FeaturedBadge } from "@/components/features/FeaturedBadge"
import { CardImageCarousel } from "@/components/features/CardImageCarousel"
import { BODY_TYPE_LABELS, FUEL_TYPE_LABELS } from "@/lib/vehicleLabels"

// ─── Props ───────────────────────────────────────────────────────────────────

interface CarCardProps {
    title: string
    make?: string | null
    model?: string | null
    price: string
    priceMin?: string | number | null
    priceMax?: string | number | null
    image: string
    /** Full image list — enables the carousel when >1. Falls back to `image` when empty/missing. */
    images?: string[]
    href?: string
    year?: number
    mileage?: number
    fuelType?: string
    bodyType?: string
    location?: string | null
    distanceMi?: number | null
    sellerId?: string
    sellerScore?: number
    isFeatured?: boolean
    badgeTier?: string | null
    status?: string | null
    bannerLabel?: string | null
    hasLinkedAuction?: boolean
    isDepartedSale?: boolean
    deliveryAvailable?: boolean
    exteriorGrade?: number | null
}

// Motorway-style exterior grade colors: 1 best → 5 worst
const GRADE_STYLES: Record<number, { dot: string; text: string; border: string; bg: string; label: string }> = {
    1: { dot: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', label: 'Excellent — minimal/no wear' },
    2: { dot: 'bg-lime-500',    text: 'text-lime-400',    border: 'border-lime-500/30',    bg: 'bg-lime-500/10',    label: 'Very good — light wear' },
    3: { dot: 'bg-amber-500',   text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   label: 'Good — moderate damage' },
    4: { dot: 'bg-orange-500',  text: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/10',  label: 'Fair — noticeable damage' },
    5: { dot: 'bg-red-500',     text: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10',     label: 'Poor — heavy damage' },
}

// ─── Component ───────────────────────────────────────────────────────────────

const BANNER_COLORS: Record<string, string> = {
    'Special Offer':       'bg-red-600',
    'Limited Time Offer':  'bg-rose-600',
    "Manager's Special":   'bg-amber-600',
    'Below Market Value':  'bg-emerald-600',
    'Weekend Deal':        'bg-violet-600',
    '5% Discount':         'bg-emerald-600',
    '10% Discount':        'bg-emerald-600',
    '15% Discount':        'bg-emerald-600',
    'Save £500':           'bg-emerald-600',
    'Save £1,000':         'bg-emerald-600',
}
const DEFAULT_BANNER_COLOR = 'bg-primary'

export function CarCard({
    title, make, model, price, priceMin, priceMax, image, images, href = "#",
    year, mileage, fuelType, bodyType, location, distanceMi,
    sellerId, sellerScore, isFeatured = false, badgeTier, status, bannerLabel, hasLinkedAuction,
    isDepartedSale, deliveryAvailable, exteriorGrade
}: CarCardProps) {
    const makeModelLine = [make, model].filter(Boolean).join(" ").trim()
    const gradeStyle = exteriorGrade && exteriorGrade >= 1 && exteriorGrade <= 5 ? GRADE_STYLES[exteriorGrade] : null
    const gallery = (images && images.length > 0 ? images : image ? [image] : []).filter(Boolean)
    const hasSpecs = year || mileage || fuelType || bodyType

    // Tier-based styling
    const tierBorder =
        badgeTier === 'PREMIUM' ? 'border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
            : badgeTier === 'STANDARD' ? 'border-blue-400/30'
                : isFeatured ? 'border-amber-400/30'
                    : ''

    const tierGlow =
        badgeTier === 'PREMIUM' ? 'bg-gradient-to-br from-amber-500/5 via-transparent to-amber-500/5'
            : badgeTier === 'STANDARD' ? 'bg-gradient-to-br from-blue-500/5 via-transparent to-transparent'
                : ''

    return (
        <div
            className={`glass-card isolate h-full flex flex-col overflow-visible group relative transition-transform duration-300 ease-out hover:-translate-y-1 ${tierBorder || ''} ${tierGlow || ''}`}
        >
            {/* Holographic Shimmer Overlay */}
            <div
                style={{ zIndex: 20 }}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.15)_0%,transparent_50%)]"
            />

            <div
                className="h-[240px] bg-gradient-to-br from-slate-800/50 to-transparent flex items-center justify-center p-6 relative overflow-hidden flex-shrink-0"
                style={{ transform: "translateZ(0px)" }}
            >
                {/* Featured Badge */}
                {isFeatured && <FeaturedBadge />}

                {/* Also at Auction badge */}
                {hasLinkedAuction && (
                    <div className="absolute top-3 left-3 z-30">
                        <span className="inline-flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded shadow border border-amber-400/50">
                            <Gavel size={10} /> Also at Auction
                        </span>
                    </div>
                )}

                {/* Trust Badges Corner */}
                {(badgeTier === 'STANDARD' || badgeTier === 'PREMIUM') && (
                    <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 items-end drop-shadow-md">
                        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md text-emerald-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-emerald-500/30">
                            <ShieldCheck size={12} className="text-emerald-500" /> Verified
                        </div>
                        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md text-blue-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-blue-500/30">
                            <BadgeCheck size={12} className="text-blue-500" /> VIN Report
                        </div>
                    </div>
                )}

                {/* Spotlight Glow */}
                <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl rounded-full scale-150 mix-blend-screen" />

                <div className="relative z-10 w-full h-full">
                    {/* Tap the image → full-screen gallery preview. The card's
                        "View Details" button below is the way to reach the
                        detail page, so image taps are freed up for previewing. */}
                    <CardImageCarousel
                        images={gallery.length > 0 ? gallery : [image]}
                        alt={title}
                        lightboxOnTap
                        imageClassName={`object-contain drop-shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:-rotate-1 ${status === 'SOLD' ? 'opacity-30 grayscale' : ''}`}
                        sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 300px"
                    />
                </div>

                {/* Banner Label Ribbon */}
                {bannerLabel && status !== 'SOLD' && (
                    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
                        <div className={`w-full px-3 py-1.5 flex items-center justify-center gap-1.5 ${BANNER_COLORS[bannerLabel] ?? DEFAULT_BANNER_COLOR}`}>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white drop-shadow-sm">
                                {bannerLabel}
                            </span>
                        </div>
                    </div>
                )}

                {/* SOLD Stamp Overlay */}
                {status === 'SOLD' && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="relative">
                            <span
                                className="block text-4xl font-black uppercase tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] rotate-[-20deg] select-none"
                                style={{
                                    textShadow: '0 0 20px rgba(239,68,68,0.6)',
                                    WebkitTextStroke: '2px rgba(239,68,68,0.4)',
                                }}
                            >
                                SOLD
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div
                className="p-6 relative z-10 flex flex-col flex-1 border-t bg-gradient-to-b from-primary/5 dark:from-white/5 to-transparent rounded-b-2xl"
                style={{ borderColor: 'var(--border-default)' }}
            >
                <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg md:text-xl font-bold font-heading tracking-wide group-hover:text-primary transition-colors duration-300 line-clamp-2">{title}</h3>
                        {makeModelLine && (
                            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-0.5 line-clamp-1">{makeModelLine}</p>
                        )}
                    </div>
                    {sellerId && sellerScore !== undefined ? (
                        <SellerBadge score={sellerScore} sellerUserId={sellerId} size="sm" showLabel />
                    ) : (
                        <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking items-center flex shrink-0 transition-transform duration-200 hover:scale-110">
                            Verified
                        </div>
                    )}
                </div>

                {/* Price Display */}
                <div className="mb-3">
                    <p className="text-2xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-gray-400">
                        {price}
                    </p>
                    {priceMin && priceMax && status !== 'SOLD' && (
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">
                            Offers Welcome
                        </span>
                    )}
                </div>

                {/* Badge Tier Label */}
                {badgeTier && badgeTier !== 'FREE' && (
                    <div className="flex items-center gap-2 mb-3">
                        {badgeTier === 'PREMIUM' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                                <Star size={10} className="fill-amber-400" /> Premium
                            </span>
                        )}
                        {badgeTier === 'STANDARD' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                <ShieldCheck size={10} /> Standard
                            </span>
                        )}
                    </div>
                )}

                {/* Estate chip — appears when isDepartedSale is true */}
                {isDepartedSale && (
                    <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-slate-500/10 dark:bg-[var(--bg-card)] text-slate-600 dark:text-[var(--text-muted)] border border-slate-500/20 dark:border-[var(--border-default)] px-2 py-0.5 rounded-full">
                            Estate
                        </span>
                    </div>
                )}

                {/* Grade chip (Motorway-style exterior grade 1–5) */}
                {gradeStyle && (
                    <div className="flex items-center gap-2 mb-3">
                        <span
                            title={gradeStyle.label}
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${gradeStyle.bg} ${gradeStyle.text} border ${gradeStyle.border} px-2 py-0.5 rounded-full`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${gradeStyle.dot}`} />
                            Grade {exteriorGrade}
                        </span>
                    </div>
                )}

                {/* Specs Tags */}
                {hasSpecs && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {year && (
                            <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Calendar size={10} /> {year}
                            </span>
                        )}
                        {mileage !== undefined && mileage !== null && (
                            <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Gauge size={10} /> {mileage.toLocaleString()} mi
                            </span>
                        )}
                        {fuelType && FUEL_TYPE_LABELS[fuelType] && (
                            <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Fuel size={10} /> {FUEL_TYPE_LABELS[fuelType]}
                            </span>
                        )}
                        {bodyType && BODY_TYPE_LABELS[bodyType] && (
                            <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Car size={10} /> {BODY_TYPE_LABELS[bodyType]}
                            </span>
                        )}
                        {distanceMi != null ? (
                            <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold px-2 py-1 rounded-md">
                                <MapPin size={10} /> {distanceMi < 1 ? '< 1 mi away' : `${Math.round(distanceMi)} mi away`}
                            </span>
                        ) : location ? (
                            <span className="inline-flex items-center gap-1 bg-slate-500/10 dark:bg-[var(--bg-card)] border border-slate-500/20 dark:border-[var(--border-default)] text-slate-600 dark:text-[var(--text-muted)] text-[10px] font-semibold px-2 py-1 rounded-md">
                                <MapPin size={10} /> {location.split(',')[0].trim()}
                            </span>
                        ) : null}
                        {deliveryAvailable && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                                bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <Truck size={11} /> Delivery
                            </span>
                        )}
                    </div>
                )}

                <div className="mt-auto">
                    <Button
                        asChild
                        className={`w-full shadow-lg text-white ${status === 'SOLD' ? 'bg-slate-700 hover:bg-slate-600 border-none opacity-80' : badgeTier === 'PREMIUM' ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 border-none' : ''}`}
                        variant="default"
                        size="sm"
                        shape="default"
                    >
                        <Link href={href} className="block w-full text-center">
                            {status === 'SOLD' ? 'View Sold Vehicle' : 'View Details'}
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
