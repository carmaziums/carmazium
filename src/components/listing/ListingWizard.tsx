"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import {
    Car, Camera, List, DollarSign, CheckCircle,
    ArrowRight, ArrowLeft, Loader2, Search,
    BadgeCheck, TrendingDown, Upload, Eye, X,
    Shield, Star, Sparkles, Zap, MapPin, LocateFixed, Edit, Info, Handshake, CreditCard, AlertTriangle, ChevronDown, Lock, FileText, Activity
} from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/listing/ImageUpload"
import {
    createListing, formatPrice,
    type CreateListingRequest, type BodyTypeValue,
    type EuroStandardValue, type VehicleTypeValue,
} from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"
import { dvlaLookup } from "@/lib/dvlaApi"
import { aiGenerateDescription } from "@/lib/aiApi"
import { BODY_TYPE_ICONS, BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
    // Step 1 — Vehicle Details (merged Identity + Specs)
    vehicleType: VehicleTypeValue
    vrm: string
    vin: string
    make: string
    model: string
    year: string
    bodyType: BodyTypeValue | ""
    location: string
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
    // Condition & History
    condition: string
    serviceHistory: string
    owners: string
    isImported: boolean
    // UK Compliance
    ulezCompliant: boolean | null
    euroStandard: EuroStandardValue | ""
    co2Emissions: string
    // DVLA extended fields
    motStatus: string
    taxStatus: string
    motExpiryDate: string
    taxDueDate: string
    markedForExport: boolean | null
    monthOfFirstRegistration: string
    wheelplan: string
    typeApproval: string
    motHistory: any[]
    firstUsedDate?: string
    primaryColour?: string
    dateOfLastV5CIssued: string
    // Step 2 — Media
    images: string[]
    // Step 3 — Pricing
    priceMin: string
    priceMax: string
    badgeTier: 'FREE' | 'STANDARD' | 'PREMIUM'
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
    { id: 1, icon: Car, title: "Details" },
    { id: 2, icon: Camera, title: "Media" },
    { id: 3, icon: DollarSign, title: "Pricing" },
    { id: 4, icon: CheckCircle, title: "Review" },
]

const INITIAL_FORM: FormData = {
    vehicleType: "CAR", vrm: "", vin: "", make: "", model: "", year: "", bodyType: "", location: "",
    mileage: "", fuelType: "", transmission: "", color: "",
    doors: "", seats: "", engineSize: "", bhp: "",
    features: [], description: "", title: "",
    condition: "", serviceHistory: "", owners: "", isImported: false,
    ulezCompliant: null, euroStandard: "", co2Emissions: "",
    motStatus: "", taxStatus: "", motExpiryDate: "", taxDueDate: "",
    markedForExport: null, monthOfFirstRegistration: "",
    wheelplan: "", typeApproval: "", motHistory: [],
    primaryColour: "",
    dateOfLastV5CIssued: "",
    images: [],
    priceMin: "", priceMax: "", badgeTier: 'FREE', status: "DRAFT",
}

// ─── Valuation Engine ─────────────────────────────────────────────────────────
// Based on UK market data: Motorway's "How Much Does Mileage Affect Car Value?"
// Key factors: age-tiered depreciation, mileage vs UK average (8k mi/yr), fuel type

