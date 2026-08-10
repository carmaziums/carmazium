"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Car, Loader2, ArrowLeft, Trash2, AlertTriangle, Eye, ChevronDown, Check, X, Clock, Pencil, Save } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { UserDetailModal } from "@/components/dashboard/UserDetailModal"
import { useAuth } from "@/context/AuthContext"
import { getAdminListings, deleteListingForce, getPendingListingReviews, approveListing, rejectListing, updateListingAsAdmin } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUGIN_HYBRID', 'LPG', 'HYDROGEN_CELL', 'BI_FUEL', 'NATURAL_GAS', 'PETROL_HYBRID', 'DIESEL_HYBRID', 'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID', 'UNLISTED']
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC', 'CVT']
const BODY_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE', 'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK', 'STATION_WAGON', 'MPV', 'VAN']
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CAT_S', 'CAT_N', 'CAT_C', 'CAT_D']
const WRITE_OFF_CATEGORIES = ['NONE', 'CAT_S', 'CAT_N', 'CAT_A', 'CAT_B']
const VEHICLE_TYPES = ['CAR', 'HGV', 'MOTORCYCLE']
const EURO_STANDARDS = ['EURO_4', 'EURO_5', 'EURO_6', 'EURO_6D']

const EDIT_NUMERIC_FIELDS = [
    'price', 'priceMin', 'priceMax', 'year', 'mileage', 'doors', 'seats',
    'engineSize', 'bhp', 'torqueNm', 'topSpeedMph', 'zeroTo60Mph', 'combinedMpg', 'extraUrbanMpg',
    'numberOfKeys', 'co2Emissions', 'deliveryPricePerMile', 'deliveryMaxMiles',
    'reservePrice', 'startingBid', 'minIncrement', 'buyItNowPrice',
]
const EDIT_BOOLEAN_FIELDS = [
    'ulezCompliant', 'stolenRecovered', 'hasOutstandingFinance', 'isLegalRegisteredKeeper',
    'isDepartedSale', 'markedForExport', 'isImported', 'deliveryAvailable',
]
const EDIT_ARRAY_FIELDS = ['features', 'videoUrls']
const LISTING_TYPES = ['CLASSIFIED', 'AUCTION']
const BADGE_TIERS = ['FREE', 'BASIC', 'STANDARD', 'PREMIUM']

const editInputClass = "w-full mt-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"

function EditField({ label, value, onChange, type = 'text', options }: {
    label: string
    value: string
    onChange: (v: string) => void
    type?: 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'datetime-local'
    options?: string[]
}) {
    return (
        <div>
            <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</label>
            {type === 'select' ? (
                <select value={value} onChange={(e) => onChange(e.target.value)} className={editInputClass}>
                    <option value="">—</option>
                    {options?.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            ) : type === 'boolean' ? (
                <select value={value} onChange={(e) => onChange(e.target.value)} className={editInputClass}>
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            ) : type === 'textarea' ? (
                <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={editInputClass} />
            ) : (
                <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={editInputClass} />
            )}
        </div>
    )
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="pt-3 first:pt-0">
            <p className="text-xs font-black uppercase tracking-widest text-primary mb-2 border-b border-[var(--border-default)] pb-1.5">{title}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
        </div>
    )
}

