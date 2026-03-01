"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import {
    Car, Camera, List, DollarSign, CheckCircle,
    ArrowRight, ArrowLeft, Loader2, MapPin,
    Edit, BadgeCheck, Search, LocateFixed, TrendingDown,
} from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/listing/ImageUpload"
import {
    createListing, dvlaLookup, formatPrice,
    type CreateListingRequest, type BodyTypeValue,
    type EuroStandardValue,
} from "@/lib/listingApi"
import { BODY_TYPE_ICONS, BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
    // Step 1 — Identity
    vrm: string
    vin: string
    make: string
    model: string
    year: string
    bodyType: BodyTypeValue | ""
    location: string
    // Step 2 — Media
    images: string[]
    // Step 3 — Technical Specs
    mileage: string
    fuelType: string
    transmission: string
    color: string
    doors: string
    seats: string
    engineSize: string
    bhp: string
    features: string[]
    description: string
    title: string
    // UK Compliance
    ulezCompliant: boolean | null
    euroStandard: EuroStandardValue | ""
    co2Emissions: string
    // Step 4 — Pricing
    priceMin: string
    priceMax: string
    status: "DRAFT" | "ACTIVE"
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_FEATURES = [
    "Navigation", "Leather Seats", "Heated Seats", "Sunroof",
    "Bluetooth", "Parking Sensors", "Reverse Camera", "Cruise Control",
    "Climate Control", "Apple CarPlay", "Android Auto", "DAB Radio",
    "LED Headlights", "Alloy Wheels", "Tow Bar",
]

const STEPS = [
    { id: 1, icon: Car, title: "Identity" },
    { id: 2, icon: Camera, title: "Media" },
    { id: 3, icon: List, title: "Specs" },
    { id: 4, icon: DollarSign, title: "Pricing" },
    { id: 5, icon: CheckCircle, title: "Review" },
]

const INITIAL_FORM: FormData = {
    vrm: "", vin: "", make: "", model: "", year: "", bodyType: "", location: "",
    images: [],
    mileage: "", fuelType: "", transmission: "", color: "",
    doors: "", seats: "", engineSize: "", bhp: "",
    features: [], description: "", title: "",
    ulezCompliant: null, euroStandard: "", co2Emissions: "",
    priceMin: "", priceMax: "", status: "DRAFT",
}

// ─── Valuation Engine ─────────────────────────────────────────────────────────
// Based on UK market data: Motorway's "How Much Does Mileage Affect Car Value?"
// Key factors: age-tiered depreciation, mileage vs UK average (8k mi/yr), fuel type

const BASE_VALUES: Record<string, number> = {
    "PORSCHE": 75000, "LAND ROVER": 58000, "AUDI": 46000,
    "BMW": 46000, "MERCEDES": 46000, "MERCEDES-BENZ": 46000,
    "LEXUS": 42000, "JAGUAR": 40000, "VOLVO": 36000,
    "VOLKSWAGEN": 32000, "TOYOTA": 30000, "HONDA": 28000,
    "NISSAN": 26000, "FORD": 26000, "VAUXHALL": 24000,
    "HYUNDAI": 24000, "KIA": 24000, "SKODA": 26000,
    "SEAT": 23000, "MAZDA": 27000, "MINI": 28000,
    "FIAT": 20000, "RENAULT": 21000, "PEUGEOT": 21000,
    "CITROËN": 20000, "CITROEN": 20000,
}

const FUEL_MULTIPLIERS: Record<string, number> = {
    "ELECTRIC": 1.10,
    "PLUGIN_HYBRID": 1.05,
    "HYBRID": 1.03,
    "PETROL": 1.00,
    "DIESEL": 0.95,
}

/**
 * Returns { low, mid, high } estimated values.
 * Age-tiered depreciation:
 *   Year 1: -20%, Years 2-3: -15%/yr, Years 4-7: -10%/yr, 8+: -7%/yr
 * Mileage: UK average = 8,000 mi/yr.
 *   Every 10k above average: -6%; every 10k below average: +3% (capped at +20%)
 */
function estimateValue(make: string, year: string, mileage: string, fuelType: string) {
    const base = BASE_VALUES[make.toUpperCase()] ?? 28000
    const currentYear = new Date().getFullYear()
    const age = Math.max(0, currentYear - Number(year))
    const miles = Number(mileage)

    // Age-tiered compound depreciation
    let retained = 1.0
    for (let y = 1; y <= age; y++) {
        if (y === 1) retained *= 0.80
        else if (y <= 3) retained *= 0.85
        else if (y <= 7) retained *= 0.90
        else retained *= 0.93
    }

    // Mileage deviation from UK average (8k mi/yr)
    const avgMiles = age * 8000
    const excessMiles = miles - avgMiles
    // Every 10,000 mi above avg = -6%; below avg = +3%, capped at +20%
    const mileageAdjustment = excessMiles >= 0
        ? Math.max(0.50, 1 - (excessMiles / 10000) * 0.06)
        : Math.min(1.20, 1 + (Math.abs(excessMiles) / 10000) * 0.03)

    // Fuel type modifier
    const fuelMult = FUEL_MULTIPLIERS[fuelType.toUpperCase()] ?? 1.0

    const mid = Math.max(500, Math.round((base * retained * mileageAdjustment * fuelMult) / 100) * 100)
    const low = Math.round(mid * 0.93 / 100) * 100
    const high = Math.round(mid * 1.07 / 100) * 100

    // Depreciation factors for display
    const ageDropPct = Math.round((1 - retained) * 100)
    const mileageDropPct = excessMiles > 0
        ? Math.round(Math.min(50, (excessMiles / 10000) * 6))
        : 0
    const mileageBonusPct = excessMiles < 0
        ? Math.round(Math.min(20, (Math.abs(excessMiles) / 10000) * 3))
        : 0

    return { low, mid, high, ageDropPct, mileageDropPct, mileageBonusPct, avgMiles }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SelectField({
    label, value, onChange, options, required = false,
}: {
    label: string; value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; required?: boolean
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold uppercase text-gray-400">{label}{required && " *"}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-10 rounded-md border border-white/10 bg-slate-900/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
                <option value="">Select {label.toLowerCase()}</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SellPage() {
    const router = useRouter()
    const { user, profile, loading: authLoading } = useAuth()

    const [currentStep, setCurrentStep] = React.useState(1)
    const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM)
    const [sellingMethod, setSellingMethod] = React.useState<"list" | null>(null)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [dvlaLoading, setDvlaLoading] = React.useState(false)
    const [dvlaError, setDvlaError] = React.useState<string | null>(null)
    const [dvlaSuccess, setDvlaSuccess] = React.useState(false)
    const [geoLoading, setGeoLoading] = React.useState(false)

    // Estimated value — derived from make, year, mileage, fuelType
    const valuation = React.useMemo(() => {
        if (!formData.make || !formData.year || !formData.mileage) return null
        return estimateValue(formData.make, formData.year, formData.mileage, formData.fuelType)
    }, [formData.make, formData.year, formData.mileage, formData.fuelType])

    const isAuthenticated = !!user && !!profile
    const isEmailVerified = !!user?.email_confirmed_at

    const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
        setFormData(prev => ({ ...prev, [key]: val }))

    // Auto-generate title from make + model + year
    React.useEffect(() => {
        if (formData.make && formData.model && formData.year) {
            const auto = `${formData.make} ${formData.model} ${formData.year}`
            if (!formData.title || formData.title.includes(formData.make)) {
                set("title", auto)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.make, formData.model, formData.year])

    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" })
    }, [currentStep, sellingMethod])

    // ─── Navigation ─────────────────────────────────────────────────────────────

    const validateStep = (): boolean => {
        switch (currentStep) {
            case 1: return !!(formData.vrm && formData.make && formData.model && formData.year)
            case 2: return formData.images.length > 0
            case 3: return !!(formData.mileage && formData.fuelType && formData.transmission && formData.title)
            case 4: {
                const hasRange = formData.priceMin && formData.priceMax
                if (!hasRange) return false
                const min = parseFloat(formData.priceMin)
                const max = parseFloat(formData.priceMax)
                if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0) return false
                if (min >= max) return false
                return true
            }
            default: return true
        }
    }

    const handleNext = () => {
        if (!validateStep()) {
            alert("Please fill in all required fields before proceeding.")
            return
        }
        setCurrentStep(prev => Math.min(prev + 1, 5))
    }
    const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1))
    const goToStep = (n: number) => setCurrentStep(n)

    const handleMethodClick = () => {
        if (!isAuthenticated) { setShowLoginModal(true); return }
        if (!isEmailVerified) {
            alert("Please verify your email address before creating a listing.")
            router.push("/auth/onboarding")
            return
        }
        setSellingMethod("list")
        set("status", "ACTIVE")
    }

    // ─── Submit ──────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!isAuthenticated) { setShowLoginModal(true); return }
        if (!isEmailVerified) { router.push("/auth/onboarding"); return }

        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const priceMin = parseFloat(formData.priceMin)
            const priceMax = parseFloat(formData.priceMax)
            const displayPrice = priceMin

            const payload: CreateListingRequest = {
                title: formData.title,
                price: displayPrice,
                priceMin,
                priceMax,
                mileage: parseInt(formData.mileage),
                year: parseInt(formData.year),
                vrm: formData.vrm,
                vin: formData.vin || undefined,
                images: formData.images,
                listingType: "CLASSIFIED",
                make: formData.make || undefined,
                model: formData.model || undefined,
                description: formData.description || undefined,
                fuelType: formData.fuelType as any || undefined,
                transmission: formData.transmission as any || undefined,
                bodyType: (formData.bodyType as BodyTypeValue) || undefined,
                color: formData.color || undefined,
                doors: formData.doors ? parseInt(formData.doors) : undefined,
                seats: formData.seats ? parseInt(formData.seats) : undefined,
                engineSize: formData.engineSize ? parseInt(formData.engineSize) : undefined,
                bhp: formData.bhp ? parseInt(formData.bhp) : undefined,
                features: formData.features.length > 0 ? formData.features : undefined,
                location: formData.location || undefined,
                ulezCompliant: formData.ulezCompliant ?? undefined,
                euroStandard: (formData.euroStandard as EuroStandardValue) || undefined,
                co2Emissions: formData.co2Emissions ? parseInt(formData.co2Emissions) : undefined,
                status: formData.status,
            }

            const response = await createListing(payload)
            setFormData(INITIAL_FORM)
            setCurrentStep(1)
            setSellingMethod(null)
            router.push(`/buy-cars/${response.data.slug}`)
        } catch (error: any) {
            console.error("Submission error:", error)
            if (error.message?.includes("Unauthorized") || error.message?.includes("401")) {
                setSubmitError("Please log in to create a listing.")
                setShowLoginModal(true)
            } else if (error.message?.includes("email") || error.message?.includes("verify")) {
                setSubmitError("Please verify your email address.")
                router.push("/auth/onboarding")
            } else {
                setSubmitError(error.message || "Failed to create listing. Please try again.")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Shared ──────────────────────────────────────────────────────────────────

    const inputCls = "bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"

    // ─── Login Modal ─────────────────────────────────────────────────────────────

    const LoginModal = () => !showLoginModal ? null : (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setShowLoginModal(false)}>
            <div className="glass-card p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-neon">
                    <Car size={40} />
                </div>
                <h2 className="text-2xl font-bold font-heading mb-3 text-white text-center">Sign In to List</h2>
                <p className="text-gray-400 mb-6 text-center text-sm">Create an account to add your listing safely.</p>
                <div className="space-y-3">
                    <Button onClick={() => { setShowLoginModal(false); router.push("/auth/login?redirect=/sell") }} className="w-full shadow-neon">Log In</Button>
                    <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white" onClick={() => { setShowLoginModal(false); router.push("/auth/signup?redirect=/sell") }}>Create Account</Button>
                </div>
            </div>
        </div>
    )

    // ─── Landing (method selection) ───────────────────────────────────────────────

    if (!sellingMethod) {
        return (
            <>
                <LoginModal />
                <div className="min-h-screen py-20">
                    <div className="container mx-auto px-5 max-w-4xl">
                        <div className="text-center mb-14">
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-4 text-white">List Your Car</h1>
                            <p className="text-xl text-gray-400">Reach thousands of buyers across the UK.</p>
                        </div>

                        <div
                            onClick={handleMethodClick}
                            className="glass-card p-10 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden max-w-xl mx-auto"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors" />
                            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                <List className="text-primary w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-bold mb-3 font-heading">List My Car</h2>
                            <p className="text-gray-400 mb-8">Set your offer range and let buyers submit their best price. You choose who to accept.</p>
                            <ul className="space-y-3 mb-8 text-gray-300">
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Free to list</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> DVLA-verified vehicle data</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Instant estimated valuation</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Reach thousands of buyers</li>
                            </ul>
                            <Button className="w-full py-6 text-lg group-hover:shadow-neon">Start Listing <ArrowRight className="ml-2" /></Button>
                        </div>

                        {/* Steps explanation */}
                        <div className="mt-24 grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
                            {STEPS.map((s) => (
                                <div key={s.id} className="p-5 glass-card">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                                        <span className="text-primary font-black text-sm">{s.id}</span>
                                    </div>
                                    <p className="text-white font-semibold text-sm">{s.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // ─── Wizard ───────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-5 max-w-3xl">
                <LoginModal />

                {/* Back link */}
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => setSellingMethod(null)} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                </div>

                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">List Your Car</h1>
                    <p className="text-gray-400 mt-2">Step {currentStep} of {STEPS.length}</p>
                </div>

                {/* Progress stepper */}
                <div className="glass-card px-6 py-5 mb-8 flex justify-between relative overflow-hidden">
                    {STEPS.map((step) => (
                        <div key={step.id} className={`flex flex-col items-center relative z-10 flex-1 ${currentStep >= step.id ? "text-primary" : "text-gray-500"}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 border transition-all ${currentStep >= step.id ? "bg-primary text-white shadow-neon border-primary" : "bg-slate-800 border-white/5"}`}>
                                <step.icon size={16} />
                            </div>
                            <span className="text-[9px] md:text-[11px] font-bold uppercase tracking-wide">{step.title}</span>
                        </div>
                    ))}
                    <div className="absolute top-[36px] left-0 w-full h-0.5 bg-white/5 -z-0">
                        <div className="h-full bg-primary transition-all duration-500 shadow-neon" style={{ width: `${(currentStep - 1) / (STEPS.length - 1) * 100}%` }} />
                    </div>
                </div>

                {/* Form card */}
                <div className="glass-card p-8 md:p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />

                    {/* ── STEP 1: Identity ──────────────────────────────────────────────── */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Vehicle Identity</h2>

                            {/* VRM + Lookup */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Registration (VRM) *</label>
                                <div className="flex gap-3">
                                    <Input placeholder="e.g. AB12 CDE" value={formData.vrm}
                                        onChange={(e) => { set("vrm", e.target.value.toUpperCase()); setDvlaSuccess(false); setDvlaError(null) }}
                                        className={`${inputCls} uppercase font-mono tracking-wider flex-1`} />
                                    <Button type="button" disabled={!formData.vrm || dvlaLoading}
                                        onClick={async () => {
                                            setDvlaLoading(true); setDvlaError(null); setDvlaSuccess(false)
                                            try {
                                                const r = await dvlaLookup(formData.vrm)
                                                if (r.make) set("make", r.make)
                                                if (r.colour) set("color", r.colour)
                                                if (r.year) set("year", String(r.year))
                                                if (r.engineSize) set("engineSize", String(r.engineSize))
                                                if (r.fuelType) set("fuelType", r.fuelType)
                                                if (r.euroStandard) set("euroStandard", r.euroStandard as EuroStandardValue)
                                                if (r.co2Emissions) set("co2Emissions", String(r.co2Emissions))
                                                setDvlaSuccess(true)
                                            } catch (err: any) {
                                                setDvlaError(err.message || "Lookup failed")
                                            } finally { setDvlaLoading(false) }
                                        }}
                                        className="bg-primary hover:bg-primary/90 text-white font-bold px-5 gap-2"
                                    >
                                        {dvlaLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                        Look Up
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-600">UK number plate — click Look Up to auto-fill vehicle details from DVLA.</p>
                                {dvlaSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><BadgeCheck size={12} /> Vehicle data loaded from DVLA — review and edit below.</p>}
                                {dvlaError && <p className="text-xs text-red-400">{dvlaError}</p>}
                            </div>

                            {/* VIN */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400 flex items-center gap-1.5">VIN <span className="text-gray-600 normal-case font-normal text-xs">(optional)</span></label>
                                <Input placeholder="17-character VIN" value={formData.vin}
                                    maxLength={17}
                                    onChange={(e) => set("vin", e.target.value.toUpperCase())}
                                    className={`${inputCls} font-mono tracking-wider`} />
                                <p className="text-xs text-gray-600">Vehicle Identification Number — increases buyer trust.</p>
                            </div>

                            {/* Make / Model / Year */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Make *</label>
                                    <Input placeholder="e.g. BMW" value={formData.make} onChange={(e) => set("make", e.target.value)} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Model *</label>
                                    <Input placeholder="e.g. M4 Competition" value={formData.model} onChange={(e) => set("model", e.target.value)} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Year *</label>
                                    <Input type="number" placeholder="2023" value={formData.year} onChange={(e) => set("year", e.target.value)} className={inputCls} />
                                </div>
                            </div>

                            {/* Body Type */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-gray-400">Body Type</label>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
                                    {BODY_TYPE_KEYS.map((key) => {
                                        const Icon = BODY_TYPE_ICONS[key]
                                        return (
                                            <button key={key} type="button"
                                                onClick={() => set("bodyType", key as BodyTypeValue)}
                                                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${formData.bodyType === key ? "border-primary bg-primary/10 text-white shadow-[0_0_15px_rgba(237,28,36,0.2)]" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/30"}`}
                                            >
                                                <Icon className="w-10 h-5" />
                                                <span className="text-[9px] font-bold uppercase tracking-wide">{BODY_TYPE_LABELS[key]}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400 flex items-center gap-1.5"><MapPin size={13} /> Location</label>
                                <div className="flex gap-3">
                                    <Input placeholder="e.g. London, Manchester" value={formData.location} onChange={(e) => set("location", e.target.value)} className={`${inputCls} flex-1`} />
                                    <Button type="button" variant="outline" disabled={geoLoading}
                                        onClick={async () => {
                                            if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return }
                                            setGeoLoading(true)
                                            navigator.geolocation.getCurrentPosition(
                                                async (pos) => {
                                                    try {
                                                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
                                                        const data = await res.json()
                                                        const addr = data.address || {}
                                                        const loc = [addr.city || addr.town || addr.village, addr.postcode].filter(Boolean).join(", ")
                                                        if (loc) set("location", loc)
                                                    } catch { /* silently fail */ }
                                                    setGeoLoading(false)
                                                },
                                                () => { alert("Could not get your location."); setGeoLoading(false) },
                                                { timeout: 10000 }
                                            )
                                        }}
                                        className="border-white/10 text-gray-400 hover:text-white gap-1.5 px-4"
                                    >
                                        {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                                        <span className="hidden md:inline">Use my location</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Media ─────────────────────────────────────────────────── */}
                    {currentStep === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Photos *</h2>
                            <p className="text-sm text-gray-400">Aim for at least 20 photos for the best results. Organize them by selecting the relevant category below.</p>
                            <ImageUpload
                                onImagesChange={(imgs) => set("images", imgs)}
                                maxImages={30}
                                existingImages={formData.images}
                            />
                        </div>
                    )}

                    {/* ── STEP 3: Technical Specs ───────────────────────────────────────── */}
                    {currentStep === 3 && (
                        <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Technical Specs</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Mileage */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Mileage *</label>
                                    <Input type="number" placeholder="e.g. 45000" value={formData.mileage} onChange={(e) => set("mileage", e.target.value)} className={inputCls} />
                                </div>

                                {/* Fuel */}
                                <SelectField label="Fuel Type" required value={formData.fuelType} onChange={(v) => set("fuelType", v)}
                                    options={[
                                        { value: "PETROL", label: "Petrol" },
                                        { value: "DIESEL", label: "Diesel" },
                                        { value: "ELECTRIC", label: "Electric" },
                                        { value: "HYBRID", label: "Hybrid" },
                                        { value: "PLUGIN_HYBRID", label: "Plug-in Hybrid" },
                                    ]}
                                />

                                {/* Transmission */}
                                <SelectField label="Transmission" required value={formData.transmission} onChange={(v) => set("transmission", v)}
                                    options={[
                                        { value: "MANUAL", label: "Manual" },
                                        { value: "AUTOMATIC", label: "Automatic" },
                                        { value: "SEMI_AUTOMATIC", label: "Semi-Automatic" },
                                    ]}
                                />

                                {/* Colour */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Colour</label>
                                    <Input placeholder="e.g. Alpine White" value={formData.color} onChange={(e) => set("color", e.target.value)} className={inputCls} />
                                </div>

                                {/* Engine */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Engine Size (cc)</label>
                                    <Input type="number" placeholder="e.g. 2993" value={formData.engineSize} onChange={(e) => set("engineSize", e.target.value)} className={inputCls} />
                                </div>

                                {/* BHP */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Power (BHP)</label>
                                    <Input type="number" placeholder="e.g. 503" value={formData.bhp} onChange={(e) => set("bhp", e.target.value)} className={inputCls} />
                                </div>

                                {/* Doors */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Doors</label>
                                    <Input type="number" placeholder="e.g. 4" min={2} max={8} value={formData.doors} onChange={(e) => set("doors", e.target.value)} className={inputCls} />
                                </div>

                                {/* Seats */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Seats</label>
                                    <Input type="number" placeholder="e.g. 5" min={1} max={20} value={formData.seats} onChange={(e) => set("seats", e.target.value)} className={inputCls} />
                                </div>
                            </div>

                            {/* UK Compliance */}
                            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                                    <BadgeCheck size={14} /> UK Compliance
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* ULEZ */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">ULEZ / CAZ Compliant?</label>
                                        <div className="flex gap-3">
                                            {(["Yes", "No", "Unknown"] as const).map((opt) => {
                                                const val = opt === "Yes" ? true : opt === "No" ? false : null
                                                const active = formData.ulezCompliant === val
                                                return (
                                                    <button key={opt} type="button"
                                                        onClick={() => set("ulezCompliant", val)}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${active ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Euro Standard */}
                                    <SelectField label="Euro Standard" value={formData.euroStandard} onChange={(v) => set("euroStandard", v as EuroStandardValue)}
                                        options={[
                                            { value: "EURO_4", label: "Euro 4" },
                                            { value: "EURO_5", label: "Euro 5" },
                                            { value: "EURO_6", label: "Euro 6" },
                                            { value: "EURO_6D", label: "Euro 6d" },
                                        ]}
                                    />

                                    {/* CO2 Emissions */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">CO₂ Emissions (g/km)</label>
                                        <Input type="number" placeholder="e.g. 142" value={formData.co2Emissions}
                                            onChange={(e) => set("co2Emissions", e.target.value)} className={inputCls} />
                                        <p className="text-xs text-gray-600">Auto-filled from DVLA when available.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-gray-400">Features</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {PRESET_FEATURES.map((f) => (
                                        <div key={f}
                                            onClick={() => set("features",
                                                formData.features.includes(f)
                                                    ? formData.features.filter(x => x !== f)
                                                    : [...formData.features, f]
                                            )}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${formData.features.includes(f) ? "bg-primary/20 border-primary text-primary" : "bg-slate-900/50 border-white/10 text-gray-400 hover:border-white/20"}`}
                                        >
                                            <span className="text-sm font-medium">{f}</span>
                                            {formData.features.includes(f) && <CheckCircle size={14} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Listing Title *</label>
                                <Input placeholder="e.g. BMW M4 Competition 2023" value={formData.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Description</label>
                                <Textarea
                                    placeholder="Describe service history, any extras, reason for selling..."
                                    value={formData.description}
                                    onChange={(e) => set("description", e.target.value)}
                                    rows={5}
                                    className={`${inputCls} resize-none`}
                                />
                                <p className="text-xs text-gray-600">{formData.description.length}/1000 characters</p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Pricing ───────────────────────────────────────────────── */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Pricing</h2>

                            {/* Estimated Valuation Card */}
                            {valuation ? (
                                <div className="rounded-xl bg-gradient-to-br from-blue-600/15 to-indigo-600/10 border border-blue-500/30 p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <BadgeCheck className="text-blue-400 shrink-0" size={20} />
                                        <h3 className="text-blue-300 font-bold uppercase tracking-wider text-sm">Estimated Market Value</h3>
                                    </div>

                                    {/* Price range */}
                                    <div>
                                        <p className="text-4xl font-black text-white tracking-tight">
                                            {formatPrice(valuation.low)}
                                            <span className="text-gray-400 text-2xl mx-2">–</span>
                                            {formatPrice(valuation.high)}
                                        </p>
                                        <p className="text-blue-300/70 text-xs mt-1 font-medium">Mid-point estimate: {formatPrice(valuation.mid)}</p>
                                    </div>

                                    {/* Factors breakdown */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                                        {valuation.ageDropPct > 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2">
                                                <TrendingDown size={14} className="text-amber-400 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Age impact</p>
                                                    <p className="text-amber-300 text-sm font-bold">−{valuation.ageDropPct}% depreciation</p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.mileageDropPct > 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2">
                                                <TrendingDown size={14} className="text-orange-400 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">High mileage</p>
                                                    <p className="text-orange-300 text-sm font-bold">−{valuation.mileageDropPct}% vs avg</p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.mileageBonusPct > 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center gap-2">
                                                <BadgeCheck size={14} className="text-emerald-400 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Low mileage</p>
                                                    <p className="text-emerald-300 text-sm font-bold">+{valuation.mileageBonusPct}% premium</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="bg-white/5 rounded-lg px-3 py-2.5">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">UK avg mileage</p>
                                            <p className="text-gray-300 text-sm font-bold">{valuation.avgMiles.toLocaleString()} mi/yr</p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-gray-500">
                                        Based on age-tiered UK market depreciation, your mileage vs. the UK average (8,000 mi/yr), and fuel type. You can override the values below.
                                    </p>

                                    <Button
                                        type="button"
                                        className="bg-blue-600 hover:bg-blue-700 text-white border-none w-full sm:w-auto"
                                        onClick={() => {
                                            set("priceMin", valuation.low.toString())
                                            set("priceMax", valuation.high.toString())
                                        }}
                                    >
                                        Use Estimated Range
                                    </Button>
                                </div>
                            ) : (
                                <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center text-gray-500 text-sm">
                                    Complete vehicle details (make, year, mileage) to see an estimated valuation.
                                </div>
                            )}

                            {/* Offer Range */}
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                <p className="text-xs text-primary font-semibold mb-1">💡 Offer Range</p>
                                <p className="text-xs text-gray-400">Buyers see your price range and submit offers within it. You choose to accept or reject each offer.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Minimum Price (£) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">£</span>
                                        <Input type="number" placeholder="e.g. 18000" value={formData.priceMin}
                                            onChange={(e) => set("priceMin", e.target.value)}
                                            className={`${inputCls} pl-8`} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Maximum Price (£) *</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">£</span>
                                        <Input type="number" placeholder="e.g. 22000" value={formData.priceMax}
                                            onChange={(e) => set("priceMax", e.target.value)}
                                            className={`${inputCls} pl-8`} />
                                    </div>
                                </div>
                            </div>

                            {formData.priceMin && formData.priceMax && (() => {
                                const min = parseFloat(formData.priceMin)
                                const max = parseFloat(formData.priceMax)
                                if (!isNaN(min) && !isNaN(max)) {
                                    const invalid = min >= max
                                    return (
                                        <p className={`text-sm ${invalid ? "text-red-400" : "text-emerald-400"}`}>
                                            {invalid
                                                ? "⚠ Minimum must be less than maximum"
                                                : `✓ Range: ${formatPrice(formData.priceMin)} – ${formatPrice(formData.priceMax)}`
                                            }
                                        </p>
                                    )
                                }
                                return null
                            })()}
                        </div>
                    )}

                    {/* ── STEP 5: Review ────────────────────────────────────────────────── */}
                    {currentStep === 5 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Review Your Listing</h2>

                            {/* Vehicle Info */}
                            <SummarySection title="Vehicle Identity" onEdit={() => goToStep(1)}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SummaryField label="VRM" value={formData.vrm} />
                                    {formData.vin && <SummaryField label="VIN" value={formData.vin} mono />}
                                    <SummaryField label="Make" value={formData.make} />
                                    <SummaryField label="Model" value={formData.model} />
                                    <SummaryField label="Year" value={formData.year} />
                                    {formData.bodyType && <SummaryField label="Body" value={formData.bodyType} />}
                                    {formData.location && <SummaryField label="Location" value={formData.location} />}
                                </div>
                            </SummarySection>

                            {/* Media */}
                            <SummarySection title={`Photos (${formData.images.length})`} onEdit={() => goToStep(2)}>
                                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                    {formData.images.slice(0, 12).map((img, i) => (
                                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                                            <Image src={img} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" />
                                        </div>
                                    ))}
                                </div>
                            </SummarySection>

                            {/* Specs */}
                            <SummarySection title="Technical Specs" onEdit={() => goToStep(3)}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <SummaryField label="Mileage" value={parseInt(formData.mileage).toLocaleString() + " mi"} />
                                    <SummaryField label="Fuel" value={formData.fuelType} />
                                    <SummaryField label="Transmission" value={formData.transmission} />
                                    {formData.color && <SummaryField label="Colour" value={formData.color} />}
                                    {formData.engineSize && <SummaryField label="Engine" value={formData.engineSize + "cc"} />}
                                    {formData.bhp && <SummaryField label="BHP" value={formData.bhp} />}
                                    {formData.doors && <SummaryField label="Doors" value={formData.doors} />}
                                    {formData.seats && <SummaryField label="Seats" value={formData.seats} />}
                                    {formData.ulezCompliant !== null && <SummaryField label="ULEZ" value={formData.ulezCompliant ? "Compliant" : "Non-compliant"} />}
                                    {formData.euroStandard && <SummaryField label="Euro Standard" value={formData.euroStandard.replace("_", " ")} />}
                                </div>
                                {formData.features.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {formData.features.map((f, i) => (
                                            <span key={i} className="text-xs bg-slate-800 text-gray-300 px-2 py-1 rounded-md border border-white/10">{f}</span>
                                        ))}
                                    </div>
                                )}
                                {formData.title && <div className="mt-3 pt-3 border-t border-white/5"><p className="text-xs text-gray-500 uppercase mb-1">Title</p><p className="text-white font-semibold">{formData.title}</p></div>}
                                {formData.description && <p className="text-sm text-gray-400 mt-2">{formData.description}</p>}
                            </SummarySection>

                            {/* Pricing */}
                            <SummarySection title="Pricing" onEdit={() => goToStep(4)}>
                                <div className="flex flex-col gap-1">
                                    <p className="text-white font-black text-2xl">
                                        {formatPrice(formData.priceMin)} – {formatPrice(formData.priceMax)}
                                    </p>
                                    <p className="text-primary text-xs font-bold uppercase">Offer Range</p>
                                    {valuation && (
                                        <p className="text-gray-500 text-xs mt-1">Estimated market value: {formatPrice(valuation.low)} – {formatPrice(valuation.high)}</p>
                                    )}
                                </div>
                            </SummarySection>

                            {submitError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                                    <p className="text-red-400 text-sm">{submitError}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-10 pt-6 border-t border-white/10">
                        {currentStep > 1
                            ? <Button variant="outline" onClick={handleBack} className="px-7 border-white/20 text-white hover:bg-white/10"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                            : <div />
                        }
                        {currentStep < 5
                            ? <Button onClick={handleNext} className="px-7 shadow-neon">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            : <Button onClick={handleSubmit} disabled={isSubmitting}
                                className="px-7 bg-emerald-600 hover:bg-emerald-700 border-none shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : <>Publish <CheckCircle className="ml-2 h-4 w-4" /></>}
                            </Button>
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Review helper components ─────────────────────────────────────────────────

function SummarySection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">{title}</h3>
                <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                    <Edit size={12} /> Edit
                </button>
            </div>
            <div className="glass-card p-5">{children}</div>
        </div>
    )
}

function SummaryField({ label, value, mono = false }: { label: string; value: string | number | undefined; mono?: boolean }) {
    if (!value) return null
    return (
        <div>
            <p className="text-[10px] text-gray-500 uppercase mb-0.5">{label}</p>
            <p className={`text-white font-medium text-sm ${mono ? "font-mono tracking-wide" : ""}`}>{value}</p>
        </div>
    )
}
