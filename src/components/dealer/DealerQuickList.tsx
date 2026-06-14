"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import {
    Search, Loader2, BadgeCheck, Upload, X,
    CheckCircle, ArrowRight, Sparkles, Info,
    LocateFixed, AlertTriangle, Zap, Gavel, List, Play
} from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/listing/ImageUpload"
import {
    createListing, type CreateListingRequest,
    type BodyTypeValue, type EuroStandardValue, type VehicleTypeValue,
} from "@/lib/listingApi"
import { apiClient } from "@/lib/apiClient"
import { dvlaLookup } from "@/lib/dvlaApi"
import { aiGenerateDescription } from "@/lib/aiApi"
import { useAuth } from "@/context/AuthContext"
import { DamageAnalysisTool } from "@/components/listing/DamageAnalysisTool"
import { useRouter, useSearchParams } from "next/navigation"

// ─── Component ────────────────────────────────────────────────────────────────

export function DealerQuickList() {
    const { user } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const editId = searchParams.get('editId')
    const editSlug = searchParams.get('editSlug')

    // ─── State ────────────────────────────────────────────────────────────────
    const [vrm, setVrm] = React.useState("")
    const [dvlaLoading, setDvlaLoading] = React.useState(false)
    const [dvlaError, setDvlaError] = React.useState<string | null>(null)
    const [dvlaData, setDvlaData] = React.useState<any>(null)

    const [model, setModel] = React.useState("")
    const [price, setPrice] = React.useState("")
    const [mileage, setMileage] = React.useState("")
    const [location, setLocation] = React.useState("")
    const [geoLoading, setGeoLoading] = React.useState(false)
    const [description, setDescription] = React.useState("")
    const [images, setImages] = React.useState<string[]>([])
    const [condition, setCondition] = React.useState("")
    const [transmission, setTransmission] = React.useState("")
    const [bodyType, setBodyType] = React.useState<BodyTypeValue | "">("")
    const [editLoading, setEditLoading] = React.useState(false)

    const [isGeneratingDesc, setIsGeneratingDesc] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [publishAs, setPublishAs] = React.useState<"ACTIVE" | "DRAFT">("ACTIVE")
    const [listingType, setListingType] = React.useState<"CLASSIFIED" | "AUCTION">("CLASSIFIED")
    const [videoUrls, setVideoUrls] = React.useState<string[]>([])
    const [videoUrlInput, setVideoUrlInput] = React.useState("")
    const [videoUrlError, setVideoUrlError] = React.useState("")

    // ─── Load existing listing when editing ───────────────────────────────────
    React.useEffect(() => {
        if (!editId) return
        setEditLoading(true)
        apiClient<{ data: any }>(`/listings/${editSlug || editId}`)
            .then(res => {
                const l = res.data
                setVrm(l.vrm || '')
                setModel(l.model || '')
                setPrice(l.price ? String(l.price) : '')
                setMileage(l.mileage ? String(l.mileage) : '')
                setLocation(l.location || '')
                setDescription(l.description || '')
                setImages(l.images || [])
                setVideoUrls(l.videoUrls || [])
                setCondition(l.condition || '')
                setTransmission(l.transmission || '')
                setBodyType((l.bodyType as BodyTypeValue) || '')
                setPublishAs(l.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT')
                // Reconstruct dvlaData from listing fields so sections appear
                setDvlaData({
                    make: l.make,
                    model: l.model,
                    year: l.year,
                    colour: l.color,
                    fuelType: l.fuelType,
                    engineSize: l.engineSize,
                    motStatus: l.motStatus,
                    taxStatus: l.taxStatus,
                    euroStandard: l.euroStandard,
                    co2Emissions: l.co2Emissions,
                    motExpiryDate: l.motExpiryDate,
                    taxDueDate: l.taxDueDate,
                    monthOfFirstRegistration: l.monthOfFirstRegistration,
                    wheelplan: l.wheelplan,
                    typeApproval: l.typeApproval,
                    markedForExport: l.markedForExport,
                })
            })
            .catch(err => setDvlaError('Failed to load listing: ' + err.message))
            .finally(() => setEditLoading(false))
    }, [editId])

    // ─── DVLA Lookup ──────────────────────────────────────────────────────────
    const handleLookup = async () => {
        if (!vrm.trim()) return
        setDvlaLoading(true)
        setDvlaError(null)
        setDvlaData(null)

        try {
            const r = await dvlaLookup(vrm.trim())
            setDvlaData(r)
            // Pre-fill model if DVLA/MOT returned one
            if (r.model) setModel(r.model)

            // Auto-fill mileage from latest MOT odometer if available
            if (r.motHistory?.length) {
                const latest = r.motHistory.find((m: any) => m.odometerValue)
                if (latest?.odometerValue) setMileage(latest.odometerValue)
            }
        } catch (err: any) {
            setDvlaError(err.message || "Vehicle not found")
        } finally {
            setDvlaLoading(false)
        }
    }

    // ─── AI Description ───────────────────────────────────────────────────────
    const handleGenerateDescription = async () => {
        if (!dvlaData) return
        setIsGeneratingDesc(true)
        try {
            const result = await aiGenerateDescription({
                make: dvlaData.make,
                model: model || dvlaData.model,
                year: dvlaData.year ? String(dvlaData.year) : undefined,
                fuelType: dvlaData.fuelType,
                color: dvlaData.colour || dvlaData.primaryColour || dvlaData.color,
                engineSize: dvlaData.engineSize ? String(dvlaData.engineSize) : undefined,
                mileage,
                condition,
            })
            setDescription(result.text)
        } catch (error) {
            console.error("AI Generation failed:", error)
            // Silently fail — dealer can write manually
        } finally {
            setIsGeneratingDesc(false)
        }
    }

    // ─── Geolocation ──────────────────────────────────────────────────────────
    const handleGeolocate = () => {
        if (!navigator.geolocation) return
        setGeoLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
                    )
                    const data = await res.json()
                    const city = data?.address?.city || data?.address?.town || data?.address?.village || ""
                    const postcode = data?.address?.postcode || ""
                    setLocation(`${city}${postcode ? `, ${postcode}` : ""}`)
                } catch { }
                setGeoLoading(false)
            },
            () => setGeoLoading(false),
            { timeout: 5000 }
        )
    }

    // ─── Submit ───────────────────────────────────────────────────────────────
    const canSubmit = !!(
        vrm && dvlaData && price && images.length > 0 &&
        // In edit mode all three publish-gate fields must be filled before saving
        (!editId || (transmission && bodyType && description.trim()))
    )

    const handleSubmit = async () => {
        if (!user || !dvlaData) return
        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const priceNum = parseFloat(price)
            const resolvedModel = model || dvlaData.model || ''

            // Infer ULEZ from DVLA data
            let ulez = false
            const ft = (dvlaData.fuelType || "").toUpperCase()
            const es = (dvlaData.euroStandard || "").toUpperCase()
            if (ft === "ELECTRIC" || ft === "PLUGIN_HYBRID" || es.includes("EURO_6") || (ft === "PETROL" && es === "EURO_4")) {
                ulez = true
            }

            const titleParts = [dvlaData.make, resolvedModel, dvlaData.year].filter(Boolean)
            const payload: CreateListingRequest = {
                title: titleParts.join(' ') || vrm,
                price: priceNum,
                priceMin: priceNum,
                priceMax: priceNum,
                mileage: parseInt(mileage) || 0,
                year: dvlaData.year || new Date().getFullYear(),
                vrm: vrm.toUpperCase(),
                images,
                listingType,
                status: publishAs,
                badgeTier: "FREE",
                vehicleType: "CAR" as VehicleTypeValue,
                make: dvlaData.make || undefined,
                model: resolvedModel || undefined,
                description: description || undefined,
                transmission: transmission as any || undefined,
                bodyType: bodyType as BodyTypeValue || undefined,
                fuelType: dvlaData.fuelType as any || undefined,
                color: dvlaData.colour || undefined,
                engineSize: dvlaData.engineSize || undefined,
                co2Emissions: dvlaData.co2Emissions || undefined,
                euroStandard: (dvlaData.euroStandard as EuroStandardValue) || undefined,
                motStatus: dvlaData.motStatus || undefined,
                taxStatus: dvlaData.taxStatus || undefined,
                motExpiryDate: dvlaData.motExpiryDate || undefined,
                taxDueDate: dvlaData.taxDueDate || undefined,
                monthOfFirstRegistration: dvlaData.monthOfFirstRegistration || undefined,
                wheelplan: dvlaData.wheelplan || undefined,
                typeApproval: dvlaData.typeApproval || undefined,
                markedForExport: dvlaData.markedForExport ?? undefined,
                ulezCompliant: ulez,
                location: location || undefined,
                condition: condition as any || undefined,
                isImported: false,
                videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
            }

            if (editId) {
                // PATCH existing listing
                await apiClient(`/listings/${editId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                })
            } else {
                await createListing(payload)
            }
            router.push("/dashboard/dealer/inventory")
        } catch (error: any) {
            setSubmitError(error.message || "Failed to save listing.")
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    if (editLoading) return (
        <div className="p-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
        </div>
    )

    return (
        <div className="p-6 md:p-10 space-y-8">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                        <Zap size={22} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black font-heading text-white tracking-tight">
                            {editId ? 'Edit Listing' : 'Quick List'}
                        </h1>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                            {editId ? 'Update vehicle details and save changes' : 'VRM → Auto-fill → Photos → Publish'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Edit-mode completion banner ──────────────────────────────── */}
            {editId && (
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-sm">
                    <Info size={16} className="shrink-0 mt-0.5 text-blue-400" />
                    <div>
                        <p className="font-bold text-blue-300 mb-0.5">Complete your listing to publish</p>
                        <p className="text-xs text-blue-200/70">
                            DVLA data and your import details are pre-filled. Select <strong>Body Type</strong> and <strong>Transmission</strong>, then add a <strong>Description</strong> — these three are required to go live.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Listing Type Selector ─────────────────────────────────────── */}
            {!editId && (
                <section className="space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Listing Type</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setListingType("CLASSIFIED")}
                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${listingType === "CLASSIFIED" ? "border-primary/60 bg-primary/10 text-white" : "border-white/10 bg-slate-900/40 text-gray-400 hover:border-white/20"}`}
                        >
                            <List size={18} className={listingType === "CLASSIFIED" ? "text-primary" : ""} />
                            <div>
                                <p className="font-bold text-sm">Retail Listing</p>
                                <p className="text-[11px] opacity-60 mt-0.5">Fixed price, buyer offers</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setListingType("AUCTION")}
                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${listingType === "AUCTION" ? "border-orange-500/60 bg-orange-500/10 text-white" : "border-white/10 bg-slate-900/40 text-gray-400 hover:border-white/20"}`}
                        >
                            <Gavel size={18} className={listingType === "AUCTION" ? "text-orange-400" : ""} />
                            <div>
                                <p className="font-bold text-sm">Auction</p>
                                <p className="text-[11px] opacity-60 mt-0.5">Live bidding, 5h duration</p>
                            </div>
                        </button>
                    </div>
                </section>
            )}

            {/* ── SECTION 1: VRM Lookup ────────────────────────────────────── */}
            <section className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black">1</span>
                    Vehicle Identification
                </h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                        placeholder="e.g. AB12 CDE"
                        value={vrm}
                        onChange={(e) => { setVrm(e.target.value.toUpperCase()); setDvlaData(null); setDvlaError(null) }}
                        className="bg-black border-primary/20 text-white uppercase font-mono tracking-widest text-lg h-14 focus:border-primary flex-1 max-w-xs placeholder:text-gray-600"
                    />
                    <Button
                        type="button"
                        disabled={!vrm || dvlaLoading}
                        onClick={handleLookup}
                        className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-14 uppercase tracking-widest gap-2 shadow-neon transition-transform active:scale-95"
                    >
                        {dvlaLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                        Lookup
                    </Button>
                </div>
                {dvlaError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> {dvlaError}</p>}

                {/* DVLA Result Card */}
                {dvlaData && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <BadgeCheck size={18} className="text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-400">DVLA Data Retrieved</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                            {[
                                { label: "Make", value: dvlaData.make },
                                { label: "Model", value: model || dvlaData.model },
                                { label: "Year", value: dvlaData.year },
                                { label: "Colour", value: dvlaData.colour || dvlaData.primaryColour },
                                { label: "Fuel", value: dvlaData.fuelType },
                                { label: "Engine", value: dvlaData.engineSize ? `${dvlaData.engineSize}cc` : null },
                                { label: "MOT", value: dvlaData.motStatus },
                                { label: "Tax", value: dvlaData.taxStatus },
                            ].filter(f => f.value).map(f => (
                                <div key={f.label}>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block">{f.label}</span>
                                    <span className="text-white font-semibold">{f.value}</span>
                                </div>
                            ))}
                        </div>
                        {/* Manual model input when DVLA didn't return one */}
                        {!dvlaData.model && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <label className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1.5 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Model not returned by DVLA — enter manually
                                </label>
                                <Input
                                    placeholder="e.g. Octavia, Golf, 3 Series"
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="bg-black border-amber-500/30 text-white h-10 focus:border-amber-400 max-w-xs placeholder:text-gray-600"
                                />
                            </div>
                        )}
                        {/* Allow editing model even when DVLA returned one */}
                        {dvlaData.model && (
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1.5">Model (editable)</label>
                                <Input
                                    value={model}
                                    onChange={e => setModel(e.target.value)}
                                    className="bg-black border-white/10 text-white h-10 focus:border-primary max-w-xs placeholder:text-gray-600"
                                />
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* ── SECTION 2: Essentials (only shown after VRM lookup) ──────── */}
            {dvlaData && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black">2</span>
                        Essentials
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Price */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400">Asking Price *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">£</span>
                                <Input
                                    type="number"
                                    placeholder="15,000"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    className="bg-slate-900/50 border-white/10 text-white pl-8 h-12 focus:border-primary text-lg font-bold placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {/* Mileage */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400">
                                Mileage
                                {mileage && <span className="text-emerald-400 ml-2 normal-case text-[10px]">● Auto-filled from MOT</span>}
                            </label>
                            <Input
                                type="number"
                                placeholder="45,000"
                                value={mileage}
                                onChange={(e) => setMileage(e.target.value)}
                                className="bg-slate-900/50 border-white/10 text-white h-12 focus:border-primary placeholder:text-gray-600"
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-gray-400">Dealership Location</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="London, SW1A 1AA"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="bg-slate-900/50 border-white/10 text-white h-12 focus:border-primary flex-1 placeholder:text-gray-600"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGeolocate}
                                    disabled={geoLoading}
                                    className="border-white/10 h-12 px-3 text-gray-400 hover:text-white shrink-0"
                                >
                                    {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Condition */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-400">Condition</label>
                        <div className="flex flex-wrap gap-2">
                            {["EXCELLENT", "GOOD", "FAIR", "POOR"].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCondition(c)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${condition === c
                                        ? "border-primary bg-primary/10 text-white shadow-[0_0_12px_rgba(237,28,36,0.15)]"
                                        : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"
                                        }`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transmission */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                            Transmission
                            {editId && <span className="text-primary">*</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'MANUAL', label: 'Manual' },
                                { value: 'AUTOMATIC', label: 'Automatic' },
                                { value: 'SEMI_AUTOMATIC', label: 'Semi-Auto' },
                                { value: 'CVT', label: 'CVT' },
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setTransmission(value)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${transmission === value
                                        ? "border-primary bg-primary/10 text-white shadow-[0_0_12px_rgba(237,28,36,0.15)]"
                                        : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Body Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1">
                            Body Type
                            {editId && <span className="text-primary">*</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: 'HATCHBACK', label: 'Hatchback' },
                                { value: 'SEDAN', label: 'Saloon' },
                                { value: 'ESTATE', label: 'Estate' },
                                { value: 'SUV', label: 'SUV' },
                                { value: 'CROSSOVER', label: 'Crossover' },
                                { value: 'COUPE', label: 'Coupé' },
                                { value: 'CONVERTIBLE', label: 'Convertible' },
                                { value: 'MPV', label: 'MPV' },
                                { value: 'VAN', label: 'Van' },
                                { value: 'PICKUP_TRUCK', label: 'Pickup' },
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setBodyType(value as BodyTypeValue)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${bodyType === value
                                        ? "border-primary bg-primary/10 text-white shadow-[0_0_12px_rgba(237,28,36,0.15)]"
                                        : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── SECTION 3: Photos ───────────────────────────────────────── */}
            {dvlaData && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black">3</span>
                        Photos
                        {images.length > 0 && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{images.length} uploaded</span>}
                    </h2>
                    <ImageUpload
                        onImagesChange={setImages}
                        maxImages={30}
                        existingImages={images}
                    />

                    {/* AI Damage Assessment (Optional for Quick List) */}
                    <div className="pt-6 border-t border-white/5">
                        <DamageAnalysisTool 
                            images={images} 
                            onComplete={(detections) => {
                                console.log("Quick List Detections:", detections)
                                alert(`${detections.length} damage records detected. These will be saved with the listing.`)
                            }} 
                        />
                    </div>
                </section>
            )}

            {/* ── SECTION 4: Description (optional, AI-powered) ───────────── */}
            {dvlaData && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black">4</span>
                            Description
                            {editId
                                ? <span className="text-primary text-[10px] font-black">* Required to publish</span>
                                : <span className="text-[10px] text-gray-600 normal-case font-normal">Optional</span>
                            }
                        </h2>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isGeneratingDesc}
                            onClick={handleGenerateDescription}
                            className="border-white/10 text-gray-400 hover:text-white gap-2 bg-black text-xs"
                        >
                            {isGeneratingDesc ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            AI Generate
                        </Button>
                    </div>
                    <Textarea
                        placeholder="Leave blank or use AI Generate to auto-write a professional listing description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-slate-900/50 border-white/10 text-white min-h-[100px] placeholder:text-gray-600 focus:border-primary"
                    />
                </section>
            )}

            {/* ── SECTION 5: Video Links ──────────────────────────────────── */}
            {dvlaData && (
                <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '250ms' }}>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-[10px] font-black">5</span>
                        Video Links
                        <span className="text-[10px] text-gray-600 normal-case font-normal">Optional · up to 5</span>
                    </h2>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste a YouTube, Instagram, Facebook or X video URL"
                            value={videoUrlInput}
                            onChange={e => { setVideoUrlInput(e.target.value); setVideoUrlError("") }}
                            className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 flex-1"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 shrink-0"
                            onClick={() => {
                                const url = videoUrlInput.trim()
                                if (!url) return
                                if (videoUrls.length >= 5) { setVideoUrlError("Maximum 5 video links allowed."); return }
                                const isValid = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com)/.test(url)
                                if (!isValid) { setVideoUrlError("Only YouTube, Instagram, Facebook or X links are accepted."); return }
                                if (videoUrls.includes(url)) { setVideoUrlError("This URL has already been added."); return }
                                setVideoUrls([...videoUrls, url])
                                setVideoUrlInput("")
                            }}
                        >
                            <Play size={14} className="mr-1" /> Add
                        </Button>
                    </div>
                    {videoUrlError && <p className="text-xs text-red-400">{videoUrlError}</p>}
                    {videoUrls.length > 0 && (
                        <div className="space-y-2">
                            {videoUrls.map((url, idx) => {
                                const platform = url.includes('youtube.com') || url.includes('youtu.be') ? 'YouTube'
                                    : url.includes('instagram.com') ? 'Instagram'
                                    : url.includes('facebook.com') || url.includes('fb.watch') ? 'Facebook'
                                    : 'X / Twitter'
                                return (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-white/5">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/20 shrink-0">{platform}</span>
                                        <span className="text-xs text-blue-400 truncate flex-1">{url}</span>
                                        <button type="button" onClick={() => setVideoUrls(videoUrls.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-red-400 transition-colors shrink-0">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
            )}

            {/* ── SUBMIT BAR ──────────────────────────────────────────────── */}
            {dvlaData && (
                <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
                    {submitError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                            <AlertTriangle size={16} /> {submitError}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-5 bg-[#0A0A0C] border border-white/5 rounded-2xl">
                        {/* Publish toggle */}
                        <div className="flex gap-2 p-1 bg-slate-800 rounded-xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => setPublishAs("ACTIVE")}
                                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${publishAs === "ACTIVE"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                                    : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                Publish Live
                            </button>
                            <button
                                type="button"
                                onClick={() => setPublishAs("DRAFT")}
                                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${publishAs === "DRAFT"
                                    ? "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                                    : "text-gray-500 hover:text-gray-300"
                                    }`}
                            >
                                Save Draft
                            </button>
                        </div>

                        <div className="flex-1" />

                        <Button
                            type="button"
                            disabled={!canSubmit || isSubmitting}
                            onClick={handleSubmit}
                            className="h-14 px-10 text-lg font-bold shadow-neon gap-2 disabled:opacity-40 w-full sm:w-auto"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={20} className="animate-spin" /> {editId ? 'Saving...' : 'Creating...'}</>
                            ) : (
                                <>{editId ? 'Save Changes' : publishAs === "ACTIVE" ? "Publish Listing" : "Save as Draft"} <ArrowRight size={20} /></>
                            )}
                        </Button>
                    </div>
                </section>
            )}
        </div>
    )
}