const BASE_VALUES: Record<string, number> = {
    "PORSCHE": 68000, "LAND ROVER": 52000, "AUDI": 41000,
    "BMW": 41000, "MERCEDES": 41000, "MERCEDES-BENZ": 41000,
    "LEXUS": 38000, "JAGUAR": 36000, "VOLVO": 32000,
    "VOLKSWAGEN": 28000, "TOYOTA": 27000, "HONDA": 25000,
    "NISSAN": 23000, "FORD": 23000, "VAUXHALL": 21000,
    "HYUNDAI": 21000, "KIA": 21000, "SKODA": 23000,
    "SEAT": 20000, "MAZDA": 24000, "MINI": 25000,
    "FIAT": 17000, "RENAULT": 18000, "PEUGEOT": 18000,
    "CITROËN": 17000, "CITROEN": 17000,
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
function estimateValue(
    make: string, year: string, mileage: string, fuelType: string,
    condition: string, serviceHistory: string, transmission: string,
    owners: string, location: string
) {
    const newBase = BASE_VALUES[make.toUpperCase()] ?? 25000
    const currentYear = new Date().getFullYear()
    const age = Math.max(0, currentYear - Number(year))
    const actualMileage = Number(mileage)

    // 1️⃣ Base Market Price (Compounding deprecation: ~13% loss per year)
    const depreciationFactor = Math.pow(0.87, age)
    let basePrice = newBase * depreciationFactor
    if (basePrice < 800) basePrice = 800 // Floor

    // 3️⃣ Mileage Adjustment (steeper penalty for high mileage)
    const expectedMileage = Math.max(10000, age * 10000)
    const mileageDiff = actualMileage - expectedMileage
    let mileageRate = (mileageDiff / 10000) * -0.03
    mileageRate = Math.max(-0.35, Math.min(0.10, mileageRate)) // Cap between -35% and +10%
    const mileageAdjustmentVal = basePrice * mileageRate

    // 5️⃣ Condition Adjustment
    let conditionRate = 0
    if (condition === "EXCELLENT") conditionRate = 0.05
    else if (condition === "GOOD") conditionRate = 0.02
    else if (condition === "FAIR") conditionRate = -0.06
    else if (condition === "POOR" || condition === "CAT_N" || condition === "CAT_S" || condition === "CAT_C" || condition === "CAT_D") conditionRate = -0.25
    const conditionAdjustmentVal = basePrice * conditionRate

    // 6️⃣ Service History Adjustment
    let serviceRate = 0
    if (serviceHistory === "FULL") serviceRate = 0.03
    else if (serviceHistory === "PARTIAL") serviceRate = 0.01
    else if (serviceHistory === "NONE") serviceRate = -0.06
    const serviceAdjustmentVal = basePrice * serviceRate

    // 7️⃣ Transmission Adjustment
    const transmissionValue = transmission === "AUTOMATIC" ? Math.min(600, basePrice * 0.03) : 0

    // 8️⃣ Fuel Type Adjustment
    let fuelRate = 0
    if (fuelType === "ELECTRIC") fuelRate = 0.05
    else if (fuelType === "HYBRID" || fuelType === "PLUGIN_HYBRID") fuelRate = 0.03
    else if (fuelType === "DIESEL") fuelRate = -0.05
    const fuelAdjustmentVal = basePrice * fuelRate

    // 9️⃣ Ownership Adjustment
    let ownerRate = 0
    if (owners === "1") ownerRate = 0.03
    else if (owners === "2") ownerRate = 0.01
    else if (owners === "3+") ownerRate = -0.04
    const ownershipAdjustmentVal = basePrice * ownerRate

    // 🔟 Location Demand Adjustment
    let locationRate = 0
    const locUpper = location ? location.toUpperCase() : ""
    if (locUpper.includes("LONDON") || locUpper.includes("SOUTH EAST")) {
        locationRate = 0.02
    } else if (locUpper.includes("MANCHESTER") || locUpper.includes("BIRMINGHAM") || locUpper.includes("LEEDS") || locUpper.includes("GLASGOW") || locUpper.includes("LIVERPOOL") || locUpper.includes("SHEFFIELD") || locUpper.includes("BRISTOL") || locUpper.includes("EDINBURGH")) {
        locationRate = 0.01
    }
    const locationAdjustmentVal = basePrice * locationRate

    // 1️⃣1️⃣ Final Formula (Complete)
    let estimatedPrice = basePrice + mileageAdjustmentVal + conditionAdjustmentVal + serviceAdjustmentVal + transmissionValue + fuelAdjustmentVal + ownershipAdjustmentVal + locationAdjustmentVal
    if (estimatedPrice < 500) estimatedPrice = 500

    const mid = Math.max(500, Math.round(estimatedPrice / 100) * 100)
    const low = Math.round(mid * 0.95 / 100) * 100
    const high = Math.round(mid * 1.05 / 100) * 100

    return { 
        low, mid, high, 
        basePrice, 
        mileageAdjustmentVal, 
        conditionAdjustmentVal, 
        serviceAdjustmentVal, 
        transmissionValue, 
        fuelAdjustmentVal, 
        ownershipAdjustmentVal, 
        locationAdjustmentVal,
        expectedMileage
    }
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
// ─── Info Tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
    return (
        <span className="relative group/tip inline-flex items-center ml-1 cursor-help">
            <Info size={12} className="text-gray-500 group-hover/tip:text-blue-400 transition-colors" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-slate-800 border border-white/10 px-3 py-2.5 text-xs text-gray-300 leading-relaxed shadow-xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none">
                {text}
                <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
            </span>
        </span>
    )
}

// ─── HPI Bait Section ─────────────────────────────────────────────────────────

function HpiBaitSection({ isUnlocked, onUnlock }: { isUnlocked: boolean, onUnlock: () => void }) {
    if (isUnlocked) {
        return (
            <div className="mt-8 relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex flex-col items-center text-center">
                 <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                     <CheckCircle className="text-emerald-400" size={24} />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-1">HPI Report Verified</h3>
                 <p className="text-sm text-emerald-200/70 mb-4 max-w-sm">Your vehicle is fully cleared. You've earned the Premium Verification Badge which will automatically be added to your listing.</p>
                 <div className="filter-none blur-none border border-white/10 p-3 rounded bg-slate-900/50 flex gap-2 w-full max-w-sm mx-auto text-left items-center">
                     <FileText size={20} className="text-blue-400 shrink-0" />
                     <div className="flex-1 min-w-0">
                         <p className="text-xs text-white font-bold truncate">HPI_Report_Clear.pdf</p>
                         <p className="text-[10px] text-gray-500">Official OneAuto Data</p>
                     </div>
                     <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Verified</span>
                 </div>
            </div>
        )
    }

    return (
        <div className="mt-8 relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-500">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="text-amber-400" size={20} />
                        <h3 className="text-lg font-bold text-white font-heading">Boost Your Sale</h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-4">
                        We've found an official HPI record for this vehicle. Unlocking the full report gives you a <strong className="text-white">Premium Verification Badge</strong>, proven to help cars sell up to 2x faster!
                    </p>
                    <ul className="space-y-2 text-xs text-gray-400 mb-6">
                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-amber-400" /> Prove there is no outstanding finance</li>
                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-amber-400" /> Verify it's never been stolen or written-off</li>
                        <li className="flex items-center gap-2"><CheckCircle size={14} className="text-amber-400" /> Give buyers complete peace of mind</li>
                    </ul>
                    <Button type="button" onClick={onUnlock} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6 shadow-[0_0_15px_rgba(245,158,11,0.3)] border-none shrink-0 w-full sm:w-auto">
                        Unlock HPI Report - £9.99
                    </Button>
                </div>
                
                {/* Simulated Blurred Document */}
                <div className="w-full md:w-48 shrink-0 flex flex-col items-center">
                    <div className="w-full h-40 bg-white/5 border border-white/10 rounded-lg relative overflow-hidden shadow-xl p-3 flex flex-col select-none pointer-events-none">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
                            <Lock size={24} className="text-white/70 mb-2" />
                            <span className="text-[10px] font-bold text-white/90 bg-black/60 px-2 py-1 rounded uppercase tracking-widest border border-white/10">Locked</span>
                        </div>
                        {/* Fake document content */}
                        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                            <span className="text-[8px] font-bold text-gray-300">ONEAUTO REPORT</span>
                            <span className="text-[8px] font-bold text-amber-500">CONFIDENTIAL</span>
                        </div>
                        <div className="space-y-1.5 opacity-60">
                            <div className="h-2 w-3/4 bg-gray-500 rounded" />
                            <div className="h-2 w-1/2 bg-gray-500 rounded" />
                            <div className="mt-3 h-2 w-full bg-gray-600 rounded" />
                            <div className="h-2 w-full bg-gray-600 rounded" />
                            <div className="h-2 w-4/5 bg-gray-600 rounded" />
                            <div className="mt-3 h-10 w-full rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <span className="text-[8px] text-emerald-400 font-bold tracking-widest">CLEAR STATUS</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[9px] text-gray-500 text-center mt-2">Data sourced seamlessly via <br/>UK Official Vehicle Records</p>
                </div>
            </div>
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListingWizard({ isDashboard = false }: { isDashboard?: boolean }) {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()

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
    const [isGeneratingDesc, setIsGeneratingDesc] = React.useState(false)

    // HPI Payment State
    const [showHpiModal, setShowHpiModal] = React.useState(false)
    const [isHpiUnlocked, setIsHpiUnlocked] = React.useState(false)
    const [isProcessingPayment, setIsProcessingPayment] = React.useState(false)

    // Estimated value — derived from complex formula
    const valuation = React.useMemo(() => {
        if (!formData.make || !formData.year || !formData.mileage) return null
        return estimateValue(
            formData.make, formData.year, formData.mileage, formData.fuelType,
            formData.condition, formData.serviceHistory, formData.transmission,
            formData.owners, formData.location
        )
    }, [formData.make, formData.year, formData.mileage, formData.fuelType, formData.condition, formData.serviceHistory, formData.transmission, formData.owners, formData.location])

    const isAuthenticated = !!user
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
            case 1: return !!(formData.vrm && formData.make && formData.model && formData.year && formData.mileage && formData.fuelType && formData.transmission && formData.title)
            case 2: return formData.images.length > 0
            case 3: {
                if (!formData.priceMin) return false
                const price = parseFloat(formData.priceMin)
                if (isNaN(price) || price <= 0) return false
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
        setCurrentStep(prev => Math.min(prev + 1, 4))
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
            const priceMax = priceMin
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
                // DVLA extended fields
                motStatus: formData.motStatus || undefined,
                taxStatus: formData.taxStatus || undefined,
                motExpiryDate: formData.motExpiryDate || undefined,
                taxDueDate: formData.taxDueDate || undefined,
                markedForExport: formData.markedForExport ?? undefined,
                monthOfFirstRegistration: formData.monthOfFirstRegistration || undefined,
                wheelplan: formData.wheelplan || undefined,
                typeApproval: formData.typeApproval || undefined,
                badgeTier: formData.badgeTier,
                status: formData.status,
                vehicleType: formData.vehicleType as VehicleTypeValue,
                isImported: formData.isImported,
                condition: formData.condition as any || undefined,
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

    // ─── HPI Payment Modal ───────────────────────────────────────────────────────

    const HpiPaymentModal = () => (!showHpiModal || isHpiUnlocked) ? null : (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => !isProcessingPayment && setShowHpiModal(false)}>
            <div className="glass-card p-0 max-w-md w-full relative overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-slate-900/80 p-5 border-b border-white/10 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><CreditCard size={18} className="text-primary"/> Secure Checkout</h3>
                    <button disabled={isProcessingPayment} type="button" onClick={() => setShowHpiModal(false)} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6">
                     <div className="flex justify-between items-center mb-6">
                         <div>
                             <p className="text-white font-bold">Comprehensive HPI Report</p>
                             <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">Powered by OneAuto API</p>
                         </div>
                         <div className="text-xl font-black text-white">£9.99</div>
                     </div>
                     
                     <div className="space-y-4 mb-6">
                          {/* Fake Card Input */}
                          <div className="space-y-1.5 bg-slate-900/50 p-4 rounded-xl border border-white/5 opacity-50 pointer-events-none">
                              <label className="text-xs font-bold text-gray-500 uppercase">Card Details</label>
                              <div className="h-10 bg-black/20 rounded border border-white/10 flex items-center px-3">
                                  <Lock size={14} className="text-gray-500 mr-2" />
                                  <span className="text-gray-500 text-sm">•••• •••• •••• ••••</span>
                              </div>
                          </div>
                          
                          {/* Bypass Note for Beta */}
                          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
                               <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                               <div>
                                   <p className="text-xs font-bold text-blue-300">Beta Testing Mode</p>
                                   <p className="text-[10px] text-blue-400/80 mt-1 leading-relaxed">Payment gateways are disabled on this environment. Use the bypass button below to simulate a successful payment and unlock the HPI report instantly.</p>
                               </div>
                          </div>
                     </div>
                     
                     <Button 
                         disabled={isProcessingPayment}
                         onClick={() => {
                             setIsProcessingPayment(true)
                             setTimeout(() => {
                                 setIsProcessingPayment(false)
                                 setIsHpiUnlocked(true)
                                 setShowHpiModal(false)
                             }, 1500)
                         }}
                         className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 text-lg relative overflow-hidden group shadow-neon border-none"
                     >
                         {isProcessingPayment ? (
                             <><Loader2 className="animate-spin mr-2" size={18} /> Processing...</>
                         ) : (
                             <>Simulate Payment <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18}/></>
                         )}
                     </Button>
                </div>
            </div>
        </div>
    )

    // ─── Landing (method selection) ───────────────────────────────────────────────

    if (!sellingMethod) {
        return (
            <>
                <LoginModal />
                <HpiPaymentModal />
                <div className={`relative ${isDashboard ? 'pb-12 w-full' : 'min-h-screen bg-slate-900 pt-24 pb-12'}`}>
                    {/* Background Effects */}
                    {!isDashboard && <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />}
                    <div className="container mx-auto px-5 max-w-4xl">
                        <div className="text-center mb-14">
                            <h1 className="text-4xl md:text-5xl font-black font-heading mb-4 text-white tracking-tight uppercase">CURATE YOUR LISTING</h1>
                            <p className="text-lg text-gray-400 max-w-lg mx-auto">Present your vehicle to thousands of high-intent buyers seeking premium quality.</p>
                        </div>

                        <div
                            onClick={handleMethodClick}
                            className="relative cursor-pointer group max-w-xl mx-auto"
                        >
                            {/* Card glow effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 via-red-600/30 to-primary/50 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative dealer-glass-card p-10 border-white/10 hover:border-primary/50 transition-all duration-300 overflow-hidden hover:shadow-neon rounded-2xl">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -z-10" />
                                <div className="w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                    <List className="text-primary w-10 h-10" />
                                </div>
                                <h2 className="text-3xl font-bold mb-3 font-heading">List My Car</h2>
                                <p className="text-gray-400 mb-8">Set your asking price and let buyers submit offers. You choose who to accept.</p>
                                <ul className="space-y-3 mb-8 text-gray-300">
                                    <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Free to list</li>
                                    <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> DVLA-verified vehicle data</li>
                                    <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Instant estimated valuation</li>
                                    <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Reach thousands of buyers</li>
                                </ul>
                                <Button className="w-full py-6 text-lg group-hover:shadow-neon">Start Listing <ArrowRight className="ml-2" /></Button>
                            </div>
                        </div>

                        {/* Steps explanation */}
                        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
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
                <HpiPaymentModal />

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
                <div className="dealer-glass-card p-10 md:p-14 relative overflow-hidden border-white/5 bg-[#0A0A0C]">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 opacity-60" />

                    {/* ── STEP 1: Identity ──────────────────────────────────────────────── */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Vehicle Details</h2>

                            {/* Vehicle Type Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Vehicle Type *</label>
                                <div className="flex gap-3">
                                    {(["CAR", "HGV", "MOTORCYCLE"] as const).map((vt) => {
                                        const labels: Record<string, string> = { CAR: "Car", HGV: "HGV / Commercial", MOTORCYCLE: "Motorcycle" }
                                        const active = formData.vehicleType === vt
                                        return (
                                            <button key={vt} type="button"
                                                onClick={() => set("vehicleType", vt)}
                                                className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${active ? "border-primary bg-primary/10 text-white shadow-[0_0_15px_rgba(237,28,36,0.2)]" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"}`}
                                            >
                                                {labels[vt]}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* VRM + Lookup */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Registration (VRM) *</label>
                                <div className="flex gap-3">
                                    <Input placeholder="e.g. AB12 CDE" value={formData.vrm}
                                        onChange={(e) => { set("vrm", e.target.value.toUpperCase()); setDvlaSuccess(false); setDvlaError(null) }}
                                        className={`${inputCls} uppercase font-mono tracking-widest text-lg h-14 bg-black border-primary/20 focus:border-primary flex-1 max-w-sm`} />
                                    <Button type="button" disabled={!formData.vrm || dvlaLoading}
                                        className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-14 uppercase tracking-widest gap-2 shadow-neon transition-transform active:scale-95"
                                        onClick={async () => {
                                            setDvlaLoading(true); setDvlaError(null); setDvlaSuccess(false)
                                            try {
                                                const r = await dvlaLookup(formData.vrm)
                                                // Core vehicle fields
                                                if (r.make) set("make", r.make)
                                                if (r.model) set("model", r.model)
                                                
                                                if (r.primaryColour) set("primaryColour", r.primaryColour)
                                                
                                                if (r.motHistory && r.motHistory.length > 0) {
                                                    set("motHistory", r.motHistory)
                                                    // Autofill mileage from the latest valid MOT (which is usually the first one since it's sorted descending by completedDate)
                                                    const latestOdometer = r.motHistory.find((m: any) => m.odometerValue)?.odometerValue
                                                    if (latestOdometer) set("mileage", latestOdometer)
                                                }
                                                
                                                if (r.colour) set("color", r.colour)
                                                if (r.year) set("year", String(r.year))
                                                if (r.engineSize) set("engineSize", String(r.engineSize))
                                                if (r.fuelType) set("fuelType", r.fuelType)
                                                if (r.euroStandard) set("euroStandard", r.euroStandard as EuroStandardValue)
                                                if (r.co2Emissions) set("co2Emissions", String(r.co2Emissions))
                                                // DVLA extended fields
                                                if (r.motStatus) set("motStatus", r.motStatus)
                                                if (r.taxStatus) set("taxStatus", r.taxStatus)
                                                if (r.motExpiryDate) set("motExpiryDate", r.motExpiryDate)
                                                if (r.taxDueDate) set("taxDueDate", r.taxDueDate)
                                                if (r.markedForExport !== undefined) set("markedForExport", r.markedForExport)
                                                if (r.monthOfFirstRegistration) set("monthOfFirstRegistration", r.monthOfFirstRegistration)
                                                if (r.wheelplan) set("wheelplan", r.wheelplan)
                                                if (r.typeApproval) set("typeApproval", r.typeApproval)
                                                if (r.dateOfLastV5CIssued) set("dateOfLastV5CIssued", r.dateOfLastV5CIssued)
                                                // Auto-infer ULEZ compliance from fuel type + euro standard
                                                const ft = (r.fuelType || "").toUpperCase()
                                                const es = (r.euroStandard || "").toUpperCase()
                                                if (ft === "ELECTRIC" || ft === "PLUGIN_HYBRID") {
                                                    set("ulezCompliant", true)
                                                } else if (es.includes("EURO_6") || es === "EURO_6D") {
                                                    set("ulezCompliant", true)
                                                } else if (ft === "PETROL" && es === "EURO_4") {
                                                    set("ulezCompliant", true)
                                                } else if (es) {
                                                    set("ulezCompliant", false)
                                                }
                                                setDvlaSuccess(true)
                                            } catch (err: any) {
                                                setDvlaError(err.message || "Lookup failed")
                                            } finally { setDvlaLoading(false) }
                                        }}
                                    >
                                        {dvlaLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                        Analyze DVLA
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-600">UK number plate — click Look Up to auto-fill vehicle details.</p>
                                {dvlaSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><BadgeCheck size={12} /> Vehicle data loaded — review and edit below.</p>}
                                {dvlaError && <p className="text-xs text-red-400">{dvlaError}</p>}
                            </div>

                            {/* Registration & Compliance Details */}
                            <div className="mt-8">
                                <h3 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white flex items-center gap-2">
                                    <Shield size={20} className="text-blue-400" />
                                    Registration & Compliance
                                </h3>
                                <p className="text-xs text-gray-500 mt-2 mb-6">
                                    These fields are auto-filled from the DVLA and MOT databases, but can be manually adjusted.
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {/* First Registered */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">First Registered</label>
                                        <Input placeholder="e.g. 2015-03" value={formData.monthOfFirstRegistration} onChange={(e) => set("monthOfFirstRegistration", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Last V5C Issued */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Last V5C Issued</label>
                                        <Input placeholder="e.g. 2021-06-15" value={formData.dateOfLastV5CIssued} onChange={(e) => set("dateOfLastV5CIssued", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* MOT Status */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">MOT Status</label>
                                        <Input placeholder="e.g. Valid" value={formData.motStatus} onChange={(e) => set("motStatus", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* MOT Expiry */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">MOT Expiry Date</label>
                                        <Input placeholder="e.g. 2024-03-11" value={formData.motExpiryDate} onChange={(e) => set("motExpiryDate", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Tax Status */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Tax Status</label>
                                        <Input placeholder="e.g. Taxed" value={formData.taxStatus} onChange={(e) => set("taxStatus", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Tax Due Date */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Tax Due Date</label>
                                        <Input placeholder="e.g. 2024-08-31" value={formData.taxDueDate} onChange={(e) => set("taxDueDate", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Type Approval */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Type Approval</label>
                                        <Input placeholder="e.g. M1" value={formData.typeApproval} onChange={(e) => set("typeApproval", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Wheelplan */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Wheelplan</label>
                                        <Input placeholder="e.g. 2 AXLE RIGID BODY" value={formData.wheelplan} onChange={(e) => set("wheelplan", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Marked For Export */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400 flex items-center gap-1.5">Marked for Export</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={formData.markedForExport === null ? "" : (formData.markedForExport ? "yes" : "no")}
                                                onChange={(e) => set("markedForExport", e.target.value === "yes" ? true : e.target.value === "no" ? false : null)}
                                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3.5 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all appearance-none"
                                            >
                                                <option value="" disabled>Select</option>
                                                <option value="yes">Yes</option>
                                                <option value="no">No</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                                {/* MOT History - Read Only List */}
                                {formData.motHistory && formData.motHistory.length > 0 && (
                                    <div className="mt-6 border border-blue-500/20 bg-blue-500/5 rounded-xl p-5">
                                        <h4 className="text-sm font-bold uppercase text-blue-400 mb-3 flex items-center gap-2">
                                            <List size={14} /> MOT History
                                        </h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                                            {formData.motHistory.slice(0, 5).map((test: any, idx: number) => (
                                                <div key={idx} className="bg-slate-900/40 rounded-lg p-3 border border-white/5">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div>
                                                            <p className="text-xs font-bold text-white">{new Date(test.completedDate).toLocaleDateString('en-GB')}</p>
                                                            {test.odometerValue && (
                                                                <p className="text-[10px] text-gray-500">{Number(test.odometerValue).toLocaleString()} {test.odometerUnit}</p>
                                                            )}
                                                        </div>
                                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${test.testResult === 'PASSED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {test.testResult}
                                                        </div>
                                                    </div>
                                                    
                                                    {test.defects && test.defects.length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {test.defects.map((defect: any, dIdx: number) => (
                                                                <div key={dIdx} className="flex gap-1.5 text-[10px]">
                                                                    <AlertTriangle size={10} className={`mt-0.5 shrink-0 ${defect.type === 'ADVISORY' ? 'text-amber-400' : 'text-red-400'}`} />
                                                                    <span className={defect.type === 'ADVISORY' ? 'text-amber-200/70' : 'text-red-200/70'}>
                                                                        <strong className="uppercase mr-1">{defect.type}:</strong>
                                                                        {defect.text}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {formData.motHistory.length > 5 && (
                                                <p className="text-[10px] text-gray-500 text-center pt-2 italic">Showing latest 5 records of {formData.motHistory.length}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
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

                            {/* Body Type (not for motorcycles) */}
                            {formData.vehicleType !== 'MOTORCYCLE' && (
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
                            )}

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

                    {/* ── STEP 1 (continued): Technical Specs ─────────────────────── */}
                    {currentStep === 1 && (
                        <div className="space-y-7">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white mt-8">Technical Specs</h2>

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
                                        { value: "LPG", label: "LPG" },
                                        { value: "HYDROGEN_CELL", label: "Hydrogen Fuel Cell" },
                                    ]}
                                />

                                {/* Transmission */}
                                <SelectField label="Transmission" required value={formData.transmission} onChange={(v) => set("transmission", v)}
                                    options={[
                                        { value: "MANUAL", label: "Manual" },
                                        { value: "AUTOMATIC", label: "Automatic" },
                                        { value: "SEMI_AUTOMATIC", label: "Semi-Automatic" },
                                        { value: "CVT", label: "CVT" },
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

                                {/* Doors (not for motorcycles) */}
                                {formData.vehicleType !== 'MOTORCYCLE' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Doors</label>
                                        <Input type="number" placeholder="e.g. 4" min={2} max={8} value={formData.doors} onChange={(e) => set("doors", e.target.value)} className={inputCls} />
                                    </div>
                                )}

                                {/* Seats (not for motorcycles) */}
                                {formData.vehicleType !== 'MOTORCYCLE' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-gray-400">Seats</label>
                                        <Input type="number" placeholder="e.g. 5" min={1} max={20} value={formData.seats} onChange={(e) => set("seats", e.target.value)} className={inputCls} />
                                    </div>
                                )}
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
                                {/* AI-Assisted Description */}
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        setIsGeneratingDesc(true)
                                        try {
                                            const res = await aiGenerateDescription({
                                                make: formData.make,
                                                model: formData.model,
                                                year: formData.year,
                                                mileage: formData.mileage,
                                                condition: formData.condition,
                                                fuelType: formData.fuelType,
                                                transmission: formData.transmission,
                                                color: formData.color,
                                                features: formData.features,
                                                vrm: formData.vrm,
                                                motStatus: formData.motStatus
                                            })
                                            set("description", res.text)
                                        } catch (err) {
                                            console.error("Failed to generate description:", err)
                                            alert("Failed to generate description. Please try again.")
                                        } finally {
                                            setIsGeneratingDesc(false)
                                        }
                                    }}
                                    disabled={isGeneratingDesc || (!formData.make && !formData.model && !formData.year)}
                                    className="mt-2 w-full justify-start rounded-lg bg-gradient-to-r from-indigo-600/10 to-violet-600/10 border border-indigo-500/20 p-3 flex items-center gap-3 hover:from-indigo-600/20 hover:to-violet-600/20 h-auto text-left"
                                >
                                    {isGeneratingDesc ? (
                                        <Loader2 size={16} className="text-indigo-400 shrink-0 animate-spin" />
                                    ) : (
                                        <Sparkles size={16} className="text-indigo-400 shrink-0" />
                                    )}
                                    <div>
                                        <p className="text-xs text-indigo-300 font-bold">
                                            {isGeneratingDesc ? "Generating magical description..." : "Auto-generate with AI"}
                                        </p>
                                        <p className="text-[10px] text-indigo-400/70">
                                            Click to draft a compelling description based on your vehicle details.
                                        </p>
                                    </div>
                                </Button>
                            </div>

                            {/* Condition */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-gray-400">Vehicle Condition</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                    {([
                                        { value: "EXCELLENT", label: "Excellent" },
                                        { value: "GOOD", label: "Good" },
                                        { value: "FAIR", label: "Fair" },
                                        { value: "POOR", label: "Poor" },
                                        { value: "CAT_S", label: "Cat S" },
                                        { value: "CAT_N", label: "Cat N" },
                                        { value: "CAT_C", label: "Cat C" },
                                        { value: "CAT_D", label: "Cat D" },
                                    ] as const).map((opt) => {
                                        const active = formData.condition === opt.value
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => set("condition", opt.value)}
                                                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${active ? "border-primary bg-primary/10 text-white" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"}`}
                                            >
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Service History */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-gray-400">Service History</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                    {([
                                        { value: "FULL", label: "Full History" },
                                        { value: "PARTIAL", label: "Partial History" },
                                        { value: "NONE", label: "No History" },
                                    ] as const).map((opt) => {
                                        const active = formData.serviceHistory === opt.value
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => set("serviceHistory", opt.value)}
                                                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${active ? "border-primary bg-primary/10 text-white" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"}`}
                                            >
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Ownership */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-gray-400">Number of Owners</label>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {([
                                        { value: "1", label: "1 Owner" },
                                        { value: "2", label: "2 Owners" },
                                        { value: "3+", label: "3+ Owners" },
                                    ] as const).map((opt) => {
                                        const active = formData.owners === opt.value
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => set("owners", opt.value)}
                                                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${active ? "border-primary bg-primary/10 text-white" : "border-white/10 bg-slate-900/50 text-gray-400 hover:border-white/20"}`}
                                            >
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Imported Vehicle Warning */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isImported}
                                        onChange={(e) => set("isImported", e.target.checked)}
                                        className="accent-primary h-4 w-4"
                                    />
                                    <span className="text-sm text-gray-300">This vehicle has been imported</span>
                                </label>
                                {formData.isImported && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                        <p className="text-red-400 text-sm font-semibold">⚠ Imported vehicles cannot be listed</p>
                                        <p className="text-red-400/70 text-xs mt-1">CarMazium currently does not accept imported vehicles. Please uncheck this option to continue.</p>
                                    </div>
                                )}
                            </div>

                            {/* HPI Bait Section (shown after VRM lookup) */}
                            {dvlaSuccess && (
                                <HpiBaitSection 
                                    isUnlocked={isHpiUnlocked} 
                                    onUnlock={() => setShowHpiModal(true)} 
                                />
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: Pricing ───────────────────────────────────────────────── */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Pricing</h2>

                            {/* Estimated Valuation Card */}
                            {valuation ? (
                                <div className="dealer-glass-card rounded-2xl border-purple-500/30 bg-gradient-to-br from-[#0A0A0C] to-slate-900 p-8 space-y-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 blur-3xl pointer-events-none" />
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                            <Sparkles className="text-purple-400 shrink-0" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-black font-heading uppercase tracking-widest text-sm">Proprietary Valuation</h3>
                                            <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Driven by Market Intelligence</p>
                                        </div>
                                    </div>

                                    {/* Price range */}
                                    <div className="relative z-10 pt-2 pb-1">
                                        <div className="inline-block relative">
                                            <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight drop-shadow-xl metallic-foil">
                                                {formatPrice(valuation.low)}
                                                <span className="text-gray-500 text-3xl mx-3 font-light">–</span>
                                                {formatPrice(valuation.high)}
                                            </p>
                                        </div>
                                        <p className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-wider flex items-center gap-2">
                                            <Activity size={12} className="text-emerald-400" /> Auto-Optimized Midpoint: <strong className="text-white">{formatPrice(valuation.mid)}</strong>
                                        </p>
                                    </div>

                                    {/* Factors breakdown */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                        <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center">Base Price
                                                    <InfoTooltip text={`Estimated new price minus 6% depreciation per year of age.`} />
                                                </p>
                                                <p className="text-gray-300 text-sm font-bold">{formatPrice(valuation.basePrice)}</p>
                                            </div>
                                        </div>
                                        {valuation.mileageAdjustmentVal !== 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center">Mileage Adj
                                                        <InfoTooltip text={`+/- 6% per 10k miles compared to the expected ${valuation.expectedMileage.toLocaleString()} miles.`} />
                                                    </p>
                                                    <p className={`text-sm font-bold ${valuation.mileageAdjustmentVal > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {valuation.mileageAdjustmentVal > 0 ? "+" : ""}{formatPrice(valuation.mileageAdjustmentVal)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.conditionAdjustmentVal !== 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Condition</p>
                                                    <p className={`text-sm font-bold ${valuation.conditionAdjustmentVal > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {valuation.conditionAdjustmentVal > 0 ? "+" : ""}{formatPrice(valuation.conditionAdjustmentVal)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.serviceAdjustmentVal !== 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Service History</p>
                                                    <p className={`text-sm font-bold ${valuation.serviceAdjustmentVal > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {valuation.serviceAdjustmentVal > 0 ? "+" : ""}{formatPrice(valuation.serviceAdjustmentVal)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.fuelAdjustmentVal !== 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Fuel Type</p>
                                                    <p className={`text-sm font-bold ${valuation.fuelAdjustmentVal > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {valuation.fuelAdjustmentVal > 0 ? "+" : ""}{formatPrice(valuation.fuelAdjustmentVal)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {valuation.ownershipAdjustmentVal !== 0 && (
                                            <div className="bg-white/5 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Owners</p>
                                                    <p className={`text-sm font-bold ${valuation.ownershipAdjustmentVal > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                                        {valuation.ownershipAdjustmentVal > 0 ? "+" : ""}{formatPrice(valuation.ownershipAdjustmentVal)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-gray-500">
                                        Calculated based on UK car market pricing algorithms. Note that transmission (+£1,000 for auto) and London/Major City location (+2-4%) are also factored in. You can override the values below.
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-4 items-center mt-4">
                                        <Button
                                            type="button"
                                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-12 w-full sm:w-auto px-6 uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all"
                                            onClick={() => {
                                                set("priceMin", valuation.mid.toString())
                                            }}
                                        >
                                            <Zap size={14} className="mr-2" /> Apply Intelligent Pricing
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center text-gray-500 text-sm">
                                    Complete vehicle details (make, year, mileage) to see an estimated valuation.
                                </div>
                            )}

                            {/* Asking Price */}
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                <p className="text-xs text-primary font-semibold mb-1">💰 Asking Price</p>
                                <p className="text-xs text-gray-400">Set your asking price. Buyers can submit offers with their own price range for you to accept or reject.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Your Asking Price (£) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">£</span>
                                    <Input type="number" placeholder="e.g. 20000" value={formData.priceMin}
                                        onChange={(e) => set("priceMin", e.target.value)}
                                        className={`${inputCls} pl-8 text-lg h-14`} />
                                </div>
                            </div>

                            {formData.priceMin && (() => {
                                const price = parseFloat(formData.priceMin)
                                if (!isNaN(price) && price > 0) {
                                    return (
                                        <p className="text-sm text-emerald-400">
                                            ✓ Asking Price: {formatPrice(formData.priceMin)}
                                        </p>
                                    )
                                }
                                return null
                            })()}

                            {/* ── Badge Plan Cards ───────────────────────────────── */}
                            <div className="pt-2">
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-3 flex items-center gap-2">
                                    <Shield size={16} className="text-primary" /> Seller Badges
                                </h3>
                                <p className="text-xs text-gray-500 mb-4">Boost buyer confidence with trust badges on your listing. Badges increase buyer engagement and sell rates.</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Free */}
                                    <button type="button"
                                        onClick={() => set('badgeTier', 'FREE')}
                                        className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'FREE'
                                            ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                            }`}
                                    >
                                        {formData.badgeTier === 'FREE' && <span className="absolute top-2 right-2 text-[10px] bg-primary text-black font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                        <p className="text-white font-bold text-sm mb-1">Free</p>
                                        <p className="text-2xl font-black text-white mb-3">£0</p>
                                        <ul className="space-y-1.5 text-xs text-gray-400">
                                            <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Standard listing</li>
                                            <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Offer range system</li>
                                            <li className="flex items-center gap-1.5 text-gray-600"><X size={12} /> No trust badges</li>
                                            <li className="flex items-center gap-1.5 text-gray-600"><X size={12} /> No featured boost</li>
                                        </ul>
                                    </button>

                                    {/* Standard */}
                                    <button type="button"
                                        onClick={() => set('badgeTier', 'STANDARD')}
                                        className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'STANDARD'
                                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                            }`}
                                    >
                                        {formData.badgeTier === 'STANDARD' && <span className="absolute top-2 right-2 text-[10px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                        <p className="text-blue-400 font-bold text-sm mb-1 flex items-center gap-1"><Shield size={14} /> Standard</p>
                                        <p className="text-2xl font-black text-white mb-3">£10</p>
                                        <ul className="space-y-1.5 text-xs text-gray-400">
                                            <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Everything in Free</li>
                                            <li className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-blue-400" /> VIN Report badge</li>
                                            <li className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-blue-400" /> Verified Seller badge</li>
                                            <li className="flex items-center gap-1.5 text-gray-600"><X size={12} /> No featured boost</li>
                                        </ul>
                                    </button>

                                    {/* Premium */}
                                    <button type="button"
                                        onClick={() => set('badgeTier', 'PREMIUM')}
                                        className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'PREMIUM'
                                            ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
                                            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                                            }`}
                                    >
                                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={10} /> Best Value</span>
                                        {formData.badgeTier === 'PREMIUM' && <span className="absolute top-2 right-2 text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                        <p className="text-amber-400 font-bold text-sm mb-1 mt-1 flex items-center gap-1"><Star size={14} /> Premium</p>
                                        <p className="text-2xl font-black text-white mb-3">£25</p>
                                        <ul className="space-y-1.5 text-xs text-gray-400">
                                            <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Everything in Standard</li>
                                            <li className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Featured boost (28 days)</li>
                                            <li className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Priority in search results</li>
                                            <li className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Featured badge on listing</li>
                                        </ul>
                                    </button>
                                </div>

                                {formData.badgeTier !== 'FREE' && (
                                    <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1">
                                        <CheckCircle size={12} /> Payment is bypassed during beta — badges are applied immediately at no charge.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Review ────────────────────────────────────────────────── */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-white/10 pb-4 text-white">Review Your Listing</h2>

                            {/* Vehicle Info */}
                            <SummarySection title="Vehicle Identity" onEdit={() => goToStep(1)}>
                                {isHpiUnlocked && (
                                    <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2">
                                         <CheckCircle className="text-emerald-400" size={16} />
                                         <span className="text-sm text-emerald-300 font-bold tracking-wide">HPI Checked & Verified</span>
                                    </div>
                                )}
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
                            <SummarySection title="Technical Specs" onEdit={() => goToStep(1)}>
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
                                    {formData.co2Emissions && <SummaryField label="CO₂" value={formData.co2Emissions + " g/km"} />}
                                </div>
                                {/* DVLA Data */}
                                {(formData.motStatus || formData.taxStatus || formData.monthOfFirstRegistration) && (
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <p className="text-[10px] text-blue-400 uppercase font-bold mb-2 flex items-center gap-1"><Shield size={10} /> DVLA Data</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {formData.motStatus && <SummaryField label="MOT Status" value={formData.motStatus} />}
                                            {formData.motExpiryDate && <SummaryField label="MOT Expiry" value={formData.motExpiryDate} />}
                                            {formData.taxStatus && <SummaryField label="Tax Status" value={formData.taxStatus} />}
                                            {formData.taxDueDate && <SummaryField label="Tax Due" value={formData.taxDueDate} />}
                                            {formData.monthOfFirstRegistration && <SummaryField label="First Registered" value={formData.monthOfFirstRegistration} />}
                                            {formData.dateOfLastV5CIssued && <SummaryField label="Last V5C Issued" value={formData.dateOfLastV5CIssued} />}
                                            {formData.primaryColour && <SummaryField label="Primary Colour" value={formData.primaryColour} />}
                                            {formData.wheelplan && <SummaryField label="Wheelplan" value={formData.wheelplan} />}
                                            {formData.typeApproval && <SummaryField label="Type Approval" value={formData.typeApproval} />}
                                            {formData.markedForExport !== null && <SummaryField label="Export" value={formData.markedForExport ? "Yes" : "No"} />}
                                        </div>
                                    </div>
                                )}
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
                            <SummarySection title="Pricing" onEdit={() => goToStep(3)}>
                                <div className="flex flex-col gap-2">
                                    <p className="text-white font-black text-2xl">
                                        {formatPrice(formData.priceMin)}
                                    </p>
                                    <p className="text-primary text-xs font-bold uppercase">Asking Price</p>
                                    {valuation && (
                                        <p className="text-gray-500 text-xs">Estimated market value: {formatPrice(valuation.low)} – {formatPrice(valuation.high)}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {formData.badgeTier === 'FREE' && (
                                            <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-md">Free Listing</span>
                                        )}
                                        {formData.badgeTier === 'STANDARD' && (
                                            <>
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1"><BadgeCheck size={10} /> Standard — £10</span>
                                                <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md">VIN Report</span>
                                                <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md">Verified</span>
                                            </>
                                        )}
                                        {formData.badgeTier === 'PREMIUM' && (
                                            <>
                                                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1"><Star size={10} /> Premium — £25</span>
                                                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">VIN Report</span>
                                                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">Verified</span>
                                                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">Featured</span>
                                            </>
                                        )}
                                    </div>
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
                        {currentStep < 4
                            ? <Button onClick={handleNext} className="px-7 shadow-neon">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            : <Button onClick={handleSubmit} disabled={isSubmitting}
                                className="px-7 bg-emerald-600 hover:bg-emerald-700 border-none shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50">
                                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publishing...</> : <>Publish <CheckCircle className="ml-2 h-4 w-4" /></>}
                            </Button>
                        }
                    </div>
                </div>
            </div>
        </div >
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