export default function AdminListingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [listings, setListings] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [deleting, setDeleting] = React.useState<string | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 20

    // ── Pending review ──
    const [pendingListings, setPendingListings] = React.useState<any[]>([])
    const [pendingLoading, setPendingLoading] = React.useState(true)
    const [expandedId, setExpandedId] = React.useState<string | null>(null)
    const [rejectReasons, setRejectReasons] = React.useState<Record<string, string>>({})
    const [actionLoading, setActionLoading] = React.useState<string | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)
    const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
    const [editingId, setEditingId] = React.useState<string | null>(null)
    const [editForm, setEditForm] = React.useState<Record<string, string>>({})
    const [editImages, setEditImages] = React.useState<string[]>([])
    const [imageUploading, setImageUploading] = React.useState(false)
    const [savingEdit, setSavingEdit] = React.useState(false)
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)

    React.useEffect(() => {
        // Enforce Admin Access
        if (!authLoading) {
            if (!user) {
                router.replace('/auth/login')
                return
            }
            if (profile?.role !== 'ADMIN') {
                router.replace('/dashboard')
                return
            }
        }
    }, [user, profile, authLoading, router])

    const fetchListings = async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await getAdminListings(page, limit)
            setListings(result.data || [])
            setTotal(result.pagination?.total || 0)
        } catch (err: any) {
            console.error('Failed to fetch admin listings:', err)
            setError(err.message || "Failed to load system listings.")
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') {
            fetchListings()
        }
    }, [profile, page])

    const loadPending = async () => {
        try {
            setPendingLoading(true)
            const data = await getPendingListingReviews()
            setPendingListings(data || [])
        } catch (err) {
            console.error('Failed to load pending listing reviews:', err)
        } finally {
            setPendingLoading(false)
        }
    }

    React.useEffect(() => {
        if (profile?.role === 'ADMIN') {
            loadPending()
        }
    }, [profile])

    const handleApprove = async (id: string) => {
        setActionError(null)
        setSuccessMsg(null)
        try {
            setActionLoading(id)
            await approveListing(id)
            setPendingListings(prev => prev.filter(l => l.id !== id))
            setExpandedId(null)
            setSuccessMsg('Listing approved and is now live.')
        } catch (err: any) {
            setActionError(err.message || 'Failed to approve listing')
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async (id: string) => {
        const reason = (rejectReasons[id] || '').trim()
        if (reason.length < 10) {
            setActionError('Please provide a rejection reason (at least 10 characters).')
            return
        }
        setActionError(null)
        setSuccessMsg(null)
        try {
            setActionLoading(id)
            await rejectListing(id, reason)
            setPendingListings(prev => prev.filter(l => l.id !== id))
            setExpandedId(null)
            setSuccessMsg('Listing rejected — the seller has been notified.')
        } catch (err: any) {
            setActionError(err.message || 'Failed to reject listing')
        } finally {
            setActionLoading(null)
        }
    }

    const startEdit = (l: any) => {
        setActionError(null)
        setSuccessMsg(null)
        setEditingId(l.id)
        setEditImages(Array.isArray(l.images) ? [...l.images] : [])
        const str = (v: unknown) => v != null ? String(v) : ''
        const bool = (v: unknown) => v === true ? 'true' : v === false ? 'false' : ''
        // datetime-local inputs need "YYYY-MM-DDTHH:mm" (no seconds/timezone)
        const localDatetime = (v: unknown) => {
            if (!v) return ''
            const d = new Date(v as string)
            if (isNaN(d.getTime())) return ''
            const pad = (n: number) => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
        setEditForm({
            title: l.title || '',
            price: str(l.price),
            priceMin: str(l.priceMin),
            priceMax: str(l.priceMax),
            description: l.description || '',
            make: l.make || '',
            model: l.model || '',
            variant: l.variant || '',
            year: str(l.year),
            mileage: str(l.mileage),
            vrm: l.vrm || '',
            vin: l.vin || '',
            fuelType: l.fuelType || '',
            transmission: l.transmission || '',
            bodyType: l.bodyType || '',
            condition: l.condition || '',
            color: l.color || '',
            doors: str(l.doors),
            seats: str(l.seats),
            driveType: l.driveType || '',
            engineSize: str(l.engineSize),
            bhp: str(l.bhp),
            torqueNm: str(l.torqueNm),
            topSpeedMph: str(l.topSpeedMph),
            zeroTo60Mph: str(l.zeroTo60Mph),
            combinedMpg: str(l.combinedMpg),
            extraUrbanMpg: str(l.extraUrbanMpg),
            ulezCompliant: bool(l.ulezCompliant),
            euroStandard: l.euroStandard || '',
            co2Emissions: str(l.co2Emissions),
            numberOfKeys: str(l.numberOfKeys),
            serviceHistory: l.serviceHistory || '',
            owners: l.owners || '',
            stolenRecovered: bool(l.stolenRecovered),
            hasOutstandingFinance: bool(l.hasOutstandingFinance),
            isLegalRegisteredKeeper: bool(l.isLegalRegisteredKeeper),
            writeOffCategory: l.writeOffCategory || '',
            isDepartedSale: bool(l.isDepartedSale),
            departedRelationship: l.departedRelationship || '',
            notOwnerRelationship: l.notOwnerRelationship || '',
            motStatus: l.motStatus || '',
            taxStatus: l.taxStatus || '',
            motExpiryDate: l.motExpiryDate || '',
            taxDueDate: l.taxDueDate || '',
            markedForExport: bool(l.markedForExport),
            monthOfFirstRegistration: l.monthOfFirstRegistration || '',
            wheelplan: l.wheelplan || '',
            typeApproval: l.typeApproval || '',
            location: l.location || '',
            vehicleType: l.vehicleType || '',
            isImported: bool(l.isImported),
            bannerLabel: l.bannerLabel || '',
            features: Array.isArray(l.features) ? l.features.join(', ') : '',
            deliveryAvailable: bool(l.deliveryAvailable),
            deliveryPricePerMile: str(l.deliveryPricePerMile),
            deliveryMaxMiles: str(l.deliveryMaxMiles),
            listingType: l.type || '',
            badgeTier: l.badgeTier || '',
            videoUrls: Array.isArray(l.videoUrls) ? l.videoUrls.join(', ') : '',
            reservePrice: str(l.auction?.reservePrice),
            startingBid: str(l.auction?.startingBid),
            minIncrement: str(l.auction?.minIncrement),
            buyItNowPrice: str(l.auction?.buyItNowPrice),
            startTime: localDatetime(l.auction?.startTime),
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
        setEditImages([])
    }

    const handleAddImage = async (id: string, file: File) => {
        setImageUploading(true)
        setActionError(null)
        try {
            const url = await uploadImage(file, 'listings', 'admin-edit')
            setEditImages(prev => [...prev, url])
        } catch (err: any) {
            setActionError(err.message || 'Image upload failed')
        } finally {
            setImageUploading(false)
        }
    }

    const handleRemoveImage = (index: number) => {
        setEditImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSaveEdit = async (id: string) => {
        setActionError(null)
        setSuccessMsg(null)
        try {
            setSavingEdit(true)
            // Blank fields are left out rather than sent as '' — every field here
            // is optional server-side, and an empty string would fail number/enum
            // validation instead of just "leave unchanged".
            const fields: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(editForm)) {
                if (value === '') continue
                if (key === 'startTime') {
                    // datetime-local value has no timezone — Date() treats it as
                    // local time, which is what the admin actually entered.
                    fields[key] = new Date(value).toISOString()
                } else if (EDIT_NUMERIC_FIELDS.includes(key)) {
                    fields[key] = Number(value)
                } else if (EDIT_BOOLEAN_FIELDS.includes(key)) {
                    fields[key] = value === 'true'
                } else if (EDIT_ARRAY_FIELDS.includes(key)) {
                    fields[key] = value.split(',').map(s => s.trim()).filter(Boolean)
                } else {
                    fields[key] = value
                }
            }
            fields.images = editImages
            const result = await updateListingAsAdmin(id, fields)
            const updated = result?.data ?? result
            setPendingListings(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
            setEditingId(null)
            setEditImages([])
            setSuccessMsg('Listing details updated.')
        } catch (err: any) {
            setActionError(err.message || 'Failed to save changes')
        } finally {
            setSavingEdit(false)
        }
    }

    const handleDelete = async (listingId: string) => {
        if (!window.confirm("Are you sure you want to forcefully delete this listing? This action cannot be undone.")) return;

        try {
            setDeleting(listingId)
            await deleteListingForce(listingId)
            setListings(listings.filter(l => l.id !== listingId))
            setTotal(t => t - 1)
        } catch (err: any) {
            alert(err.message || 'Failed to delete listing')
        } finally {
            setDeleting(null)
        }
    }

    if (authLoading || (user && !profile) || (loading && listings.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user || profile?.role !== 'ADMIN') return null;

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-[var(--text-muted)] hover:text-primary dark:hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                                <Car className="text-primary hidden sm:block" size={28} />
                                Listing Moderation
                            </h1>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                            <strong>System Error:</strong> {error}
                        </div>
                    )}

                    {/* ── Pending Review ────────────────────────────────────────── */}
                    <div className="glass-card border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl p-6">
                        <h2 className="text-xl font-black font-heading uppercase tracking-tight flex items-center gap-2 mb-4">
                            <Clock className="text-amber-400" size={22} />
                            Pending Review
                            {pendingListings.length > 0 && (
                                <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                                    {pendingListings.length}
                                </span>
                            )}
                        </h2>

                        {actionError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">{actionError}</div>
                        )}
                        {successMsg && (
                            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm">{successMsg}</div>
                        )}

                        {pendingLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
                        ) : pendingListings.length === 0 ? (
                            <p className="text-sm text-[var(--text-muted)] py-4">No listings awaiting review.</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingListings.map((l) => {
                                    const isExpanded = expandedId === l.id
                                    const isRejectedResubmit = l.status === 'REJECTED'
                                    const isEditing = editingId === l.id
                                    const set = (key: string) => (v: string) => setEditForm(prev => ({ ...prev, [key]: v }))
                                    return (
                                        <div key={l.id} className={`border rounded-xl overflow-hidden ${isRejectedResubmit ? 'border-red-500/30' : 'border-[var(--border-default)]'}`}>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedId(isExpanded ? null : l.id)}
                                                className="w-full flex items-center gap-3 p-4 hover:bg-[var(--bg-input)] transition-colors text-left cursor-pointer"
                                            >
                                                {l.images?.[0] ? (
                                                    <Image src={l.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                                        <Car className="text-[var(--text-muted)]" size={18} />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate">{l.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)] truncate">{l.seller?.firstName} {l.seller?.lastName} · {l.seller?.email}</p>
                                                </div>
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${isRejectedResubmit ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {isRejectedResubmit ? 'Rejected' : 'Pending'}
                                                </span>
                                                <span className="text-sm font-bold shrink-0 hidden sm:inline">{formatPrice(l.price)}</span>
                                                <ChevronDown size={18} className={`text-[var(--text-muted)] transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 pt-0 border-t border-[var(--border-default)] bg-[var(--bg-input)]/40">
                                                    {isRejectedResubmit && l.rejectionReason && (
                                                        <div className="my-4 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-300">
                                                            <strong>Previous rejection reason:</strong> {l.rejectionReason}
                                                        </div>
                                                    )}

                                                    {l.images?.length > 0 && (
                                                        <div className="flex gap-2 overflow-x-auto py-4">
                                                            {l.images.map((img: string, i: number) => (
                                                                <Image key={i} src={img} alt="" width={96} height={72} className="w-24 h-[72px] rounded-lg object-cover shrink-0 border border-[var(--border-default)]" />
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isEditing ? (
                                                        <div className="space-y-1 py-2">
                                                            <EditSection title="Core">
                                                                <div className="col-span-2 sm:col-span-3">
                                                                    <EditField label="Title" value={editForm.title} onChange={set('title')} />
                                                                </div>
                                                                <EditField label="Price (£)" value={editForm.price} onChange={set('price')} type="number" />
                                                                <EditField label="Min Offer Price (£)" value={editForm.priceMin} onChange={set('priceMin')} type="number" />
                                                                <EditField label="Max Offer Price (£)" value={editForm.priceMax} onChange={set('priceMax')} type="number" />
                                                            </EditSection>

                                                            <EditSection title="Vehicle Identity">
                                                                <EditField label="Make" value={editForm.make} onChange={set('make')} />
                                                                <EditField label="Model" value={editForm.model} onChange={set('model')} />
                                                                <EditField label="Variant / Trim" value={editForm.variant} onChange={set('variant')} />
                                                                <EditField label="Year" value={editForm.year} onChange={set('year')} type="number" />
                                                                <EditField label="Mileage" value={editForm.mileage} onChange={set('mileage')} type="number" />
                                                                <EditField label="VRM" value={editForm.vrm} onChange={set('vrm')} />
                                                                <EditField label="VIN" value={editForm.vin} onChange={set('vin')} />
                                                            </EditSection>

                                                            <EditSection title="Mechanical &amp; Body">
                                                                <EditField label="Fuel" value={editForm.fuelType} onChange={set('fuelType')} type="select" options={FUEL_TYPES} />
                                                                <EditField label="Transmission" value={editForm.transmission} onChange={set('transmission')} type="select" options={TRANSMISSIONS} />
                                                                <EditField label="Body Type" value={editForm.bodyType} onChange={set('bodyType')} type="select" options={BODY_TYPES} />
                                                                <EditField label="Condition" value={editForm.condition} onChange={set('condition')} type="select" options={CONDITIONS} />
                                                                <EditField label="Colour" value={editForm.color} onChange={set('color')} />
                                                                <EditField label="Doors" value={editForm.doors} onChange={set('doors')} type="number" />
                                                                <EditField label="Seats" value={editForm.seats} onChange={set('seats')} type="number" />
                                                                <EditField label="Drive Type" value={editForm.driveType} onChange={set('driveType')} />
                                                                <EditField label="Engine Size (cc)" value={editForm.engineSize} onChange={set('engineSize')} type="number" />
                                                                <EditField label="Power (BHP)" value={editForm.bhp} onChange={set('bhp')} type="number" />
                                                                <EditField label="Torque (Nm)" value={editForm.torqueNm} onChange={set('torqueNm')} type="number" />
                                                                <EditField label="Top Speed (mph)" value={editForm.topSpeedMph} onChange={set('topSpeedMph')} type="number" />
                                                                <EditField label="0-60mph (sec)" value={editForm.zeroTo60Mph} onChange={set('zeroTo60Mph')} type="number" />
                                                                <EditField label="Combined MPG" value={editForm.combinedMpg} onChange={set('combinedMpg')} type="number" />
                                                                <EditField label="Extra Urban MPG" value={editForm.extraUrbanMpg} onChange={set('extraUrbanMpg')} type="number" />
                                                                <EditField label="ULEZ Compliant" value={editForm.ulezCompliant} onChange={set('ulezCompliant')} type="boolean" />
                                                                <EditField label="Euro Standard" value={editForm.euroStandard} onChange={set('euroStandard')} type="select" options={EURO_STANDARDS} />
                                                                <EditField label="CO2 (g/km)" value={editForm.co2Emissions} onChange={set('co2Emissions')} type="number" />
                                                            </EditSection>

                                                            <EditSection title="History &amp; Ownership">
                                                                <EditField label="Number of Keys" value={editForm.numberOfKeys} onChange={set('numberOfKeys')} type="number" />
                                                                <EditField label="Service History" value={editForm.serviceHistory} onChange={set('serviceHistory')} />
                                                                <EditField label="Previous Owners" value={editForm.owners} onChange={set('owners')} />
                                                                <EditField label="Stolen/Recovered" value={editForm.stolenRecovered} onChange={set('stolenRecovered')} type="boolean" />
                                                                <EditField label="Outstanding Finance" value={editForm.hasOutstandingFinance} onChange={set('hasOutstandingFinance')} type="boolean" />
                                                                <EditField label="Seller is Legal Keeper" value={editForm.isLegalRegisteredKeeper} onChange={set('isLegalRegisteredKeeper')} type="boolean" />
                                                                <EditField label="Write-Off Category" value={editForm.writeOffCategory} onChange={set('writeOffCategory')} type="select" options={WRITE_OFF_CATEGORIES} />
                                                                <EditField label="Departed/Estate Sale" value={editForm.isDepartedSale} onChange={set('isDepartedSale')} type="boolean" />
                                                                <EditField label="Departed Relationship" value={editForm.departedRelationship} onChange={set('departedRelationship')} />
                                                                <EditField label="Not-Owner Relationship" value={editForm.notOwnerRelationship} onChange={set('notOwnerRelationship')} />
                                                            </EditSection>

                                                            <EditSection title="DVLA-Derived">
                                                                <EditField label="MOT Status" value={editForm.motStatus} onChange={set('motStatus')} />
                                                                <EditField label="Tax Status" value={editForm.taxStatus} onChange={set('taxStatus')} />
                                                                <EditField label="MOT Expiry" value={editForm.motExpiryDate} onChange={set('motExpiryDate')} />
                                                                <EditField label="Tax Due Date" value={editForm.taxDueDate} onChange={set('taxDueDate')} />
                                                                <EditField label="Marked for Export" value={editForm.markedForExport} onChange={set('markedForExport')} type="boolean" />
                                                                <EditField label="First Registered" value={editForm.monthOfFirstRegistration} onChange={set('monthOfFirstRegistration')} />
                                                                <EditField label="Wheelplan" value={editForm.wheelplan} onChange={set('wheelplan')} />
                                                                <EditField label="Type Approval" value={editForm.typeApproval} onChange={set('typeApproval')} />
                                                            </EditSection>

                                                            <EditSection title="Listing Meta">
                                                                <EditField label="Location" value={editForm.location} onChange={set('location')} />
                                                                <EditField label="Vehicle Type" value={editForm.vehicleType} onChange={set('vehicleType')} type="select" options={VEHICLE_TYPES} />
                                                                <EditField label="Imported" value={editForm.isImported} onChange={set('isImported')} type="boolean" />
                                                                <EditField label="Banner Label" value={editForm.bannerLabel} onChange={set('bannerLabel')} />
                                                                <div className="col-span-2 sm:col-span-3">
                                                                    <EditField label="Features (comma-separated)" value={editForm.features} onChange={set('features')} />
                                                                </div>
                                                            </EditSection>

                                                            <EditSection title="Delivery">
                                                                <EditField label="Delivery Available" value={editForm.deliveryAvailable} onChange={set('deliveryAvailable')} type="boolean" />
                                                                <EditField label="Price per Mile (£)" value={editForm.deliveryPricePerMile} onChange={set('deliveryPricePerMile')} type="number" />
                                                                <EditField label="Max Miles" value={editForm.deliveryMaxMiles} onChange={set('deliveryMaxMiles')} type="number" />
                                                            </EditSection>

                                                            <EditSection title="Type &amp; Badge">
                                                                <EditField label="Listing Type" value={editForm.listingType} onChange={set('listingType')} type="select" options={LISTING_TYPES} />
                                                                <EditField label="Badge Tier" value={editForm.badgeTier} onChange={set('badgeTier')} type="select" options={BADGE_TIERS} />
                                                                <div className="col-span-2 sm:col-span-3">
                                                                    <EditField label="Video URLs (comma-separated)" value={editForm.videoUrls} onChange={set('videoUrls')} />
                                                                </div>
                                                            </EditSection>

                                                            {(l.type === 'AUCTION' || editForm.listingType === 'AUCTION') && (
                                                                <EditSection title="Auction Schedule">
                                                                    {!l.auction && (
                                                                        <p className="col-span-2 sm:col-span-3 text-xs text-[var(--text-muted)] -mt-1 mb-1">
                                                                            No auction has been scheduled for this listing yet.
                                                                        </p>
                                                                    )}
                                                                    <EditField label="Reserve Price (£)" value={editForm.reservePrice} onChange={set('reservePrice')} type="number" />
                                                                    <EditField label="Starting Bid (£)" value={editForm.startingBid} onChange={set('startingBid')} type="number" />
                                                                    <EditField label="Min Increment (£)" value={editForm.minIncrement} onChange={set('minIncrement')} type="number" />
                                                                    <EditField label="Buy It Now (£)" value={editForm.buyItNowPrice} onChange={set('buyItNowPrice')} type="number" />
                                                                    <EditField label="Start Time" value={editForm.startTime} onChange={set('startTime')} type="datetime-local" />
                                                                </EditSection>
                                                            )}

                                                            <div className="pt-3 first:pt-0">
                                                                <p className="text-xs font-black uppercase tracking-widest text-primary mb-2 border-b border-[var(--border-default)] pb-1.5">Photos</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {editImages.map((img, i) => (
                                                                        <div key={i} className="relative group">
                                                                            <Image src={img} alt="" width={80} height={60} className="w-20 h-[60px] rounded-lg object-cover border border-[var(--border-default)]" />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveImage(i)}
                                                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <X size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <label className="w-20 h-[60px] rounded-lg border border-dashed border-[var(--border-default)] flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors shrink-0">
                                                                        {imageUploading ? <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /> : <span className="text-2xl text-[var(--text-muted)]">+</span>}
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            disabled={imageUploading}
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0]
                                                                                if (file) handleAddImage(l.id, file)
                                                                                e.target.value = ''
                                                                            }}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>

                                                            <div className="pt-3">
                                                                <EditField label="Description" value={editForm.description} onChange={set('description')} type="textarea" />
                                                            </div>

                                                            <div className="flex gap-3 mt-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveEdit(l.id)}
                                                                    disabled={savingEdit}
                                                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                                                >
                                                                    {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                    Save Changes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEdit}
                                                                    disabled={savingEdit}
                                                                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-muted)] font-bold text-xs uppercase tracking-widest hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                                                >
                                                                    <X size={14} />
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm py-2">
                                                                {([
                                                                    ['Make', l.make], ['Model', l.model], ['Year', l.year],
                                                                    ['Mileage', l.mileage ? `${Number(l.mileage).toLocaleString()} mi` : null],
                                                                    ['VRM', l.vrm], ['VIN', l.vin],
                                                                    ['Fuel', l.fuelType], ['Transmission', l.transmission],
                                                                    ['Body Type', l.bodyType], ['Condition', l.condition],
                                                                    ['Colour', l.color], ['Doors', l.doors], ['Seats', l.seats],
                                                                    ['Location', l.location], ['Badge Tier', l.badgeTier],
                                                                    ['Type', l.type], ['Owners', l.owners],
                                                                    ['MOT', l.motStatus], ['Tax', l.taxStatus],
                                                                    ...(l.type === 'AUCTION' && l.auction ? ([
                                                                        ['Auction Status', l.auction.status],
                                                                        ['Reserve Price', formatPrice(l.auction.reservePrice)],
                                                                        ['Starting Bid', formatPrice(l.auction.startingBid)],
                                                                        ['Min Increment', formatPrice(l.auction.minIncrement)],
                                                                        ['Buy It Now', l.auction.buyItNowPrice ? formatPrice(l.auction.buyItNowPrice) : null],
                                                                        ['Start Time', new Date(l.auction.startTime).toLocaleString('en-GB')],
                                                                    ] as [string, unknown][]) : []),
                                                                ] as [string, unknown][]).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                                                                    <div key={label}>
                                                                        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</p>
                                                                        <p className="font-medium">{String(value)}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {l.type === 'AUCTION' && !l.auction && (
                                                                <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-2">
                                                                    Marked as an auction listing but no auction schedule has been created yet.
                                                                </div>
                                                            )}

                                                            {l.description && (
                                                                <div className="py-3">
                                                                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1">Description</p>
                                                                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{l.description}</p>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-4 py-2">
                                                                <Link href={`/buy-cars/${l.slug}`} target="_blank" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                                                                    <Eye size={12} /> Preview listing
                                                                </Link>
                                                            </div>

                                                            <div className="mt-3">
                                                                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
                                                                    Rejection reason (required to reject)
                                                                </label>
                                                                <textarea
                                                                    value={rejectReasons[l.id] || ''}
                                                                    onChange={(e) => setRejectReasons(prev => ({ ...prev, [l.id]: e.target.value }))}
                                                                    placeholder="Explain what needs fixing before this can be approved..."
                                                                    rows={2}
                                                                    className="w-full mt-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"
                                                                />
                                                            </div>

                                                            <div className="flex gap-3 mt-4">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApprove(l.id)}
                                                                    disabled={actionLoading === l.id}
                                                                    className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                                                >
                                                                    {actionLoading === l.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                                    Approve — Go Live
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEdit(l)}
                                                                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-xs uppercase tracking-widest hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                                                >
                                                                    <Pencil size={14} />
                                                                    Edit Details
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReject(l.id)}
                                                                    disabled={actionLoading === l.id}
                                                                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-xs uppercase tracking-widest hover:bg-red-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                                                >
                                                                    {actionLoading === l.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">

                        {/* ── Mobile cards (< sm) ── */}
                        <div className="sm:hidden divide-y divide-[var(--border-default)]">
                            {listings.map((l) => {
                                const isSelf = false
                                return (
                                    <div key={l.id} className={`flex items-center gap-3 p-4 ${l.deletedAt ? 'bg-red-500/5' : ''}`}>
                                        {l.images?.[0] ? (
                                            <Image src={l.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                                <Car className="text-[var(--text-muted)]" size={18} />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-bold text-sm truncate">{l.title}</p>
                                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold shrink-0 border ${l.deletedAt ? 'bg-red-500/10 text-red-400 border-red-500/20' : l.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : l.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : l.status === 'PENDING_REVIEW' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : l.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-500/10 text-[var(--text-muted)] border-gray-500/20'}`}>
                                                    {l.deletedAt ? 'DELETED' : l.status === 'PENDING_REVIEW' ? 'UNDER REVIEW' : l.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-xs text-[var(--text-muted)] truncate hover:text-primary transition-colors cursor-pointer" onClick={() => l.seller?.id && setSelectedUserId(l.seller.id)}>{l.seller?.firstName} {l.seller?.lastName} · {l.vrm || 'No VRM'}</p>
                                                <p className="text-sm font-bold ml-2 shrink-0">{formatPrice(l.price)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 shrink-0 ml-1">
                                            <Link href={`/buy-cars/${l.slug}`} target="_blank" className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"><Eye size={16} /></Link>
                                            <button onClick={() => handleDelete(l.id)} disabled={deleting === l.id || !!l.deletedAt} className="p-2.5 bg-red-500/10 rounded-lg text-red-400 disabled:opacity-30 hover:bg-red-500/20 transition-colors">
                                                {deleting === l.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Desktop table (≥ sm) ── */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                                    <tr>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4">Seller</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]/80">
                                    {listings.map((l) => (
                                        <tr key={l.id} className={`transition-colors ${l.deletedAt ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[var(--bg-card)]'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {l.images?.[0] ? (
                                                        <Image src={l.images[0]} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                                                            <Car className="text-[var(--text-muted)]" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold max-w-[200px] truncate">{l.title}</p>
                                                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                                                            {l.vrm || 'No VRM'} 
                                                            {l.deletedAt && <AlertTriangle size={12} className="text-red-400 ml-1" />}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                                    l.deletedAt ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    l.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                    l.status === 'SOLD' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                    l.status === 'PENDING_REVIEW' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                    l.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    'bg-gray-500/10 text-[var(--text-muted)] border border-gray-500/20'
                                                }`}>
                                                    {l.deletedAt ? 'DELETED' : l.status === 'PENDING_REVIEW' ? 'UNDER REVIEW' : l.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-sm">
                                                {formatPrice(l.price)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm cursor-pointer group" onClick={() => l.seller?.id && setSelectedUserId(l.seller.id)}>
                                                    <p className="truncate max-w-[150px] group-hover:text-primary transition-colors">{l.seller?.firstName} {l.seller?.lastName}</p>
                                                    <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">{l.seller?.email}</p>
                                                    {l.seller?.phone && <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">{l.seller.phone}</p>}
                                                    {l.seller?.dealerProfile?.companyName && (
                                                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            {l.seller.dealerProfile.companyName}{l.seller.dealerProfile.isVerified ? ' ✓' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link href={`/buy-cars/${l.slug}`} target="_blank" className="p-2.5 hover:bg-white/10 rounded-lg transition-colors text-blue-400 hover:text-primary dark:hover:" title="View Listing">
                                                        <Eye size={18} />
                                                    </Link>
                                                    <button 
                                                        onClick={() => handleDelete(l.id)} 
                                                        disabled={deleting === l.id || !!l.deletedAt}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="Force Delete"
                                                    >
                                                        {deleting === l.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}

                        {/* Pagination footer */}
                        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
                            <span>Showing {(page - 1) * limit + 1 + (listings.length === 0 ? -1 : 0)} to {Math.min(page * limit, total)} of {total}</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >Prev</button>
                                <button 
                                    className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= total}
                                >Next</button>
                            </div>
                        </div>
                    </div>

                </main>
            </div>
            <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
        </div>
    )
}
