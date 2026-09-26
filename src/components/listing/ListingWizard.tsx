"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import {
    Car, Camera, List, DollarSign, CheckCircle,
    ArrowRight, ArrowLeft, Loader2, Search,
    BadgeCheck, TrendingDown, Upload, Eye, X,
    Shield, Star, Sparkles, Zap, MapPin, LocateFixed, Edit, Info, Handshake, CreditCard, AlertTriangle, ChevronDown, Lock, FileText, Activity, Gavel, Clock, RotateCcw
} from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/listing/ImageUpload"
import { PendingReviewModal } from "@/components/listing/PendingReviewModal"
import {
    createListing, formatPrice, getDamageRecords,
    type CreateListingRequest, type BodyTypeValue,
    type EuroStandardValue, type VehicleTypeValue,
    createHpiCheckoutSession, createListingCheckoutSession, publishListing,
    getRetailConversionCandidate, convertAuctionToRetail,
    type RetailConversionCandidate
} from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"
import { getSessionStatus, applyHpiFee } from "@/lib/paymentApi"
import { dvlaLookup } from "@/lib/dvlaApi"
import { aiGenerateDescription } from "@/lib/aiApi"
import { BODY_TYPE_ICONS, BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"
import { CAR_MAKES, getModelsForMake, getVariantsForModel } from "@/lib/carData"
import { useAuth } from "@/context/AuthContext"
import { useAnalytics } from "@/hooks/useAnalytics"
import { SELLER_FUNNEL, listingTypeLabel } from "@/lib/gtm"
import { VehicleDamageMapper, type DamageRecord } from "./VehicleDamageMapper"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/apiClient"
import { getAuctionOpeningBid, getAuctionReserveGuide } from "@/lib/auctionPricing"
import { applyVehicleValuationAdjustments, getVehicleValuation, type VehicleValuation } from "@/lib/valuationApi"
import { computeExteriorGradeFromDefectCount } from "@/lib/exteriorGrade"
import { VehicleValuationCard } from "./VehicleValuationCard"

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
    mechanicalIssues: string
    electricalIssues: string
    owners: string
    isDepartedSale: boolean
    departedRelationship: string
    isImported: boolean
    // Delivery Options (Phase 15)
    deliveryAvailable: boolean
    deliveryPricePerMile: string
    deliveryMaxMiles: string
    // Extended vehicle details
    variant: string
    driveType: string
    numberOfKeys: string
    torqueNm: string
    topSpeedMph: string
    zeroTo60Mph: string
    combinedMpg: string
    extraUrbanMpg: string
    // Legal declarations (Write-Off & Compliance)
    writeOffCategory: 'CAT_A' | 'CAT_B' | 'CAT_S' | 'CAT_N' | 'NONE' | ''
    stolenRecovered: boolean | null
    hasOutstandingFinance: boolean | null
    isLegalRegisteredKeeper: boolean | null
    notOwnerRelationship: string
    declarationAcknowledged: boolean
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
    videoUrls: string[]
    // Step 3 — Pricing (3-tier seller evaluation)
    priceMin: string      // Lower bound — minimum the seller will accept
    priceAsking: string   // Asking price — displayed publicly on the listing
    badgeTier: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM'
    bannerLabel: string
    status: "DRAFT" | "ACTIVE"
    listingType: "CLASSIFIED" | "AUCTION"
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

const BANNER_LABELS = [
    { value: 'Special Offer',       color: 'bg-primary/90' },
    { value: 'Limited Time Offer',  color: 'bg-rose-600/90' },
    { value: 'Manager\'s Special',  color: 'bg-amber-600/90' },
    { value: 'Below Market Value',  color: 'bg-emerald-600/90' },
    { value: 'Weekend Deal',        color: 'bg-violet-600/90' },
    { value: '5% Discount',         color: 'bg-emerald-600/90' },
    { value: '10% Discount',        color: 'bg-emerald-600/90' },
    { value: '15% Discount',        color: 'bg-emerald-600/90' },
    { value: 'Save £500',           color: 'bg-emerald-600/90' },
    { value: 'Save £1,000',         color: 'bg-emerald-600/90' },
] as const

const RELATIONSHIP_OPTIONS = [
    { value: 'Son',              label: 'Son' },
    { value: 'Daughter',         label: 'Daughter' },
    { value: 'Sibling',          label: 'Sibling' },
    { value: 'Spouse',           label: 'Spouse' },
    { value: 'Executor of Will', label: 'Executor of Will' },
    { value: 'Solicitor',        label: 'Solicitor' },
    { value: 'Other',            label: 'Other' },
] as const

const NOT_OWNER_RELATIONSHIP_OPTIONS = [
    { value: 'Family member',                    label: 'Family member' },
    { value: 'Friend',                            label: 'Friend' },
    { value: 'Employer',                          label: 'Employer' },
    { value: "Selling with owner's permission",   label: "Selling with owner's permission" },
    { value: 'Other',                             label: 'Other' },
] as const

const INITIAL_FORM: FormData = {
    vehicleType: "CAR", vrm: "", vin: "", make: "", model: "", year: "", bodyType: "", location: "",
    mileage: "", fuelType: "", transmission: "", color: "",
    doors: "", seats: "", engineSize: "", bhp: "",
    features: [], description: "", title: "",
    condition: "", serviceHistory: "", mechanicalIssues: "", electricalIssues: "", owners: "", isDepartedSale: false, departedRelationship: "", isImported: false,
    deliveryAvailable: false, deliveryPricePerMile: '', deliveryMaxMiles: '',
    variant: "", driveType: "", numberOfKeys: "",
    torqueNm: "", topSpeedMph: "", zeroTo60Mph: "", combinedMpg: "", extraUrbanMpg: "",
    writeOffCategory: "", stolenRecovered: null, hasOutstandingFinance: null, isLegalRegisteredKeeper: null, notOwnerRelationship: "", declarationAcknowledged: false,
    ulezCompliant: null, euroStandard: "", co2Emissions: "",
    motStatus: "", taxStatus: "", motExpiryDate: "", taxDueDate: "",
    markedForExport: null, monthOfFirstRegistration: "",
    wheelplan: "", typeApproval: "", motHistory: [],
    primaryColour: "",
    dateOfLastV5CIssued: "",
    images: [],
    videoUrls: [],
    priceMin: "", priceAsking: "", badgeTier: 'BASIC', bannerLabel: "", status: "DRAFT", listingType: "CLASSIFIED",
}

function getValuationBaseKey(data: Partial<FormData>, excludeListingId?: string | null) {
    return [
        String(data.vrm || '').replace(/\s/g, '').toUpperCase(),
        String(data.make || '').trim().toUpperCase(),
        String(data.model || '').trim().toUpperCase(),
        String(data.year || '').trim(),
        String(data.mileage || '').replace(/[^0-9]/g, ''),
        excludeListingId || '',
    ].join('|')
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function addHours(isoString: string, hours: number): string {
    const d = new Date(new Date(isoString).getTime() + hours * 60 * 60 * 1000)
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function SelectField({
    label, value, onChange, options, required = false, error = false
}: {
    label: string; value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; required?: boolean; error?: boolean
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold uppercase text-[var(--text-muted)]">{label}{required && " *"}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full h-10 rounded-md border bg-[var(--bg-input)] px-3 text-base md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${error ? 'border-red-500' : 'border-[var(--border-default)]'}`}
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
            <Info size={12} className="text-[var(--text-muted)] group-hover/tip:text-blue-400 transition-colors" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] px-3 py-2.5 text-xs text-[var(--text-secondary)] leading-relaxed shadow-xl opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all duration-200 z-50 pointer-events-none">
                {text}
                <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
            </span>
        </span>
    )
}

// ─── Optional HPI Section ─────────────────────────────────────────────────────

function HpiBaitSection({ isUnlocked, onUnlock }: { isUnlocked: boolean, onUnlock: () => void }) {
    if (isUnlocked) {
        // Payment succeeded, but the report itself is prepared by our team
        // after review — nothing has actually been checked yet at this point,
        // so this must not claim a clean result before one exists.
        return (
            <div className="mt-8 relative overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex flex-col items-center text-center">
                 <div className="flex items-center gap-3">
                     <Clock className="text-blue-400" size={20} />
                     <h3 className="text-base font-bold text-blue-300">HPI Report Requested</h3>
                 </div>
                 <p className="text-xs text-[var(--text-muted)] mt-1">Our team will prepare your vehicle history report during review.</p>
            </div>
        )
    }

    return (
        <div className="mt-8">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] overflow-hidden flex flex-col md:flex-row shadow-2xl">
                {/* Left side: Image with blur */}
                <div className="relative w-full md:w-2/5 aspect-[4/3] md:aspect-auto cursor-pointer group" onClick={onUnlock}>
                    <Image
                        src="/assets/images/Hpi Template.jpg"
                        alt="HPI Report Preview"
                        fill
                        className="object-cover blur-[6px] opacity-70 group-hover:blur-sm group-hover:opacity-90 transition-all duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 group-hover:bg-slate-900/10 transition-colors" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
                        <div className="bg-white/10 backdrop-blur-md p-4 rounded-full text-white shadow-neon border border-white/20">
                            <Lock size={28} />
                        </div>
                        <span className="text-white font-bold tracking-wider text-sm drop-shadow-md">CLICK TO UNLOCK</span>
                    </div>
                </div>

                {/* Right side: Content */}
                <div className="p-6 md:p-8 flex-1 flex flex-col justify-center text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                        <Shield className="text-blue-400 shrink-0" size={32} />
                        <h3 className="text-[var(--text-primary)] font-bold text-xl">Official HPI Vehicle Check</h3>
                    </div>
                    
                    <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">
                        Add a CarMazium vehicle history report if you want extra reassurance for buyers. It is optional and does not block publishing.
                    </p>
                    
                    <div className="flex flex-col items-center md:items-start gap-3 mt-auto">
                        <Button type="button" onClick={onUnlock} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-8 py-6 text-base shadow-neon shrink-0 w-full sm:w-auto border-0">
                            Request HPI Report (Optional)
                        </Button>
                        <p className="text-xs text-[var(--text-muted)] italic flex items-center gap-1.5">
                            <BadgeCheck size={14} className="text-emerald-400" />
                            Optional for both Auction and Retail listings
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ListingWizard({ isDashboard = false }: { isDashboard?: boolean }) {
    const { user, profile, loading: authLoading } = useAuth()
    const { trackEvent } = useAnalytics()
    const router = useRouter()

    const hasAiSharingConsent = React.useCallback(() => {
        if (typeof window === "undefined") return false
        return window.localStorage.getItem("mazium_ai_consent_v1") === "accepted"
    }, [])

    const ensureAiSharingConsent = React.useCallback(() => {
        if (hasAiSharingConsent()) return true
        const accepted = window.confirm(
            "AI data sharing\n\nTo generate the description, CarMazium will send the vehicle details you entered, including the registration where available, to OpenAI. AI can make mistakes, so review the result before publishing.\n\nDo you consent to this AI processing?"
        )
        if (accepted) {
            window.localStorage.setItem("mazium_ai_consent_v1", "accepted")
        }
        return accepted
    }, [hasAiSharingConsent])

    const [currentStep, setCurrentStep] = React.useState(1)
    const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM)
    // Tracks "the user explicitly chose Other" independently of whether the
    // field has anything typed in it yet — deriving that purely from the
    // field being non-empty meant picking Other (which resets the field to
    // "") made the custom input immediately un-render itself, so "Other"
    // silently did nothing and the dropdown snapped back to the placeholder.
    const [manualMakeEntry, setManualMakeEntry] = React.useState(false)
    const [manualModelEntry, setManualModelEntry] = React.useState(false)
    const [manualVariantEntry, setManualVariantEntry] = React.useState(false)
    const [sellingMethod, setSellingMethod] = React.useState<"list" | null>(null)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [pendingReview, setPendingReview] = React.useState<{ title: string; onContinue: () => void } | null>(null)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState<string | null>(null)
    const [dvlaLoading, setDvlaLoading] = React.useState(false)
    const [dvlaError, setDvlaError] = React.useState<string | null>(null)
    const [dvlaSuccess, setDvlaSuccess] = React.useState(false)
    const [geoLoading, setGeoLoading] = React.useState(false)
    const [isGeneratingDesc, setIsGeneratingDesc] = React.useState(false)
    const [baseValuation, setBaseValuation] = React.useState<VehicleValuation | null>(null)
    const [valuation, setValuation] = React.useState<VehicleValuation | null>(null)
    const valuationBaseKeyRef = React.useRef<string | null>(null)
    const [valuationLoading, setValuationLoading] = React.useState(false)
    const [valuationError, setValuationError] = React.useState<string | null>(null)
    // A non-PII journey key links a valuation to a later listing submission.
    // Keep it outside FormData so it never becomes vehicle/listing data.
    const valuationJourneyIdRef = React.useRef<string | null>(null)
    const valuationJourneyVrmRef = React.useRef<string | null>(null)
    const [retailConversion, setRetailConversion] = React.useState<{
        candidate: RetailConversionCandidate
        payload: CreateListingRequest
    } | null>(null)
    const [isConvertingToRetail, setIsConvertingToRetail] = React.useState(false)

    // HPI Payment State
    const [showHpiModal, setShowHpiModal] = React.useState(false)
    const [isHpiUnlocked, setIsHpiUnlocked] = React.useState(false)
    const [existingAuctionStatus, setExistingAuctionStatus] = React.useState<string | null>(null)
    const [isVerifyingHpiPayment, setIsVerifyingHpiPayment] = React.useState(false)
    const [hpiVerifyError, setHpiVerifyError] = React.useState<string | null>(null)
    const [isProcessingPayment, setIsProcessingPayment] = React.useState(false)
    const [draftListingId, setDraftListingId] = React.useState<string | null>(null)
    const [damageImageCount, setDamageImageCount] = React.useState(0)
    const [damageRecords, setDamageRecords] = React.useState<DamageRecord[]>([])
    const [hasAttemptedNext, setHasAttemptedNext] = React.useState(false)
    const [auctionSchedule, setAuctionSchedule] = React.useState({
        startTime: '',
        reservePrice: '',
        startingBid: '',
        minIncrement: '100',
        buyItNowPrice: '',
    })


    // Edit mode — detect from URL params
    const searchParams = useSearchParams()
    const draftRestoreAttemptedRef = React.useRef(false)
    const quickSellModeAppliedRef = React.useRef<string | null>(null)
    const editId = searchParams.get('editId')
    const editSlug = searchParams.get('editSlug')
    const [editLoading, setEditLoading] = React.useState(false)
    const [videoUrlInput, setVideoUrlInput] = React.useState("")
    const [videoUrlError, setVideoUrlError] = React.useState("")

    // Departed sale — ephemeral UI state for dropdown + freetext
    const [departedRelSelect, setDepartedRelSelect] = React.useState<string>('')
    const [departedRelOther, setDepartedRelOther] = React.useState<string>('')

    // Not the legal registered keeper — ephemeral UI state for dropdown + freetext
    const [notOwnerRelSelect, setNotOwnerRelSelect] = React.useState<string>('')
    const [notOwnerRelOther, setNotOwnerRelOther] = React.useState<string>('')

    // Pre-fill form when editing an existing listing
    React.useEffect(() => {
        if (!editId) return
        setEditLoading(true)
        apiClient<{ data: any }>(`/listings/${editSlug || editId}`)
            .then(res => {
                const l = res.data
                setFormData(prev => ({
                    ...prev,
                    vrm: l.vrm || '',
                    make: l.make || '',
                    model: l.model || '',
                    year: l.year ? String(l.year) : '',
                    mileage: l.mileage ? String(l.mileage) : '',
                    fuelType: l.fuelType || '',
                    transmission: l.transmission || '',
                    color: l.color || '',
                    bodyType: l.bodyType || '',
                    doors: l.doors ? String(l.doors) : '',
                    seats: l.seats ? String(l.seats) : '',
                    engineSize: l.engineSize ? String(l.engineSize) : '',
                    bhp: l.bhp ? String(l.bhp) : '',
                    features: l.features || [],
                    description: l.description || '',
                    title: l.title || '',
                    condition: l.condition || '',
                    location: l.location || '',
                    motStatus: l.motStatus || '',
                    taxStatus: l.taxStatus || '',
                    motExpiryDate: l.motExpiryDate || '',
                    taxDueDate: l.taxDueDate || '',
                    monthOfFirstRegistration: l.monthOfFirstRegistration || '',
                    euroStandard: l.euroStandard || '',
                    co2Emissions: l.co2Emissions ? String(l.co2Emissions) : '',
                    ulezCompliant: l.ulezCompliant ?? null,
                    markedForExport: l.markedForExport ?? null,
                    wheelplan: l.wheelplan || '',
                    typeApproval: l.typeApproval || '',
                    images: l.images || [],
                    videoUrls: l.videoUrls || [],
                    priceMin: l.priceMin ? String(l.priceMin) : '',
                    priceAsking: l.price ? String(l.price) : '',
                    status: l.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
                    badgeTier: l.badgeTier || 'BASIC',
                    // Fields missing from original prefill
                    vin: l.vin || '',
                    vehicleType: l.vehicleType || 'CAR',
                    isImported: l.isImported ?? false,
                    stolenRecovered: l.stolenRecovered ?? null,
                    hasOutstandingFinance: l.hasOutstandingFinance ?? null,
                    isLegalRegisteredKeeper: l.isLegalRegisteredKeeper ?? null,
                    writeOffCategory: (l.writeOffCategory || 'NONE') as FormData['writeOffCategory'],
                    listingType: (l.type || 'CLASSIFIED') as 'CLASSIFIED' | 'AUCTION',
                    serviceHistory: l.serviceHistory || '',
                    mechanicalIssues: l.mechanicalIssues || '',
                    electricalIssues: l.electricalIssues || '',
                    owners: l.owners ? String(l.owners) : '',
                    variant: l.variant || '',
                    driveType: l.driveType || '',
                    numberOfKeys: l.numberOfKeys ? String(l.numberOfKeys) : '',
                    torqueNm: l.torqueNm ? String(l.torqueNm) : '',
                    topSpeedMph: l.topSpeedMph ? String(l.topSpeedMph) : '',
                    zeroTo60Mph: l.zeroTo60Mph ? String(l.zeroTo60Mph) : '',
                    combinedMpg: l.combinedMpg ? String(l.combinedMpg) : '',
                    extraUrbanMpg: l.extraUrbanMpg ? String(l.extraUrbanMpg) : '',
                    deliveryAvailable: l.deliveryAvailable ?? false,
                    deliveryPricePerMile: l.deliveryPricePerMile ? String(l.deliveryPricePerMile) : '',
                    deliveryMaxMiles: l.deliveryMaxMiles ? String(l.deliveryMaxMiles) : '',
                }))
                // Jump straight to step 1 (already pre-filled)
                setIsHpiUnlocked(!!l.hpiReport)
                setDvlaSuccess(true)
                setExistingAuctionStatus(l.auction?.status ?? null)
                if (l.type === 'AUCTION') {
                    const now = Date.now()
                    const auctionStart = l.auction?.startTime ? new Date(l.auction.startTime) : null
                    setAuctionSchedule({
                        startTime: auctionStart && auctionStart.getTime() > now
                            ? auctionStart.toISOString().slice(0, 16)
                            : 'NOW',
                        reservePrice: l.auction?.reservePrice ? String(l.auction.reservePrice) : '',
                        startingBid: l.auction?.startingBid ? String(l.auction.startingBid) : '',
                        minIncrement: l.auction?.minIncrement ? String(l.auction.minIncrement) : '100',
                        buyItNowPrice: l.auction?.buyItNowPrice ? String(l.auction.buyItNowPrice) : '',
                    })
                }
                setSellingMethod('list')
                setCurrentStep(1)

                // Load existing damage records
                return getDamageRecords(editId!)
            })
            .then(damageData => {
                if (!damageData) return
                const mapped = damageData.map((r: any) => ({
                    id: crypto.randomUUID(),
                    zone: r.part,
                    description: r.type || '',
                    photoUrl: r.imageUrl || undefined,
                    bodyType: r.bodyType || '',
                    view: (r.coords?.view ?? 'TOP') as 'TOP' | 'FRONT',
                    x: r.coords?.x ?? 0,
                    y: r.coords?.y ?? 0,
                }))
                setDamageRecords(mapped)
            })
            .catch(err => console.error('Failed to load listing for edit:', err))
            .finally(() => setEditLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editId])

    // Restore an ordinary browser draft after refresh/navigation, not only
    // after returning from HPI checkout. Edit mode owns its own server-backed
    // prefill and HPI-return has a dedicated restoration path below, so neither
    // should be overwritten by a stale local draft.
    React.useEffect(() => {
        if (draftRestoreAttemptedRef.current) return
        if (editId || searchParams.get('hpi_success') === 'true' || searchParams.get('sellMode')) return
        draftRestoreAttemptedRef.current = true

        const saved = localStorage.getItem('carmazium_listing_draft')
        if (!saved) return

        try {
            const parsed = JSON.parse(saved) as Partial<FormData>
            if (!parsed.vrm) return

            const urlVrm = searchParams.get('vrm')
            const normaliseVrm = (value: string) => value.replace(/\s/g, '').toUpperCase()
            if (urlVrm && normaliseVrm(urlVrm) !== normaliseVrm(parsed.vrm)) return

            setFormData(prev => ({ ...prev, ...parsed }))
            setSellingMethod('list')

            const savedStep = Number(localStorage.getItem('carmazium_listing_draft_step'))
            const maxStep = parsed.listingType === 'AUCTION' ? 5 : 4
            setCurrentStep(
                Number.isInteger(savedStep) && savedStep >= 1
                    ? Math.min(savedStep, maxStep)
                    : 1
            )

            const savedDraftId = localStorage.getItem('carmazium_hpi_draft_id')
            if (savedDraftId) setDraftListingId(savedDraftId)
        } catch (error) {
            console.error('Failed to restore saved listing draft:', error)
            localStorage.removeItem('carmazium_listing_draft')
            localStorage.removeItem('carmazium_listing_draft_step')
        }
    }, [editId, searchParams])

    // Handle Stripe return for HPI — verify the session actually completed
    // instead of trusting the bare `hpi_success` URL flag (which anyone could
    // navigate to directly, e.g. after a cancelled checkout), and fall back to
    // triggering report generation ourselves in case the webhook was delayed
    // or dropped — otherwise the UI could show "unlocked" with no report ever
    // having been generated server-side.
    React.useEffect(() => {
        const hpiSuccess = searchParams.get('hpi_success') === 'true'
        const urlVrm = searchParams.get('vrm')
        const sessionId = searchParams.get('session_id')

        if (!hpiSuccess) return

        // Restore form data from localStorage if available
        const saved = localStorage.getItem('carmazium_listing_draft')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setFormData(parsed)
                setSellingMethod('list')
                setCurrentStep(2) // Return to media step where HPI is
            } catch (e) {
                console.error("Failed to parse saved draft", e)
            }
        }
        // Restore draft listing ID if present
        const savedDraftId = localStorage.getItem('carmazium_hpi_draft_id')
        if (savedDraftId) setDraftListingId(savedDraftId)
        if (urlVrm && !formData.vrm) {
            setFormData(prev => ({ ...prev, vrm: urlVrm }))
        }

        if (!sessionId) {
            setHpiVerifyError("Couldn't verify your payment — no session reference found.")
            return
        }

        setIsVerifyingHpiPayment(true)
        setHpiVerifyError(null)
        getSessionStatus(sessionId)
            .then(status => {
                if (status.paymentStatus !== 'paid') {
                    setHpiVerifyError("We couldn't confirm your HPI report payment. If you were charged, please contact support.")
                    return
                }
                // Idempotent — safe even if the webhook already generated the report.
                return applyHpiFee(sessionId).then(() => setIsHpiUnlocked(true))
            })
            .catch(() => setHpiVerifyError("Couldn't verify your payment. Please refresh or contact support if you were charged."))
            .finally(() => setIsVerifyingHpiPayment(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams])

    // Persist the form and the seller's current step so a normal browser
    // refresh resumes where they were instead of dropping back to method choice.
    React.useEffect(() => {
        if (sellingMethod === 'list' && formData.vrm) {
            localStorage.setItem('carmazium_listing_draft', JSON.stringify(formData))
            localStorage.setItem('carmazium_listing_draft_step', String(currentStep))
        }
    }, [formData, sellingMethod, currentStep])

    const handleStartFresh = () => {
        const confirmed = window.confirm(
            'Start a fresh listing? This will clear all unsaved vehicle details, photos, pricing and auction settings from this form.'
        )
        if (!confirmed) return

        // Clear every browser-side draft reference first so the reset cannot be
        // restored on the next render or after a refresh.
        localStorage.removeItem('carmazium_listing_draft')
        localStorage.removeItem('carmazium_listing_draft_step')
        localStorage.removeItem('carmazium_hpi_draft_id')
        draftRestoreAttemptedRef.current = true

        // Reset the listing itself and all wizard-only state. Existing server
        // drafts are deliberately not deleted here; this action clears the
        // current unsaved form without silently destroying a saved listing.
        setFormData({ ...INITIAL_FORM, features: [], images: [], videoUrls: [], motHistory: [] })
        setCurrentStep(1)
        setSellingMethod(null)
        setManualMakeEntry(false)
        setManualModelEntry(false)
        setManualVariantEntry(false)
        setShowHpiModal(false)
        setIsHpiUnlocked(false)
        setExistingAuctionStatus(null)
        setIsVerifyingHpiPayment(false)
        setHpiVerifyError(null)
        setIsProcessingPayment(false)
        setDraftListingId(null)
        setDamageImageCount(0)
        setDamageRecords([])
        setHasAttemptedNext(false)
        setAuctionSchedule({
            startTime: '',
            reservePrice: '',
            startingBid: '',
            minIncrement: '100',
            buyItNowPrice: '',
        })
        setVideoUrlInput('')
        setVideoUrlError('')
        setDepartedRelSelect('')
        setDepartedRelOther('')
        setNotOwnerRelSelect('')
        setNotOwnerRelOther('')
        setDvlaLoading(false)
        setDvlaError(null)
        setDvlaSuccess(false)
        setBaseValuation(null)
        valuationBaseKeyRef.current = null
        setValuation(null)
        setValuationLoading(false)
        setValuationError(null)
        valuationJourneyIdRef.current = null
        valuationJourneyVrmRef.current = null
        setSubmitError(null)

        // Strip HPI/edit/query parameters so a stale URL cannot repopulate the
        // newly-cleared form.
        router.replace(window.location.pathname, { scroll: false })
    }


    const isAuthenticated = !!user
    const isEmailVerified = !!user?.email_confirmed_at
    const isVerifiedDealer = profile?.role === 'DEALER' && !!profile?.dealerProfile?.isVerified

    // Header quick navigation can take a seller straight into the requested
    // listing channel. Keep edit/HPI flows authoritative and apply the shortcut
    // only once per requested mode.
    React.useEffect(() => {
        if (isDashboard || editId || searchParams.get('hpi_success') === 'true') return

        const sellMode = searchParams.get('sellMode')
        if (sellMode !== 'retail' && sellMode !== 'auction') return
        if (quickSellModeAppliedRef.current === sellMode) return

        if (!isAuthenticated) {
            setShowLoginModal(true)
            return
        }
        if (!isEmailVerified) {
            router.push('/auth/onboarding')
            return
        }
        if (profile?.role === 'DEALER' && !isVerifiedDealer) {
            router.push('/dashboard/dealer')
            return
        }

        const listingType: FormData['listingType'] = sellMode === 'auction' ? 'AUCTION' : 'CLASSIFIED'
        quickSellModeAppliedRef.current = sellMode
        draftRestoreAttemptedRef.current = true
        setFormData(prev => ({
            ...prev,
            listingType,
            badgeTier: listingType === 'AUCTION' ? 'FREE' : 'BASIC',
            status: 'ACTIVE',
        }))
        setSellingMethod('list')
        setCurrentStep(1)
        setHasAttemptedNext(false)

        trackEvent(SELLER_FUNNEL.LISTING_STARTED, {
            listing_type: sellMode,
            seller_role: profile?.role || 'UNKNOWN',
            entry_point: 'header_quick_navigation',
            valuation_id: valuationJourneyIdRef.current || undefined,
        })
    }, [
        editId,
        isAuthenticated,
        isDashboard,
        isEmailVerified,
        isVerifiedDealer,
        profile?.role,
        router,
        searchParams,
        trackEvent,
    ])

    const set = <K extends keyof FormData>(key: K, val: FormData[K]) =>
        setFormData(prev => ({ ...prev, [key]: val }))

    const isAuction = formData.listingType === 'AUCTION'
    const automaticExteriorGrade = computeExteriorGradeFromDefectCount(damageRecords.length)

    // The market lookup is intentionally based only on stable vehicle identity.
    // Seller answers below (fuel, gearbox, condition, keys, service history,
    // compliance, damage grade and equipment) adjust that base locally; they do
    // not trigger another market search.
    const valuationReady =
        formData.vehicleType === 'CAR' &&
        !!formData.make &&
        !!formData.model &&
        Number(formData.year) >= 1950 &&
        formData.mileage !== '' &&
        Number(formData.mileage) >= 0

    const currentValuationBaseKey = getValuationBaseKey(formData, editId)

    React.useEffect(() => {
        if (!valuationReady) {
            setBaseValuation(null)
            valuationBaseKeyRef.current = null
            setValuation(null)
            setValuationError(null)
            setValuationLoading(false)
            return
        }

        // A valuation supplied by the landing-page registration/mileage lookup
        // is already the correct base. Do not ask the market again.
        if (baseValuation && valuationBaseKeyRef.current === currentValuationBaseKey) {
            return
        }

        setBaseValuation(null)
        setValuation(null)
        valuationBaseKeyRef.current = null

        let cancelled = false
        const timer = window.setTimeout(() => {
            setValuationLoading(true)
            setValuationError(null)

            getVehicleValuation({
                make: formData.make,
                model: formData.model,
                year: Number(formData.year),
                mileage: Number(formData.mileage),
                excludeListingId: editId || undefined,
            })
                .then((result) => {
                    if (cancelled) return
                    valuationBaseKeyRef.current = currentValuationBaseKey
                    setBaseValuation(result)

                    const normalizedVrm = formData.vrm.replace(/\s/g, "").toUpperCase()
                    if (
                        !valuationJourneyIdRef.current
                        || valuationJourneyVrmRef.current !== normalizedVrm
                    ) {
                        valuationJourneyIdRef.current = crypto.randomUUID()
                        valuationJourneyVrmRef.current = normalizedVrm
                        trackEvent(SELLER_FUNNEL.VALUATION_REQUESTED, {
                            valuation_id: valuationJourneyIdRef.current,
                            entry_point: isDashboard ? "dashboard_listing_wizard" : "listing_wizard",
                            listing_type: listingTypeLabel(formData.listingType),
                            make: formData.make || undefined,
                            model: formData.model || undefined,
                            year: Number(formData.year) || undefined,
                            valuation_source: result.source,
                        })
                    }
                })
                .catch((error: any) => {
                    if (cancelled) return
                    console.error('Base vehicle valuation failed:', error)
                    setBaseValuation(null)
                    setValuation(null)
                    setValuationError(error?.message || 'Valuation unavailable')
                })
                .finally(() => {
                    if (!cancelled) setValuationLoading(false)
                })
        }, 550)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [
        valuationReady,
        currentValuationBaseKey,
        formData.vrm,
        formData.make,
        formData.model,
        formData.year,
        formData.mileage,
        formData.listingType,
        editId,
        isDashboard,
        trackEvent,
        baseValuation,
    ])

    React.useEffect(() => {
        if (!baseValuation) return

        setValuation(applyVehicleValuationAdjustments(baseValuation, {
            make: formData.make,
            model: formData.model,
            year: Number(formData.year),
            mileage: Number(formData.mileage),
            variant: formData.variant || undefined,
            fuelType: formData.fuelType || undefined,
            transmission: formData.transmission || undefined,
            condition: formData.condition || undefined,
            exteriorGrade: automaticExteriorGrade,
            serviceHistory: formData.serviceHistory || undefined,
            owners: formData.owners || undefined,
            numberOfKeys: formData.numberOfKeys ? Number(formData.numberOfKeys) : undefined,
            ulezCompliant: formData.ulezCompliant ?? undefined,
            euroStandard: formData.euroStandard || undefined,
            doors: formData.doors ? Number(formData.doors) : undefined,
            seats: formData.seats ? Number(formData.seats) : undefined,
            features: formData.features.length ? formData.features : undefined,
            writeOffCategory: formData.writeOffCategory || undefined,
            isImported: formData.isImported,
        }))
    }, [
        baseValuation,
        formData.make,
        formData.model,
        formData.year,
        formData.mileage,
        formData.variant,
        formData.fuelType,
        formData.transmission,
        formData.condition,
        automaticExteriorGrade,
        formData.serviceHistory,
        formData.owners,
        formData.numberOfKeys,
        formData.ulezCompliant,
        formData.euroStandard,
        formData.doors,
        formData.seats,
        formData.features,
        formData.writeOffCategory,
        formData.isImported,
    ])

    function applyValuation() {
        if (!valuation) return

        // The customer-facing valuation is one neutral Current Market Value.
        // Keep the richer retail/auction guidance in the valuation payload for
        // internal platform logic, but never switch the visible applied figure
        // based on listing method.
        set("priceAsking", String(valuation.auction.marketValue))

        if (isAuction) {
            setAuctionSchedule(prev => ({
                ...prev,
                reservePrice: String(valuation.auction.suggestedReserve),
            }))
            return
        }

        // A retail offer floor is optional. Do not silently introduce a second
        // auto-valued customer price after they chose "Use this value".
        set("priceMin", "")
    }

    const auctionMarketValue = isAuction ? (parseFloat(formData.priceAsking) || 0) : 0
    const platformOpeningBid = getAuctionOpeningBid(auctionMarketValue)
    const reserveGuide = getAuctionReserveGuide(auctionMarketValue)

    React.useEffect(() => {
        if (!isAuction || platformOpeningBid <= 0) return
        const nextStartingBid = String(platformOpeningBid)
        setAuctionSchedule(prev =>
            prev.startingBid === nextStartingBid
                ? prev
                : { ...prev, startingBid: nextStartingBid }
        )
    }, [isAuction, platformOpeningBid])

    const totalSteps = isAuction ? 5 : 4
    // "Method" is a cosmetic-only leading step representing the Retail/Auction choice
    // already made on the landing screen — it doesn't participate in currentStep/
    // validateStep numbering, it just makes that choice visually register as Step 1
    // in the progress indicator.
    const WIZARD_STEPS = isAuction
        ? [
            { id: 0, icon: List, title: "Method" },
            { id: 1, icon: Car, title: "Details" },
            { id: 2, icon: Camera, title: "Media" },
            { id: 3, icon: DollarSign, title: "Pricing" },
            { id: 4, icon: Gavel, title: "Auction" },
            { id: 5, icon: CheckCircle, title: "Review" },
        ]
        : [
            { id: 0, icon: List, title: "Method" },
            { id: 1, icon: Car, title: "Details" },
            { id: 2, icon: Camera, title: "Media" },
            { id: 3, icon: DollarSign, title: "Pricing" },
            { id: 4, icon: CheckCircle, title: "Review" },
        ]

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

    // If the listing type switches from AUCTION to CLASSIFIED (e.g. user changes
    // tier in the pricing step), clear any Cat A/B selection — those are
    // auction-only categories and must not carry over to a retail listing.
    React.useEffect(() => {
        if (formData.listingType === 'CLASSIFIED' &&
            (formData.writeOffCategory === 'CAT_A' || formData.writeOffCategory === 'CAT_B')) {
            set('writeOffCategory', '')
        }
    }, [formData.listingType])

    // ─── Departed sale handlers ──────────────────────────────────────────────────

    const handleRelSelectChange = (v: string) => {
        setDepartedRelSelect(v)
        if (v !== 'Other') {
            set('departedRelationship', v)
            setDepartedRelOther('')
        } else {
            set('departedRelationship', '') // 'Other' sentinel — wait for freetext
        }
    }

    const handleRelOtherChange = (v: string) => {
        setDepartedRelOther(v)
        set('departedRelationship', v)
    }

    // ─── Not legal registered keeper handlers ───────────────────────────────────

    const handleNotOwnerRelSelectChange = (v: string) => {
        setNotOwnerRelSelect(v)
        if (v !== 'Other') {
            set('notOwnerRelationship', v)
            setNotOwnerRelOther('')
        } else {
            set('notOwnerRelationship', '') // 'Other' sentinel — wait for freetext
        }
    }

    const handleNotOwnerRelOtherChange = (v: string) => {
        setNotOwnerRelOther(v)
        set('notOwnerRelationship', v)
    }

    // ─── Navigation ─────────────────────────────────────────────────────────────

    const getStepValidationError = (): string | null => {
        switch (currentStep) {
            case 1: {
                const missing: string[] = []
                if (!formData.vrm) missing.push('registration')
                if (!formData.make) missing.push('make')
                if (!formData.model) missing.push('model')
                if (!formData.year) missing.push('year')
                if (!formData.mileage) missing.push('mileage')
                if (!formData.fuelType) missing.push('fuel type')
                if (!formData.transmission) missing.push('transmission')
                if (!formData.bodyType) missing.push('body type')
                if (!formData.title || formData.title.length < 5) missing.push('listing title')
                if (!formData.location) missing.push('location')
                if (!formData.owners) missing.push('previous keepers')
                if (!formData.description.trim()) missing.push('description')
                if (!formData.condition) missing.push('condition')
                if (formData.writeOffCategory === '') missing.push('write-off status')
                if (formData.stolenRecovered === null) missing.push('stolen/recovered declaration')
                if (formData.hasOutstandingFinance === null) missing.push('outstanding finance declaration')
                if (formData.isLegalRegisteredKeeper === null) missing.push('registered keeper declaration')
                if (formData.isLegalRegisteredKeeper === false && !(formData.notOwnerRelationship ?? '').trim()) {
                    missing.push('relationship/authority to sell')
                }
                if (formData.isDepartedSale && !(formData.departedRelationship ?? '').trim()) {
                    missing.push('estate/departed-sale relationship')
                }
                if (!formData.declarationAcknowledged) missing.push('seller declaration')
                if ((formData.writeOffCategory === 'CAT_A' || formData.writeOffCategory === 'CAT_B') && formData.listingType !== 'AUCTION') {
                    return 'Category A and Category B vehicles can only be listed in Auction. Switch this listing to Auction to continue.'
                }
                return missing.length > 0
                    ? `Please complete: ${missing.join(', ')}.`
                    : null
            }
            case 2: {
                const missingPhotos = Math.max(0, 10 - formData.images.length)
                return missingPhotos > 0
                    ? `Please add ${missingPhotos} more photo${missingPhotos === 1 ? '' : 's'} to continue. A minimum of 10 photos is required. HPI is optional.`
                    : null
            }
            case 3: {
                const pMin = parseFloat(formData.priceMin)
                const pAsk = parseFloat(formData.priceAsking)
                if (!formData.priceAsking || isNaN(pAsk) || pAsk <= 0) {
                    return isAuction
                        ? 'Please enter a valid estimated market value before continuing.'
                        : 'Please enter a valid asking price before continuing.'
                }
                if (formData.priceMin && !isNaN(pMin) && pMin > pAsk) {
                    return 'The minimum price cannot be higher than the asking price.'
                }
                return null
            }
            case 4: {
                if (!isAuction) return null
                if (!auctionSchedule.startTime && auctionSchedule.startTime !== 'NOW') {
                    return 'Please choose when the auction should start.'
                }
                if (auctionSchedule.startTime !== 'NOW') {
                    const startMs = new Date(auctionSchedule.startTime).getTime()
                    if (startMs < Date.now() - 60 * 1000) {
                        return 'The auction start time cannot be in the past.'
                    }
                }
                if (!auctionSchedule.reservePrice || parseFloat(auctionSchedule.reservePrice) <= 0) {
                    return 'Please enter a valid reserve price.'
                }
                if (!auctionSchedule.startingBid || parseFloat(auctionSchedule.startingBid) <= 0) {
                    return 'Please enter a valid opening bid.'
                }
                if (!auctionSchedule.minIncrement || parseFloat(auctionSchedule.minIncrement) <= 0) {
                    return 'Please enter a valid minimum bid increment.'
                }
                return null
            }
            default:
                return null
        }
    }

    const validateStep = (): boolean => getStepValidationError() === null

    const handleNext = () => {
        if (!validateStep()) {
            const validationError = getStepValidationError()
            setHasAttemptedNext(true)
            // Where sellers get stuck is as useful as where they drop —
            // a step failing validation repeatedly is a UX problem.
            trackEvent('listing_step_blocked', {
                listing_type: listingTypeLabel(formData.listingType),
                step: currentStep,
                step_name: WIZARD_STEPS.find(s => s.id === currentStep)?.title ?? String(currentStep),
                validation_error: validationError ?? 'unknown',
            })
            if (currentStep === 1 && !formData.condition) {
                window.setTimeout(() => {
                    document.getElementById('vehicle-condition-field')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    })
                }, 50)
            }
            alert(validationError ?? "Please complete the required information before proceeding.")
            return
        }
        setHasAttemptedNext(false)
        trackEvent(SELLER_FUNNEL.LISTING_STEP_COMPLETED, {
            listing_type: listingTypeLabel(formData.listingType),
            step: currentStep,
            step_name: WIZARD_STEPS.find(s => s.id === currentStep)?.title ?? String(currentStep),
            total_steps: totalSteps,
        })
        setCurrentStep(prev => Math.min(prev + 1, totalSteps))
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
        if (profile?.role === 'DEALER' && !isVerifiedDealer) {
            alert("Your dealer account is pending KYC verification. Complete verification to start listing vehicles.")
            router.push('/dashboard/dealer')
            return
        }
        set("listingType", "CLASSIFIED")
        // Retail listings always start on the £1 BASIC tier. This must explicitly
        // overwrite FREE because users can switch back from the free Auction flow
        // and stale localStorage/HPI drafts may still carry the auction tier.
        set("badgeTier", "BASIC")
        setSellingMethod("list")
        trackEvent(SELLER_FUNNEL.LISTING_STARTED, {
            listing_type: 'retail',
            seller_role: profile?.role || 'UNKNOWN',
            valuation_id: valuationJourneyIdRef.current || undefined,
        })
        set("status", "ACTIVE")
    }


    React.useEffect(() => {
        if (isDashboard) return

        const handleStartFromLanding = (event: Event) => {
            const detail = (event as CustomEvent<{
                listingType?: "AUCTION" | "CLASSIFIED"
                vehicle?: Partial<FormData>
                valuation?: VehicleValuation | null
                dvlaVerified?: boolean
                valuationId?: string
            }>).detail

            if (!detail?.listingType || !detail.vehicle) return
            if (!isAuthenticated) {
                setShowLoginModal(true)
                return
            }
            if (!isEmailVerified) {
                alert("Please verify your email address before creating a listing.")
                router.push("/auth/onboarding")
                return
            }
            if (profile?.role === "DEALER" && !isVerifiedDealer) {
                alert("Your dealer account is pending KYC verification. Complete verification to start listing vehicles.")
                router.push("/dashboard/dealer")
                return
            }

            const listingType = detail.listingType
            setFormData(prev => ({
                ...prev,
                ...detail.vehicle,
                listingType,
                badgeTier: listingType === "AUCTION" ? "FREE" : "BASIC",
                status: "ACTIVE",
            }))
            const landingBase = detail.valuation ?? null
            setBaseValuation(landingBase)
            valuationBaseKeyRef.current = landingBase
                ? getValuationBaseKey(detail.vehicle, editId)
                : null
            setValuation(landingBase)
            setValuationError(null)
            if (detail.valuationId) {
                valuationJourneyIdRef.current = detail.valuationId
                valuationJourneyVrmRef.current = String(detail.vehicle.vrm || "").replace(/\s/g, "").toUpperCase()
            }
            const verifiedByDvla = detail.dvlaVerified !== false
            setDvlaSuccess(verifiedByDvla)
            setDvlaError(verifiedByDvla ? null : "DVLA could not verify this registration. Review the manually entered vehicle details before continuing.")
            setSellingMethod("list")
            setCurrentStep(1)

            trackEvent(SELLER_FUNNEL.LISTING_STARTED, {
                listing_type: listingType === "AUCTION" ? "auction" : "retail",
                seller_role: profile?.role || "UNKNOWN",
                entry_point: "sell_landing_valuation",
                valuation_id: detail.valuationId || valuationJourneyIdRef.current || undefined,
            })
        }

        window.addEventListener("carmazium:start-seller-listing", handleStartFromLanding as EventListener)
        return () => window.removeEventListener("carmazium:start-seller-listing", handleStartFromLanding as EventListener)
    }, [
        isDashboard,
        isAuthenticated,
        isEmailVerified,
        isVerifiedDealer,
        profile?.role,
        router,
        trackEvent,
        editId,
    ])

    // ─── Submit ──────────────────────────────────────────────────────────────────

    // handleSubmit has three top-level branches (edit / returning-from-HPI /
    // new listing), each of which ends in one of the same two outcomes. These
    // two helpers keep the event payloads identical across all six exit points
    // instead of copy-pasting the tracking call into each one.
    const trackListingSubmitted = (
        payload: CreateListingRequest,
        listingId: string,
        // 'published' is the admin path — no fee and no review queue, so the
        // listing goes straight to ACTIVE (see ListingsService.publishListing).
        outcome: 'pending_review' | 'awaiting_payment' | 'published',
    ) => {
        const listing_type = listingTypeLabel(payload.listingType)
        const common = {
            listing_type,
            listing_id: listingId,
            badge_tier: payload.badgeTier,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            seller_role: profile?.role || 'UNKNOWN',
            valuation_id: valuationJourneyIdRef.current || undefined,
        }
        trackEvent(SELLER_FUNNEL.LISTING_SUBMITTED, { ...common, outcome })
        // Gate the path-specific events on listing_type, not on outcome —
        // a retail listing can also reach pending_review directly (already
        // paid, resubmitting after a rejection), and that's not an auction.
        if (listing_type === 'auction') {
            trackEvent(SELLER_FUNNEL.AUCTION_SUBMITTED, common)
        } else if (outcome === 'awaiting_payment') {
            trackEvent(SELLER_FUNNEL.LISTING_CHECKOUT_STARTED, common)
        }
    }

    const ensureAuctionScheduled = async (listingId: string) => {
        if (formData.listingType !== 'AUCTION') return

        // Existing scheduled auctions are already complete. Cancelled/ended
        // auctions (for example after admin rejection) are intentionally sent
        // through the same endpoint so the backend can restart the same row.
        if (existingAuctionStatus && !['CANCELLED', 'ENDED'].includes(existingAuctionStatus)) {
            return
        }

        const isImmediate = auctionSchedule.startTime === 'NOW'
        const startTimeIso = isImmediate
            ? new Date().toISOString()
            : new Date(auctionSchedule.startTime).toISOString()

        await apiClient('/auctions', {
            method: 'POST',
            body: JSON.stringify({
                listingId,
                startTime: startTimeIso,
                reservePrice: parseFloat(auctionSchedule.reservePrice),
                startingBid: parseFloat(auctionSchedule.startingBid),
                minIncrement: parseFloat(auctionSchedule.minIncrement),
                ...(auctionSchedule.buyItNowPrice
                    ? { buyItNowPrice: parseFloat(auctionSchedule.buyItNowPrice) }
                    : {}),
            }),
        })
        setExistingAuctionStatus('SCHEDULED')
    }

    const handleSubmit = async () => {
        if (!isAuthenticated) { setShowLoginModal(true); return }
        if (!isEmailVerified) { router.push("/auth/onboarding"); return }

        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const priceAsking = parseFloat(formData.priceAsking)
            const isAuctionListing = formData.listingType === 'AUCTION'
            const priceMin = formData.priceMin ? parseFloat(formData.priceMin) : priceAsking
            const priceMax = priceAsking // Retail asking-price ceiling
            const displayPrice = priceAsking

            const payload: CreateListingRequest = {
                title: formData.title,
                // For auctions this single price field is the seller's Estimated
                // Market Value / guide price. Retail-only offer bounds are omitted.
                price: displayPrice,
                ...(!isAuctionListing ? { priceMin, priceMax } : {}),
                mileage: parseInt(formData.mileage),
                year: parseInt(formData.year),
                vrm: formData.vrm,
                vin: formData.vin || undefined,
                images: formData.images,
                listingType: formData.listingType,
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
                badgeTier: (formData.listingType === 'CLASSIFIED' && formData.badgeTier === 'FREE') ? 'BASIC' : formData.badgeTier,
                status: formData.status,
                vehicleType: formData.vehicleType as VehicleTypeValue,
                isImported: formData.isImported,
                condition: formData.condition as any || undefined,
                // Legal declarations
                stolenRecovered: formData.stolenRecovered ?? undefined,
                hasOutstandingFinance: formData.hasOutstandingFinance ?? undefined,
                isLegalRegisteredKeeper: formData.isLegalRegisteredKeeper ?? undefined,
                notOwnerRelationship: formData.notOwnerRelationship || undefined,
                writeOffCategory: (formData.writeOffCategory !== '' ? formData.writeOffCategory : 'NONE') as 'NONE' | 'CAT_S' | 'CAT_N' | 'CAT_A' | 'CAT_B',
                // Extended vehicle details
                variant: formData.variant || undefined,
                driveType: formData.driveType || undefined,
                numberOfKeys: formData.numberOfKeys ? parseInt(formData.numberOfKeys) : undefined,
                serviceHistory: formData.serviceHistory || undefined,
                mechanicalIssues: formData.mechanicalIssues.trim() || undefined,
                electricalIssues: formData.electricalIssues.trim() || undefined,
                owners: formData.owners || undefined,
                torqueNm: formData.torqueNm ? parseInt(formData.torqueNm) : undefined,
                topSpeedMph: formData.topSpeedMph ? parseInt(formData.topSpeedMph) : undefined,
                zeroTo60Mph: formData.zeroTo60Mph ? parseFloat(formData.zeroTo60Mph) : undefined,
                combinedMpg: formData.combinedMpg ? parseFloat(formData.combinedMpg) : undefined,
                extraUrbanMpg: formData.extraUrbanMpg ? parseFloat(formData.extraUrbanMpg) : undefined,
                bannerLabel: formData.bannerLabel || undefined,
                videoUrls: formData.videoUrls.length > 0 ? formData.videoUrls : undefined,
                isDepartedSale: formData.isDepartedSale || undefined,
                departedRelationship: formData.departedRelationship || undefined,
                deliveryAvailable: formData.deliveryAvailable,
                deliveryPricePerMile: formData.deliveryAvailable && formData.deliveryPricePerMile
                    ? parseFloat(formData.deliveryPricePerMile)
                    : null,
                deliveryMaxMiles: formData.deliveryAvailable && formData.deliveryMaxMiles
                    ? parseInt(formData.deliveryMaxMiles, 10)
                    : null,
            }

            // Generic listing PATCHes may only change seller-editable vehicle
            // fields. Lifecycle/commercial fields are handled by dedicated
            // publish/payment/auction endpoints and are deliberately stripped.
            const {
                status: _status,
                listingType: _listingType,
                badgeTier: _badgeTier,
                ...editablePayload
            } = payload;

            if (editId) {
                // Update existing listing
                await apiClient<{ data: any }>(`/listings/${editId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(editablePayload),
                })

                // Save damage records (overwrites previous damage for this listing)
                try {
                    const detections = damageRecords.map(r => ({
                        part: r.zone,
                        type: r.description,
                        size: "MEDIUM",
                        coords: { x: r.x, y: r.y, view: r.view },
                        imageUrl: r.photoUrl ?? "",
                    }))
                    await apiClient(`/damage/${editId}/save`, {
                        method: 'POST',
                        body: JSON.stringify({ detections }),
                    })
                } catch (e) {
                    console.error('Failed to save damage records:', e)
                }

                await ensureAuctionScheduled(editId)

                if (payload.badgeTier !== 'FREE') {
                    // Check if this listing already has a completed payment — avoid double-charging
                    const publish = await publishListing(editId)
                    if (publish.activated) {
                        router.push('/dashboard/seller/listings')
                        return
                    }
                    if (publish.pendingReview) {
                        // Already paid (e.g. resubmitting after a rejection) — no need to charge again
                        trackListingSubmitted(payload, editId, 'pending_review')
                        setPendingReview({ title: payload.title, onContinue: () => router.push('/dashboard/seller/listings') })
                        return
                    }
                    // No completed payment found — go to Stripe
                    trackListingSubmitted(payload, editId, 'awaiting_payment')
                    const checkout = await createListingCheckoutSession(editId, payload.badgeTier as string)
                    window.location.href = checkout.url
                    return
                }

                // FREE tier (auctions) — no payment step, so publishing (DRAFT/REJECTED
                // -> PENDING_REVIEW) is the whole submission, not something a webhook does.
                await publishListing(editId)
                trackListingSubmitted(payload, editId, 'pending_review')
                setPendingReview({ title: payload.title, onContinue: () => router.push('/dashboard/seller/listings') })
            } else if (draftListingId) {
                // User returned from HPI payment — update the existing draft listing instead of creating a new one
                const response = await apiClient<{ data: any }>(`/listings/${draftListingId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(editablePayload),
                })
                const finalListingId = response.data.id
                const finalSlug = response.data.slug

                try {
                    const detections = damageRecords.map(r => ({
                        part: r.zone,
                        type: r.description,
                        size: "MEDIUM",
                        coords: { x: r.x, y: r.y, view: r.view },
                        imageUrl: r.photoUrl ?? "",
                    }))
                    await apiClient(`/damage/${finalListingId}/save`, {
                        method: 'POST',
                        body: JSON.stringify({ detections }),
                    })
                } catch (e) {
                    console.error('Failed to save damage records:', e)
                }

                localStorage.removeItem('carmazium_listing_draft')
            localStorage.removeItem('carmazium_listing_draft_step')
                localStorage.removeItem('carmazium_hpi_draft_id')

                await ensureAuctionScheduled(finalListingId)

                if (payload.badgeTier !== 'FREE') {
                    // Check if this draft already has a completed payment — avoid double-charging
                    const publish = await publishListing(finalListingId)
                    if (publish.activated) {
                        setFormData(INITIAL_FORM)
                        setCurrentStep(1)
                        setSellingMethod(null)
                        router.push(`/buy-cars/${finalSlug}`)
                        return
                    }
                    if (publish.pendingReview) {
                        // Already paid (e.g. resubmitting after a rejection) — no need to charge again
                        trackListingSubmitted(payload, finalListingId, 'pending_review')
                        setPendingReview({
                            title: payload.title,
                            onContinue: () => {
                                setFormData(INITIAL_FORM)
                                setCurrentStep(1)
                                setSellingMethod(null)
                                router.push('/dashboard/seller/listings')
                            },
                        })
                        return
                    }
                    // No completed payment — go to Stripe
                    trackListingSubmitted(payload, finalListingId, 'awaiting_payment')
                    const checkout = await createListingCheckoutSession(finalListingId, payload.badgeTier as string)
                    window.location.href = checkout.url
                    return
                }

                // FREE tier (auctions) — no payment step, so publishing (DRAFT -> PENDING_REVIEW)
                // is the whole submission, not something a webhook does.
                await publishListing(finalListingId)
                trackListingSubmitted(payload, finalListingId, 'pending_review')
                setFormData(INITIAL_FORM)
                setCurrentStep(1)
                setSellingMethod(null)
                setPendingReview({
                    title: payload.title,
                    onContinue: () => router.push(payload.listingType === 'AUCTION' ? '/dashboard/seller/auctions' : '/dashboard/seller/listings'),
                })
            } else {
                // Brand-new auctions carry their schedule in this same POST /listings
                // request. The backend creates Listing + Auction explicitly inside
                // one Prisma transaction, so a failed Auction create rolls back
                // the Listing too. Existing/HPI drafts
                // still use ensureAuctionScheduled() above because their Listing
                // row already exists.
                const initialAuctionFields = formData.listingType === 'AUCTION'
                    ? {
                        auctionStartTime: auctionSchedule.startTime === 'NOW'
                            ? new Date().toISOString()
                            : new Date(auctionSchedule.startTime).toISOString(),
                        auctionReservePrice: parseFloat(auctionSchedule.reservePrice),
                        auctionMinIncrement: parseFloat(auctionSchedule.minIncrement),
                        auctionStartingBid: parseFloat(auctionSchedule.startingBid),
                        ...(auctionSchedule.buyItNowPrice
                            ? { auctionBuyItNowPrice: parseFloat(auctionSchedule.buyItNowPrice) }
                            : {}),
                    }
                    : {}

                // For paid tiers, create as DRAFT — the Stripe webhook activates it after payment.
                // Auction listings also remain DRAFT until publishListing() passes
                // readiness/HPI checks and submits them for admin review.
                const isPaidTier = payload.badgeTier !== 'FREE'
                const createPayload = {
                    ...(isPaidTier ? { ...payload, status: 'DRAFT' as const } : payload),
                    ...initialAuctionFields,
                }
                // If this VRM already belongs to one of this seller's auction
                // listings, do not create a duplicate Retail row. Ask the seller
                // to confirm the channel switch first; the backend re-checks all
                // auction safety rules again when they confirm.
                if (payload.listingType === 'CLASSIFIED') {
                    const conversion = await getRetailConversionCandidate(payload.vrm)
                    if (conversion.candidate) {
                        if (!conversion.candidate.canConvert) {
                            if (conversion.candidate.existingRetailSlug) {
                                setSubmitError(
                                    conversion.candidate.blockedReason
                                    || 'This vehicle already has a Retail listing. Open that listing instead.',
                                )
                            } else {
                                setSubmitError(
                                    conversion.candidate.blockedReason
                                    || 'This auction cannot be switched to Retail at the moment.',
                                )
                            }
                            return
                        }

                        setRetailConversion({
                            candidate: conversion.candidate,
                            payload: {
                                ...payload,
                                listingType: 'CLASSIFIED',
                                status: 'DRAFT',
                                badgeTier: payload.badgeTier === 'FREE' ? 'BASIC' : payload.badgeTier,
                            },
                        })
                        return
                    }
                }

                const response = await createListing(createPayload)
                const newListingId = response.data.id

                // Save damage records separately (not part of listing DTO to avoid validation issues)
                if (damageRecords.length > 0) {
                    try {
                        const detections = damageRecords.map(r => ({
                            part: r.zone,
                            type: r.description,
                            size: "MEDIUM",
                            coords: { x: r.x, y: r.y, view: r.view },
                            imageUrl: r.photoUrl ?? "",
                        }))
                        await apiClient(`/damage/${newListingId}/save`, {
                            method: 'POST',
                            body: JSON.stringify({ detections }),
                        })
                    } catch (e) {
                        console.error('Failed to save damage records:', e)
                    }
                }

                // No second /auctions request for a brand-new auction: it was
                // created atomically with the Listing above.
                if (isPaidTier) {
                    // Ask the server whether this listing actually needs paying for before
                    // sending anyone to Stripe. Admins list free, so publishListing() takes
                    // them straight to ACTIVE — without this call an admin hits checkout and
                    // the payments service rejects them with "Admin listings are free",
                    // leaving them stuck on this step with no way forward.
                    const publish = await publishListing(newListingId)
                    if (publish.activated) {
                        trackListingSubmitted(payload, newListingId, 'published')
                        setFormData(INITIAL_FORM)
                        localStorage.removeItem('carmazium_listing_draft')
                        localStorage.removeItem('carmazium_listing_draft_step')
                        setCurrentStep(1)
                        setSellingMethod(null)
                        router.push(response.data.slug ? `/buy-cars/${response.data.slug}` : '/dashboard/seller/listings')
                        return
                    }
                    if (publish.pendingReview) {
                        trackListingSubmitted(payload, newListingId, 'pending_review')
                        setPendingReview({
                            title: payload.title,
                            onContinue: () => {
                                setFormData(INITIAL_FORM)
                                localStorage.removeItem('carmazium_listing_draft')
                        localStorage.removeItem('carmazium_listing_draft_step')
                                setCurrentStep(1)
                                setSellingMethod(null)
                                router.push('/dashboard/seller/listings')
                            },
                        })
                        return
                    }
                    // Redirect to Stripe — webhook moves the listing to PENDING_REVIEW on success
                    trackListingSubmitted(payload, newListingId, 'awaiting_payment')
                    const checkout = await createListingCheckoutSession(newListingId, payload.badgeTier as string)
                    window.location.href = checkout.url
                    return
                }

                // FREE tier (auctions) — no payment step, so publishing (DRAFT -> PENDING_REVIEW)
                // is the whole submission. Show the same "under review" messaging as the
                // paid-tier checkout-success flow before sending them onward.
                await publishListing(newListingId)
                trackListingSubmitted(payload, newListingId, 'pending_review')
                setPendingReview({
                    title: payload.title,
                    onContinue: () => {
                        setFormData(INITIAL_FORM)
                        localStorage.removeItem('carmazium_listing_draft')
                        localStorage.removeItem('carmazium_listing_draft_step')
                        setCurrentStep(1)
                        setSellingMethod(null)
                        router.push(payload.listingType === 'AUCTION' ? '/dashboard/seller/auctions' : '/dashboard/seller/listings')
                    },
                })
            }
        } catch (error: any) {
            console.error("Submission error:", error)
            // A seller who got all the way to Submit and then hit an error is
            // the most expensive kind of drop-off — surface it in the funnel.
            trackEvent('listing_submit_failed', {
                listing_type: listingTypeLabel(formData.listingType),
                badge_tier: formData.badgeTier,
                reason: error?.message || 'unknown',
            })
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

    const confirmRetailConversion = async () => {
        if (!retailConversion) return

        setIsConvertingToRetail(true)
        setSubmitError(null)

        try {
            const { candidate, payload } = retailConversion
            const result = await convertAuctionToRetail(candidate.listingId, {
                ...payload,
                listingType: 'CLASSIFIED',
                status: 'DRAFT',
                badgeTier: payload.badgeTier === 'FREE' ? 'BASIC' : payload.badgeTier,
                confirmAuctionCancellation: true,
            })

            // Preserve the same damage-save behaviour as a normal new listing.
            // If the seller did not edit damage in this form, existing damage
            // records on the reused listing are left untouched.
            if (damageRecords.length > 0) {
                try {
                    const detections = damageRecords.map(r => ({
                        part: r.zone,
                        type: r.description,
                        size: "MEDIUM",
                        coords: { x: r.x, y: r.y, view: r.view },
                        imageUrl: r.photoUrl ?? "",
                    }))
                    await apiClient(`/damage/${result.listingId}/save`, {
                        method: 'POST',
                        body: JSON.stringify({ detections }),
                    })
                } catch (e) {
                    console.error('Failed to save damage records during Retail conversion:', e)
                }
            }

            setRetailConversion(null)

            // Use the normal Retail publish/payment gate after conversion. This
            // prevents the channel switch from bypassing either the listing fee
            // or admin review.
            const publish = await publishListing(result.listingId)
            if (publish.activated) {
                trackListingSubmitted(payload, result.listingId, 'published')
                localStorage.removeItem('carmazium_listing_draft')
                localStorage.removeItem('carmazium_listing_draft_step')
                router.push(result.slug ? `/buy-cars/${result.slug}` : '/dashboard/seller/listings')
                return
            }
            if (publish.pendingReview) {
                trackListingSubmitted(payload, result.listingId, 'pending_review')
                setPendingReview({
                    title: payload.title,
                    onContinue: () => router.push('/dashboard/seller/listings'),
                })
                return
            }

            trackListingSubmitted(payload, result.listingId, 'awaiting_payment')
            const checkout = await createListingCheckoutSession(
                result.listingId,
                (payload.badgeTier === 'FREE' ? 'BASIC' : payload.badgeTier) as string,
            )
            window.location.href = checkout.url
        } catch (error: any) {
            console.error("Auction to Retail conversion error:", error)
            setSubmitError(error?.message || "Could not switch this auction to a Retail listing. Please try again.")
            setRetailConversion(null)
        } finally {
            setIsConvertingToRetail(false)
        }
    }

    // ─── Shared ──────────────────────────────────────────────────────────────────

    const inputCls = "bg-[var(--bg-input)] border-[var(--border-default)] placeholder:text-[var(--text-secondary)] focus:border-primary text-base md:text-sm"

    // ─── Login Modal ─────────────────────────────────────────────────────────────

    const LoginModal = () => !showLoginModal ? null : (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setShowLoginModal(false)}>
            <div className="glass-card p-8 max-w-md w-full relative" onClick={(e) => e.stopPropagation()}>
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-neon">
                    <Car size={40} />
                </div>
                <h2 className="text-2xl font-bold font-heading mb-3 text-center">Sign In to List</h2>
                <p className="text-[var(--text-muted)] mb-6 text-center text-sm">Create an account to add your listing safely.</p>
                <div className="space-y-3">
                    <Button onClick={() => { setShowLoginModal(false); router.push("/auth/login?redirect=/sell") }} className="w-full shadow-neon">Log In</Button>
                    <Button variant="outline" className="w-full border-[var(--border-default)] text-[var(--text-muted)] hover:text-primary dark:hover:text-white" onClick={() => { setShowLoginModal(false); router.push("/auth/signup?redirect=/sell") }}>Create Account</Button>
                </div>
            </div>
        </div>
    )

    const RetailConversionModal = () => {
        if (!retailConversion) return null

        const { candidate, payload } = retailConversion
        const activeAuction = candidate.auctionStatus === 'ACTIVE' || candidate.auctionStatus === 'SCHEDULED'
        const draftAuction = candidate.auctionStatus === 'DRAFT'
        const tier = payload.badgeTier === 'PREMIUM'
            ? 'Premium £25'
            : payload.badgeTier === 'STANDARD'
                ? 'Standard £10'
                : 'Basic £1'

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5">
                <div className="glass-card p-0 max-w-lg w-full overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="retail-conversion-title">
                    <div className="p-6 border-b border-[var(--border-default)] flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <AlertTriangle className="text-amber-500" size={24}/>
                        </div>
                        <div>
                            <h3 id="retail-conversion-title" className="text-xl font-bold font-heading">Switch this vehicle to Retail?</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-1">{candidate.title}</p>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        {activeAuction ? (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                                <p className="font-bold text-amber-500">Your existing auction will be cancelled.</p>
                                <p className="text-sm text-[var(--text-muted)] mt-2">
                                    Continuing will close the auction before this vehicle is changed to a Retail listing.
                                    {candidate.hasActiveBids ? " Existing auction bids will be closed and bidders will be notified." : ""}
                                </p>
                            </div>
                        ) : draftAuction ? (
                            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                                <p className="font-bold">An Auction draft already exists for this vehicle.</p>
                                <p className="text-sm text-[var(--text-muted)] mt-2">
                                    CarMazium will replace that Auction draft with this Retail listing instead of creating a duplicate.
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                                <p className="font-bold">Your previous auction is already closed.</p>
                                <p className="text-sm text-[var(--text-muted)] mt-2">
                                    CarMazium will reuse that vehicle listing for Retail instead of creating a duplicate.
                                </p>
                            </div>
                        )}

                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 text-sm">
                            <p><strong>Retail package:</strong> {tier}</p>
                            <p className="text-[var(--text-muted)] mt-2">
                                After you confirm, the vehicle becomes a Retail draft. You will then continue to the normal payment step if a Retail listing fee is due. The listing will still require CarMazium review before going live.
                            </p>
                        </div>

                        <p className="text-xs text-[var(--text-muted)]">
                            If the auction already has a winner or the reserve has been met, CarMazium will block the conversion even after confirmation.
                        </p>
                    </div>

                    <div className="p-5 border-t border-[var(--border-default)] flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isConvertingToRetail}
                            onClick={() => setRetailConversion(null)}
                        >
                            Keep Auction
                        </Button>
                        <Button
                            type="button"
                            disabled={isConvertingToRetail}
                            onClick={confirmRetailConversion}
                            className="bg-emerald-600 hover:bg-emerald-700 border-none"
                        >
                            {isConvertingToRetail
                                ? <><Loader2 size={16} className="animate-spin mr-2"/>Switching...</>
                                : <>{activeAuction ? "Cancel Auction & Continue" : "Switch to Retail & Continue"}<ArrowRight size={16} className="ml-2"/></>}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // ─── HPI Payment Modal ───────────────────────────────────────────────────────

    const HpiPaymentModal = () => (!showHpiModal || isHpiUnlocked) ? null : (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => !isProcessingPayment && setShowHpiModal(false)}>
            <div className="glass-card p-0 max-w-md w-full relative overflow-hidden flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-[var(--bg-card)] p-5 border-b border-[var(--border-default)] flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2"><CreditCard size={18} className="text-primary"/> Secure Checkout</h3>
                    <button disabled={isProcessingPayment} type="button" onClick={() => setShowHpiModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6">
                     <div className="flex justify-between items-center mb-6">
                         <div>
                             <p className="text-[var(--text-primary)] font-bold">Vehicle History Report</p>
                             <p className="text-xs text-[var(--text-muted)] mt-1">Prepared by our team while your listing is reviewed</p>
                         </div>
                         <div className="text-xl font-black">£9.99</div>
                     </div>
                     
                     <div className="space-y-4 mb-6">
                          {/* Card Input */}
                          <div className="space-y-1.5 bg-[var(--bg-input)] p-4 rounded-xl border border-[var(--border-default)]">
                              <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Card Details</label>
                              <div className="h-10 bg-black/20 rounded border border-[var(--border-default)] flex items-center px-3">
                                  <Lock size={14} className="text-[var(--text-muted)] mr-2" />
                                  <span className="text-[var(--text-muted)] text-sm">•••• •••• •••• ••••</span>
                              </div>
                          </div>
                          
                     </div>
                     
                     <Button
                         disabled={isProcessingPayment}
                         onClick={async () => {
                             if (!formData.vrm) {
                                 alert("Please enter a VRM first.")
                                 return
                             }
                             setIsProcessingPayment(true)
                             try {
                                 // Need a listing ID for HPI checkout — create a draft first if we don't have one.
                                 // Do not create that draft ahead of an auction → Retail switch:
                                 // the final submit flow owns the destructive confirmation and reuses
                                 // the existing listing row instead of producing a duplicate.
                                 let listingId = draftListingId
                                 if (!listingId) {
                                     if (formData.listingType === 'CLASSIFIED') {
                                         const conversion = await getRetailConversionCandidate(formData.vrm)
                                         if (conversion.candidate) {
                                             alert(
                                                 conversion.candidate.canConvert
                                                     ? 'This registration already belongs to your auction listing. Submit this Retail form first so CarMazium can safely switch and reuse that listing; then add the optional HPI check from the Retail draft.'
                                                     : (conversion.candidate.blockedReason || 'This vehicle cannot be changed to a Retail listing at the moment.'),
                                             )
                                             setIsProcessingPayment(false)
                                             return
                                         }
                                     }

                                     const draft = await createListing({
                                         title: formData.title || `${formData.make || ''} ${formData.model || ''} ${formData.year || ''}`.trim() || formData.vrm,
                                         price: parseFloat(formData.priceAsking) || 1,
                                         mileage: parseInt(formData.mileage) || 0,
                                         year: parseInt(formData.year) || new Date().getFullYear(),
                                         vrm: formData.vrm,
                                         images: formData.images,
                                         listingType: formData.listingType,
                                         make: formData.make || undefined,
                                         model: formData.model || undefined,
                                         status: 'DRAFT',
                                         badgeTier: (formData.listingType === 'CLASSIFIED' && formData.badgeTier === 'FREE') ? 'BASIC' : formData.badgeTier,
                                         vehicleType: formData.vehicleType,
                                     })
                                     listingId = draft.data.id
                                     setDraftListingId(listingId)
                                     localStorage.setItem('carmazium_hpi_draft_id', listingId)
                                 }
                                 const checkout = await createHpiCheckoutSession(formData.vrm, listingId)
                                 window.location.href = checkout.url
                             } catch (err: any) {
                                 console.error("HPI Checkout error:", err)
                                 alert(err.message || "Failed to start checkout. Please try again.")
                                 setIsProcessingPayment(false)
                             }
                         }}
                         className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 text-lg relative overflow-hidden group shadow-neon border-none"
                     >
                         {isProcessingPayment ? (
                             <><Loader2 className="animate-spin mr-2" size={18} /> Redirecting to Stripe...</>
                         ) : (
                             <>Pay Securely with Stripe <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18}/></>
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
                <RetailConversionModal />
                <HpiPaymentModal />
                <PendingReviewModal open={!!pendingReview} listingTitle={pendingReview?.title} onContinue={() => pendingReview?.onContinue()} />
                <div className={`relative ${isDashboard ? 'pb-12 w-full' : 'min-h-screen pt-24 pb-12'}`}>
                    {/* Background Effects */}
                    {!isDashboard && <div className="fixed inset-0 -z-10" style={{ background: 'var(--bg-body)' }} />}
                    <div className="container mx-auto px-5 max-w-4xl">
                        <div className="text-center mb-14">
                            <p className="text-xs font-black uppercase tracking-widest text-primary mb-3">
                                {isDashboard ? "Choose Your Listing Method" : "Step 2 · Choose How to Sell"}
                            </p>
                            <h2 className="text-4xl md:text-5xl font-black font-heading mb-4 tracking-tight">Choose How You Want to Sell</h2>
                            <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto">
                                Use the free dealer auction for verified motor-trade bids or advertise directly to retail buyers from £1.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                            {/* Auction card */}
                            <div
                                onClick={() => {
                                    if (!isAuthenticated) { setShowLoginModal(true); return }
                                    if (!isEmailVerified) { router.push("/auth/onboarding"); return }
                                    if (profile?.role === 'DEALER' && !isVerifiedDealer) {
                                        alert("Your dealer account is pending KYC verification. Complete verification to start listing vehicles.")
                                        router.push('/dashboard/dealer')
                                        return
                                    }
                                    set("listingType", "AUCTION")
                                    set("badgeTier", "FREE")
                                    setSellingMethod("list")
                                    set("status", "ACTIVE")
                                    trackEvent(SELLER_FUNNEL.LISTING_STARTED, {
                                        listing_type: 'auction',
                                        seller_role: profile?.role || 'UNKNOWN',
                                        valuation_id: valuationJourneyIdRef.current || undefined,
                                    })
                                }}
                                className="relative group cursor-pointer"
                            >
                                {/* £100 incentive stamp — bleeds over the card's corner, so it lives
                                    outside the card's own overflow-hidden wrapper rather than inside it */}
                                <div className="absolute -top-7 -right-7 z-20 w-28 h-28 sm:w-32 sm:h-32 rotate-[12deg] drop-shadow-xl pointer-events-none">
                                    <Image src="/assets/images/auction-100-stamp.png" alt="We pay you £100 as an incentive to list and complete the sale" fill className="object-contain" />
                                </div>
                                <div className="relative dealer-glass-card p-8 transition-all duration-300 overflow-hidden rounded-2xl h-full flex flex-col border-orange-500/20 hover:border-orange-500/50 hover:shadow-[0_10px_40px_rgba(249,115,22,0.15)]">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl -z-10 group-hover:bg-orange-500/20 transition-colors" />
                                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                                        <span className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                                            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse shrink-0" /> LIVE BIDDING
                                        </span>
                                    </div>
                                    <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/20 group-hover:border-orange-500/50 group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] transition-all">
                                        <Gavel className="w-8 h-8 text-orange-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2 font-heading">Auction</h2>
                                    <p className="text-[var(--text-muted)] mb-4 text-sm">Let verified motor dealers bid for your car in real time. Live auctions include anti-snipe protection.</p>
                                    {/* Bidding notice */}
                                    <div className="flex items-start gap-2 mb-5 px-3 py-2.5 rounded-lg border text-xs bg-orange-500/5 border-orange-500/20 text-orange-300/80">
                                        <Shield size={12} className="shrink-0 mt-0.5" />
                                        <span>Only <strong>verified dealers</strong> can bid. Open to all registered sellers to list.</span>
                                    </div>
                                    <ul className="space-y-2.5 mb-6 text-[var(--text-secondary)] flex-1">
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="shrink-0 text-orange-400" /> Free to list</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="shrink-0 text-orange-400" /> Real-time live bidding</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="shrink-0 text-orange-400" /> Anti-snipe protection</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="shrink-0 text-orange-400" /> Set your reserve price</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="shrink-0 text-orange-400" /> Connect with winner via chat</li>
                                    </ul>
                                    <Button className="w-full py-4 border-0 bg-orange-600 hover:bg-orange-500 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                                        <span>List for Auction</span><Gavel className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Retail Listing card */}
                            <div
                                onClick={handleMethodClick}
                                className="relative cursor-pointer group"
                            >
                                <div className="relative dealer-glass-card p-8 border-[var(--border-default)] hover:border-primary/40 transition-all duration-300 overflow-hidden hover:shadow-[0_10px_40px_rgba(237,28,36,0.15)] rounded-2xl h-full flex flex-col">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors" />
                                    <div className="w-16 h-16 bg-[var(--bg-input)] rounded-2xl flex items-center justify-center mb-6 border border-[var(--border-default)] group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                        <List className="text-primary w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2 font-heading">Retail Listing</h2>
                                    <p className="text-[var(--text-muted)] mb-6 text-sm">Set your asking price and let buyers submit offers. You choose who to accept.</p>
                                    <ul className="space-y-2.5 mb-6 text-[var(--text-secondary)] flex-1">
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Starting from £1</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> DVLA-verified vehicle data</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Instant estimated valuation</li>
                                        <li className="flex items-center gap-2.5 text-sm"><CheckCircle size={15} className="text-emerald-400 shrink-0" /> Reach retail buyers across the UK</li>
                                    </ul>
                                    <Button className="w-full py-4 group-hover:shadow-neon">Start Listing <ArrowRight className="ml-2 h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>

                        {/* Steps explanation */}
                        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                            {STEPS.map((s) => (
                                <div key={s.id} className="p-5 glass-card">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                                        <span className="text-primary font-black text-sm">{s.id}</span>
                                    </div>
                                    <p className="text-[var(--text-primary)] font-semibold text-sm">{s.title}</p>
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
                <RetailConversionModal />
                <HpiPaymentModal />
                <PendingReviewModal open={!!pendingReview} listingTitle={pendingReview?.title} onContinue={() => pendingReview?.onContinue()} />

                {/* Wizard actions */}
                <div className="mb-6 flex items-center justify-between gap-3">
                    <Button variant="ghost" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] group px-2"
                        onClick={() => {
                            if (currentStep > 1) {
                                handleBack()
                            } else {
                                setSellingMethod(null)
                            }
                        }}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        {currentStep > 1 ? "Previous Step" : "Exit"}
                    </Button>

                    {!editId && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleStartFresh}
                            className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary px-3 sm:px-4"
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Start Fresh
                        </Button>
                    )}
                </div>

                <div className="text-center mb-10">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold">
                        {formData.listingType === "AUCTION" ? "List for Auction" : "List Your Car"}
                    </h2>
                    <p className="text-[var(--text-muted)] mt-2">Step {currentStep + 1} of {totalSteps + 1}</p>
                </div>

                {/* Progress stepper */}
                <div className="glass-card px-6 py-5 mb-8 flex justify-between relative overflow-hidden">
                    {WIZARD_STEPS.map((step) => (
                        <div key={step.id} className={`flex flex-col items-center relative z-10 flex-1 ${currentStep >= step.id ? "text-primary" : "text-[var(--text-muted)]"}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1.5 border transition-all ${currentStep >= step.id ? "bg-primary text-white shadow-neon border-primary" : "bg-[var(--bg-input)] border-[var(--border-default)]"}`}>
                                <step.icon size={16} />
                            </div>
                            <span className="text-[9px] md:text-[11px] font-bold uppercase tracking-wide">{step.title}</span>
                        </div>
                    ))}
                    <div className="absolute top-[36px] left-0 w-full h-0.5 bg-[var(--bg-card)] -z-0">
                        <div className="h-full bg-primary transition-all duration-500 shadow-neon" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
                    </div>
                </div>

                {/* Form card */}
                <div className="dealer-glass-card p-10 md:p-14 relative overflow-hidden border-[var(--border-default)]">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-10 opacity-60" />

                    {/* ── STEP 1: Identity ──────────────────────────────────────────────── */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4">Vehicle Details</h2>

                            {/* Vehicle Type Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Vehicle Type *</label>
                                <div className="flex gap-3">
                                    {(["CAR", "HGV", "MOTORCYCLE"] as const).map((vt) => {
                                        const labels: Record<string, string> = { CAR: "Car", HGV: "HGV / Commercial", MOTORCYCLE: "Motorcycle" }
                                        const active = formData.vehicleType === vt
                                        return (
                                            <button key={vt} type="button"
                                                onClick={() => set("vehicleType", vt)}
                                                className={`flex-1 py-3 px-2 sm:px-3 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-center text-center ${active ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(237,28,36,0.2)]" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"}`}
                                            >
                                                <span className="whitespace-normal break-words leading-tight">{labels[vt]}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* VRM + Lookup */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Registration (VRM) *</label>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input placeholder="e.g. AB12 CDE" value={formData.vrm}
                                        onChange={(e) => { set("vrm", e.target.value.toUpperCase()); setDvlaSuccess(false); setDvlaError(null) }}
                                        className={`${inputCls} uppercase font-mono tracking-widest text-lg h-14 flex-1 ${hasAttemptedNext && !formData.vrm ? 'border-red-500' : 'border-primary/20 focus:border-primary'}`} />
                                    <Button type="button" disabled={!formData.vrm || dvlaLoading}
                                        className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-14 uppercase tracking-widest gap-2 shadow-neon transition-transform active:scale-95 w-full sm:w-auto"
                                        onClick={async () => {
                                            setDvlaLoading(true); setDvlaError(null); setDvlaSuccess(false)
                                            try {
                                                const r = await dvlaLookup(formData.vrm, hasAiSharingConsent())
                                                // Core vehicle fields — normalize make/model to canonical casing
                                                if (r.make) {
                                                    const canonical = CAR_MAKES.find(m => m.toLowerCase() === r.make!.toLowerCase())
                                                    set("make", canonical ?? r.make)
                                                }
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
                                                if (r.fuelType) {
                                                    const fuelTypeMap: Record<string, string> = {
                                                        'PETROL': 'PETROL', 'DIESEL': 'DIESEL',
                                                        'ELECTRICITY': 'ELECTRIC', 'ELECTRIC': 'ELECTRIC',
                                                        'HYBRID': 'HYBRID', 'PLUGIN_HYBRID': 'PLUGIN_HYBRID',
                                                        'PLUGIN HYBRID': 'PLUGIN_HYBRID', 'PLUG-IN HYBRID': 'PLUGIN_HYBRID',
                                                        'LPG': 'LPG', 'GAS': 'NATURAL_GAS',
                                                        'HYDROGEN': 'HYDROGEN_CELL', 'HYDROGEN_CELL': 'HYDROGEN_CELL',
                                                        'BI_FUEL': 'BI_FUEL', 'BI-FUEL': 'BI_FUEL',
                                                        'NATURAL_GAS': 'NATURAL_GAS', 'NATURAL GAS': 'NATURAL_GAS',
                                                        'PETROL_HYBRID': 'PETROL_HYBRID', 'DIESEL_HYBRID': 'DIESEL_HYBRID',
                                                        'PETROL_PLUGIN_HYBRID': 'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID': 'DIESEL_PLUGIN_HYBRID',
                                                        'UNLISTED': 'UNLISTED',
                                                    }
                                                    const mappedFuel = fuelTypeMap[r.fuelType.toUpperCase()]
                                                    if (mappedFuel) set("fuelType", mappedFuel)
                                                }
                                                if (r.transmission) {
                                                    const transmissionMap: Record<string, string> = {
                                                        'MANUAL': 'MANUAL', 'AUTOMATIC': 'AUTOMATIC',
                                                        'SEMI_AUTOMATIC': 'SEMI_AUTOMATIC', 'SEMI-AUTOMATIC': 'SEMI_AUTOMATIC',
                                                        'SEMI AUTOMATIC': 'SEMI_AUTOMATIC',
                                                        'CVT': 'CVT', 'CONTINUOUSLY VARIABLE': 'CVT',
                                                    }
                                                    const mappedTrans = transmissionMap[r.transmission.toUpperCase()]
                                                    if (mappedTrans) set("transmission", mappedTrans)
                                                }

                                                // Evidence-backed AI specification enrichment. The backend
                                                // only exposes auto-fill fields when the match is sufficiently
                                                // strong; the seller can still review and edit them.
                                                if (r.variant) set("variant", r.variant)
                                                if (r.bodyType && BODY_TYPE_KEYS.includes(r.bodyType as any)) {
                                                    set("bodyType", r.bodyType as BodyTypeValue)
                                                }
                                                if (r.driveType && ["FWD", "RWD", "AWD", "4WD"].includes(r.driveType)) {
                                                    set("driveType", r.driveType)
                                                }
                                                if (r.doors != null) set("doors", String(r.doors))
                                                if (r.seats != null) set("seats", String(r.seats))
                                                if (r.bhp != null) set("bhp", String(r.bhp))
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
                                                // Vehicle lookup is distinct from valuation. The actual
                                                // valuation_requested event fires only after the valuation
                                                // endpoint returns successfully (see valuation effect above).
                                                trackEvent('vehicle_lookup_completed', {
                                                    listing_type: listingTypeLabel(formData.listingType),
                                                    make: r.make || undefined,
                                                    model: r.model || undefined,
                                                    year: r.year || undefined,
                                                    fuel_type: r.fuelType || undefined,
                                                })
                                            } catch (err: any) {
                                                setDvlaError(err.message || "Lookup failed")
                                                trackEvent('valuation_failed', {
                                                    listing_type: listingTypeLabel(formData.listingType),
                                                    reason: err?.message || 'lookup_failed',
                                                })
                                            } finally { setDvlaLoading(false) }
                                        }}
                                    >
                                        {dvlaLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                        Analyze DVLA
                                    </Button>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)]">UK number plate — click Look Up to auto-fill vehicle details.</p>
                                {dvlaSuccess && <p className="text-xs text-emerald-400 flex items-center gap-1"><BadgeCheck size={12} /> Vehicle data loaded — DVLA/MOT details plus verified live specification matches have been applied where available. Review and edit below.</p>}
                                {dvlaError && <p className="text-xs text-red-400">{dvlaError}</p>}
                            </div>

                            {/* Registration & Compliance Details */}
                            <div className="mt-8">
                                <h3 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-blue-400" />
                                    Registration & Compliance
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-2 mb-6">
                                    These fields are auto-filled from the DVLA and MOT databases, but can be manually adjusted.
                                </p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {/* Last V5C Issued */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Last V5C Issued</label>
                                        <Input type="date" min="1972-01-01" max={new Date().toISOString().split('T')[0]} value={formData.dateOfLastV5CIssued} onChange={(e) => set("dateOfLastV5CIssued", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* MOT Status */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">MOT Status</label>
                                        <Input placeholder="e.g. Valid" value={formData.motStatus} onChange={(e) => set("motStatus", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* MOT Expiry */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">MOT Expiry Date</label>
                                        <Input type="date" min="1972-01-01" max="2100-12-31" value={formData.motExpiryDate} onChange={(e) => set("motExpiryDate", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Tax Status */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Tax Status</label>
                                        <Input placeholder="e.g. Taxed" value={formData.taxStatus} onChange={(e) => set("taxStatus", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Tax Due Date */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Tax Due Date</label>
                                        <Input type="date" min="1972-01-01" max="2100-12-31" value={formData.taxDueDate} onChange={(e) => set("taxDueDate", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Type Approval */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Type Approval</label>
                                        <Input placeholder="e.g. M1" value={formData.typeApproval} onChange={(e) => set("typeApproval", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Wheelplan */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Wheelplan</label>
                                        <Input placeholder="e.g. 2 AXLE RIGID BODY" value={formData.wheelplan} onChange={(e) => set("wheelplan", e.target.value)} className={inputCls} />
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
                                                <div key={idx} className="bg-[var(--bg-input)] rounded-lg p-3 border border-[var(--border-default)]">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div>
                                                            <p className="text-xs font-bold text-[var(--text-primary)]">{new Date(test.completedDate).toLocaleDateString('en-GB')}</p>
                                                            {test.odometerValue && (
                                                                <p className="text-[10px] text-[var(--text-muted)]">{Number(test.odometerValue).toLocaleString()} {test.odometerUnit}</p>
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
                                                <p className="text-[10px] text-[var(--text-muted)] text-center pt-2 italic">Showing latest 5 records of {formData.motHistory.length}</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* VIN */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5">VIN <span className="text-[var(--text-secondary)] normal-case font-normal text-xs">(optional)</span></label>
                                <Input placeholder="17-character VIN" value={formData.vin}
                                    maxLength={17}
                                    onChange={(e) => set("vin", e.target.value.toUpperCase())}
                                    className={`${inputCls} font-mono tracking-wider`} />
                                <p className="text-xs text-[var(--text-secondary)]">Vehicle Identification Number — increases buyer trust.</p>
                            </div>

                            {/* Make / Model / Year */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Make *</label>
                                    {(() => {
                                        // Case-insensitive match — DVLA returns uppercase (e.g. "TOYOTA")
                                        const matchedMake = CAR_MAKES.find(m => m.toLowerCase() === formData.make.trim().toLowerCase())
                                        const isCustomMake = manualMakeEntry || (formData.make.trim() !== "" && !matchedMake)
                                        const selectValue = matchedMake ?? (isCustomMake ? "__other__" : "")
                                        return (
                                            <>
                                                <select
                                                    value={selectValue}
                                                    onChange={(e) => {
                                                        if (e.target.value === "__other__") {
                                                            setManualMakeEntry(true); setManualModelEntry(false); setManualVariantEntry(false)
                                                            set("make", ""); set("model", ""); set("variant", "")
                                                        } else {
                                                            // Store canonical casing from CAR_MAKES
                                                            setManualMakeEntry(false); setManualModelEntry(false); setManualVariantEntry(false)
                                                            set("make", e.target.value); set("model", ""); set("variant", "")
                                                        }
                                                    }}
                                                    className="w-full h-10 rounded-md border bg-[var(--bg-input)] px-3 text-base md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border-[var(--border-default)]"
                                                >
                                                    <option value="">Select make</option>
                                                    {CAR_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                                                    <option value="__other__">Other (type below)</option>
                                                </select>
                                                {isCustomMake && (
                                                    <Input placeholder="e.g. BMW" value={formData.make}
                                                        onChange={(e) => {
                                                            setManualModelEntry(false); setManualVariantEntry(false)
                                                            set("make", e.target.value); set("model", ""); set("variant", "")
                                                        }} className={inputCls} />
                                                )}
                                            </>
                                        )
                                    })()}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Model *</label>
                                    {(() => {
                                        // getModelsForMake is already case-insensitive
                                        const models = getModelsForMake(formData.make)
                                        if (models.length === 0) {
                                            const modelMissing = hasAttemptedNext && !formData.model
                                            return (
                                                <>
                                                    <Input placeholder="e.g. M4 Competition" value={formData.model}
                                                        onChange={(e) => {
                                                            setManualVariantEntry(false)
                                                            set("model", e.target.value); set("variant", "")
                                                        }} className={`${inputCls} ${modelMissing ? 'border-red-500' : ''}`} />
                                                    {modelMissing && <p className="text-xs text-red-400">Model is required.</p>}
                                                </>
                                            )
                                        }
                                        const matchedModel = models.find(m => m.toLowerCase() === formData.model.trim().toLowerCase())
                                        const isCustomModel = manualModelEntry || (formData.model.trim() !== "" && !matchedModel)
                                        const selectValue = matchedModel ?? (isCustomModel ? "__other__" : "")
                                        const modelMissing = hasAttemptedNext && !formData.model
                                        return (
                                            <>
                                                <select
                                                    value={selectValue}
                                                    onChange={(e) => {
                                                        if (e.target.value === "__other__") {
                                                            setManualModelEntry(true); setManualVariantEntry(false)
                                                            set("model", ""); set("variant", "")
                                                        } else {
                                                            setManualModelEntry(false); setManualVariantEntry(false)
                                                            set("model", e.target.value); set("variant", "")
                                                        }
                                                    }}
                                                    className={`w-full h-10 rounded-md border bg-[var(--bg-input)] px-3 text-base md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${modelMissing ? 'border-red-500' : 'border-[var(--border-default)]'}`}
                                                >
                                                    <option value="">Select model</option>
                                                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                                                    <option value="__other__">Other (type below)</option>
                                                </select>
                                                {isCustomModel && (
                                                    <Input placeholder="e.g. M4 Competition" value={formData.model}
                                                        onChange={(e) => {
                                                            setManualVariantEntry(false)
                                                            set("model", e.target.value); set("variant", "")
                                                        }} className={`${inputCls} ${modelMissing ? 'border-red-500' : ''}`} />
                                                )}
                                                {modelMissing && <p className="text-xs text-red-400">Model is required.</p>}
                                            </>
                                        )
                                    })()}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Year *</label>
                                    <Input type="number" placeholder="2023" value={formData.year} onChange={(e) => set("year", e.target.value)} className={inputCls} />
                                </div>
                            </div>

                            {/* ── Model & Variant ───────────────────────────────────────── */}
                            <div className="border border-[var(--border-default)] bg-[var(--bg-input)] rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold uppercase text-[var(--text-muted)] tracking-wider flex items-center gap-2">
                                    <Car size={14} /> Model Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Variant/Trim */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Variant / Trim</label>
                                        {(() => {
                                            const knownVariants = getVariantsForModel(formData.make, formData.model)
                                            if (knownVariants.length === 0) {
                                                return (
                                                    <Input placeholder="e.g. M Sport, GT Line, S-Line" value={formData.variant}
                                                        onChange={(e) => set("variant", e.target.value)} className={inputCls} />
                                                )
                                            }
                                            const matchedVariant = knownVariants.find(v => v.toLowerCase() === formData.variant.trim().toLowerCase())
                                            const isCustom = manualVariantEntry || (formData.variant.trim() !== "" && !matchedVariant)
                                            const selectValue = matchedVariant ?? (isCustom ? "__other__" : "")
                                            return (
                                                <>
                                                    <select
                                                        value={selectValue}
                                                        onChange={(e) => {
                                                            if (e.target.value === "__other__") { setManualVariantEntry(true); set("variant", "") }
                                                            else { setManualVariantEntry(false); set("variant", e.target.value) }
                                                        }}
                                                        className="w-full h-10 rounded-md border bg-[var(--bg-input)] px-3 text-base md:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border-[var(--border-default)]"
                                                    >
                                                        <option value="">Select variant / trim</option>
                                                        {knownVariants.map(v => <option key={v} value={v}>{v}</option>)}
                                                        <option value="__other__">Other (type below)</option>
                                                    </select>
                                                    {isCustom && (
                                                        <Input placeholder="Type your variant / trim" value={formData.variant}
                                                            onChange={(e) => set("variant", e.target.value)} className={inputCls} />
                                                    )}
                                                </>
                                            )
                                        })()}
                                    </div>
                                    {/* Drive Type */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Drive Type</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {(["FWD", "RWD", "AWD", "4WD"] as const).map((dt) => (
                                                <button key={dt} type="button"
                                                    onClick={() => set("driveType", formData.driveType === dt ? "" : dt)}
                                                    className={`py-2 rounded-lg border text-xs font-bold transition-all ${formData.driveType === dt ? "border-primary bg-primary/10 text-primary" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"}`}
                                                >{dt}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Vehicle Condition */}
                                    <div id="vehicle-condition-field" className={`space-y-2 md:col-span-2 rounded-xl p-3 border ${hasAttemptedNext && !formData.condition ? 'border-red-500/70 bg-red-500/5' : 'border-transparent'}`}>
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Vehicle Condition *</label>
                                        <p className="text-xs text-[var(--text-secondary)]">Choose the condition that best describes the vehicle today. This helps make the valuation more accurate.</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {([
                                                { value: "EXCELLENT", label: "Excellent", help: "Very clean, minimal wear" },
                                                { value: "GOOD", label: "Good", help: "Normal age-related wear" },
                                                { value: "FAIR", label: "Fair", help: "Noticeable wear or defects" },
                                                { value: "POOR", label: "Poor", help: "Significant faults or damage" },
                                            ] as const).map((opt) => {
                                                const active = formData.condition === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => set("condition", opt.value)}
                                                        className={`p-3 rounded-xl border text-left transition-all ${active
                                                            ? "border-primary bg-primary/10 text-primary"
                                                            : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                        }`}
                                                    >
                                                        <span className="block text-sm font-bold">{opt.label}</span>
                                                        <span className="block text-[10px] leading-snug mt-0.5 opacity-75">{opt.help}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {hasAttemptedNext && !formData.condition && (
                                            <p className="text-xs text-red-400 font-medium">Vehicle condition is required.</p>
                                        )}
                                    </div>

                                    {/* Service History */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Service History</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {(["Full Main Dealer", "Full Independent", "Partial", "None"] as const).map((sh) => (
                                                <button key={sh} type="button"
                                                    onClick={() => set("serviceHistory", formData.serviceHistory === sh ? "" : sh)}
                                                    className={`py-2.5 px-2 rounded-lg border text-xs font-semibold transition-all text-center ${formData.serviceHistory === sh ? "border-primary bg-primary/10 text-primary" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"}`}
                                                >{sh}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Known Mechanical & Electrical Problems */}
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Known Mechanical Problems</label>
                                        <Textarea
                                            value={formData.mechanicalIssues}
                                            onChange={(e) => set("mechanicalIssues", e.target.value)}
                                            maxLength={2000}
                                            rows={3}
                                            placeholder="e.g. clutch judder when cold, suspension knock, oil leak, gearbox noise. Leave blank if you have nothing to report."
                                            className={inputCls}
                                        />
                                        <p className="text-[10px] text-[var(--text-secondary)]">Tell buyers about any known engine, gearbox, clutch, brake, steering, suspension or other mechanical faults.</p>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Known Electrical Problems</label>
                                        <Textarea
                                            value={formData.electricalIssues}
                                            onChange={(e) => set("electricalIssues", e.target.value)}
                                            maxLength={2000}
                                            rows={3}
                                            placeholder="e.g. warning light, parking sensor fault, battery issue, window or infotainment problem. Leave blank if you have nothing to report."
                                            className={inputCls}
                                        />
                                        <p className="text-[10px] text-[var(--text-secondary)]">Add known warning lights, battery/charging, sensor, lighting, infotainment or other electrical faults.</p>
                                    </div>

                                    {/* Number of Keys */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Number of Keys</label>
                                        <div className="flex gap-2">
                                            {(["1", "2", "3"] as const).map((k) => (
                                                <button key={k} type="button"
                                                    onClick={() => set("numberOfKeys", formData.numberOfKeys === k ? "" : k)}
                                                    className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all ${formData.numberOfKeys === k ? "border-primary bg-primary/10 text-primary" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"}`}
                                                >{k} {k === "3" ? "+" : ""} {parseInt(k) === 1 ? "Key" : "Keys"}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Performance & Economy ─────────────────────────────────── */}
                            <div className="border border-[var(--border-default)] bg-[var(--bg-input)] rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-bold uppercase text-[var(--text-muted)] tracking-wider flex items-center gap-2">
                                    <Zap size={14} /> Performance & Economy
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                    {/* 0-60 */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">0–60 mph (secs)</label>
                                        <Input type="number" step="0.1" placeholder="e.g. 4.5" value={formData.zeroTo60Mph}
                                            onChange={(e) => set("zeroTo60Mph", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Top Speed */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Top Speed (mph)</label>
                                        <Input type="number" placeholder="e.g. 155" value={formData.topSpeedMph}
                                            onChange={(e) => set("topSpeedMph", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Torque */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Torque (Nm)</label>
                                        <Input type="number" placeholder="e.g. 400" value={formData.torqueNm}
                                            onChange={(e) => set("torqueNm", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Combined MPG */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Combined MPG</label>
                                        <Input type="number" step="0.1" placeholder="e.g. 38.2" value={formData.combinedMpg}
                                            onChange={(e) => set("combinedMpg", e.target.value)} className={inputCls} />
                                    </div>
                                    {/* Extra Urban MPG */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Extra Urban MPG</label>
                                        <Input type="number" step="0.1" placeholder="e.g. 45.6" value={formData.extraUrbanMpg}
                                            onChange={(e) => set("extraUrbanMpg", e.target.value)} className={inputCls} />
                                    </div>
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)]">All performance figures are optional — check your vehicle handbook or manufacturer spec sheet.</p>
                            </div>

                            {/* Body Type (not for motorcycles) */}
                            {formData.vehicleType !== 'MOTORCYCLE' && (
                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Body Type *</label>
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5">
                                        {BODY_TYPE_KEYS.map((key) => {
                                            const Icon = BODY_TYPE_ICONS[key]
                                            return (
                                                <button key={key} type="button"
                                                    onClick={() => set("bodyType", key as BodyTypeValue)}
                                                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${formData.bodyType === key ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(237,28,36,0.2)]" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-white/30"}`}
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
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><MapPin size={13} /> Location *</label>
                                <div className="flex gap-3">
                                    <Input placeholder="e.g. London, Manchester" value={formData.location} onChange={(e) => set("location", e.target.value)} className={`${inputCls} flex-1 ${hasAttemptedNext && !formData.location ? 'border-red-500' : ''}`} />
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
                                        className="border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] gap-1.5 px-4"
                                    >
                                        {geoLoading ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                                        <span className="hidden md:inline">Use my location</span>
                                    </Button>
                                </div>
                                {hasAttemptedNext && !formData.location && (
                                    <p className="text-xs text-red-400">Location is required.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Media ─────────────────────────────────────────────────── */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4">Photos *</h2>
                                <p className="text-sm text-[var(--text-muted)]">Upload up to 100 photos. Aim for at least 20 for the best results, and organise them by selecting the relevant category below.</p>
                                {/* Photo counter and progress bar — wizard form only */}
                                {(() => {
                                    const photoCount = formData.images.length
                                    const MIN_PHOTOS = 10
                                    const MAX_PHOTOS = 100
                                    const isMinMet = photoCount >= MIN_PHOTOS
                                    const progressPct = Math.min((photoCount / MAX_PHOTOS) * 100, 100)
                                    const label = editId
                                        ? `${photoCount}/${MAX_PHOTOS} photos`
                                        : !isMinMet
                                            ? `${photoCount}/${MIN_PHOTOS} photos — ${MIN_PHOTOS - photoCount} more required to publish`
                                            : `${photoCount}/${MAX_PHOTOS} photos — More photos = more buyer trust. Keep going!`
                                    return (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-xs font-medium ${isMinMet ? 'text-green-400' : 'text-amber-400'}`}>
                                                    {label}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${isMinMet ? 'bg-green-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${progressPct}%` }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })()}
                                <ImageUpload
                                    onImagesChange={(imgs) => set("images", imgs)}
                                    onDamageImageCountChange={setDamageImageCount}
                                    maxImages={100}
                                    existingImages={formData.images}
                                />
                            </div>

                            {/* Damage Mapping Section */}
                            <div className="pt-8 border-t border-[var(--border-default)]">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                        <AlertTriangle className="text-amber-400 w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Damage Map</h3>
                                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold">Select damaged areas on your vehicle</p>
                                    </div>
                                </div>
                                <VehicleDamageMapper
                                    bodyType={formData.bodyType || undefined}
                                    existingRecords={damageRecords}
                                    onComplete={(records) => setDamageRecords(records)}
                                />
                            </div>

                            {/* Video Embeds */}
                            <div className="pt-8 border-t border-[var(--border-default)]">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                                        <Camera className="text-primary w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Video Links</h3>
                                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold">YouTube, Instagram, Facebook or X — up to 5</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <Input
                                        placeholder="Paste a YouTube, Instagram, Facebook or X video URL"
                                        value={videoUrlInput}
                                        onChange={e => { setVideoUrlInput(e.target.value); setVideoUrlError("") }}
                                        className="bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-white/10 shrink-0"
                                        onClick={() => {
                                            const url = videoUrlInput.trim()
                                            if (!url) return
                                            if (formData.videoUrls.length >= 5) { setVideoUrlError("Maximum 5 video links allowed."); return }
                                            const isValid = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com)/.test(url)
                                            if (!isValid) { setVideoUrlError("Only YouTube, Instagram, Facebook or X links are accepted."); return }
                                            if (formData.videoUrls.includes(url)) { setVideoUrlError("This URL has already been added."); return }
                                            set("videoUrls", [...formData.videoUrls, url])
                                            setVideoUrlInput("")
                                        }}
                                    >
                                        Add
                                    </Button>
                                </div>
                                {videoUrlError && <p className="text-xs text-red-400 mb-3">{videoUrlError}</p>}
                                {formData.videoUrls.length > 0 && (
                                    <div className="space-y-2">
                                        {formData.videoUrls.map((url, idx) => {
                                            const platform = url.includes('youtube.com') || url.includes('youtu.be') ? 'YouTube'
                                                : url.includes('instagram.com') ? 'Instagram'
                                                : url.includes('facebook.com') || url.includes('fb.watch') ? 'Facebook'
                                                : 'X'
                                            return (
                                                <div key={idx} className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-3 py-2">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-primary shrink-0">{platform}</span>
                                                    <span className="text-xs text-[var(--text-muted)] truncate flex-1">{url}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => set("videoUrls", formData.videoUrls.filter((_, i) => i !== idx))}
                                                        className="text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 1 (continued): Technical Specs ─────────────────────── */}
                    {currentStep === 1 && (
                        <div className="space-y-7">
                            <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4 mt-8">Technical Specs</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Mileage */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Mileage *</label>
                                    <Input type="number" placeholder="e.g. 45000" value={formData.mileage} onChange={(e) => set("mileage", e.target.value)} className={`${inputCls} ${hasAttemptedNext && !formData.mileage ? 'border-red-500' : ''}`} />
                                </div>

                                {/* Give sellers value guidance immediately after the
                                    minimum valuation inputs are known, not only after
                                    photos and declarations are complete. */}
                                <div className="md:col-span-2">
                                    <VehicleValuationCard
                                        valuation={valuation}
                                        loading={valuationLoading}
                                        error={valuationError}
                                        mode={isAuction ? "auction" : "retail"}
                                        compact
                                        onApply={applyValuation}
                                    />
                                </div>

                                {/* Fuel */}
                                <SelectField label="Fuel Type" required error={hasAttemptedNext && !formData.fuelType} value={formData.fuelType} onChange={(v) => set("fuelType", v)}
                                    options={[
                                        { value: "PETROL", label: "Petrol" },
                                        { value: "DIESEL", label: "Diesel" },
                                        { value: "ELECTRIC", label: "Electric" },
                                        { value: "HYBRID", label: "Hybrid" },
                                        { value: "PETROL_HYBRID", label: "Petrol Hybrid" },
                                        { value: "DIESEL_HYBRID", label: "Diesel Hybrid" },
                                        { value: "PLUGIN_HYBRID", label: "Plug-in Hybrid" },
                                        { value: "PETROL_PLUGIN_HYBRID", label: "Petrol Plug-in Hybrid" },
                                        { value: "DIESEL_PLUGIN_HYBRID", label: "Diesel Plug-in Hybrid" },
                                        { value: "LPG", label: "LPG" },
                                        { value: "BI_FUEL", label: "Bi Fuel" },
                                        { value: "NATURAL_GAS", label: "Natural Gas" },
                                        { value: "HYDROGEN_CELL", label: "Hydrogen" },
                                        { value: "UNLISTED", label: "Unlisted" },
                                    ]}
                                />

                                {/* Transmission */}
                                <SelectField label="Transmission" required error={hasAttemptedNext && !formData.transmission} value={formData.transmission} onChange={(v) => set("transmission", v)}
                                    options={[
                                        { value: "MANUAL", label: "Manual" },
                                        { value: "AUTOMATIC", label: "Automatic" },
                                        { value: "SEMI_AUTOMATIC", label: "Semi-Automatic" },
                                        { value: "CVT", label: "CVT" },
                                    ]}
                                />

                                {/* Colour */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Colour</label>
                                    <Input placeholder="e.g. Alpine White" value={formData.color} onChange={(e) => set("color", e.target.value)} className={inputCls} />
                                </div>

                                {/* Engine */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Engine Size (cc)</label>
                                    <Input type="number" placeholder="e.g. 2993" value={formData.engineSize} onChange={(e) => set("engineSize", e.target.value)} className={inputCls} />
                                </div>

                                {/* BHP */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Power (BHP)</label>
                                    <Input type="number" placeholder="e.g. 503" value={formData.bhp} onChange={(e) => set("bhp", e.target.value)} className={inputCls} />
                                </div>

                                {/* Doors (not for motorcycles) */}
                                {formData.vehicleType !== 'MOTORCYCLE' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Doors</label>
                                        <Input type="number" placeholder="e.g. 4" min={2} max={8} value={formData.doors} onChange={(e) => set("doors", e.target.value)} className={inputCls} />
                                    </div>
                                )}

                                {/* Seats (not for motorcycles) */}
                                {formData.vehicleType !== 'MOTORCYCLE' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Seats</label>
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
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">ULEZ / CAZ Compliant?</label>
                                        <div className="flex gap-3">
                                            {(["Yes", "No", "Unknown"] as const).map((opt) => {
                                                const val = opt === "Yes" ? true : opt === "No" ? false : null
                                                const active = formData.ulezCompliant === val
                                                return (
                                                    <button key={opt} type="button"
                                                        onClick={() => set("ulezCompliant", val)}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${active ? "border-emerald-500 bg-emerald-500/20 text-emerald-300" : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"}`}
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
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)]">CO₂ Emissions (g/km)</label>
                                        <Input type="number" placeholder="e.g. 142" value={formData.co2Emissions}
                                            onChange={(e) => set("co2Emissions", e.target.value)} className={inputCls} />
                                        <p className="text-xs text-[var(--text-secondary)]">Auto-filled from DVLA when available.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Features</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {PRESET_FEATURES.map((f) => (
                                        <div key={f}
                                            onClick={() => set("features",
                                                formData.features.includes(f)
                                                    ? formData.features.filter(x => x !== f)
                                                    : [...formData.features, f]
                                            )}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${formData.features.includes(f) ? "bg-primary/20 border-primary text-primary" : "bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30"}`}
                                        >
                                            <span className="text-sm font-medium">{f}</span>
                                            {formData.features.includes(f) && <CheckCircle size={14} />}
                                        </div>
                                    ))}
                                    {/* Custom Features */}
                                    {formData.features.filter(f => !PRESET_FEATURES.includes(f)).map((f, i) => (
                                        <div key={`custom-${i}`}
                                            onClick={() => set("features", formData.features.filter(x => x !== f))}
                                            className="p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between bg-primary/20 border-primary text-primary"
                                        >
                                            <span className="text-sm font-medium">{f}</span>
                                            <CheckCircle size={14} />
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <Input 
                                        id="custom-feature-input"
                                        placeholder="Add a custom feature (e.g. Dashcam)" 
                                        className={inputCls} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.currentTarget.value.trim();
                                                if (val && !formData.features.includes(val)) {
                                                    set("features", [...formData.features, val]);
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => {
                                            const input = document.getElementById('custom-feature-input') as HTMLInputElement;
                                            const val = input.value.trim();
                                            if (val && !formData.features.includes(val)) {
                                                set("features", [...formData.features, val]);
                                                input.value = '';
                                            }
                                        }}
                                        className="border-[var(--border-default)] text-[var(--text-primary)] hover:border-primary shrink-0"
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Listing Title *</label>
                                <Input placeholder="e.g. BMW M4 Competition 2023" value={formData.title} onChange={(e) => set("title", e.target.value)} className={`${inputCls} ${hasAttemptedNext && !formData.title ? 'border-red-500' : ''}`} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Description *</label>
                                <Textarea
                                    placeholder="Describe service history, any extras, reason for selling..."
                                    value={formData.description}
                                    onChange={(e) => set("description", e.target.value)}
                                    rows={5}
                                    className={`${inputCls} resize-none`}
                                />
                                <p className="text-xs text-[var(--text-secondary)]">{formData.description.length}/1000 characters</p>
                                {/* AI-Assisted Description */}
                                <Button
                                    type="button"
                                    onClick={async () => {
                                        if (!ensureAiSharingConsent()) return
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
                                            Click to draft a description using OpenAI. Your vehicle details are shared only after you consent.
                                        </p>
                                    </div>
                                </Button>
                            </div>




                            {/* Ownership */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Number of Owners *</label>
                                <div className="flex flex-wrap gap-2">
                                    {(['1', '2', '3', '4', '5+'] as const).map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => set('owners', opt)}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                formData.owners === opt
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'
                                            }`}
                                        >
                                            {opt === '5+' ? '5+ Owners' : `${opt} Owner${opt !== '1' ? 's' : ''}`}
                                        </button>
                                    ))}
                                </div>
                                {/* Departed Sale */}
                                <div className="flex items-center gap-3 mt-3">
                                    <input
                                        type="checkbox"
                                        id="isDepartedSale"
                                        checked={formData.isDepartedSale ?? false}
                                        onChange={(e) => {
                                            set('isDepartedSale', e.target.checked)
                                            if (!e.target.checked) {
                                                setDepartedRelSelect('')
                                                setDepartedRelOther('')
                                                set('departedRelationship', '')
                                            }
                                        }}
                                        className="w-4 h-4 rounded border-white/20 bg-[var(--bg-card)] accent-blue-500"
                                    />
                                    <label htmlFor="isDepartedSale" className="text-sm text-[var(--text-secondary)] cursor-pointer">
                                        This is a departed/estate sale
                                    </label>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mt-1 ml-7">
                                    Buyers will see a Deceased Estate badge on your listing. You may be asked for probate documentation.
                                </p>
                                {formData.isDepartedSale && (
                                    <div className="mt-3 space-y-2">
                                        <SelectField
                                            label="Relationship to owner"
                                            required
                                            error={hasAttemptedNext && !formData.departedRelationship}
                                            value={departedRelSelect}
                                            onChange={handleRelSelectChange}
                                            options={RELATIONSHIP_OPTIONS as unknown as { value: string; label: string }[]}
                                        />
                                        {hasAttemptedNext && !formData.departedRelationship && (
                                            <p className="text-red-400 text-xs mt-1">Please select your relationship to the owner.</p>
                                        )}
                                        {departedRelSelect === 'Other' && (
                                            <input
                                                type="text"
                                                placeholder="Please specify your relationship"
                                                value={departedRelOther}
                                                onChange={(e) => handleRelOtherChange(e.target.value)}
                                                className="mt-2 w-full px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>



                            {/* ── Write-Off & Legal Declaration ──────────────── */}
                            <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-6 space-y-6">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 shrink-0">
                                        <AlertTriangle className="text-red-400 w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-red-300 uppercase tracking-wider">Write-Off &amp; Legal Declaration</h3>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">Required by law. False declarations void the listing and may be reported to relevant authorities.</p>
                                    </div>
                                </div>

                                {/* Write-Off Category */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold uppercase text-[var(--text-secondary)] flex items-center gap-1.5">
                                        Insurance Write-Off Status *
                                        <InfoTooltip text="Cat S/N have been repaired after a write-off and can still be re-registered. Cat A/B are total-loss write-offs (structural or body-salvage) — these cannot be re-registered and are only available when listing via Auction." />
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {([
                                            { value: 'NONE',  label: 'None',  desc: 'Not a write-off',           auctionOnly: false },
                                            { value: 'CAT_S', label: 'Cat S', desc: 'Structural — repaired',      auctionOnly: false },
                                            { value: 'CAT_N', label: 'Cat N', desc: 'Non-structural — repaired',  auctionOnly: false },
                                            { value: 'CAT_A', label: 'Cat A', desc: 'Auction only',               auctionOnly: true  },
                                            { value: 'CAT_B', label: 'Cat B', desc: 'Auction only',               auctionOnly: true  },
                                        ] as const).map((opt) => {
                                            const isAuctionOnly = opt.auctionOnly
                                            const isRetailListing = formData.listingType !== 'AUCTION'
                                            const isLocked = isAuctionOnly && isRetailListing
                                            const active = formData.writeOffCategory === opt.value

                                            if (isLocked) {
                                                return (
                                                    <div key={opt.value} title="Only available for Auction listings"
                                                        className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-center flex flex-col gap-0.5 opacity-50 cursor-not-allowed select-none relative"
                                                    >
                                                        <Lock size={10} className="absolute top-2 right-2 text-[var(--text-muted)]" />
                                                        <span className="text-sm font-bold text-[var(--text-muted)]">{opt.label}</span>
                                                        <span className="text-[10px] leading-tight text-[var(--text-muted)]">Auction only</span>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <button key={opt.value} type="button"
                                                    onClick={() => set("writeOffCategory", opt.value)}
                                                    className={`p-3 rounded-xl border text-center transition-all flex flex-col gap-0.5 ${active
                                                        ? isAuctionOnly
                                                            ? "border-amber-500 bg-amber-500/10 text-amber-300"
                                                            : "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                                                        : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                    }`}
                                                >
                                                    <span className="text-sm font-bold">{opt.label}</span>
                                                    <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {/* Context-aware hint */}
                                    {formData.listingType !== 'AUCTION' && (
                                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                                            <Lock size={10} /> Cat A and Cat B are locked — they require an <strong className="text-[var(--text-secondary)]">Auction listing</strong> to enable.
                                        </p>
                                    )}
                                    {formData.listingType === 'AUCTION' && (formData.writeOffCategory === 'CAT_A' || formData.writeOffCategory === 'CAT_B') && (
                                        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                                            <AlertTriangle size={11} /> Cat A/B write-offs will be auctioned for parts or scrapping only and cannot be re-registered.
                                        </p>
                                    )}
                                </div>

                                {/* Stolen / Recovered */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-secondary)]">Has this vehicle ever been reported stolen or recovered? *</label>
                                    <div className="flex gap-3">
                                        {([{ label: 'Yes', val: true }, { label: 'No', val: false }] as const).map(({ label, val }) => (
                                            <button key={label} type="button"
                                                onClick={() => set("stolenRecovered", val)}
                                                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${formData.stolenRecovered === val
                                                    ? val ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                                                    : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Outstanding Finance */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-secondary)]">Is there currently outstanding finance on this vehicle? *</label>
                                    <div className="flex gap-3">
                                        {([{ label: 'Yes', val: true }, { label: 'No', val: false }] as const).map(({ label, val }) => (
                                            <button key={label} type="button"
                                                onClick={() => set("hasOutstandingFinance", val)}
                                                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${formData.hasOutstandingFinance === val
                                                    ? val ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                                                    : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.hasOutstandingFinance === true && (
                                        <p className="text-xs text-amber-400 flex items-center gap-1.5">
                                            <AlertTriangle size={12} /> Listing with outstanding finance requires lender consent. Buyers will be informed.
                                        </p>
                                    )}
                                </div>

                                {/* Legal Registered Keeper */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-secondary)]">Are you the legal registered keeper of this vehicle? *</label>
                                    <div className="flex gap-3">
                                        {([{ label: 'Yes', val: true }, { label: 'No — I am not the keeper', val: false }] as const).map(({ label, val }) => (
                                            <button key={label} type="button"
                                                onClick={() => set("isLegalRegisteredKeeper", val)}
                                                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${formData.isLegalRegisteredKeeper === val
                                                    ? val ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-red-500 bg-red-500/10 text-red-300"
                                                    : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {formData.isLegalRegisteredKeeper === false && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs text-amber-400 flex items-center gap-1.5">
                                                <AlertTriangle size={12} /> You may still list this vehicle, but please tell us your relationship to the legal registered keeper.
                                            </p>
                                            <SelectField
                                                label="Relationship to the registered keeper"
                                                required
                                                error={hasAttemptedNext && !formData.notOwnerRelationship}
                                                value={notOwnerRelSelect}
                                                onChange={handleNotOwnerRelSelectChange}
                                                options={NOT_OWNER_RELATIONSHIP_OPTIONS as unknown as { value: string; label: string }[]}
                                            />
                                            {hasAttemptedNext && !formData.notOwnerRelationship && (
                                                <p className="text-red-400 text-xs mt-1">Please select your relationship to the registered keeper.</p>
                                            )}
                                            {notOwnerRelSelect === 'Other' && (
                                                <input
                                                    type="text"
                                                    placeholder="Please specify your relationship"
                                                    value={notOwnerRelOther}
                                                    onChange={(e) => handleNotOwnerRelOtherChange(e.target.value)}
                                                    className="mt-2 w-full px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Imported */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-secondary)]">Is this vehicle an import?</label>
                                    <div className="flex gap-3">
                                        {([{ label: 'Yes', val: true }, { label: 'No', val: false }] as const).map(({ label, val }) => (
                                            <button key={label} type="button"
                                                onClick={() => set("isImported", val)}
                                                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${formData.isImported === val
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30"
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Declaration Acknowledgment */}
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div
                                        onClick={() => set("declarationAcknowledged", !formData.declarationAcknowledged)}
                                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${formData.declarationAcknowledged ? "bg-emerald-500 border-emerald-500" : "border-[var(--border-default)] bg-[var(--bg-input)] group-hover:border-primary/40"}`}
                                    >
                                        {formData.declarationAcknowledged && <CheckCircle size={12} className="text-white" />}
                                    </div>
                                    <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                                        I confirm that the above declarations are true and accurate to the best of my knowledge. I understand that false declarations void the listing and may result in legal action.
                                    </span>
                                </label>

                                {hasAttemptedNext && (formData.writeOffCategory === '' || formData.stolenRecovered === null || formData.hasOutstandingFinance === null || formData.isLegalRegisteredKeeper === null || (formData.isLegalRegisteredKeeper === false && !(formData.notOwnerRelationship ?? '').trim()) || !formData.declarationAcknowledged) && (
                                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                                        <AlertTriangle size={12} /> Please complete all declarations above before proceeding.
                                    </p>
                                )}
                            </div>

                            {/* Delivery Options */}
                            <div className="border-t border-[var(--border-default)] pt-4 space-y-3">
                                <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                                    Delivery Options
                                </h3>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.deliveryAvailable}
                                        onChange={(e) => set('deliveryAvailable', e.target.checked)}
                                        className="w-4 h-4 rounded border-white/20 bg-[var(--bg-card)] text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-[var(--text-secondary)]">Offer delivery for this listing</span>
                                </label>
                                {formData.deliveryAvailable && (
                                    <div className="space-y-3 pl-7">
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">
                                                Price per mile <span className="text-[var(--text-muted)]">(e.g. 0.50)</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">£</span>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="e.g. 0.50"
                                                    value={formData.deliveryPricePerMile}
                                                    onChange={(e) => set('deliveryPricePerMile', e.target.value)}
                                                    className={`${inputCls} pl-7`}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">
                                                Maximum delivery radius <span className="text-[var(--text-muted)]">(miles — leave blank for UK-wide)</span>
                                            </label>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="1"
                                                placeholder="e.g. 100"
                                                value={formData.deliveryMaxMiles}
                                                onChange={(e) => set('deliveryMaxMiles', e.target.value)}
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isVerifyingHpiPayment && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                                    <Loader2 size={14} className="animate-spin shrink-0" /> Verifying your HPI report payment…
                                </div>
                            )}
                            {hpiVerifyError && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                                    <AlertTriangle size={14} className="shrink-0" /> {hpiVerifyError}
                                </div>
                            )}

                            {hasAttemptedNext && getStepValidationError() && (
                                <div
                                    role="alert"
                                    className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
                                >
                                    <p className="font-bold">Please complete the following before continuing:</p>
                                    <p className="mt-1 leading-relaxed">{getStepValidationError()}</p>
                                </div>
                            )}

                            {/* Optional HPI add-on (shown after VRM lookup) */}
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
                            <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4">{isAuction ? "Vehicle Value" : "Pricing"}</h2>

                            <VehicleValuationCard
                                valuation={valuation}
                                loading={valuationLoading}
                                error={valuationError}
                                mode={isAuction ? "auction" : "retail"}
                                onApply={applyValuation}
                            />

                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                {isAuction ? (
                                    <>
                                        <p className="text-xs text-primary font-semibold mb-1">📊 Estimated Market Value</p>
                                        <p className="text-xs text-[var(--text-muted)]">This isn&apos;t shown to bidders. CarMazium uses it to set the <strong className="text-[var(--text-primary)]">Opening Bid</strong> automatically at 70% of this value, while you still control the reserve and optional Buy It Now price.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs text-primary font-semibold mb-1">💰 Set Your Price Range</p>
                                        <p className="text-xs text-[var(--text-muted)]">Define your price points for your vehicle. The <strong className="text-[var(--text-primary)]">Asking Price</strong> is displayed publicly. The <strong className="text-[var(--text-primary)]">Lower (Min)</strong> defines your acceptable offer floor.</p>
                                    </>
                                )}
                            </div>

                            <div className={`grid grid-cols-1 ${isAuction ? '' : 'md:grid-cols-2'} gap-4`}>
                                {/* Lower (Minimum) — classified listings only; auctions use bids, not offers */}
                                {!isAuction && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                            Lower (Min)
                                            <InfoTooltip text="The minimum price you'd accept. Bids below this are rejected. Not shown publicly." />
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">£</span>
                                            <Input type="number" placeholder="e.g. 18000" value={formData.priceMin}
                                                onChange={(e) => set("priceMin", e.target.value)}
                                                className={`${inputCls} pl-8 text-lg h-14 ${formData.priceMin && formData.priceAsking && parseFloat(formData.priceMin) > parseFloat(formData.priceAsking) ? 'border-red-500' : ''}`} />
                                        </div>
                                        <p className="text-[10px] text-[var(--text-secondary)]">Floor price — not visible to buyers</p>
                                    </div>
                                )}

                                {/* Asking Price / Estimated Market Value */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-primary flex items-center gap-1">
                                        {isAuction ? "Estimated Market Value *" : "Asking Price *"}
                                        <InfoTooltip text={isAuction
                                            ? "Your best estimate of the car's market value. CarMazium uses it to calculate the auction opening bid at 70% — never shown to bidders."
                                            : "This is the price displayed on your listing. Buyers will see this as the advertised price."} />
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary text-lg font-bold">£</span>
                                        <Input type="number" placeholder="e.g. 20000" value={formData.priceAsking}
                                            onChange={(e) => set("priceAsking", e.target.value)}
                                            className={`${inputCls} pl-8 text-lg h-14 border-primary/30 focus:border-primary ring-1 ring-primary/10`} />
                                    </div>
                                    <p className="text-[10px] text-primary/60 font-semibold">{isAuction ? "Internal reference only — required" : "Displayed on listing — required"}</p>
                                </div>
                            </div>

                            {!isAuction && formData.priceMin && formData.priceAsking && parseFloat(formData.priceMin) > parseFloat(formData.priceAsking) && (
                                <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle size={12} /> Lower price cannot be higher than the asking price.</p>
                            )}

                            {!isAuction && formData.priceAsking && (() => {
                                const pMin = parseFloat(formData.priceMin) || 0
                                const pAsk = parseFloat(formData.priceAsking) || 0
                                if (pAsk <= 0) return null
                                return (
                                    <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--border-default)]">
                                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                                            <span>Your Price Range</span>
                                            <span className="text-emerald-400">✓ Valid</span>
                                        </div>
                                        {/* Visual bar */}
                                        <div className="relative h-3 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                            {pMin > 0 && pAsk > pMin && (
                                                <div className="absolute inset-y-0 bg-gradient-to-r from-amber-500/40 to-primary/60 rounded-full" style={{ left: '5%', right: '5%' }} />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-amber-400 font-bold tabular-nums">{pMin > 0 ? formatPrice(pMin) : '—'}</span>
                                            <span className="text-sm text-primary font-black tabular-nums">{formatPrice(pAsk)}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[9px] text-[var(--text-secondary)] uppercase">Lower</span>
                                            <span className="text-[9px] text-primary/60 uppercase font-bold">Asking</span>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* ── Badge Plan Cards ───────────────────────────────── */}
                            <div className="pt-2">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <h3 className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-2">
                                        <Shield size={16} className="text-primary" /> {isAuction ? "Auction Listing" : "Seller Badges"}
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setSellingMethod(null)}
                                        className="text-xs font-bold text-primary hover:underline shrink-0"
                                    >
                                        Change listing method
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mb-4">
                                    {isAuction
                                        ? "You chose to list this vehicle for auction."
                                        : "Choose Basic £1, Standard £10 with HPI included, or Premium £25 with HPI and a 28-day Featured Boost included."}
                                </p>

                                <div className={`grid grid-cols-1 gap-3 ${isAuction ? 'md:grid-cols-1 max-w-sm' : 'md:grid-cols-3'}`}>
                                    {isAuction ? (
                                        /* Auction — listing type already chosen on the landing screen; this only confirms badgeTier */
                                        <button type="button"
                                            onClick={() => set('badgeTier', 'FREE')}
                                            className="relative rounded-xl border p-4 text-left transition-all border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/50"
                                        >
                                            <span className="absolute top-2 right-2 text-[10px] bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">Selected</span>
                                            <p className="text-orange-400 font-bold text-sm mb-1 flex items-center gap-1"><Gavel size={14} /> Auction</p>
                                            <div className="mb-3">
                                                <p className="text-2xl font-black">Free</p>
                                                <p className="text-[10px] text-orange-400/70 font-semibold">£0 seller listing fee</p>
                                            </div>
                                            <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                                <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Open bidding</li>
                                                <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> 24-hour auction</li>
                                                <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Verified Traders can bid</li>
                                                <li className="flex items-center gap-1.5 text-[var(--text-secondary)]"><X size={12} /> No trust badges</li>
                                            </ul>
                                            <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-[var(--border-default)]">
                                                <Lock size={10} className="text-amber-500/70 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-amber-500/70 leading-tight">Sellers can list for auction; only verified Traders can bid</p>
                                            </div>
                                        </button>
                                    ) : (
                                        <>
                                            {/* Basic */}
                                            <button type="button"
                                                onClick={() => set('badgeTier', 'BASIC')}
                                                className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'BASIC'
                                                    ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                                                    : 'border-[var(--border-default)] bg-white/[0.02] hover:border-primary/30'
                                                    }`}
                                            >
                                                {formData.badgeTier === 'BASIC' && <span className="absolute top-2 right-2 text-[10px] bg-primary text-black font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                                <p className="text-[var(--text-primary)] font-bold text-sm mb-1">Basic</p>
                                                <p className="text-2xl font-black text-[var(--text-primary)] mb-3">£1</p>
                                                <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                                    <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Standard listing</li>
                                                    <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Offer range system</li>
                                                    <li className="flex items-center gap-1.5 text-[var(--text-secondary)]"><X size={12} /> No trust badges</li>
                                                </ul>
                                            </button>

                                            {/* Standard */}
                                            <button type="button"
                                                onClick={() => set('badgeTier', 'STANDARD')}
                                                className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'STANDARD'
                                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/50'
                                                    : 'border-[var(--border-default)] bg-white/[0.02] hover:border-primary/30'
                                                    }`}
                                            >
                                                {formData.badgeTier === 'STANDARD' && <span className="absolute top-2 right-2 text-[10px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                                <p className="text-blue-400 font-bold text-sm mb-1 flex items-center gap-1"><Shield size={14} /> Standard</p>
                                                <p className="text-2xl font-black text-[var(--text-primary)] mb-3">£10</p>
                                                <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                                    <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Everything in Basic</li>
                                                    <li className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-blue-400" /> HPI vehicle-history report included</li>
                                                    <li className="flex items-center gap-1.5"><BadgeCheck size={12} className="text-blue-400" /> Verified Seller badge</li>
                                                </ul>
                                            </button>

                                            {/* Premium */}
                                            <button type="button"
                                                onClick={() => set('badgeTier', 'PREMIUM')}
                                                className={`relative rounded-xl border p-4 text-left transition-all ${formData.badgeTier === 'PREMIUM'
                                                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50'
                                                    : 'border-[var(--border-default)] bg-white/[0.02] hover:border-primary/30'
                                                    }`}
                                            >
                                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={10} /> Best Value</span>
                                                {formData.badgeTier === 'PREMIUM' && <span className="absolute top-2 right-2 text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-full">Selected</span>}
                                                <p className="text-amber-400 font-bold text-sm mb-1 mt-1 flex items-center gap-1"><Star size={14} /> Premium</p>
                                                <p className="text-2xl font-black text-[var(--text-primary)] mb-3">£25</p>
                                                <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                                    <li className="flex items-center gap-1.5"><CheckCircle size={12} className="text-emerald-400" /> Everything in Standard, including HPI</li>
                                                    <li className="flex items-center gap-1.5"><Star size={12} className="text-amber-400" /> Premium listing badge and presentation</li>
                                                    <li className="flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /> Featured Boost included for 28 days</li>
                                                </ul>
                                            </button>
                                        </>
                                    )}
                                </div>

                                {formData.vrm && (isAuction || formData.badgeTier === 'BASIC') && (
                                    <HpiBaitSection
                                        isUnlocked={isHpiUnlocked}
                                        onUnlock={() => setShowHpiModal(true)}
                                    />
                                )}
                                {!isAuction && (formData.badgeTier === 'STANDARD' || formData.badgeTier === 'PREMIUM') && (
                                    <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm text-blue-200">
                                        <div className="flex items-center gap-2 font-bold">
                                            <BadgeCheck size={16} /> HPI report included with this package
                                        </div>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">No separate HPI payment is required. The report request is created automatically when the listing package payment succeeds.</p>
                                    </div>
                                )}
                            </div>

                            {/* ── Attention Label ─────────────────────────────────── */}
                            <div className="border border-[var(--border-default)] bg-[var(--bg-input)] rounded-xl p-5 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold uppercase text-[var(--text-muted)] tracking-wider flex items-center gap-2">
                                        <Sparkles size={14} className="text-amber-400" /> Attention Label
                                        <span className="text-[10px] text-[var(--text-secondary)] normal-case font-normal">(optional)</span>
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Add a promotional ribbon to your listing card to grab buyer attention.</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {BANNER_LABELS.map(({ value, color }) => {
                                        const active = formData.bannerLabel === value
                                        return (
                                            <button key={value} type="button"
                                                onClick={() => set("bannerLabel", active ? "" : value)}
                                                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all text-left ${active ? 'border-primary bg-primary/10 text-primary' : 'border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30 hover:text-gray-200'}`}
                                            >
                                                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
                                                {value}
                                                {active && <CheckCircle size={12} className="text-primary ml-auto shrink-0" />}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">Or write your own custom label</label>
                                    <input
                                        type="text"
                                        maxLength={40}
                                        placeholder="e.g. Just Reduced!"
                                        value={BANNER_LABELS.some(b => b.value === formData.bannerLabel) ? '' : formData.bannerLabel}
                                        onChange={(e) => set("bannerLabel", e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-primary/50"
                                    />
                                </div>
                                {formData.bannerLabel && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-muted)]">Preview:</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-md ${BANNER_LABELS.find(b => b.value === formData.bannerLabel)?.color ?? 'bg-primary/90'}`}>
                                            {formData.bannerLabel}
                                        </span>
                                        <button type="button" onClick={() => set("bannerLabel", "")} className="text-[var(--text-secondary)] hover:text-[var(--text-muted)] transition-colors ml-1">
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Auction Schedule (auction listings only) ──────────────── */}
                    {currentStep === 4 && isAuction && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4 flex items-center gap-2">
                                <Gavel size={20} className="text-orange-400" /> Schedule Your Auction
                            </h2>

                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                <p className="text-xs text-orange-400 font-bold mb-1">Live Auction — 24-Hour Fixed Duration</p>
                                <p className="text-xs text-[var(--text-muted)]">Your auction will run for exactly 24 hours. Anti-snipe protection automatically extends bidding by 3 minutes if a bid arrives in the final 3 minutes.</p>
                            </div>

                            {/* Start Mode Toggle */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">When to Start *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button"
                                        onClick={() => setAuctionSchedule(prev => ({ ...prev, startTime: 'NOW' }))}
                                        className={`p-4 rounded-xl border text-left transition-all ${auctionSchedule.startTime === 'NOW' ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                    >
                                        <p className="font-bold text-sm mb-0.5">⚡ Start Immediately</p>
                                        <p className="text-[10px] opacity-70">Auction goes live right now</p>
                                    </button>
                                    <button type="button"
                                        onClick={() => setAuctionSchedule(prev => ({ ...prev, startTime: prev.startTime === 'NOW' ? '' : prev.startTime }))}
                                        className={`p-4 rounded-xl border text-left transition-all ${auctionSchedule.startTime !== 'NOW' ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                    >
                                        <p className="font-bold text-sm mb-0.5">📅 Schedule for Later</p>
                                        <p className="text-[10px] opacity-70">Pick a specific date &amp; time</p>
                                    </button>
                                </div>
                            </div>

                            {/* Start Date & Time — only shown for scheduled mode */}
                            {auctionSchedule.startTime !== 'NOW' && (<div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)]">Start Date &amp; Time *</label>
                                <Input
                                    type="datetime-local"
                                    value={auctionSchedule.startTime === 'NOW' ? '' : auctionSchedule.startTime}
                                    min={new Date().toISOString().slice(0, 16)}
                                    onChange={e => setAuctionSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                                    className={`${inputCls} h-14 ${hasAttemptedNext && !auctionSchedule.startTime ? 'border-red-500' : ''}`}
                                />
                                {auctionSchedule.startTime && auctionSchedule.startTime !== 'NOW' && (
                                    <p className="text-xs text-orange-400/80 flex items-center gap-1.5">
                                        <Clock size={12} /> Ends: {addHours(auctionSchedule.startTime, 24)}
                                    </p>
                                )}
                            </div>)}

                            {/* Auction Parameters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                        Reserve Price *
                                        <InfoTooltip text="The minimum price you'll accept. If bidding doesn't reach this, the auction ends with no sale. Hidden from buyers." />
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">£</span>
                                        <Input type="number" placeholder="e.g. 15000"
                                            value={auctionSchedule.reservePrice}
                                            onChange={e => setAuctionSchedule(prev => ({ ...prev, reservePrice: e.target.value }))}
                                            className={`${inputCls} pl-8 h-14 ${hasAttemptedNext && !auctionSchedule.reservePrice ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">Hidden from buyers — minimum you'll accept</p>
                                    {auctionMarketValue > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-emerald-400">
                                                CarMazium suggested reserve: {formatPrice(reserveGuide.low)}–{formatPrice(reserveGuide.high)}
                                            </p>
                                            {auctionSchedule.reservePrice && parseFloat(auctionSchedule.reservePrice) > reserveGuide.high && (
                                                <p className={`text-[10px] flex items-start gap-1 ${parseFloat(auctionSchedule.reservePrice) >= auctionMarketValue ? 'text-red-400' : 'text-amber-400'}`}>
                                                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                                    {parseFloat(auctionSchedule.reservePrice) >= auctionMarketValue
                                                        ? "Your reserve is at or above the estimated market value. Dealer bidding may be very limited."
                                                        : "This reserve is above the suggested range and may reduce dealer interest."}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                        Opening Bid
                                        <InfoTooltip text="CarMazium automatically starts bidding at 70% of your Estimated Market Value. This lets dealers make a genuine offer up to 30% below market value while keeping the auction competitive." />
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">£</span>
                                        <Input
                                            type="number"
                                            value={platformOpeningBid > 0 ? platformOpeningBid : ''}
                                            readOnly
                                            className={`${inputCls} pl-8 h-14 bg-[var(--bg-card)] cursor-not-allowed opacity-90`}
                                        />
                                    </div>
                                    <p className="text-[10px] text-emerald-400">
                                        Automatically set to 70% of the {formatPrice(auctionMarketValue)} Estimated Market Value.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                        Min. Bid Increment *
                                        <InfoTooltip text="Each new bid must exceed the current highest bid by at least this amount." />
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">£</span>
                                        <Input type="number" placeholder="e.g. 100"
                                            value={auctionSchedule.minIncrement}
                                            onChange={e => setAuctionSchedule(prev => ({ ...prev, minIncrement: e.target.value }))}
                                            className={`${inputCls} pl-8 h-14 ${hasAttemptedNext && !auctionSchedule.minIncrement ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">Minimum amount each bid must exceed by</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                    <Zap size={14} /> Buy It Now Price
                                    <span className="normal-case text-[var(--text-secondary)] font-normal tracking-normal ml-1">— optional</span>
                                    <InfoTooltip text="Lets a buyer request to end the auction immediately at this price. You'll still need to confirm the request." />
                                </label>
                                <div className="relative max-w-xs">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-lg">£</span>
                                    <Input type="number" placeholder="Leave blank to disable"
                                        value={auctionSchedule.buyItNowPrice}
                                        onChange={e => setAuctionSchedule(prev => ({ ...prev, buyItNowPrice: e.target.value }))}
                                        className={`${inputCls} pl-8 h-14`}
                                    />
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)]">A buyer can request to buy it now at this price — you approve or decline the request</p>
                            </div>

                            {/* Summary card */}
                            {auctionSchedule.reservePrice && auctionSchedule.startingBid && auctionSchedule.startTime && (
                                <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5"><Gavel size={12} /> Auction Summary</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                                        <div>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Reserve</p>
                                            <p className="text-[var(--text-primary)] font-black">{formatPrice(parseFloat(auctionSchedule.reservePrice))}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Opening Bid</p>
                                            <p className="text-[var(--text-primary)] font-bold">{formatPrice(parseFloat(auctionSchedule.startingBid))}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Min. Increment</p>
                                            <p className="text-[var(--text-primary)] font-bold">{formatPrice(parseFloat(auctionSchedule.minIncrement || '0'))}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Duration</p>
                                            <p className="text-orange-400 font-bold">24 hours</p>
                                        </div>
                                    </div>
                                    <div className="border-t border-[var(--border-default)] pt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                                        {auctionSchedule.startTime === 'NOW' ? (
                                            <span className="flex items-center gap-1"><Clock size={10} /> Starts: Immediately</span>
                                        ) : (
                                            <span className="flex items-center gap-1"><Clock size={10} /> Starts: {new Date(auctionSchedule.startTime).toLocaleString('en-GB')}</span>
                                        )}
                                        {auctionSchedule.startTime === 'NOW' ? (
                                            <span className="flex items-center gap-1"><Clock size={10} /> Ends: 24 hours from now</span>
                                        ) : (
                                            <span className="flex items-center gap-1"><Clock size={10} /> Ends: {addHours(auctionSchedule.startTime, 24)}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP 4/5: Review ─────────────────────────────────────────────── */}
                    {currentStep === (isAuction ? 5 : 4) && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold font-heading border-b border-[var(--border-default)] pb-4">Review Your Listing</h2>

                            {/* Vehicle Info */}
                            <SummarySection title="Vehicle Identity" onEdit={() => goToStep(1)}>
                                {isHpiUnlocked && (
                                    <div className="mb-4 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex items-center gap-2">
                                         <Clock className="text-blue-400" size={16} />
                                         <span className="text-sm text-blue-300 font-bold tracking-wide">HPI Report Requested — being prepared</span>
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
                                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-default)]">
                                            <Image src={img} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="80px" />
                                        </div>
                                    ))}
                                </div>
                            </SummarySection>

                            {/* Videos */}
                            {formData.videoUrls && formData.videoUrls.length > 0 && (
                                <SummarySection title={`Videos (${formData.videoUrls.length})`} onEdit={() => goToStep(2)}>
                                    <div className="space-y-4">
                                        {formData.videoUrls.map((url, i) => {
                                            // Extract YouTube embed URL
                                            let ytEmbedUrl: string | null = null
                                            const shortMatch = url.match(/youtu\.be\/([^?&]+)/)
                                            if (shortMatch) ytEmbedUrl = `https://www.youtube.com/embed/${shortMatch[1]}`
                                            if (!ytEmbedUrl) {
                                                try {
                                                    const u = new URL(url)
                                                    const v = u.searchParams.get('v')
                                                    if (v) ytEmbedUrl = `https://www.youtube.com/embed/${v}`
                                                    const shortsMatch = url.match(/\/shorts\/([^?&]+)/)
                                                    if (shortsMatch) ytEmbedUrl = `https://www.youtube.com/embed/${shortsMatch[1]}`
                                                } catch { /* invalid URL */ }
                                            }

                                            let platform = 'Video'
                                            if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'YouTube'
                                            else if (url.includes('instagram.com')) platform = 'Instagram'
                                            else if (url.includes('facebook.com') || url.includes('fb.watch')) platform = 'Facebook'
                                            else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'X / Twitter'

                                            if (ytEmbedUrl) {
                                                return (
                                                    <div key={i} className="rounded-xl overflow-hidden border border-[var(--border-default)] bg-black">
                                                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                                            <iframe
                                                                src={ytEmbedUrl}
                                                                title={`Video ${i + 1}`}
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                allowFullScreen
                                                                className="absolute inset-0 w-full h-full"
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] hover:border-primary/30 transition-colors group">
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/20 shrink-0">{platform}</span>
                                                    <span className="text-xs text-blue-400 truncate flex-1 group-hover:text-blue-300">{url}</span>
                                                    <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />
                                                </a>
                                            )
                                        })}
                                    </div>
                                </SummarySection>
                            )}

                            {/* Damage Records */}
                            {damageRecords.length > 0 && (
                                <SummarySection title={`Reported Damage (${damageRecords.length} zone${damageRecords.length !== 1 ? 's' : ''})`} onEdit={() => goToStep(2)}>
                                    <div className="space-y-2">
                                        {damageRecords.map((record, i) => (
                                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)]">
                                                {record.photoUrl && (
                                                    <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 border border-[var(--border-default)]">
                                                        <Image src={record.photoUrl} alt={record.zone} fill className="object-cover" sizes="48px" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--text-primary)]">{record.zone}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{record.description}</p>
                                                    <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mt-0.5">{record.view} view</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SummarySection>
                            )}

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
                                    <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
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
                                        </div>
                                    </div>
                                )}
                                {formData.features.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {formData.features.map((f, i) => (
                                            <span key={i} className="text-xs bg-[var(--bg-input)] text-[var(--text-secondary)] px-2 py-1 rounded-md border border-[var(--border-default)]">{f}</span>
                                        ))}
                                    </div>
                                )}
                                {formData.title && <div className="mt-3 pt-3 border-t border-[var(--border-default)]"><p className="text-xs text-[var(--text-muted)] uppercase mb-1">Title</p><p className="text-[var(--text-primary)] font-semibold">{formData.title}</p></div>}
                                {formData.description && <p className="text-sm text-[var(--text-muted)] mt-2">{formData.description}</p>}
                            </SummarySection>

                            <SummarySection title="Pricing" onEdit={() => goToStep(3)}>
                                <div className="flex flex-col gap-3">
                                    {isAuction ? (
                                        <div>
                                            <p className="text-[10px] text-primary uppercase font-bold mb-0.5">Estimated Market Value</p>
                                            <p className="text-[var(--text-primary)] font-black text-2xl tabular-nums">{formatPrice(formData.priceAsking)}</p>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Internal guide value used to calculate the 70% opening bid.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">Lower</p>
                                                <p className="text-[var(--text-primary)] font-bold text-lg tabular-nums">{formData.priceMin ? formatPrice(formData.priceMin) : '—'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-primary uppercase font-bold mb-0.5">Asking Price</p>
                                                <p className="text-[var(--text-primary)] font-black text-2xl tabular-nums">{formatPrice(formData.priceAsking)}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 mt-1">
                                        {formData.badgeTier === 'FREE' && formData.listingType === 'AUCTION' && (
                                            <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">🔨 For Auction — Free</span>
                                        )}
                                        {formData.badgeTier === 'BASIC' && (
                                            <span className="text-xs bg-white/10 text-[var(--text-muted)] px-2 py-0.5 rounded-md">Basic — £1</span>
                                        )}
                                        {formData.badgeTier === 'STANDARD' && (
                                            <>
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1"><BadgeCheck size={10} /> Standard — £10</span>
                                                <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md">HPI Included</span>
                                                <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-md">Verified</span>
                                            </>
                                        )}
                                        {formData.badgeTier === 'PREMIUM' && (
                                            <>
                                                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1"><Star size={10} /> Premium — £25 · HPI + 28-day Boost</span>
                                                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">HPI Included</span>
                                                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-md">Verified</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </SummarySection>

                            {/* Auction Schedule Summary */}
                            {isAuction && auctionSchedule.startTime && (
                                <SummarySection title="Auction Schedule" onEdit={() => goToStep(4)}>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <SummaryField label="Start Time" value={new Date(auctionSchedule.startTime).toLocaleString('en-GB')} />
                                        <SummaryField label="End Time" value={addHours(auctionSchedule.startTime, 24)} />
                                        <SummaryField label="Duration" value="24 hours" />
                                        <SummaryField label="Reserve Price" value={formatPrice(parseFloat(auctionSchedule.reservePrice)) as string} />
                                        <SummaryField label="Opening Bid (70%)" value={formatPrice(platformOpeningBid) as string} />
                                        <SummaryField label="Min. Increment" value={formatPrice(parseFloat(auctionSchedule.minIncrement || '0')) as string} />
                                    </div>
                                </SummarySection>
                            )}

                            {submitError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                                    <p className="text-red-400 text-sm">{submitError}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between mt-10 pt-6 border-t border-[var(--border-default)]">
                        {currentStep > 1
                            ? <Button variant="outline" onClick={handleBack} className="px-7 hover:bg-primary/5 dark:hover:bg-white/10"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                            : <div />
                        }
                        {currentStep < totalSteps
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
                <h3 className="font-bold">{title}</h3>
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
            <p className="text-[10px] text-[var(--text-muted)] uppercase mb-0.5">{label}</p>
            <p className={`text-[var(--text-primary)] font-medium text-sm ${mono ? "font-mono tracking-wide" : ""}`}>{value}</p>
        </div>
    )
}
