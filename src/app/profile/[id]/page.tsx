import { notFound } from "next/navigation"
import Link from "next/link"
import { BadgeCheck, Building2, CalendarDays, MapPin, ShieldCheck, Star } from "lucide-react"
import { ProfileReviewForm } from "@/components/profile/ProfileReviewForm"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

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

type Review = {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    reviewer: { id: string; displayName: string; avatar: string | null }
}

async function getProfile(id: string): Promise<PublicProfile | null> {
    try {
        const response = await fetch(`${API_BASE}/profiles/${id}`, { next: { revalidate: 60 } })
        if (response.status === 404) return null
        if (!response.ok) return null
        const json = await response.json()
        return json.data
    } catch {
        return null
    }
}

async function getReviews(id: string): Promise<{ data: Review[]; total: number }> {
    try {
        const response = await fetch(`${API_BASE}/profiles/${id}/reviews?limit=20`, { next: { revalidate: 60 } })
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

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const [profile, reviews] = await Promise.all([getProfile(id), getReviews(id)])
    if (!profile) notFound()

    return (
        <main className="min-h-screen">
            <section className="border-b border-[var(--border-default)] bg-gradient-to-b from-slate-900 to-slate-950 text-white">
                <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <div className="h-28 w-28 overflow-hidden rounded-3xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                            {profile.avatar ? (
                                <img src={profile.avatar} alt={profile.displayName} className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-4xl font-black">{profile.displayName.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">{profile.displayName}</h1>
                                {profile.verification.business && <BadgeCheck className="text-emerald-400" size={24} aria-label="Verified business" />}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                                <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} /> {profile.accountLabel}</span>
                                <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> Member since {formatDate(profile.memberSince)}</span>
                                {(profile.business?.businessAddress || profile.provider?.serviceArea || profile.location) && (
                                    <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {profile.business?.businessAddress || profile.provider?.serviceArea || profile.location}</span>
                                )}
                            </div>
                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                                    <Stars rating={profile.rating.average} />
                                    <span className="font-bold">{profile.rating.average.toFixed(1)}</span>
                                    <span className="text-sm text-slate-400">({profile.rating.count} reviews)</span>
                                </div>
                                {profile.badges.map((badge) => (
                                    <span key={badge.key} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                                        {badge.verified && <BadgeCheck size={13} />} {badge.label}
                                    </span>
                                ))}
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
                            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{reviews.total} total</span>
                        </div>
                        {reviews.data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-8 text-center" style={{ color: "var(--text-muted)" }}>No reviews yet.</div>
                        ) : (
                            <div className="space-y-4">
                                {reviews.data.map((review) => (
                                    <article key={review.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/profile/${review.reviewer.id}`} className="h-10 w-10 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {review.reviewer.avatar ? <img src={review.reviewer.avatar} alt="" className="h-full w-full object-cover" /> : <span className="font-bold text-primary">{review.reviewer.displayName.charAt(0)}</span>}
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
