"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import {
    X, Loader2, Save, AlertCircle, CheckCircle2, Circle, CircleDot,
    Tag, Fingerprint, Wrench, History as HistoryIcon, ShieldCheck,
    MapPinned, Truck, Layers, Gavel, ImageIcon, AlignLeft,
} from "lucide-react"
import { getAdminListing, updateListingAsAdmin } from "@/lib/adminApi"
import { uploadImage } from "@/lib/supabase"

const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUGIN_HYBRID', 'LPG', 'HYDROGEN_CELL', 'BI_FUEL', 'NATURAL_GAS', 'PETROL_HYBRID', 'DIESEL_HYBRID', 'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID', 'UNLISTED']
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC', 'CVT']
const BODY_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE', 'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK', 'STATION_WAGON', 'MPV', 'VAN']
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CAT_S', 'CAT_N', 'CAT_C', 'CAT_D']
const WRITE_OFF_CATEGORIES = ['NONE', 'CAT_S', 'CAT_N', 'CAT_A', 'CAT_B']
const VEHICLE_TYPES = ['CAR', 'HGV', 'MOTORCYCLE']
const EURO_STANDARDS = ['EURO_4', 'EURO_5', 'EURO_6', 'EURO_6D']
const LISTING_TYPES = ['CLASSIFIED', 'AUCTION']
const BADGE_TIERS = ['FREE', 'BASIC', 'STANDARD', 'PREMIUM']

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

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    PENDING_REVIEW: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/25",
    DRAFT: "bg-gray-500/10 text-[var(--text-muted)] border-gray-500/25",
    SOLD: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    OFFER_ACCEPTED: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    WITHDRAWN: "bg-gray-500/10 text-[var(--text-muted)] border-gray-500/25",
}

// Each entry's `fields` is what's compared against the loaded snapshot to
// decide whether that section carries unsaved edits — the tab rail's dot.
const SECTIONS = [
    { key: 'core', label: 'Core', icon: Tag, fields: ['title', 'price', 'priceMin', 'priceMax'] },
    { key: 'identity', label: 'Vehicle Identity', icon: Fingerprint, fields: ['make', 'model', 'variant', 'year', 'mileage', 'vrm', 'vin'] },
    {
        key: 'mechanical', label: 'Mechanical & Body', icon: Wrench, fields: [
            'fuelType', 'transmission', 'bodyType', 'condition', 'color', 'doors', 'seats', 'driveType',
            'engineSize', 'bhp', 'torqueNm', 'topSpeedMph', 'zeroTo60Mph', 'combinedMpg', 'extraUrbanMpg',
            'ulezCompliant', 'euroStandard', 'co2Emissions',
        ],
    },
    {
        key: 'history', label: 'History & Ownership', icon: HistoryIcon, fields: [
            'numberOfKeys', 'serviceHistory', 'owners', 'stolenRecovered', 'hasOutstandingFinance',
            'isLegalRegisteredKeeper', 'writeOffCategory', 'isDepartedSale', 'departedRelationship', 'notOwnerRelationship',
        ],
    },
    {
        key: 'dvla', label: 'DVLA-Derived', icon: ShieldCheck, fields: [
            'motStatus', 'taxStatus', 'motExpiryDate', 'taxDueDate', 'markedForExport',
            'monthOfFirstRegistration', 'wheelplan', 'typeApproval',
        ],
    },
    { key: 'meta', label: 'Listing Meta', icon: MapPinned, fields: ['location', 'vehicleType', 'isImported', 'bannerLabel', 'features'] },
    { key: 'delivery', label: 'Delivery', icon: Truck, fields: ['deliveryAvailable', 'deliveryPricePerMile', 'deliveryMaxMiles'] },
    { key: 'typeBadge', label: 'Type & Badge', icon: Layers, fields: ['listingType', 'badgeTier', 'videoUrls'] },
    { key: 'auction', label: 'Auction Schedule', icon: Gavel, fields: ['reservePrice', 'startingBid', 'minIncrement', 'buyItNowPrice', 'startTime'], auctionOnly: true },
    { key: 'photos', label: 'Photos', icon: ImageIcon, fields: [] },
    { key: 'description', label: 'Description', icon: AlignLeft, fields: ['description'] },
] as const

const fieldInputClass = "w-full mt-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"

