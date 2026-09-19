"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    AlertCircle,
    Building2,
    Car,
    CheckCircle2,
    Loader2,
    Shield,
    Star,
    User,
} from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { ProfileImageUploader } from "@/components/profile/ProfileImageUploader"
import { ServiceBadgePill } from "@/components/profile/ServiceBadgePill"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

type ServiceBadge = { key: string; label: string; verified: boolean }
type PublicProfileSummary = {
    badges: ServiceBadge[]
    rating: { average: number; count: number }
}
type ReviewItem = {
    id: string
    rating: number
    comment: string | null
    createdAt: string
    reviewer?: { id: string; displayName: string; avatar: string | null }
    target?: { id: string; displayName: string; avatar: string | null }
}

export default function ProfilePage() {
    const { profile, refreshProfile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [personalLoading, setPersonalLoading] = React.useState(false)
    const [success, setSuccess] = React.useState<string | null>(null)
    const [roleError, setRoleError] = React.useState<string | null>(null)
    const [businessLoading, setBusinessLoading] = React.useState(false)
    const [publicSummary, setPublicSummary] = React.useState<PublicProfileSummary | null>(null)
    const [receivedReviews, setReceivedReviews] = React.useState<ReviewItem[]>([])
    const [givenReviews, setGivenReviews] = React.useState<ReviewItem[]>([])

    const [personalForm, setPersonalForm] = React.useState({
        firstName: "",
        lastName: "",
        phone: "",
        location: "",
        postcode: "",
    })
    const [businessForm, setBusinessForm] = React.useState({
        companyName: "",
        registrationNumber: "",
        vatNumber: "",
        businessAddress: "",
        phone: "",
        website: "",
        description: "",
        logo: "",
        openingHours: Object.fromEntries(DAYS.map((day) => [day, ""])) as Record<string, string>,
    })

    React.useEffect(() => {
        if (!profile) return
        setPersonalForm({
            firstName: profile.firstName || "",
            lastName: profile.lastName || "",
            phone: profile.phone || "",
            location: profile.location || "",
            postcode: profile.postcode || "",
        })
        const dealer = profile.dealerProfile
        setBusinessForm({
            companyName: dealer?.companyName || "",
            registrationNumber: dealer?.registrationNumber || "",
            vatNumber: dealer?.vatNumber?.startsWith?.("PENDING-") ? "" : dealer?.vatNumber || "",
            businessAddress: dealer?.businessAddress || "",
            phone: dealer?.phone || "",
            website: dealer?.website || "",
            description: dealer?.description || "",
            logo: dealer?.logo || "",
            openingHours: {
                ...Object.fromEntries(DAYS.map((day) => [day, ""])),
                ...(dealer?.openingHours || {}),
            },
        })
    }, [profile])

    const loadReputation = React.useCallback(async () => {
        if (!profile?.id) return
        try {
            const [summaryResponse, receivedResponse, givenResponse] = await Promise.all([
                apiClient<{ success: boolean; data: PublicProfileSummary }>(`/profiles/${profile.id}`),
                apiClient<{ success: boolean; data: { data: ReviewItem[] } }>(`/profiles/${profile.id}/reviews?limit=20`),
                apiClient<{ success: boolean; data: { data: ReviewItem[] } }>(`/profiles/me/reviews/given?limit=20`),
            ])
            setPublicSummary(summaryResponse.data)
            setReceivedReviews(receivedResponse.data.data || [])
            setGivenReviews(givenResponse.data.data || [])
        } catch (error) {
            console.warn("Could not load profile reputation", error)
        }
    }, [profile?.id])

    React.useEffect(() => {
        loadReputation()
    }, [loadReputation])

    const saveProfileImage = async (url: string) => {
        await apiClient("/users/me", { method: "PATCH", body: JSON.stringify({ profileImage: url }) })
        await refreshProfile()
    }

    const handleUpdatePersonal = async () => {
        setPersonalLoading(true)
        setSuccess(null)
        setRoleError(null)
        try {
            await apiClient("/users/me", { method: "PATCH", body: JSON.stringify(personalForm) })
            await refreshProfile()
            setSuccess("Personal profile updated successfully.")
        } catch (error) {
            setRoleError(error instanceof Error ? error.message : "Could not update your profile.")
        } finally {
            setPersonalLoading(false)
        }
    }

    const businessPayload = React.useCallback((extra?: Record<string, unknown>) => ({
        companyName: businessForm.companyName.trim(),
        ...(businessForm.registrationNumber.trim() ? { registrationNumber: businessForm.registrationNumber.trim() } : {}),
        ...(businessForm.vatNumber.trim() ? { vatNumber: businessForm.vatNumber.trim() } : {}),
        ...(businessForm.businessAddress.trim() ? { businessAddress: businessForm.businessAddress.trim() } : {}),
        ...(businessForm.phone.trim() ? { phone: businessForm.phone.trim() } : {}),
        ...(businessForm.website.trim() ? { website: businessForm.website.trim() } : {}),
        description: businessForm.description.trim(),
        openingHours: Object.fromEntries(Object.entries(businessForm.openingHours).filter(([, value]) => value.trim())),
        ...extra,
    }), [businessForm])

    const handleUpdateBusiness = async () => {
        if (!businessForm.companyName.trim()) {
            setRoleError("Business / trading name is required.")
            return
        }
        setBusinessLoading(true)
        setSuccess(null)
        setRoleError(null)
        try {
            const payload = businessPayload()
            await apiClient("/users/dealer-profile", {
                method: "PATCH",
                body: JSON.stringify(payload),
            })
            // The legacy DealerProfile create branch predates openingHours and
            // does not persist that field on the first insert. If this is the
            // Partner's first business save, immediately run the same payload
            // through the update branch so the complete profile is stored.
            if (!profile?.dealerProfile) {
                await apiClient("/users/dealer-profile", {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                })
            }
            setSuccess("Partner business profile updated successfully.")
            await refreshProfile()
            await loadReputation()
        } catch (error) {
            setRoleError(error instanceof Error ? error.message : "Could not update the Partner business profile.")
        } finally {
            setBusinessLoading(false)
        }
    }

    const saveBusinessLogo = async (url: string) => {
        if (!businessForm.companyName.trim()) throw new Error("Enter the business / trading name before uploading the logo.")
        await apiClient("/users/dealer-profile", {
            method: "PATCH",
            body: JSON.stringify(businessPayload({ logo: url })),
        })
        setBusinessForm((current) => ({ ...current, logo: url }))
        await refreshProfile()
        await loadReputation()
    }

    const handleRoleElevation = async (newRole: "BUYER" | "DEALER") => {
        setLoading(true)
        setSuccess(null)
        setRoleError(null)
        try {
            await apiClient("/users/elevate", { method: "POST", body: JSON.stringify({ newRole }) })
            await refreshProfile()
            if (newRole === "DEALER") {
                router.push("/dashboard/partner")
                return
            }
            setSuccess("Your account is now set up as a Personal Account.")
        } catch (error) {
            setRoleError(error instanceof Error ? error.message : "Could not change your account type. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>
    }

    const currentRole = profile?.role || ""
    const isPersonal = currentRole === "BUYER" || currentRole === "SELLER"
    const isPartner = currentRole === "DEALER" || currentRole === "CONTRACTOR"
    const canOwnDealershipProfile = currentRole === "DEALER" || !!profile?.dealerProfile
    const accountLabel = isPersonal ? "Personal Account" : isPartner ? "Partner Account" : currentRole
    const initials = `${profile?.firstName?.[0] || ""}${profile?.lastName?.[0] || ""}` || profile?.email?.[0] || "C"

    return (
        <div className="max-w-5xl mx-auto py-12 px-4">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl font-bold font-heading">Manage Your Profile</h1>
                {profile?.id && <Link href={`/profile/${profile.id}`}><Button variant="outline">View Public Profile</Button></Link>}
            </div>

            <div className="glass-card p-8 mb-8">
                <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
                    <ProfileImageUploader
                        currentUrl={profile?.profileImage}
                        fallback={initials}
                        folder={`profiles/${profile?.id || "unknown"}`}
                        label="Profile photo"
                        onSave={saveProfileImage}
                    />
                    <div>
                        <h2 className="text-xl font-bold">{profile?.firstName} {profile?.lastName}</h2>
                        <p style={{ color: "var(--text-muted)" }}>{profile?.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/45 bg-gradient-to-r from-violet-500/20 to-indigo-500/10 px-3 py-1.5 text-xs font-bold text-violet-700 shadow-[0_0_18px_rgba(139,92,246,0.12)] dark:text-violet-100"><Shield size={13} /> {accountLabel}</span>
                            {publicSummary?.badges.map((badge) => <ServiceBadgePill key={badge.key} badge={badge} compact />)}
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <Stars rating={publicSummary?.rating.average || 0} />
                            <strong>{(publicSummary?.rating.average || 0).toFixed(1)}</strong>
                            <span style={{ color: "var(--text-muted)" }}>({publicSummary?.rating.count || 0} reviews)</span>
                        </div>
                    </div>
                </div>
            </div>

            {success && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-700 dark:text-green-200 flex items-center gap-3"><CheckCircle2 size={18} /> {success}</div>}
            {roleError && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-red-600 dark:text-red-300 flex items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0" /> {roleError}</div>}

            <section className="mb-12">
                <h3 className="text-xl font-bold mb-6">Personal Profile</h3>
                <div className="glass-card p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label="First name" value={personalForm.firstName} onChange={(value) => setPersonalForm({ ...personalForm, firstName: value })} />
                        <Field label="Last name" value={personalForm.lastName} onChange={(value) => setPersonalForm({ ...personalForm, lastName: value })} />
                        <Field label="Phone" value={personalForm.phone} onChange={(value) => setPersonalForm({ ...personalForm, phone: value })} />
                        <Field label="Postcode" value={personalForm.postcode} onChange={(value) => setPersonalForm({ ...personalForm, postcode: value })} />
                        <div className="md:col-span-2"><Field label="Location / area" value={personalForm.location} onChange={(value) => setPersonalForm({ ...personalForm, location: value })} /></div>
                    </div>
                    <Button className="mt-6" onClick={handleUpdatePersonal} disabled={personalLoading}>{personalLoading && <Loader2 className="animate-spin mr-2" size={16} />}Save Personal Profile</Button>
                </div>
            </section>

            <section className="mb-12">
                <h3 className="text-xl font-bold mb-6">Appearance</h3>
                <div className="glass-card p-6 flex items-center justify-between">
                    <div><p className="font-semibold">Theme</p><p className="text-sm" style={{ color: "var(--text-muted)" }}>Switch between light and dark mode</p></div>
                    <ThemeToggle />
                </div>
            </section>

            {isPartner && (
                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Building2 className="text-primary" /> Partner Account</h3>
                    <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div><p className="font-bold">One business account, multiple services</p><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Your approved Vehicle Dealer, Delivery & Recovery, Vehicle Inspection, Vehicle Finance and Warranty services can live under the same Partner Account.</p></div>
                        <Link href="/dashboard/partner"><Button>Open Partner Dashboard</Button></Link>
                    </div>
                </section>
            )}

            {canOwnDealershipProfile && (
                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Building2 className="text-primary" /> Partner Business Profile</h3>
                    <div className="glass-card p-8 space-y-8">
                        <ProfileImageUploader
                            currentUrl={businessForm.logo || profile?.dealerProfile?.logo}
                            fallback={businessForm.companyName || "CM"}
                            folder={`partner-logos/${profile?.id || "unknown"}`}
                            label="Business / dealership logo"
                            onSave={saveBusinessLogo}
                            square
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Business / Trading Name *" value={businessForm.companyName} onChange={(value) => setBusinessForm({ ...businessForm, companyName: value })} />
                            <Field label="Company Registration Number" value={businessForm.registrationNumber} onChange={(value) => setBusinessForm({ ...businessForm, registrationNumber: value })} />
                            <Field label="VAT Number" value={businessForm.vatNumber} onChange={(value) => setBusinessForm({ ...businessForm, vatNumber: value })} />
                            <Field label="Phone" value={businessForm.phone} onChange={(value) => setBusinessForm({ ...businessForm, phone: value })} />
                            <Field label="Website" type="url" value={businessForm.website} onChange={(value) => setBusinessForm({ ...businessForm, website: value })} />
                            <div className="md:col-span-2"><Field label="Business Address / Service Area" value={businessForm.businessAddress} onChange={(value) => setBusinessForm({ ...businessForm, businessAddress: value })} /></div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold uppercase" style={{ color: "var(--text-muted)" }}>Business Description</label>
                                <textarea value={businessForm.description} onChange={(event) => setBusinessForm({ ...businessForm, description: event.target.value })} rows={4} maxLength={2000} className="w-full border rounded-lg px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold mb-3">Opening Hours</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {DAYS.map((day) => <Field key={day} label={day} placeholder="e.g. 09:00–17:30 or Closed" value={businessForm.openingHours[day] || ""} onChange={(value) => setBusinessForm({ ...businessForm, openingHours: { ...businessForm.openingHours, [day]: value } })} />)}
                            </div>
                        </div>
                        <Button onClick={handleUpdateBusiness} disabled={businessLoading}>{businessLoading && <Loader2 className="animate-spin mr-2" size={16} />}Save Business Profile</Button>
                    </div>
                </section>
            )}

            <section className="mb-12">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                    <div><h3 className="text-xl font-bold">Ratings & Reviews</h3><p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>See what others have written about you and the reviews you have given.</p></div>
                    {profile?.id && <Link href={`/profile/${profile.id}`}><Button size="sm">Open public reviews</Button></Link>}
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                    <ReviewPanel title="Reviews received" items={receivedReviews} mode="received" />
                    <ReviewPanel title="Reviews given" items={givenReviews} mode="given" />
                </div>
            </section>

            <section id="upgrade-role" className="scroll-mt-28">
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2"><Car className="text-primary" /> Account Type</h3>
                <p className="mb-7" style={{ color: "var(--text-muted)" }}>Personal accounts are for individual buyers and sellers. Businesses use one Partner Account and add the services they need from the Partner Dashboard.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {!isPersonal && <AccountCard icon={User} label="Personal Account" sub="Buy and sell vehicles as an individual" button="Switch to Personal Account" loading={loading} onClick={() => handleRoleElevation("BUYER")} />}
                    {!isPartner && <AccountCard icon={Building2} label="Partner Account" sub="One business login with Dealer, Delivery, Inspection, Finance and Warranty add-ons" button="Create Partner Account" loading={loading} onClick={() => handleRoleElevation("DEALER")} />}
                </div>
            </section>
        </div>
    )
}

function Stars({ rating }: { rating: number }) {
    return <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={14} className={star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-[var(--text-muted)]"} />)}</span>
}

function ReviewPanel({ title, items, mode }: { title: string; items: ReviewItem[]; mode: "received" | "given" }) {
    return (
        <div className="glass-card p-6">
            <h4 className="font-bold mb-4">{title}</h4>
            {items.length === 0 ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No reviews yet.</p> : (
                <div className="space-y-4">
                    {items.slice(0, 5).map((review) => {
                        const person = mode === "received" ? review.reviewer : review.target
                        return <div key={review.id} className="border-b border-[var(--border-default)] pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between gap-3"><Link href={person ? `/profile/${person.id}` : "#"} className="font-semibold hover:text-primary">{person?.displayName || "CarMazium Member"}</Link><Stars rating={review.rating} /></div>
                            {review.comment && <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{review.comment}</p>}
                        </div>
                    })}
                </div>
            )}
        </div>
    )
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
    return <div className="space-y-2"><label className="text-sm font-bold uppercase" style={{ color: "var(--text-muted)" }}>{label}</label><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="w-full border rounded-lg px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none" style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-primary)" }} /></div>
}

function AccountCard({ icon: Icon, label, sub, button, loading, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; sub: string; button: string; loading: boolean; onClick: () => void }) {
    return <div className="glass-card p-6 hover:bg-primary/5 transition-colors flex flex-col items-center text-center"><div className="w-12 h-12 rounded-full flex items-center justify-center text-primary mb-4" style={{ background: "var(--bg-input)" }}><Icon size={24} /></div><h4 className="font-bold mb-2">{label}</h4><p className="text-xs mb-6" style={{ color: "var(--text-faint)" }}>{sub}</p><Button variant="outline" size="sm" className="mt-auto w-full" disabled={loading} onClick={onClick}>{loading ? <Loader2 className="animate-spin" size={16} /> : button}</Button></div>
}
