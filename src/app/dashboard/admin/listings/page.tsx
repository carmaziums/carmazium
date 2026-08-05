"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Car, Loader2, ArrowLeft, Trash2, AlertTriangle, Eye, ChevronDown, Check, X, Clock, Pencil, Save } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminListings, deleteListingForce, getPendingListingReviews, approveListing, rejectListing, updateListingAsAdmin } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUGIN_HYBRID', 'LPG', 'HYDROGEN_CELL', 'BI_FUEL', 'NATURAL_GAS', 'PETROL_HYBRID', 'DIESEL_HYBRID', 'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID', 'UNLISTED']
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC', 'CVT']
const BODY_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE', 'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK', 'STATION_WAGON', 'MPV', 'VAN']
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CAT_S', 'CAT_N', 'CAT_C', 'CAT_D']
const EDIT_NUMERIC_FIELDS = ['price', 'year', 'mileage', 'doors', 'seats']

const editInputClass = "w-full mt-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"

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
    const [savingEdit, setSavingEdit] = React.useState(false)

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
        setEditForm({
            title: l.title || '',
            price: l.price != null ? String(l.price) : '',
            description: l.description || '',
            make: l.make || '',
            model: l.model || '',
            year: l.year != null ? String(l.year) : '',
            mileage: l.mileage != null ? String(l.mileage) : '',
            vrm: l.vrm || '',
            vin: l.vin || '',
            fuelType: l.fuelType || '',
            transmission: l.transmission || '',
            bodyType: l.bodyType || '',
            condition: l.condition || '',
            color: l.color || '',
            doors: l.doors != null ? String(l.doors) : '',
            seats: l.seats != null ? String(l.seats) : '',
            location: l.location || '',
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
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
                fields[key] = EDIT_NUMERIC_FIELDS.includes(key) ? Number(value) : value
            }
            const result = await updateListingAsAdmin(id, fields)
            const updated = result?.data ?? result
            setPendingListings(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
            setEditingId(null)
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
                                                        <div className="space-y-3 py-2">
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Title</label>
                                                                <input type="text" value={editForm.title} onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))} className={editInputClass} />
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Price (£)</label>
                                                                    <input type="number" value={editForm.price} onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Make</label>
                                                                    <input type="text" value={editForm.make} onChange={(e) => setEditForm(prev => ({ ...prev, make: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Model</label>
                                                                    <input type="text" value={editForm.model} onChange={(e) => setEditForm(prev => ({ ...prev, model: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Year</label>
                                                                    <input type="number" value={editForm.year} onChange={(e) => setEditForm(prev => ({ ...prev, year: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Mileage</label>
                                                                    <input type="number" value={editForm.mileage} onChange={(e) => setEditForm(prev => ({ ...prev, mileage: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">VRM</label>
                                                                    <input type="text" value={editForm.vrm} onChange={(e) => setEditForm(prev => ({ ...prev, vrm: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">VIN</label>
                                                                    <input type="text" value={editForm.vin} onChange={(e) => setEditForm(prev => ({ ...prev, vin: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Fuel</label>
                                                                    <select value={editForm.fuelType} onChange={(e) => setEditForm(prev => ({ ...prev, fuelType: e.target.value }))} className={editInputClass}>
                                                                        <option value="">—</option>
                                                                        {FUEL_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Transmission</label>
                                                                    <select value={editForm.transmission} onChange={(e) => setEditForm(prev => ({ ...prev, transmission: e.target.value }))} className={editInputClass}>
                                                                        <option value="">—</option>
                                                                        {TRANSMISSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Body Type</label>
                                                                    <select value={editForm.bodyType} onChange={(e) => setEditForm(prev => ({ ...prev, bodyType: e.target.value }))} className={editInputClass}>
                                                                        <option value="">—</option>
                                                                        {BODY_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Condition</label>
                                                                    <select value={editForm.condition} onChange={(e) => setEditForm(prev => ({ ...prev, condition: e.target.value }))} className={editInputClass}>
                                                                        <option value="">—</option>
                                                                        {CONDITIONS.map(v => <option key={v} value={v}>{v}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Colour</label>
                                                                    <input type="text" value={editForm.color} onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Doors</label>
                                                                    <input type="number" value={editForm.doors} onChange={(e) => setEditForm(prev => ({ ...prev, doors: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Seats</label>
                                                                    <input type="number" value={editForm.seats} onChange={(e) => setEditForm(prev => ({ ...prev, seats: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Location</label>
                                                                    <input type="text" value={editForm.location} onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))} className={editInputClass} />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Description</label>
                                                                <textarea value={editForm.description} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} rows={4} className={editInputClass} />
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
                                                                ] as [string, unknown][]).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                                                                    <div key={label}>
                                                                        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</p>
                                                                        <p className="font-medium">{String(value)}</p>
                                                                    </div>
                                                                ))}
                                                            </div>

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
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEdit(l)}
                                                                    className="text-xs text-[var(--text-muted)] hover:text-primary transition-colors inline-flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Pencil size={12} /> Edit details
                                                                </button>
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
                                                <p className="text-xs text-[var(--text-muted)] truncate">{l.seller?.firstName} {l.seller?.lastName} · {l.vrm || 'No VRM'}</p>
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
                                                <div className="text-sm">
                                                    <p className="truncate max-w-[150px]">{l.seller?.firstName} {l.seller?.lastName}</p>
                                                    <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">{l.seller?.email}</p>
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
        </div>
    )
}
