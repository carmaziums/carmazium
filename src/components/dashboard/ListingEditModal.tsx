"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { X, Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react"
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

const editInputClass = "w-full mt-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"

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
    const [editImages, setEditImages] = React.useState<string[]>([])
    const [imageUploading, setImageUploading] = React.useState(false)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [savedMsg, setSavedMsg] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (!listingId) return
        setLoading(true)
        setLoadError(null)
        setSavedMsg(null)
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
                setEditImages(Array.isArray(l.images) ? [...l.images] : [])
            })
            .catch(err => setLoadError(errorMessage(err, 'Failed to load listing')))
            .finally(() => setLoading(false))
    }, [listingId])

    if (!listingId) return null

    const set = (key: string) => (v: string) => setEditForm(prev => ({ ...prev, [key]: v }))

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
            setSavedMsg('Listing updated.')
            onSaved?.(updated)
        } catch (err) {
            setError(errorMessage(err, 'Failed to save changes'))
        } finally {
            setSaving(false)
        }
    }

    if (typeof document === "undefined") return null

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-2xl h-full bg-[var(--bg-card)] border-l border-[var(--border-default)] shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 flex items-center justify-between p-5 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Edit Listing</h3>
                        {listing && <p className="text-xs text-[var(--text-muted)] mt-0.5">{listing.title} · {listing.status}</p>}
                    </div>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {loading && !listing && (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
                    )}
                    {loadError && (
                        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <AlertCircle size={16} className="shrink-0" /> {loadError}
                        </div>
                    )}

                    {listing && (
                        <div className="space-y-1">
                            {error && (
                                <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    <AlertCircle size={16} className="shrink-0" /> {error}
                                </div>
                            )}
                            {savedMsg && (
                                <div className="flex items-center gap-2 p-3 mb-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                                    <CheckCircle2 size={16} className="shrink-0" /> {savedMsg}
                                </div>
                            )}

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

                            {(listing.type === 'AUCTION' || editForm.listingType === 'AUCTION') && (
                                <EditSection title="Auction Schedule">
                                    {(!listing.auction || listing.auction.status !== 'SCHEDULED') && (
                                        <p className="col-span-2 sm:col-span-3 text-xs text-[var(--text-muted)] -mt-1 mb-1">
                                            {listing.auction
                                                ? `Auction is ${listing.auction.status} — schedule/pricing can only be edited while SCHEDULED.`
                                                : 'No auction has been scheduled for this listing yet.'}
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
                                                if (file) handleAddImage(file)
                                                e.target.value = ''
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="pt-3">
                                <EditField label="Description" value={editForm.description} onChange={set('description')} type="textarea" />
                            </div>
                        </div>
                    )}
                </div>

                {listing && (
                    <div className="shrink-0 p-5 border-t border-[var(--border-default)] bg-[var(--bg-card)]">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-neon"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
