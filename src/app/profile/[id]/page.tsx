import { notFound } from "next/navigation"
import Link from "next/link"
import { BadgeCheck, Building2, CalendarDays, MapPin, ShieldCheck, Star } from "lucide-react"
import { ProfileReviewForm } from "@/components/profile/ProfileReviewForm"
import { ServiceBadgePill } from "@/components/profile/ServiceBadgePill"
import { profileImageStyle, type ProfileImageFit } from "@/lib/profileImagePresentation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

const TRANSIENT_BACKEND_STATUS = new Set([502, 503, 504])

function retryUrl(url: string, attempt: number) {
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}_ssrRetry=${attempt}`
}

async function fetchBackend(url: string) {
    let lastError: unknown = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const target = attempt === 0 ? url : retryUrl(url, attempt)
            const response = await fetch(target, { next: { revalidate: 60 } })
            if (!TRANSIENT_BACKEND_STATUS.has(response.status) || attempt === 2) return response
        } catch (error) {
            lastError = error
            if (attempt === 2) throw error
        }
    }

    if (lastError instanceof Error) throw lastError
    throw new Error("Backend request failed")
}

type ServiceBadge = { key: string; label: string; verified: boolean }
type PublicProfile = {
    id: string
    displayName: string
    avatar: string | null
    accountLabel: string
    role: string
    firstName: string | null
    lastName: string | null
    profileImage: string | null
    location: string | null
    memberSince: string
    verification: { email: boolean; address: boolean; business: boolean }
    business: null | {
        id: string
        companyName: string
        registrationNumber: string | null
        businessAddress: string | null
        logo: string | null
        description: string | null
        phone: string | null
        website: string | null
        openingHours: Record<string, string> | null
        isVerified: boolean
    }
    provider: null | { businessName: string | null; serviceArea: string | null; certifications: string[] }
    badges: ServiceBadge[]
    rating: { average: number; count: number; distribution: Array<{ star: number; count: number }> }
}

type ReceivedReview = {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    reviewer: { id: string; displayName: string; avatar: string | null }
}

type GivenReview = {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    target: { id: string; displayName: string; avatar: string | null }
}

async function getProfile(id: string): Promise<PublicProfile | null> {
    try {
        const response = await fetchBackend(`${API_BASE}/profiles/${id}`)
        if (response.status === 404) return null
        if (!response.ok) return null
        const json = await response.json()
        return json.data
    } catch {
        return null
    }
}

async function getReceivedReviews(id: string): Promise<{ data: ReceivedReview[]; total: number }> {
    try {
        const response = await fetchBackend(`${API_BASE}/profiles/${id}/reviews?limit=20`)
        if (!response.ok) return { data: [], total: 0 }
        const json = await response.json()
        return json.data ?? { data: [], total: 0 }
    } catch {
        return { data: [], total: 0 }
    }
}

async function getGivenReviews(id: string): Promise<{ data: GivenReview[]; total: number }> {
    try {
        const response = await fetchBackend(`${API_BASE}/profiles/${id}/reviews/given?limit=20`)
        if (!response.ok) return { data: [], total: 0 }
        const json = await response.json()
        return json.data ?? { data: [], total: 0 }
    } catch {
        return { data: [], total: 0 }
    }
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
    return (
        <span className="inline-flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={size} className={star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-[var(--text-muted)]"} />
            ))}
        </span>
    )
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(value))
}

function PresentedImage({ value, alt, className, fallbackFit = "cover" }: { value: string; alt: string; className: string; fallbackFit?: ProfileImageFit }) {
    const image = profileImageStyle(value, fallbackFit)
    return <img src={image.src} alt={alt} className={className} style={image.style} />
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const [profile, receivedReviews, givenReviews] = await Promise.all([
        getProfile(id),
        getReceivedReviews(id),
        getGivenReviews(id),
    ])
    if (!profile) notFound()

    return (
        <main className="min-h-screen">
            <section className="border-b border-slate-700/50 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
                <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
                    <div className="rounded-3xl border border-blue-300/15 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.35)] backdrop-blur-sm sm:p-7">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                            <div className={`h-28 w-28 overflow-hidden rounded-3xl border border-white/15 flex items-center justify-center shrink-0 shadow-lg sm:h-32 sm:w-32 ${profile.business ? "bg-white" : "bg-white/5"}`}>
                                {profile.avatar ? (
                                    <PresentedImage value={profile.avatar} alt={profile.displayName} className="h-full w-full transition-transform duration-200" fallbackFit={profile.business ? "contain" : "cover"} />
                                ) : (
                                    <span className="text-4xl font-black">{profile.displayName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{profile.displayName}</h1>
                                    {profile.verification.business && <BadgeCheck className="text-emerald-400" size={24} aria-label="Verified business" />}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-500/25 to-indigo-500/15 px-3 py-1.5 font-bold text-violet-100 shadow-[0_0_18px_rgba(139,92,246,0.12)]"><ShieldCheck size={14} /> {profile.accountLabel}</span>
                                    <span className="inline-flex items-center gap-1.5 px-1"><CalendarDays size={15} /> Member since {formatDate(profile.memberSince)}</span>
                                    {(profile.business?.businessAddress || profile.provider?.serviceArea || profile.location) && (
                                        <span className="inline-flex min-w-0 items-center gap-1.5 px-1"><MapPin size={15} className="shrink-0" /> <span className="truncate">{profile.business?.businessAddress || profile.provider?.serviceArea || profile.location}</span></span>
                                    )}
                                </div>
                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 shadow-sm">
                                        <Stars rating={profile.rating.average} />
                                        <span className="font-bold">{profile.rating.average.toFixed(1)}</span>
                                        <span className="text-sm text-slate-400">({profile.rating.count} reviews)</span>
                                    </div>
                                    {profile.badges.map((badge) => <ServiceBadgePill key={badge.key} badge={badge} />)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-8">
                    {profile.business && (
                        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <h2 className="flex items-center gap-2 text-xl font-bold"><Building2 className="text-primary" size={20} /> Business profile</h2>
                            {profile.business.description && <p className="mt-4 leading-7" style={{ color: "var(--text-muted)" }}>{profile.business.description}</p>}
                            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                                {profile.business.registrationNumber && <Info label="Company number" value={profile.business.registrationNumber} />}
                                {profile.business.phone && <Info label="Business phone" value={profile.business.phone} />}
                                {profile.business.website && <Info label="Website" value={profile.business.website} href={profile.business.website} />}
                                {profile.business.businessAddress && <Info label="Business address / service area" value={profile.business.businessAddress} />}
                            </dl>
                            {profile.business.openingHours && Object.keys(profile.business.openingHours).length > 0 && (
                                <div className="mt-6 border-t border-[var(--border-default)] pt-5">
                                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Opening hours</h3>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {Object.entries(profile.business.openingHours).map(([day, hours]) => (
                                            <div key={day} className="flex justify-between gap-4 text-sm"><span className="capitalize font-semibold">{day}</span><span style={{ color: "var(--text-muted)" }}>{hours}</span></div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">Reviews received</h2>
                            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{receivedReviews.total} total</span>
                        </div>
                        {receivedReviews.data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center" style={{ color: "var(--text-muted)" }}>No reviews yet.</div>
                        ) : (
                            <div className="space-y-4">
                                {receivedReviews.data.map((review) => (
                                    <article key={review.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/profile/${review.reviewer.id}`} className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {review.reviewer.avatar ? <PresentedImage value={review.reviewer.avatar} alt="" className="h-full w-full" /> : <span className="font-bold text-primary">{review.reviewer.displayName.charAt(0)}</span>}
                                            </Link>
                                            <div className="flex-1">
                                                <Link href={`/profile/${review.reviewer.id}`} className="font-semibold hover:text-primary">{review.reviewer.displayName}</Link>
                                                <div className="mt-1 flex items-center gap-2"><Stars rating={review.rating} size={13} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(review.createdAt)}</span></div>
                                            </div>
                                        </div>
                                        {review.comment && <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{review.comment}</p>}
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">Reviews given</h2>
                            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{givenReviews.total} total</span>
                        </div>
                        {givenReviews.data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center" style={{ color: "var(--text-muted)" }}>No reviews given yet.</div>
                        ) : (
                            <div className="space-y-4">
                                {givenReviews.data.map((review) => (
                                    <article key={review.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/profile/${review.target.id}`} className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {review.target.avatar ? <PresentedImage value={review.target.avatar} alt="" className="h-full w-full" /> : <span className="font-bold text-primary">{review.target.displayName.charAt(0)}</span>}
                                            </Link>
                                            <div className="flex-1">
                                                <Link href={`/profile/${review.target.id}`} className="font-semibold hover:text-primary">{review.target.displayName}</Link>
                                                <div className="mt-1 flex items-center gap-2"><Stars rating={review.rating} size={13} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(review.createdAt)}</span></div>
                                            </div>
                                        </div>
                                        {review.comment && <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{review.comment}</p>}
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <aside className="space-y-5">
                    <ProfileReviewForm profileId={profile.id} />
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                        <h3 className="font-bold">Profile trust</h3>
                        <div className="mt-4 space-y-3 text-sm">
                            <TrustRow label="Email verified" active={profile.verification.email} />
                            <TrustRow label="Address verified" active={profile.verification.address} />
                            {profile.business && <TrustRow label="Business verified" active={profile.verification.business} />}
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    )
}

function Info({ label, value, href }: { label: string; value: string; href?: string }) {
    return (
        <div>
            <dt className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</dt>
            <dd className="mt-1 font-medium">{href ? <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">{value}</a> : value}</dd>
        </div>
    )
}

function TrustRow({ label, active }: { label: string; active: boolean }) {
    return <div className="flex items-center justify-between"><span>{label}</span><span className={active ? "text-emerald-500 font-semibold" : "text-[var(--text-muted)]"}>{active ? "Verified" : "Not verified"}</span></div>
}
