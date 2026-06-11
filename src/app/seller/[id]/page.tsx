/**
 * /seller/[id] — Public Seller Profile Page
 *
 * Server Component (data fetched on the server for SEO).
 * Shows: seller identity, reliability score, stats, active listings, and reviews.
 */

import Link from "next/link"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Star, ShieldCheck, Car, MessageCircle, TrendingUp, Clock, ChevronRight, AlertCircle, BadgeCheck } from "lucide-react"
import type { Metadata } from "next"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SellerUser {
    id: string
    firstName: string | null
    lastName: string | null
    profileImage: string | null
    role: string
    createdAt: string
}

interface SellerProfileStats {
    id: string
    userId: string
    reliabilityScore: number
    totalSales: number
    totalListings: number
    responseRate: number
    avgResponseHours: number | null
    createdAt: string
}

interface SellerData {
    profile: SellerProfileStats
    user: SellerUser
    reviewCount: number
    averageRating: number
    positiveCount: number
    neutralCount: number
    negativeCount: number
    starCounts: { star: number; count: number }[]
}

interface Listing {
    id: string
    title: string
    slug: string
    price: number
    images: string[]
    year: number
    mileage: number
    fuelType: string
    location: string
}

interface Review {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    listingId: string | null
    reviewer: {
        id: string
        firstName: string | null
        lastName: string | null
        profileImage: string | null
    }
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

async function getSellerProfile(userId: string): Promise<SellerData | null> {
    try {
        const res = await fetch(`${API_BASE}/sellers/${userId}`, { next: { revalidate: 60 } })
        if (res.status === 404) return null
        if (!res.ok) throw new Error("Failed to fetch seller profile")
        const json = await res.json()
        return json.data
    } catch {
        return null
    }
}

async function getSellerListings(userId: string): Promise<{ data: Listing[]; total: number }> {
    try {
        // Fetch up to 6 listings for the grid display
        const res = await fetch(`${API_BASE}/sellers/${userId}/listings?limit=6`, { next: { revalidate: 60 } })
        if (!res.ok) return { data: [], total: 0 }
        const json = await res.json()
        // API may return pagination.total or just total at root level
        const total =
            json.pagination?.total ??
            json.total ??
            (Array.isArray(json.data) ? json.data.length : 0)
        return { data: json.data ?? [], total }
    } catch {
        return { data: [], total: 0 }
    }
}

/** Fetch the true total count of ALL active listings for this seller */
async function getSellerActiveCount(userId: string): Promise<number> {
    try {
        // limit=1 is enough — we only care about pagination.total
        const res = await fetch(`${API_BASE}/sellers/${userId}/listings?limit=1&status=ACTIVE`, { next: { revalidate: 60 } })
        if (!res.ok) return 0
        const json = await res.json()
        return json.pagination?.total ?? json.total ?? 0
    } catch {
        return 0
    }
}

/** Fetch the count of SOLD listings for this seller */
async function getSellerSoldCount(userId: string): Promise<number> {
    try {
        const res = await fetch(`${API_BASE}/sellers/${userId}/listings?limit=1&status=SOLD`, { next: { revalidate: 60 } })
        if (!res.ok) return 0
        const json = await res.json()
        return json.pagination?.total ?? json.total ?? 0
    } catch {
        return 0
    }
}

async function getSellerReviews(sellerProfileId: string): Promise<{ data: Review[]; total: number }> {
    try {
        const res = await fetch(`${API_BASE}/sellers/${sellerProfileId}/reviews?limit=5`, { next: { revalidate: 60 } })
        if (!res.ok) return { data: [], total: 0 }
        const json = await res.json()
        return { data: json.data ?? [], total: json.pagination?.total ?? 0 }
    } catch {
        return { data: [], total: 0 }
    }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const seller = await getSellerProfile(id)
    if (!seller) return { title: "Seller Not Found | Carmazium" }
    const name = [seller.user.firstName, seller.user.lastName].filter(Boolean).join(" ") || "Seller"
    return {
        title: `${name} — Seller Profile | Carmazium`,
        description: `View ${name}'s listings, reliability score of ${seller.profile.reliabilityScore.toFixed(1)}/5, and ${seller.reviewCount} reviews on Carmazium.`,
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number) {
    if (score >= 4.5) return { label: "Top Seller", color: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" }
    if (score >= 3.5) return { label: "Trusted", color: "text-blue-400", border: "border-blue-500/30", glow: "shadow-blue-500/20" }
    if (score >= 2.5) return { label: "Good", color: "text-yellow-400", border: "border-yellow-500/30", glow: "shadow-yellow-500/20" }
    return { label: "New Seller", color: "text-gray-400", border: "border-white/10", glow: "" }
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <Star
                    key={n}
                    size={size}
                    className={n <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}
                />
            ))}
        </span>
    )
}