function Field({ label, value, onChange, type = 'text', options, mono, span }: {
    label: string
    value: string
    onChange: (v: string) => void
    type?: 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'datetime-local'
    options?: readonly string[]
    mono?: boolean
    span?: boolean
}) {
    return (
        <div className={span ? "col-span-2 md:col-span-3" : undefined}>
            <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</label>
            {type === 'select' ? (
                <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
                    <option value="">—</option>
                    {options?.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
            ) : type === 'boolean' ? (
                <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass}>
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            ) : type === 'textarea' ? (
                <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={8} className={`${fieldInputClass} resize-y`} />
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${fieldInputClass} ${mono ? 'font-mono tracking-wider' : ''}`}
                />
            )}
        </div>
    )
}

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback
}

interface ListingEditModalProps {
    listingId: string | null
    onClose: () => void
    onSaved?: (updated: any) => void
}

export function ListingEditModal({ listingId, onClose, onSaved }: ListingEditModalProps) {
    const [listing, setListing] = React.useState<any | null>(null)
    const [loading, setLoading] = React.useState(false)
    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [editForm, setEditForm] = React.useState<Record<string, string>>({})
    const [originalForm, setOriginalForm] = React.useState<Record<string, string>>({})
    const [editImages, setEditImages] = React.useState<string[]>([])
    const [originalImages, setOriginalImages] = React.useState<string[]>([])
    const [activeSection, setActiveSection] = React.useState<string>('core')
    const [imageUploading, setImageUploading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!listingId) return
        setLoading(true)
        setLoadError(null)
        setSavedMsg(null)
        setActiveSection('core')
        getAdminListing(listingId)
            .then((l) => {
                setListing(l)
                const str = (v: unknown) => v != null ? String(v) : ''
                const bool = (v: unknown) => v === true ? 'true' : v === false ? 'false' : ''
                const localDatetime = (v: unknown) => {
                    if (!v) return ''
                    const d = new Date(v as string)
                    if (isNaN(d.getTime())) return ''
                    const pad = (n: number) => String(n).padStart(2, '0')
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                }
                const form = {
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
                }
                setEditForm(form)
                setOriginalForm(form)
                const images = Array.isArray(l.images) ? [...l.images] : []
                setEditImages(images)
                setOriginalImages(images)
            })
            .catch(err => setLoadError(errorMessage(err, 'Failed to load listing')))
            .finally(() => setLoading(false))
    }, [listingId])

    const set = (key: string) => (v: string) => setEditForm(prev => ({ ...prev, [key]: v }))

    const imagesChanged = editImages.length !== originalImages.length || editImages.some((img, i) => img !== originalImages[i])
    const changedFieldKeys = Object.keys(editForm).filter(k => editForm[k] !== originalForm[k])
    const totalChanges = changedFieldKeys.length + (imagesChanged ? 1 : 0)
    const sectionHasChanges = (fields: readonly string[]) => fields.some(f => changedFieldKeys.includes(f))

    const visibleSections = SECTIONS.filter(s => !('auctionOnly' in s) || listing?.type === 'AUCTION' || editForm.listingType === 'AUCTION')

    const handleAddImage = async (file: File) => {
        setImageUploading(true)
        setError(null)
        try {
            const url = await uploadImage(file, 'listings', 'admin-edit')
            setEditImages(prev => [...prev, url])
        } catch (err) {
            setError(errorMessage(err, 'Image upload failed'))
        } finally {
            setImageUploading(false)
        }
    }

    const handleRemoveImage = (index: number) => {
        setEditImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        if (!listingId) return
        setError(null)
        setSavedMsg(null)
        try {
            setSaving(true)
            const fields: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(editForm)) {
                if (value === '') continue
                if (key === 'startTime') {
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
            const result = await updateListingAsAdmin(listingId, fields)
            const updated = result?.data ?? result
            setListing((prev: any) => ({ ...prev, ...updated }))
            setOriginalForm(editForm)
            setOriginalImages(editImages)
            setSavedMsg('Saved.')
            onSaved?.(updated)
        } catch (err) {
            setError(errorMessage(err, 'Failed to save changes'))
        } finally {
            setSaving(false)
        }
    }

    if (!listingId) return null
    if (typeof document === "undefined") return null

    const active = SECTIONS.find(s => s.key === activeSection) ?? SECTIONS[0]

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-8 bg-black/70 backdrop-blur-md" onClick={onClose}>
            <div
                className="w-full max-w-6xl h-full max-h-[94vh] md:max-h-[90vh] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="shrink-0 flex items-center gap-4 p-4 md:p-5 border-b border-[var(--border-default)]">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-input)] border border-[var(--border-default)] shrink-0 flex items-center justify-center">
                        {listing?.images?.[0] ? (
                            <Image src={listing.images[0]} alt="" width={48} height={48} className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon size={18} className="text-[var(--text-muted)]" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black tracking-tight truncate">{listing?.title || 'Edit Listing'}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            {listing?.status && (
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${STATUS_STYLES[listing.status] || STATUS_STYLES.DRAFT}`}>
                                    {listing.status.replace('_', ' ')}
                                </span>
                            )}
                            {listing?.vrm && <span className="text-xs font-mono text-[var(--text-muted)] tracking-wider">{listing.vrm}</span>}
                        </div>
                    </div>
                    {totalChanges > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1 shrink-0">
                            <CircleDot size={12} /> {totalChanges} unsaved {totalChanges === 1 ? 'change' : 'changes'}
                        </span>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg p-1.5 hover:bg-[var(--bg-input)] focus-visible:ring-2 focus-visible:ring-primary/40 outline-none transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {loading && !listing && (
                    <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-primary" size={28} /></div>
                )}
                {loadError && (
                    <div className="p-5">
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <AlertCircle size={16} className="shrink-0" /> {loadError}
                        </div>
                    </div>
                )}

                {listing && (
                    <>
                        {/* Mobile section tabs */}
                        <div className="md:hidden shrink-0 flex gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-[var(--border-default)] scrollbar-hide">
                            {visibleSections.map((s) => {
                                const hasChanges = sectionHasChanges(s.fields) || (s.key === 'photos' && imagesChanged)
                                const isActive = s.key === activeSection
                                return (
                                    <button
                                        key={s.key}
                                        type="button"
                                        onClick={() => setActiveSection(s.key)}
                                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white' : 'bg-[var(--bg-input)] text-[var(--text-muted)]'}`}
                                    >
                                        {s.label}
                                        {hasChanges && <CircleDot size={10} className={isActive ? 'text-white' : 'text-primary'} />}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Section rail — desktop */}
                            <nav className="hidden md:block w-60 shrink-0 border-r border-[var(--border-default)] overflow-y-auto p-3">
                                {visibleSections.map((s) => {
                                    const Icon = s.icon
                                    const hasChanges = sectionHasChanges(s.fields) || (s.key === 'photos' && imagesChanged)
                                    const isActive = s.key === activeSection
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setActiveSection(s.key)}
                                            className={`w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2.5 rounded-lg text-sm font-semibold text-left mb-0.5 border-l-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 outline-none cursor-pointer ${
                                                isActive
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-input)]'
                                            }`}
                                        >
                                            <Icon size={15} className="shrink-0" />
                                            <span className="flex-1 truncate">{s.label}</span>
                                            {hasChanges ? (
                                                <CircleDot size={10} className="text-primary shrink-0" />
                                            ) : (
                                                <Circle size={10} className="text-[var(--text-faint)] shrink-0" />
                                            )}
                                        </button>
                                    )
                                })}
                            </nav>

                            {/* Active section content */}
                            <div className="flex-1 overflow-y-auto p-5 md:p-6">
                                {error && (
                                    <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                        <AlertCircle size={16} className="shrink-0" /> {error}
                                    </div>
                                )}
                                {savedMsg && (
                                    <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                                        <CheckCircle2 size={16} className="shrink-0" /> {savedMsg}
                                    </div>
                                )}

                                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center gap-2">
                                    <active.icon size={14} className="text-primary" /> {active.label}
                                </h4>

                                {active.key === 'core' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Title" value={editForm.title} onChange={set('title')} span />
                                        <Field label="Price (£)" value={editForm.price} onChange={set('price')} type="number" />
                                        <Field label="Min Offer Price (£)" value={editForm.priceMin} onChange={set('priceMin')} type="number" />
                                        <Field label="Max Offer Price (£)" value={editForm.priceMax} onChange={set('priceMax')} type="number" />
                                    </div>
                                )}

                                {active.key === 'identity' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Make" value={editForm.make} onChange={set('make')} />
                                        <Field label="Model" value={editForm.model} onChange={set('model')} />
                                        <Field label="Variant / Trim" value={editForm.variant} onChange={set('variant')} />
                                        <Field label="Year" value={editForm.year} onChange={set('year')} type="number" />
                                        <Field label="Mileage" value={editForm.mileage} onChange={set('mileage')} type="number" />
                                        <Field label="VRM" value={editForm.vrm} onChange={set('vrm')} mono />
                                        <Field label="VIN" value={editForm.vin} onChange={set('vin')} mono />
                                    </div>
                                )}

                                {active.key === 'mechanical' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Fuel" value={editForm.fuelType} onChange={set('fuelType')} type="select" options={FUEL_TYPES} />
                                        <Field label="Transmission" value={editForm.transmission} onChange={set('transmission')} type="select" options={TRANSMISSIONS} />
                                        <Field label="Body Type" value={editForm.bodyType} onChange={set('bodyType')} type="select" options={BODY_TYPES} />
                                        <Field label="Condition" value={editForm.condition} onChange={set('condition')} type="select" options={CONDITIONS} />
                                        <Field label="Colour" value={editForm.color} onChange={set('color')} />
                                        <Field label="Doors" value={editForm.doors} onChange={set('doors')} type="number" />
                                        <Field label="Seats" value={editForm.seats} onChange={set('seats')} type="number" />
                                        <Field label="Drive Type" value={editForm.driveType} onChange={set('driveType')} />
                                        <Field label="Engine Size (cc)" value={editForm.engineSize} onChange={set('engineSize')} type="number" />
                                        <Field label="Power (BHP)" value={editForm.bhp} onChange={set('bhp')} type="number" />
                                        <Field label="Torque (Nm)" value={editForm.torqueNm} onChange={set('torqueNm')} type="number" />
                                        <Field label="Top Speed (mph)" value={editForm.topSpeedMph} onChange={set('topSpeedMph')} type="number" />
                                        <Field label="0-60mph (sec)" value={editForm.zeroTo60Mph} onChange={set('zeroTo60Mph')} type="number" />
                                        <Field label="Combined MPG" value={editForm.combinedMpg} onChange={set('combinedMpg')} type="number" />
                                        <Field label="Extra Urban MPG" value={editForm.extraUrbanMpg} onChange={set('extraUrbanMpg')} type="number" />
                                        <Field label="ULEZ Compliant" value={editForm.ulezCompliant} onChange={set('ulezCompliant')} type="boolean" />
                                        <Field label="Euro Standard" value={editForm.euroStandard} onChange={set('euroStandard')} type="select" options={EURO_STANDARDS} />
                                        <Field label="CO2 (g/km)" value={editForm.co2Emissions} onChange={set('co2Emissions')} type="number" />
                                    </div>
                                )}

                                {active.key === 'history' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Number of Keys" value={editForm.numberOfKeys} onChange={set('numberOfKeys')} type="number" />
                                        <Field label="Service History" value={editForm.serviceHistory} onChange={set('serviceHistory')} />
                                        <Field label="Previous Owners" value={editForm.owners} onChange={set('owners')} />
                                        <Field label="Stolen/Recovered" value={editForm.stolenRecovered} onChange={set('stolenRecovered')} type="boolean" />
                                        <Field label="Outstanding Finance" value={editForm.hasOutstandingFinance} onChange={set('hasOutstandingFinance')} type="boolean" />
                                        <Field label="Seller is Legal Keeper" value={editForm.isLegalRegisteredKeeper} onChange={set('isLegalRegisteredKeeper')} type="boolean" />
                                        <Field label="Write-Off Category" value={editForm.writeOffCategory} onChange={set('writeOffCategory')} type="select" options={WRITE_OFF_CATEGORIES} />
                                        <Field label="Departed/Estate Sale" value={editForm.isDepartedSale} onChange={set('isDepartedSale')} type="boolean" />
                                        <Field label="Departed Relationship" value={editForm.departedRelationship} onChange={set('departedRelationship')} />
                                        <Field label="Not-Owner Relationship" value={editForm.notOwnerRelationship} onChange={set('notOwnerRelationship')} />
                                    </div>
                                )}

                                {active.key === 'dvla' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="MOT Status" value={editForm.motStatus} onChange={set('motStatus')} />
                                        <Field label="Tax Status" value={editForm.taxStatus} onChange={set('taxStatus')} />
                                        <Field label="MOT Expiry" value={editForm.motExpiryDate} onChange={set('motExpiryDate')} />
                                        <Field label="Tax Due Date" value={editForm.taxDueDate} onChange={set('taxDueDate')} />
                                        <Field label="Marked for Export" value={editForm.markedForExport} onChange={set('markedForExport')} type="boolean" />
                                        <Field label="First Registered" value={editForm.monthOfFirstRegistration} onChange={set('monthOfFirstRegistration')} />
                                        <Field label="Wheelplan" value={editForm.wheelplan} onChange={set('wheelplan')} />
                                        <Field label="Type Approval" value={editForm.typeApproval} onChange={set('typeApproval')} />
                                    </div>
                                )}

                                {active.key === 'meta' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Location" value={editForm.location} onChange={set('location')} />
                                        <Field label="Vehicle Type" value={editForm.vehicleType} onChange={set('vehicleType')} type="select" options={VEHICLE_TYPES} />
                                        <Field label="Imported" value={editForm.isImported} onChange={set('isImported')} type="boolean" />
                                        <Field label="Banner Label" value={editForm.bannerLabel} onChange={set('bannerLabel')} />
                                        <Field label="Features (comma-separated)" value={editForm.features} onChange={set('features')} span />
                                    </div>
                                )}

                                {active.key === 'delivery' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Delivery Available" value={editForm.deliveryAvailable} onChange={set('deliveryAvailable')} type="boolean" />
                                        <Field label="Price per Mile (£)" value={editForm.deliveryPricePerMile} onChange={set('deliveryPricePerMile')} type="number" />
                                        <Field label="Max Miles" value={editForm.deliveryMaxMiles} onChange={set('deliveryMaxMiles')} type="number" />
                                    </div>
                                )}

                                {active.key === 'typeBadge' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Field label="Listing Type" value={editForm.listingType} onChange={set('listingType')} type="select" options={LISTING_TYPES} />
                                        <Field label="Badge Tier" value={editForm.badgeTier} onChange={set('badgeTier')} type="select" options={BADGE_TIERS} />
                                        <Field label="Video URLs (comma-separated)" value={editForm.videoUrls} onChange={set('videoUrls')} span />
                                    </div>
                                )}

                                {active.key === 'auction' && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {(!listing.auction || listing.auction.status !== 'SCHEDULED') && (
                                            <p className="col-span-2 md:col-span-3 text-xs text-[var(--text-muted)] bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-3 py-2.5">
                                                {listing.auction
                                                    ? `Auction is ${listing.auction.status} — schedule/pricing can only be edited while SCHEDULED.`
                                                    : 'No auction has been scheduled for this listing yet.'}
                                            </p>
                                        )}
                                        <Field label="Reserve Price (£)" value={editForm.reservePrice} onChange={set('reservePrice')} type="number" />
                                        <Field label="Starting Bid (£)" value={editForm.startingBid} onChange={set('startingBid')} type="number" />
                                        <Field label="Min Increment (£)" value={editForm.minIncrement} onChange={set('minIncrement')} type="number" />
                                        <Field label="Buy It Now (£)" value={editForm.buyItNowPrice} onChange={set('buyItNowPrice')} type="number" />
                                        <Field label="Start Time" value={editForm.startTime} onChange={set('startTime')} type="datetime-local" />
                                    </div>
                                )}

                                {active.key === 'photos' && (
                                    <div className="flex flex-wrap gap-3">
                                        {editImages.map((img, i) => (
                                            <div key={i} className="relative group">
                                                <Image src={img} alt="" width={112} height={84} className="w-28 h-[84px] rounded-lg object-cover border border-[var(--border-default)]" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(i)}
                                                    aria-label="Remove photo"
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <label className="w-28 h-[84px] rounded-lg border border-dashed border-[var(--border-default)] flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors shrink-0">
                                            {imageUploading ? <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /> : <span className="text-2xl text-[var(--text-muted)]">+</span>}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={imageUploading}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleAddImage(file)
                                                    e.target.value = ''
                                                }}
                                            />
                                        </label>
                                    </div>
                                )}

                                {active.key === 'description' && (
                                    <Field label="Description" value={editForm.description} onChange={set('description')} type="textarea" />
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 flex items-center justify-between gap-4 p-4 md:p-5 border-t border-[var(--border-default)]">
                            <span className="text-xs text-[var(--text-muted)] sm:hidden">
                                {totalChanges > 0 ? `${totalChanges} unsaved` : 'No changes'}
                            </span>
                            <span className="hidden sm:block text-xs text-[var(--text-muted)]">
                                {totalChanges > 0 ? 'You have unsaved changes.' : 'No changes yet.'}
                            </span>
                            <button
                                onClick={handleSave}
                                disabled={saving || totalChanges === 0}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-neon"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Changes
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    )
}