function formatPrice(p: number) {
    return `£${p.toLocaleString("en-GB")}`
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 30) return `${days} days ago`
    const months = Math.floor(days / 30)
    return `${months} month${months > 1 ? "s" : ""} ago`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const [sellerData, listingsResult, reviewsResult, activeListingCount, soldCount] = await Promise.all([
        getSellerProfile(id),
        getSellerListings(id),
        getSellerProfile(id).then((s) =>
            s ? getSellerReviews(s.profile.id) : { data: [], total: 0 }
        ),
        getSellerActiveCount(id),
        getSellerSoldCount(id),
    ])

    if (!sellerData) notFound()

    const { profile, user, reviewCount, averageRating, positiveCount, neutralCount, negativeCount, starCounts } = sellerData
    // Use the live active count from the listings endpoint, fallback to DB field
    const { data: listings, total: listingsPageTotal } = listingsResult
    const totalListings = activeListingCount || listingsPageTotal || profile.totalListings
    // Use live sold count, fallback to DB field
    const totalSales = soldCount || profile.totalSales
    const { data: reviews, total: totalReviews } = reviewsResult

    const tier = getTier(profile.reliabilityScore)
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Seller"
    const memberSince = new Date(user.createdAt).getFullYear()

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            {/* ── Hero: seller identity + score ── */}
            <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-slate-900 to-slate-950">
                {/* Background glow */}
                <div className="pointer-events-none absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_top,white,transparent_70%)]" />

                <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
                    <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                        {/* Avatar */}
                        <div className={`relative flex-shrink-0 rounded-full border-2 ${tier.border} shadow-xl ${tier.glow}`}>
                            {user.profileImage ? (
                                <Image
                                    src={user.profileImage}
                                    alt={displayName}
                                    width={112}
                                    height={112}
                                    className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28"
                                />
                            ) : (
                                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 text-3xl font-bold text-white sm:h-28 sm:w-28">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {/* Tier badge overlay */}
                            <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${tier.border} ${tier.color} bg-slate-900`}>
                                {tier.label}
                            </span>
                        </div>

                        {/* Identity */}
                        <div className="flex-1">
                            <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{displayName}</h1>
                            <p className="mt-1 text-sm text-gray-400">
                                Member since {memberSince} &middot; {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-4">
                                {/* Reliability Score */}
                                <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${tier.border} bg-white/5`}>
                                    <ShieldCheck size={18} className={tier.color} />
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500">Reliability</p>
                                        <p className={`text-xl font-black ${tier.color}`}>{profile.reliabilityScore.toFixed(1)}<span className="text-sm font-normal text-gray-500">/5</span></p>
                                    </div>
                                </div>

                                {/* Average rating */}
                                {reviewCount > 0 && (
                                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                                        <StarRating rating={averageRating} size={13} />
                                        <span className="text-sm font-semibold">{averageRating.toFixed(1)}</span>
                                        <span className="text-xs text-gray-400">({reviewCount} reviews)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
                <div className="grid gap-10 lg:grid-cols-3">

                    {/* ── Left column: stats ── */}
                    <aside className="space-y-6">
                        <div className="rounded-2xl border border-white/5 bg-white/2 p-6">
                            <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-gray-500">Seller Stats</h2>
                            <ul className="space-y-4">
                                <StatRow icon={<Car size={15} className="text-primary" />} label="Active Listings" value={totalListings} />
                                <StatRow icon={<TrendingUp size={15} className="text-emerald-400" />} label="Total Sales" value={totalSales} />
                                <StatRow
                                    icon={<MessageCircle size={15} className="text-blue-400" />}
                                    label="Response Rate"
                                    value={`${profile.responseRate.toFixed(0)}%`}
                                />
                                {profile.avgResponseHours !== null && (
                                    <StatRow
                                        icon={<Clock size={15} className="text-yellow-400" />}
                                        label="Avg Response"
                                        value={`${profile.avgResponseHours.toFixed(0)}h`}
                                    />
                                )}
                            </ul>
                        </div>

                        {/* Score breakdown note */}
                        <div className="rounded-xl border border-white/5 bg-primary/5 px-4 py-3">
                            <p className="text-[11px] text-gray-400">
                                <span className="font-semibold text-primary">How is reliability calculated?</span><br />
                                Score = (avg rating × 50%) + (response rate × 30%) + (sales ratio × 20%), capped at 5.0.
                            </p>
                        </div>
                    </aside>

                    {/* ── Right column: listings + reviews ── */}
                    <div className="space-y-12 lg:col-span-2">

                        {/* Active listings */}
                        <section>
                            <div className="mb-5 flex items-center justify-between">
                                <h2 className="text-lg font-bold">Active Listings</h2>
                                {totalListings > 6 && (
                                    <Link href={`/buy-cars?seller=${id}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                                        View all {totalListings} <ChevronRight size={14} />
                                    </Link>
                                )}
                            </div>

                            {listings.length === 0 ? (
                                <EmptyState icon={<Car size={32} className="text-gray-600" />} message="No active listings yet" />
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {listings.map((listing) => (
                                        <ListingCard key={listing.id} listing={listing} />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Reviews */}
                        <section>
                            <h2 className="text-lg font-bold mb-5">
                                All Feedback <span className="text-gray-500 font-normal">({totalReviews})</span>
                            </h2>

                            {totalReviews > 0 && (
                                <div className="rounded-2xl border border-white/5 bg-white/2 p-6 mb-6 space-y-5">
                                    {/* Positive / Neutral / Negative summary */}
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Summary</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { label: "Positive", count: positiveCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                                                { label: "Neutral",  count: neutralCount,  color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20" },
                                                { label: "Negative", count: negativeCount, color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
                                            ].map(({ label, count, color, bg }) => (
                                                <div key={label} className={`rounded-xl border ${bg} px-4 py-3 text-center`}>
                                                    <p className={`text-2xl font-black ${color}`}>{count}</p>
                                                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Star distribution bars */}
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Rating Breakdown</p>
                                        <div className="space-y-2">
                                            {[...starCounts].reverse().map(({ star, count }) => {
                                                const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0
                                                return (
                                                    <div key={star} className="flex items-center gap-3 text-xs">
                                                        <span className="w-12 text-right text-gray-400 shrink-0">{star} star{star !== 1 ? 's' : ''}</span>
                                                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="w-8 text-gray-500 shrink-0">{count}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {reviews.length === 0 ? (
                                <EmptyState icon={<Star size={32} className="text-gray-600" />} message="No reviews yet" />
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map((review) => (
                                        <ReviewCard key={review.id} review={review} />
                                    ))}
                                </div>
                            )}
                        </section>

                    </div>
                </div>
            </div>
        </main>
    )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-gray-400">
                {icon} {label}
            </span>
            <span className="text-sm font-bold text-white">{value}</span>
        </li>
    )
}

function ListingCard({ listing }: { listing: Listing }) {
    const img = listing.images?.[0] || "/placeholder-car.jpg"
    return (
        <Link
            href={`/buy-cars/${listing.slug}`}
            className="group block overflow-hidden rounded-xl border border-white/5 bg-white/2 transition-colors hover:border-primary/30 hover:bg-white/5"
        >
            <div className="relative h-36 overflow-hidden bg-slate-800">
                <Image
                    src={img}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
            </div>
            <div className="p-3">
                <p className="truncate text-sm font-semibold">{listing.title}</p>
                <p className="mt-0.5 text-base font-black text-primary">{formatPrice(listing.price)}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                    {listing.year} · {listing.mileage?.toLocaleString()} mi · {listing.location}
                </p>
            </div>
        </Link>
    )
}

function ReviewCard({ review }: { review: Review }) {
    const name = [review.reviewer.firstName, review.reviewer.lastName].filter(Boolean).join(" ") || "Anonymous"
    const isVerified = !!review.listingId
    return (
        <div className="rounded-xl border border-white/5 bg-white/2 p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    {review.reviewer.profileImage ? (
                        <Image src={review.reviewer.profileImage} alt={name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-bold">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{name}</p>
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <BadgeCheck size={10} /> Verified purchase
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{timeAgo(review.createdAt)}</p>
                    </div>
                </div>
                <StarRating rating={review.rating} size={12} />
            </div>
            {review.comment && (
                <p className="mt-3 text-sm leading-relaxed text-gray-300">&ldquo;{review.comment}&rdquo;</p>
            )}
        </div>
    )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-12 text-center">
            {icon}
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    )
}
