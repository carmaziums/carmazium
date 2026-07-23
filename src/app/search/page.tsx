"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { CarCard } from "@/components/features/CarCard"
import {
    Search, Filter, X, Gavel, AlertTriangle, Loader2,
    RotateCcw, ChevronDown, ShieldCheck, Star, ArrowRight, MapPin, Truck, EyeOff,
} from "lucide-react"
import { getListings, getFeaturedListings, formatPrice, type Listing, type ListingFilters, type VehicleConditionValue, type EuroStandardValue } from "@/lib/listingApi"
import { BODY_TYPE_ICONS, BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"
import { useLocation } from "@/context/LocationContext"
import { haversineDistanceMiles } from "@/lib/distance"
import { CAR_MAKES, getModelsForMake } from "@/lib/carData"

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULAR_FEATURES = [
    'Air Conditioning', 'Climate Control', 'Alloy Wheels',
    'Parking Sensors (Front)', 'Parking Sensors (Rear)', 'Reverse Camera',
    'Sat Nav', 'Bluetooth / Hands Free', 'DAB Radio',
    'Heated Seats', 'Cruise Control', 'Panoramic Roof',
    'Apple CarPlay', 'Android Auto', 'Keyless Entry',
    'Lane Assist', 'Blind Spot Monitoring', 'Adaptive Cruise Control',
] as const

const FUEL_TYPES = [
    'Bi Fuel', 'Diesel', 'Diesel Hybrid', 'Diesel Plug-in Hybrid', 'Electric',
    'Hybrid', 'Hydrogen', 'LPG', 'Natural Gas', 'Petrol', 'Petrol Hybrid',
    'Petrol Plug-in Hybrid', 'Plugin Hybrid', 'Unlisted',
] as const
const FUEL_MAP: Record<string, string> = {
    'Petrol': 'PETROL', 'Diesel': 'DIESEL', 'Hybrid': 'HYBRID',
    'Electric': 'ELECTRIC', 'Plugin Hybrid': 'PLUGIN_HYBRID',
    'LPG': 'LPG', 'Hydrogen': 'HYDROGEN_CELL',
    'Bi Fuel': 'BI_FUEL', 'Natural Gas': 'NATURAL_GAS',
    'Petrol Hybrid': 'PETROL_HYBRID', 'Diesel Hybrid': 'DIESEL_HYBRID',
    'Petrol Plug-in Hybrid': 'PETROL_PLUGIN_HYBRID', 'Diesel Plug-in Hybrid': 'DIESEL_PLUGIN_HYBRID',
    'Unlisted': 'UNLISTED',
}
// Reverse map: API enum values → display labels (used when AI filter cards pass singular fuelType)
const REVERSE_FUEL_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(FUEL_MAP).map(([label, value]) => [value, label])
)

const TRANSMISSION_TYPES = ['Manual', 'Automatic', 'Semi-Automatic', 'CVT'] as const
const TRANS_MAP: Record<string, string> = {
    'Manual': 'MANUAL', 'Automatic': 'AUTOMATIC', 'Semi-Automatic': 'SEMI_AUTOMATIC', 'CVT': 'CVT',
}
const REVERSE_TRANS_MAP: Record<string, string> = Object.fromEntries(
    Object.entries(TRANS_MAP).map(([label, value]) => [value, label])
)

const CONDITION_OPTIONS: { value: VehicleConditionValue; label: string }[] = [
    { value: 'EXCELLENT', label: 'Excellent' },
    { value: 'GOOD', label: 'Good' },
    { value: 'FAIR', label: 'Fair' },
    { value: 'POOR', label: 'Poor' },
    { value: 'CAT_S', label: 'CAT S (write-off)' },
    { value: 'CAT_N', label: 'CAT N (write-off)' },
    { value: 'CAT_C', label: 'CAT C (write-off)' },
    { value: 'CAT_D', label: 'CAT D (write-off)' },
]

const EURO_OPTIONS: { value: EuroStandardValue; label: string }[] = [
    { value: 'EURO_4', label: 'Euro 4' },
    { value: 'EURO_5', label: 'Euro 5' },
    { value: 'EURO_6', label: 'Euro 6' },
    { value: 'EURO_6D', label: 'Euro 6d' },
]

const SORT_OPTIONS = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low → High', value: 'price_asc' },
    { label: 'Price: High → Low', value: 'price_desc' },
    { label: 'Mileage: Low → High', value: 'mileage_asc' },
    { label: 'Mileage: High → Low', value: 'mileage_desc' },
    { label: 'Year: Newest', value: 'year_desc' },
    { label: 'Year: Oldest', value: 'year_asc' },
]

const CURRENT_YEAR = new Date().getFullYear()

const DISTANCE_CHIPS = [10, 25, 50, 100, 200] as const

const PAGE_SIZE = 10

// ─── Filter State ─────────────────────────────────────────────────────────────

interface FilterState {
    search: string
    make: string
    model: string
    minPrice: string
    maxPrice: string
    minYear: string
    maxYear: string
    minMileage: string
    maxMileage: string
    fuelTypes: string[]
    transmissions: string[]
    bodyType: string
    color: string
    minDoors: string
    minSeats: string
    minEngine: string
    maxEngine: string
    maxCo2: string
    conditions: VehicleConditionValue[]
    ulezCompliant: 'yes' | 'no' | ''
    euroStandard: EuroStandardValue | ''
    vehicleType: string
    minBhp: string
    maxBhp: string
    sellerType: 'PRIVATE' | 'DEALER' | ''
    location: string
    listingType: 'CLASSIFIED' | 'AUCTION' | ''
    sortBy: string
    features: string[]
    maxDistanceMi: number | null
    deliveryAvailable: boolean
    isImported: 'yes' | 'no' | ''
}

const INITIAL_FILTERS: FilterState = {
    search: '', make: '', model: '',
    minPrice: '', maxPrice: '',
    minYear: '', maxYear: '',
    minMileage: '', maxMileage: '',
    fuelTypes: [], transmissions: [],
    bodyType: '', color: '',
    minDoors: '', minSeats: '',
    minEngine: '', maxEngine: '', maxCo2: '',
    conditions: [], ulezCompliant: '', euroStandard: '',
    vehicleType: 'CAR',
    minBhp: '', maxBhp: '',
    sellerType: '', location: '', listingType: '',
    sortBy: 'newest',
    features: [],
    maxDistanceMi: null,
    deliveryAvailable: false,
    isImported: '',
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = false }: {
    title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
    const [open, setOpen] = React.useState(defaultOpen)
    return (
        <div className="border-b border-[var(--border-default)] pb-4">
            <button type="button" onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-sm font-bold uppercase text-[var(--text-muted)] tracking-wide hover:text-[var(--text-secondary)] transition-colors cursor-pointer py-1"
            >
                {title}
                <ChevronDown size={16} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="mt-3">{children}</div>}
        </div>
    )
}

// ─── Range Pair Input ─────────────────────────────────────────────────────────

function RangeInputs({ minVal, maxVal, onMinChange, onMaxChange, minPlaceholder = 'Min', maxPlaceholder = 'Max' }: {
    minVal: string; maxVal: string
    onMinChange: (v: string) => void; onMaxChange: (v: string) => void
    minPlaceholder?: string; maxPlaceholder?: string
}) {
    return (
        <div className="flex gap-2">
            <Input type="number" placeholder={minPlaceholder} value={minVal}
                onChange={(e) => onMinChange(e.target.value)}
                className="h-9 text-sm" />
            <Input type="number" placeholder={maxPlaceholder} value={maxVal}
                onChange={(e) => onMaxChange(e.target.value)}
                className="h-9 text-sm" />
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    )
}

function SearchPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { location: userLocation, setPostcode } = useLocation()
    const [isFilterOpen, setIsFilterOpen] = React.useState(false)
    const [detectingLocation, setDetectingLocation] = React.useState(false)
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [totalCount, setTotalCount] = React.useState(0)
    const [currentPage, setCurrentPage] = React.useState(1)
    const [totalPages, setTotalPages] = React.useState(1)
    const resultsTopRef = React.useRef<HTMLDivElement>(null)
    const [featuredListings, setFeaturedListings] = React.useState<Listing[]>([])

    // Fetch featured listings once on mount
    React.useEffect(() => {
        getFeaturedListings().then(setFeaturedListings).catch(() => { })
    }, [])

    // Hydrate initial filters from URL query params
    const hydrateFromUrl = React.useCallback((): FilterState => {
        const p = (k: string) => searchParams.get(k) || ''
        return {
            search: p('search'), make: p('make'), model: p('model'),
            minPrice: p('minPrice'), maxPrice: p('maxPrice'),
            minYear: p('minYear'), maxYear: p('maxYear'),
            minMileage: p('minMileage'), maxMileage: p('maxMileage'),
            fuelTypes: searchParams.get('fuelTypes')?.split(',').filter(Boolean)
                || (searchParams.get('fuelType') ? [REVERSE_FUEL_MAP[searchParams.get('fuelType')!] || searchParams.get('fuelType')!] : []),
            transmissions: searchParams.get('transmissions')?.split(',').filter(Boolean)
                || (searchParams.get('transmission') ? [REVERSE_TRANS_MAP[searchParams.get('transmission')!] || searchParams.get('transmission')!] : []),
            bodyType: p('bodyType'), color: p('color'),
            minDoors: p('minDoors'), minSeats: p('minSeats'),
            minEngine: p('minEngine'), maxEngine: p('maxEngine'), maxCo2: p('maxCo2'),
            conditions: (searchParams.get('conditions')?.split(',').filter(Boolean) as VehicleConditionValue[])
                || (p('condition') ? [p('condition') as VehicleConditionValue] : []),
            ulezCompliant: (p('ulezCompliant') as 'yes' | 'no') || '',
            euroStandard: (p('euroStandard') as EuroStandardValue) || '',
            vehicleType: p('vehicleType') || 'CAR',
            minBhp: p('minBhp'), maxBhp: p('maxBhp'),
            sellerType: (p('sellerType') as 'PRIVATE' | 'DEALER') || '',
            location: p('location'), listingType: (p('listingType') as 'CLASSIFIED' | 'AUCTION') || '',
            sortBy: p('sortBy') || 'newest',
            features: searchParams.get('features')?.split(',').filter(Boolean) || [],
            maxDistanceMi: searchParams.get('maxDistanceMi') ? Number(searchParams.get('maxDistanceMi')) : null,
            deliveryAvailable: p('deliveryAvailable') === 'true',
            isImported: (p('isImported') as 'yes' | 'no') || '',
        }
    }, [searchParams])

    const [filters, setFilters] = React.useState<FilterState>(() => {
        const fromUrl = typeof window !== 'undefined' ? null : null // will hydrate in effect
        return INITIAL_FILTERS
    })
    const [appliedFilters, setAppliedFilters] = React.useState<FilterState>(INITIAL_FILTERS)

    // Sync filters when searchParams change externally (e.g., from AI widget)
    const currentQs = searchParams.toString()
    const lastQs = React.useRef(currentQs)
    const didInitialHydrate = React.useRef(false)

    // Ref holding latest state for the unmount-save without re-subscribing effects
    const searchCacheRef = React.useRef({ listings, totalCount, currentPage, totalPages, filters: appliedFilters })
    React.useEffect(() => {
        searchCacheRef.current = { listings, totalCount, currentPage, totalPages, filters: appliedFilters }
    }, [listings, totalCount, currentPage, totalPages, appliedFilters])

    // Save state to sessionStorage on unmount (navigation away from search page)
    React.useEffect(() => {
        return () => {
            if (searchCacheRef.current.listings.length === 0) return
            try {
                sessionStorage.setItem('search_listings_cache', JSON.stringify({
                    qs: window.location.search,
                    scrollY: window.scrollY,
                    ...searchCacheRef.current,
                }))
            } catch { /* quota exceeded or SSR */ }
        }
    }, [])

    // Effect moved down after fetchListings definition

    const set = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
        setFilters(prev => ({ ...prev, [key]: val }))

    const handleDetectLocation = async () => {
        if (!navigator?.geolocation) return
        setDetectingLocation(true)
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
            )
            const { latitude, longitude } = pos.coords
            const resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            )
            const data = await resp.json()
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || ''
            if (city) set('location', city)
        } catch {
            // silently ignore — user may have denied permission
        } finally {
            setDetectingLocation(false)
        }
    }

    // Count active filters for badge
    const activeFilterCount = React.useMemo(() => {
        let count = 0
        if (appliedFilters.make) count++
        if (appliedFilters.model) count++
        if (appliedFilters.minPrice || appliedFilters.maxPrice) count++
        if (appliedFilters.minYear || appliedFilters.maxYear) count++
        if (appliedFilters.minMileage || appliedFilters.maxMileage) count++
        if (appliedFilters.fuelTypes.length) count++
        if (appliedFilters.transmissions.length) count++
        if (appliedFilters.bodyType) count++
        if (appliedFilters.color) count++
        if (appliedFilters.minDoors) count++
        if (appliedFilters.minSeats) count++
        if (appliedFilters.minEngine || appliedFilters.maxEngine) count++
        if (appliedFilters.maxCo2) count++
        if (appliedFilters.conditions.length) count++
        if (appliedFilters.ulezCompliant) count++
        if (appliedFilters.euroStandard) count++
        if (appliedFilters.vehicleType && appliedFilters.vehicleType !== 'CAR') count++
        if (appliedFilters.minBhp || appliedFilters.maxBhp) count++
        if (appliedFilters.sellerType) count++
        if (appliedFilters.location) count++
        if (appliedFilters.listingType) count++
        if (appliedFilters.maxDistanceMi) count++
        if (appliedFilters.deliveryAvailable) count++
        if (appliedFilters.isImported) count++
        return count
    }, [appliedFilters])

    // Build API filters from state
    const buildApiFilters = React.useCallback((state: FilterState): ListingFilters => {
        const f: ListingFilters = { limit: PAGE_SIZE }
        if (state.search) f.search = state.search
        if (state.make) f.make = state.make
        if (state.model) f.model = state.model
        if (state.minPrice) f.minPrice = parseFloat(state.minPrice)
        if (state.maxPrice) f.maxPrice = parseFloat(state.maxPrice)
        if (state.minYear) f.minYear = parseInt(state.minYear)
        if (state.maxYear) f.maxYear = parseInt(state.maxYear)
        if (state.minMileage) f.minMileage = parseInt(state.minMileage)
        if (state.maxMileage) f.maxMileage = parseInt(state.maxMileage)
        if (state.fuelTypes.length === 1) f.fuelType = FUEL_MAP[state.fuelTypes[0]]
        else if (state.fuelTypes.length > 1) f.fuelTypes = state.fuelTypes.map(t => FUEL_MAP[t])
        if (state.transmissions.length === 1) f.transmission = TRANS_MAP[state.transmissions[0]]
        else if (state.transmissions.length > 1) f.transmissions = state.transmissions.map(t => TRANS_MAP[t])
        if (state.bodyType) f.bodyType = state.bodyType
        if (state.color) f.color = state.color
        if (state.minDoors) f.minDoors = parseInt(state.minDoors)
        if (state.minSeats) f.minSeats = parseInt(state.minSeats)
        if (state.minEngine) f.minEngine = parseInt(state.minEngine)
        if (state.maxEngine) f.maxEngine = parseInt(state.maxEngine)
        if (state.maxCo2) f.maxCo2 = parseInt(state.maxCo2)
        if (state.conditions.length) f.conditions = state.conditions
        if (state.ulezCompliant) f.ulezCompliant = state.ulezCompliant === 'yes'
        if (state.euroStandard) f.euroStandard = state.euroStandard
        if (state.vehicleType) f.vehicleType = state.vehicleType
        if (state.minBhp) f.minBhp = parseInt(state.minBhp)
        if (state.maxBhp) f.maxBhp = parseInt(state.maxBhp)
        if (state.sellerType) f.sellerType = state.sellerType
        if (state.location) f.location = state.location
        if (state.listingType) f.listingType = state.listingType
        if (state.sortBy && state.sortBy !== 'newest') f.sortBy = state.sortBy
        if (state.features?.length) f.features = state.features
        if (state.deliveryAvailable) f.deliveryAvailable = true
        if (state.isImported === 'yes') f.isImported = true
        else if (state.isImported === 'no') f.isImported = false
        return f
    }, [])

    // Fetch listings
    const fetchListings = React.useCallback(async (filterState: FilterState, page = 1) => {
        try {
            setLoading(true)
            setError(null)
            const apiFilters = buildApiFilters(filterState)
            apiFilters.page = page
            const response = await getListings(apiFilters)

            let filtered = response.data
            if (filterState.maxDistanceMi && userLocation?.lat && userLocation?.lng) {
                filtered = filtered.filter(l =>
                    l.latitude != null && l.longitude != null &&
                    haversineDistanceMiles(userLocation.lat!, userLocation.lng!, l.latitude, l.longitude) <= filterState.maxDistanceMi!
                )
                filtered.sort((a, b) => {
                    const dA = haversineDistanceMiles(userLocation.lat!, userLocation.lng!, a.latitude!, a.longitude!)
                    const dB = haversineDistanceMiles(userLocation.lat!, userLocation.lng!, b.latitude!, b.longitude!)
                    return dA - dB
                })
            }
            setListings(filtered)
            setTotalCount(response.pagination.total)
            setTotalPages(response.pagination.totalPages)
            setCurrentPage(page)
        } catch (err) {
            console.error('Failed to fetch listings:', err)
            setError(err instanceof Error ? err.message : 'Failed to load listings')
        } finally {
            setLoading(false)
        }
    }, [buildApiFilters])

    React.useEffect(() => {
        if (!didInitialHydrate.current) {
            didInitialHydrate.current = true

            // Restore from sessionStorage when the user navigates back
            try {
                const raw = sessionStorage.getItem('search_listings_cache')
                if (raw) {
                    const cache = JSON.parse(raw)
                    if (cache.qs === window.location.search) {
                        sessionStorage.removeItem('search_listings_cache')
                        setListings(cache.listings)
                        setTotalCount(cache.totalCount)
                        setCurrentPage(cache.currentPage)
                        setTotalPages(cache.totalPages ?? (Math.ceil(cache.totalCount / PAGE_SIZE) || 1))
                        setAppliedFilters(cache.filters)
                        setFilters(cache.filters)
                        setLoading(false)
                        requestAnimationFrame(() => window.scrollTo(0, cache.scrollY ?? 0))
                        return
                    }
                    sessionStorage.removeItem('search_listings_cache')
                }
            } catch { /* ignore parse errors */ }

            const fromUrl = hydrateFromUrl()
            setFilters(fromUrl)
            setAppliedFilters(fromUrl)
            fetchListings(fromUrl)
            return
        }

        // Handle external navigations (e.g. from chatbot)
        if (lastQs.current !== currentQs) {
            lastQs.current = currentQs
            const fromUrl = hydrateFromUrl()
            setFilters(fromUrl)
            setAppliedFilters(fromUrl)
            fetchListings(fromUrl)
        }
    }, [currentQs, hydrateFromUrl, fetchListings])

    // (Initial mount fetch relies on didInitialHydrate inside the main effect above)

    // ─── Handlers ─────────────────────────────────────────────────────────────

    // Sync filters → URL query params
    const pushFiltersToUrl = React.useCallback((state: FilterState) => {
        const params = new URLSearchParams()
        const skip = new Set(['sortBy'])
        for (const [k, v] of Object.entries(state)) {
            if (skip.has(k) && v === 'newest') continue
            if (Array.isArray(v)) { if (v.length) params.set(k, v.join(',')) }
            else if (v !== '' && v !== undefined && v !== null) params.set(k, String(v))
        }
        const qs = params.toString()
        lastQs.current = qs // Stop useEffect double fetch
        router.replace(qs ? `/search?${qs}` : '/search', { scroll: false })
    }, [router])

    const handleApplyFilters = () => {
        setAppliedFilters({ ...filters })
        fetchListings(filters)
        pushFiltersToUrl(filters)
        setIsFilterOpen(false)
    }
    const handleResetFilters = () => {
        setFilters(INITIAL_FILTERS)
        setAppliedFilters(INITIAL_FILTERS)
        fetchListings(INITIAL_FILTERS)
        lastQs.current = '' // Stop useEffect double fetch
        router.replace('/search', { scroll: false })
    }
    const handleSearch = () => {
        const updated = { ...filters }
        setAppliedFilters(updated)
        fetchListings(updated)
        pushFiltersToUrl(updated)
    }
    const handleSortChange = (value: string) => {
        const updated = { ...appliedFilters, sortBy: value }
        setFilters(prev => ({ ...prev, sortBy: value }))
        setAppliedFilters(updated)
        fetchListings(updated)
    }
    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages || page === currentPage) return
        fetchListings(appliedFilters, page)
        resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const toggleFuelType = (f: string) => setFilters(prev => ({ ...prev, fuelTypes: prev.fuelTypes.includes(f) ? prev.fuelTypes.filter(x => x !== f) : [...prev.fuelTypes, f] }))
    const toggleTransmission = (t: string) => setFilters(prev => ({ ...prev, transmissions: prev.transmissions.includes(t) ? prev.transmissions.filter(x => x !== t) : [...prev.transmissions, t] }))

    const getListingImage = (listing: Listing) => {
        if (listing.images?.length > 0) {
            const valid = listing.images.find(img => !img.includes('example.com'))
            if (valid) return valid
        }
        return "/assets/images/featured-sports.png"
    }

    // Quick-remove helper for applied filter tags
    const clearFilter = (patch: Partial<FilterState>) => {
        const u = { ...appliedFilters, ...patch }
        setFilters(u); setAppliedFilters(u); fetchListings(u)
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen pb-20">
            {/* Search Header */}
            <div className="glass-strong py-12 px-5 border-b border-[var(--border-default)]">
                <div className="container mx-auto">
                    <h1 className="text-3xl md:text-4xl font-heading font-bold mb-6">Find Your Perfect Car</h1>
                    <div className="flex gap-4 max-w-4xl bg-[var(--bg-card)] p-2 rounded-lg backdrop-blur-md border border-[var(--border-default)] flex-col md:flex-row">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                            <Input
                                placeholder="Search make, model, or keywords..."
                                value={filters.search}
                                onChange={(e) => set('search', e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="pl-12 h-12"
                            />
                        </div>
                        <Button size="lg" className="h-12 px-8" onClick={handleSearch}>Search</Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-5 py-8 flex flex-col lg:flex-row gap-8">
                {/* Mobile Filter Toggle */}
                <Button className="lg:hidden w-full flex items-center justify-between" variant="outline"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}>
                    <span className="flex items-center gap-2">
                        <Filter size={18} /> Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                        )}
                    </span>
                    {isFilterOpen ? <X size={18} /> : null}
                </Button>

                {/* ── Sidebar Overlay (Mobile) ── */}
                {isFilterOpen && (
                    <div
                        className="fixed inset-0 z-[55] bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
                        onClick={() => setIsFilterOpen(false)}
                    />
                )}

                {/* ── Sidebar ──────────────────────────────────────────────────── */}
                <aside className={`
                    fixed inset-x-0 bottom-0 z-[60] lg:z-10 flex flex-col h-[85vh] bg-[var(--bg-dropdown)] border-t border-[var(--border-default)] rounded-t-3xl shadow-2xl transition-transform duration-300
                    lg:static lg:w-72 lg:flex-shrink-0 lg:glass-card lg:border lg:rounded-2xl lg:shadow-none lg:translate-y-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:flex lg:flex-col lg:overflow-visible lg:p-0
                    ${isFilterOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
                `}>
                    <div className="flex justify-between items-center p-6 pb-4 border-b border-[var(--border-default)] lg:px-6 lg:pt-6 lg:pb-4 lg:border-b lg:border-[var(--border-default)] shrink-0">
                        <h3 className="font-heading font-bold text-xl">Filters</h3>
                        <div className="flex items-center gap-4">
                            {activeFilterCount > 0 && (
                                <button onClick={handleResetFilters} className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-1">
                                    <RotateCcw size={12} /> Reset All
                                </button>
                            )}
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="lg:hidden text-[var(--text-muted)] hover:text-primary dark:hover:text-white bg-[var(--bg-card)] w-8 h-8 rounded-full flex items-center justify-center"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="px-6 py-4 overflow-y-auto flex-1 scrollbar-hide">
                        <div className="space-y-4">
                            {/* Vehicle Category */}
                            <div className="pb-4 border-b border-[var(--border-default)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Vehicle Category</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'CAR', label: '🚗 Cars' },
                                        { value: 'MOTORCYCLE', label: '🏍 Bikes' },
                                        { value: 'HGV', label: '🚛 HGV' },
                                    ].map((opt) => {
                                        const active = filters.vehicleType === opt.value
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => setFilters(prev => ({ ...prev, vehicleType: opt.value }))}
                                                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all text-center ${
                                                    active
                                                        ? 'border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(237,28,36,0.15)]'
                                                        : 'border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:border-primary/30 hover:text-[var(--text-secondary)]'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Body Type — hidden for motorcycles */}
                            {filters.vehicleType !== 'MOTORCYCLE' && (
                            <FilterSection title="Body Type">
                                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                                    {BODY_TYPE_KEYS.map((key) => {
                                        const Icon = BODY_TYPE_ICONS[key]
                                        const isActive = filters.bodyType === key
                                        return (
                                            <button key={key} type="button"
                                                onClick={() => set('bodyType', filters.bodyType === key ? '' : key)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${isActive ? 'bg-primary/15 text-primary border border-primary/30' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)] dark:hover:text-white border border-transparent'}`}
                                            >
                                                <Icon className="w-8 h-4 shrink-0" />{BODY_TYPE_LABELS[key]}
                                            </button>
                                        )
                                    })}
                                </div>
                            </FilterSection>
                            )}

                            {/* Make & Model */}
                            <FilterSection title="Make / Model" defaultOpen={true}>
                                <div className="space-y-2">
                                    {/* Make — text input with datalist autocomplete */}
                                    <div className="relative">
                                        <input
                                            list="make-options"
                                            placeholder="Make (e.g. BMW)"
                                            value={filters.make}
                                            onChange={(e) => {
                                                set('make', e.target.value)
                                                set('model', '') // reset model when make changes
                                            }}
                                            className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"
                                        />
                                        <datalist id="make-options">
                                            {CAR_MAKES.map(m => <option key={m} value={m} />)}
                                        </datalist>
                                    </div>
                                    {/* Model — inline scrollable list when make is known, text input otherwise */}
                                    {(() => {
                                        const models = getModelsForMake(filters.make)
                                        return models.length > 0 ? (
                                            <div className="max-h-44 overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] space-y-0.5 p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => set('model', '')}
                                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${!filters.model ? 'bg-primary/15 text-primary font-semibold' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)] dark:hover:text-white'}`}
                                                >
                                                    All {filters.make} models
                                                </button>
                                                {models.map(m => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => set('model', m)}
                                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${filters.model === m ? 'bg-primary/15 text-primary font-semibold' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)] dark:hover:text-white'}`}
                                                    >
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <Input
                                                placeholder="Model (e.g. M4)"
                                                value={filters.model}
                                                onChange={(e) => set('model', e.target.value)}
                                                className="h-9 text-sm bg-[var(--bg-input)] border-[var(--border-default)] placeholder:text-[var(--text-muted)]"
                                            />
                                        )
                                    })()}
                                </div>
                            </FilterSection>

                            {/* Price Range */}
                            <FilterSection title="Price (£)" defaultOpen={true}>
                                <RangeInputs minVal={filters.minPrice} maxVal={filters.maxPrice}
                                    onMinChange={(v) => set('minPrice', v)} onMaxChange={(v) => set('maxPrice', v)}
                                    minPlaceholder="Min £" maxPlaceholder="Max £" />
                            </FilterSection>

                            {/* Year Range */}
                            <FilterSection title="Year">
                                <RangeInputs minVal={filters.minYear} maxVal={filters.maxYear}
                                    onMinChange={(v) => set('minYear', v)} onMaxChange={(v) => set('maxYear', v)}
                                    minPlaceholder={`From`} maxPlaceholder={`${CURRENT_YEAR}`} />
                            </FilterSection>

                            {/* Mileage Range */}
                            <FilterSection title="Mileage (miles)">
                                <RangeInputs minVal={filters.minMileage} maxVal={filters.maxMileage}
                                    onMinChange={(v) => set('minMileage', v)} onMaxChange={(v) => set('maxMileage', v)}
                                    minPlaceholder="Min" maxPlaceholder="Max" />
                            </FilterSection>

                            {/* Fuel Type */}
                            <FilterSection title="Fuel Type">
                                <div className="space-y-2">
                                    {FUEL_TYPES.map(fuel => (
                                        <label key={fuel} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                            <input type="checkbox" checked={filters.fuelTypes.includes(fuel)} onChange={() => toggleFuelType(fuel)}
                                                className="accent-primary rounded w-4 h-4 bg-[var(--bg-input)] border-[var(--border-default)]" />
                                            {fuel}
                                        </label>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Transmission */}
                            <FilterSection title="Transmission">
                                <div className="space-y-2">
                                    {TRANSMISSION_TYPES.map(trans => (
                                        <label key={trans} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                            <input type="checkbox" checked={filters.transmissions.includes(trans)} onChange={() => toggleTransmission(trans)}
                                                className="accent-primary rounded w-4 h-4 bg-[var(--bg-input)] border-[var(--border-default)]" />
                                            {trans}
                                        </label>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Colour */}
                            <FilterSection title="Colour">
                                <Input placeholder="e.g. White, Black, Blue" value={filters.color}
                                    onChange={(e) => set('color', e.target.value)}
                                    className="h-9 text-sm bg-[var(--bg-input)] border-[var(--border-default)] placeholder:text-[var(--text-muted)]" />
                            </FilterSection>

                            {/* Doors */}
                            <FilterSection title="Doors">
                                <div className="flex gap-2">
                                    {['2', '3', '4', '5'].map(d => (
                                        <button key={d} type="button"
                                            onClick={() => set('minDoors', filters.minDoors === d ? '' : d)}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${filters.minDoors === d ? 'border-primary bg-primary/15 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                        >{d}+</button>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Seats */}
                            <FilterSection title="Seats">
                                <div className="flex gap-2">
                                    {['2', '4', '5', '7'].map(s => (
                                        <button key={s} type="button"
                                            onClick={() => set('minSeats', filters.minSeats === s ? '' : s)}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${filters.minSeats === s ? 'border-primary bg-primary/15 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                        >{s}+</button>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Engine Size */}
                            <FilterSection title="Engine Size (cc)">
                                <RangeInputs minVal={filters.minEngine} maxVal={filters.maxEngine}
                                    onMinChange={(v) => set('minEngine', v)} onMaxChange={(v) => set('maxEngine', v)}
                                    minPlaceholder="Min cc" maxPlaceholder="Max cc" />
                            </FilterSection>

                            {/* CO₂ Emissions */}
                            <FilterSection title="CO₂ (g/km)">
                                <div className="space-y-2">
                                    <Input placeholder="Max g/km" type="number" value={filters.maxCo2}
                                        onChange={(e) => set('maxCo2', e.target.value)}
                                        className="h-9 text-sm bg-[var(--bg-input)] border-[var(--border-default)] placeholder:text-[var(--text-muted)]" />
                                    <div className="flex gap-2">
                                        {['100', '120', '150', '200'].map(v => (
                                            <button key={v} type="button"
                                                onClick={() => set('maxCo2', filters.maxCo2 === v ? '' : v)}
                                                className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer ${filters.maxCo2 === v ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                            >≤{v}</button>
                                        ))}
                                    </div>
                                </div>
                            </FilterSection>

                            {/* Condition */}
                            <FilterSection title="Condition">
                                <div className="space-y-1">
                                    {CONDITION_OPTIONS.map(opt => {
                                        const isActive = filters.conditions.includes(opt.value)
                                        const isCat = opt.value.startsWith('CAT')
                                        return (
                                            <button key={opt.value} type="button"
                                                onClick={() => set('conditions', isActive
                                                    ? filters.conditions.filter(c => c !== opt.value)
                                                    : [...filters.conditions, opt.value]
                                                )}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer flex items-center gap-2 ${isActive ? 'bg-primary/15 text-primary border border-primary/30' : isCat ? 'text-amber-500/70 hover:bg-amber-500/10 border border-transparent' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)] dark:hover:text-white border border-transparent'}`}
                                            >
                                                <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${isActive ? 'bg-primary border-primary' : 'border-white/20'}`}>
                                                    {isActive && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                                </span>
                                                {opt.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </FilterSection>

                            {/* UK Compliance */}
                            <FilterSection title="UK Compliance">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-[var(--text-muted)] mb-1.5 flex items-center gap-1"><ShieldCheck size={11} /> ULEZ / CAZ</p>
                                        <div className="flex gap-2">
                                            {(['yes', 'no', ''] as const).map((v) => (
                                                <button key={v} type="button"
                                                    onClick={() => set('ulezCompliant', v)}
                                                    className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all ${filters.ulezCompliant === v && v !== '' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : v === '' ? filters.ulezCompliant === '' ? 'border-primary bg-primary/10 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)]' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                                >
                                                    {v === 'yes' ? '✓ ULEZ' : v === 'no' ? '✗ Non' : 'Either'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[var(--text-muted)] mb-1.5">Euro Standard</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {([{ value: '' as EuroStandardValue | '', label: 'Any' }, ...EURO_OPTIONS]).map(o => (
                                                <button
                                                    key={o.value}
                                                    type="button"
                                                    onClick={() => set('euroStandard', o.value as EuroStandardValue | '')}
                                                    className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer ${filters.euroStandard === o.value ? 'border-primary bg-primary/15 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30 hover:text-[var(--text-secondary)]'}`}
                                                >
                                                    {o.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </FilterSection>


                            {/* BHP / Power */}
                            <FilterSection title="Power (BHP)">
                                <RangeInputs minVal={filters.minBhp} maxVal={filters.maxBhp}
                                    onMinChange={(v) => set('minBhp', v)} onMaxChange={(v) => set('maxBhp', v)}
                                    minPlaceholder="Min BHP" maxPlaceholder="Max BHP" />
                            </FilterSection>

                            {/* Features / Options */}
                            <FilterSection title="Features / Options">
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {POPULAR_FEATURES.map(feat => (
                                        <label key={feat} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={filters.features.includes(feat)}
                                                onChange={() => setFilters(prev => ({
                                                    ...prev,
                                                    features: prev.features.includes(feat)
                                                        ? prev.features.filter(f => f !== feat)
                                                        : [...prev.features, feat]
                                                }))}
                                                className="accent-primary rounded w-4 h-4 bg-[var(--bg-input)] border-[var(--border-default)]"
                                            />
                                            {feat}
                                        </label>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Location */}
                            <FilterSection title="Location" defaultOpen={true}>
                                <div className="space-y-1.5">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. London, Manchester, B1…"
                                            value={filters.location}
                                            onChange={(e) => set('location', e.target.value)}
                                            className="h-9 text-sm bg-[var(--bg-input)] border-[var(--border-default)] placeholder:text-[var(--text-muted)] flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleDetectLocation}
                                            disabled={detectingLocation}
                                            title="Use my location"
                                            className="h-9 w-9 flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50 shrink-0"
                                        >
                                            {detectingLocation
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <MapPin size={14} />
                                            }
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-[var(--text-secondary)]">Matches listings by city or postcode area</p>
                                </div>
                            </FilterSection>

                            {/* Distance */}
                            <FilterSection title="Distance">
                                <div className="space-y-2">
                                    {!userLocation?.lat && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-[var(--text-muted)]">Allow location or enter your postcode:</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. M1 1AA"
                                                    className="flex-1 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary/50"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') setPostcode((e.target as HTMLInputElement).value)
                                                    }}
                                                    onBlur={(e) => { if (e.target.value) setPostcode(e.target.value) }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <select
                                        value={filters.maxDistanceMi ?? ''}
                                        onChange={(e) => set('maxDistanceMi', e.target.value === '' ? null : Number(e.target.value))}
                                        disabled={!userLocation?.lat}
                                        className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-primary/50"
                                    >
                                        <option value="">Any distance</option>
                                        {DISTANCE_CHIPS.map(d => (
                                            <option key={d} value={d}>Within {d} mi</option>
                                        ))}
                                    </select>
                                    {userLocation?.lat && userLocation.source === 'postcode' && userLocation.postcode && (
                                        <p className="text-[10px] text-[var(--text-secondary)]">Using: {userLocation.postcode}</p>
                                    )}
                                </div>
                            </FilterSection>

                            {/* Listing Type */}
                            <FilterSection title="Listing Type">
                                <div className="flex gap-2">
                                    {([
                                        { value: '' as const, label: 'All' },
                                        { value: 'CLASSIFIED' as const, label: 'Buy Now' },
                                        { value: 'AUCTION' as const, label: 'Auction' },
                                    ]).map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => set('listingType', opt.value)}
                                            className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer ${filters.listingType === opt.value ? 'border-primary bg-primary/15 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                        >{opt.label}</button>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Seller Type */}
                            <FilterSection title="Seller Type">
                                <div className="flex gap-2">
                                    {([
                                        { value: '' as const, label: 'All' },
                                        { value: 'PRIVATE' as const, label: 'Private' },
                                        { value: 'DEALER' as const, label: 'Dealer' },
                                    ]).map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => set('sellerType', opt.value)}
                                            className={`flex-1 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer ${filters.sellerType === opt.value ? 'border-primary bg-primary/15 text-primary' : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                                        >{opt.label}</button>
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Delivery */}
                            <FilterSection title="Delivery">
                                <button
                                    type="button"
                                    onClick={() => set('deliveryAvailable', !filters.deliveryAvailable)}
                                    className={`flex items-center gap-2 w-full py-1.5 px-2.5 rounded-md border text-xs font-semibold transition-all ${
                                        filters.deliveryAvailable
                                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                            : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'
                                    }`}
                                >
                                    <Truck size={12} />
                                    Delivery available
                                </button>
                            </FilterSection>

                            {/* Import status */}
                            <FilterSection title="Import">
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => set('isImported', filters.isImported === 'yes' ? '' : 'yes')}
                                        className={`flex items-center gap-2 w-full py-1.5 px-2.5 rounded-md border text-xs font-semibold transition-all ${
                                            filters.isImported === 'yes'
                                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                                : 'border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'
                                        }`}
                                    >
                                        Imported vehicles
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => set('isImported', filters.isImported === 'no' ? '' : 'no')}
                                        className={`flex items-center gap-2 w-full py-1.5 px-2.5 rounded-md border text-xs font-semibold transition-all ${
                                            filters.isImported === 'no'
                                                ? 'border-primary/60 text-primary bg-transparent'
                                                : 'border-dashed border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30 bg-transparent'
                                        }`}
                                    >
                                        <EyeOff size={12} />
                                        Hide imported cars
                                    </button>
                                </div>
                            </FilterSection>

                        </div>

                        {/* Auction Promo Card */}
                        <div className="hidden lg:block mt-8 p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-2xl -z-10" />
                            <div className="flex items-center gap-2 mb-3">
                                <Gavel className="text-primary" size={20} />
                                <h3 className="font-bold text-lg">Live Auctions</h3>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">Live marketplace for verified buyers and sellers — coming soon.</p>
                            <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-3">
                                <h4 className="text-amber-500 font-bold text-xs mb-1 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Verification Required
                                </h4>
                                <p className="text-[10px] text-amber-200/70 leading-relaxed">KYC identity verification required to participate.</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer — pinned Apply button (visible on both mobile and desktop) */}
                    <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-dropdown)] shrink-0 lg:bg-transparent lg:border-[var(--border-default)]">
                        <Button className="w-full shadow-neon py-6 text-lg lg:py-3 lg:text-sm" onClick={handleApplyFilters}>
                            <span className="lg:hidden">Show Results</span>
                            <span className="hidden lg:inline">Apply Filters</span>
                        </Button>
                    </div>
                </aside>

                {/* ── Results Column ─────────────────────────────────────────── */}
                <div ref={resultsTopRef} className="flex-1 min-w-0">
                    {/* Sort Bar */}
                    <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
                        <p className="text-[var(--text-muted)] text-sm">
                            {loading ? <span>Loading...</span> : appliedFilters.maxDistanceMi ? (
                                <span className="text-xs text-[var(--text-muted)]">Filtered results ({listings.length} within {appliedFilters.maxDistanceMi} mi)</span>
                            ) : totalCount === 0 ? (
                                <>Showing <span className="font-bold">0</span> vehicles</>
                            ) : (
                                <>Showing <span className="font-bold">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of <span className="font-bold">{totalCount}</span> vehicles</>
                            )}
                        </p>
                        <select value={appliedFilters.sortBy} onChange={(e) => handleSortChange(e.target.value)}
                            className="bg-transparent border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm font-bold cursor-pointer outline-none hover:border-primary/30">
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-[var(--bg-dropdown)] text-[var(--text-primary)]">{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Active Filter Tags */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {appliedFilters.bodyType && (
                                <FilterTag label={BODY_TYPE_LABELS[appliedFilters.bodyType]} onRemove={() => clearFilter({ bodyType: '' })} />
                            )}
                            {appliedFilters.make && <FilterTag label={`Make: ${appliedFilters.make}`} onRemove={() => clearFilter({ make: '' })} />}
                            {appliedFilters.model && <FilterTag label={`Model: ${appliedFilters.model}`} onRemove={() => clearFilter({ model: '' })} />}
                            {(appliedFilters.minPrice || appliedFilters.maxPrice) && (
                                <FilterTag label={`£${appliedFilters.minPrice || '0'} – £${appliedFilters.maxPrice || '∞'}`} onRemove={() => clearFilter({ minPrice: '', maxPrice: '' })} />
                            )}
                            {(appliedFilters.minYear || appliedFilters.maxYear) && (
                                <FilterTag label={`${appliedFilters.minYear || ''}–${appliedFilters.maxYear || ''}`} onRemove={() => clearFilter({ minYear: '', maxYear: '' })} />
                            )}
                            {(appliedFilters.minMileage || appliedFilters.maxMileage) && (
                                <FilterTag label={`${appliedFilters.minMileage || '0'}–${appliedFilters.maxMileage || '∞'} mi`} onRemove={() => clearFilter({ minMileage: '', maxMileage: '' })} />
                            )}
                            {appliedFilters.fuelTypes.map(f => <FilterTag key={f} label={f} onRemove={() => clearFilter({ fuelTypes: appliedFilters.fuelTypes.filter(x => x !== f) })} />)}
                            {appliedFilters.transmissions.map(t => <FilterTag key={t} label={t} onRemove={() => clearFilter({ transmissions: appliedFilters.transmissions.filter(x => x !== t) })} />)}
                            {appliedFilters.color && <FilterTag label={`Colour: ${appliedFilters.color}`} onRemove={() => clearFilter({ color: '' })} />}
                            {appliedFilters.conditions.map(c => {
                                const label = CONDITION_OPTIONS.find(o => o.value === c)?.label ?? c
                                return <FilterTag key={c} label={`Condition: ${label}`} onRemove={() => clearFilter({ conditions: appliedFilters.conditions.filter(x => x !== c) })} />
                            })}
                            {appliedFilters.ulezCompliant && <FilterTag label={appliedFilters.ulezCompliant === 'yes' ? 'ULEZ Compliant' : 'Non-ULEZ'} onRemove={() => clearFilter({ ulezCompliant: '' })} />}
                            {appliedFilters.euroStandard && <FilterTag label={appliedFilters.euroStandard.replace('_', ' ')} onRemove={() => clearFilter({ euroStandard: '' })} />}
                            {(appliedFilters.minBhp || appliedFilters.maxBhp) && <FilterTag label={`BHP: ${appliedFilters.minBhp || '0'}–${appliedFilters.maxBhp || '∞'}`} onRemove={() => clearFilter({ minBhp: '', maxBhp: '' })} />}
                            {appliedFilters.location && <FilterTag label={`Near: ${appliedFilters.location}`} onRemove={() => clearFilter({ location: '' })} />}
                            {appliedFilters.listingType && <FilterTag label={appliedFilters.listingType === 'AUCTION' ? 'Auction' : 'Buy Now'} onRemove={() => clearFilter({ listingType: '' })} />}
                            {appliedFilters.sellerType && <FilterTag label={appliedFilters.sellerType === 'DEALER' ? 'Dealer' : 'Private Seller'} onRemove={() => clearFilter({ sellerType: '' })} />}
                            {appliedFilters.maxDistanceMi && <FilterTag label={`Within ${appliedFilters.maxDistanceMi} mi`} onRemove={() => clearFilter({ maxDistanceMi: null })} />}
                            {appliedFilters.deliveryAvailable && (
                                <FilterTag label="Delivery available" onRemove={() => clearFilter({ deliveryAvailable: false })} />
                            )}
                            {appliedFilters.isImported && (
                                <FilterTag
                                    label={appliedFilters.isImported === 'yes' ? 'Imported' : 'Imported hidden'}
                                    onRemove={() => clearFilter({ isImported: '' })}
                                />
                            )}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                            <p className="text-[var(--text-muted)]">Loading listings...</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && !loading && (
                        <div className="glass-card p-8 text-center">
                            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold mb-2">Failed to Load Listings</h3>
                            <p className="text-[var(--text-muted)] mb-4">{error}</p>
                            <Button onClick={() => fetchListings(appliedFilters)}>Try Again</Button>
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && !error && listings.length === 0 && (
                        <div className="glass-card p-8 text-center">
                            <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                            <h3 className="text-xl font-bold mb-2">No Listings Found</h3>
                            <p className="text-[var(--text-muted)] mb-4">
                                {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Be the first to list your car!'}
                            </p>
                            {activeFilterCount > 0
                                ? <Button onClick={handleResetFilters}>Clear All Filters</Button>
                                : <Button onClick={() => window.location.href = '/sell'}>Sell Your Car</Button>
                            }
                        </div>
                    )}

                    {/* ── Featured Pinned Row ────────────────────────────────── */}
                    {!loading && featuredListings.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <Star size={15} className="text-amber-400 fill-amber-400" />
                                <h2 className="text-sm font-bold uppercase tracking-widest text-amber-400">Featured Listings</h2>
                                <div className="flex-1 h-px bg-amber-400/20" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {featuredListings.map((listing) => (
                                    <CarCard
                                        key={listing.id}
                                        title={listing.title}
                                        make={listing.make}
                                        model={listing.model}
                                        price={formatPrice(listing.price)}
                                        priceMin={listing.priceMin}
                                        priceMax={listing.priceMax}
                                        image={getListingImage(listing)}
                                        images={listing.images ?? []}
                                        href={`/buy-cars/${listing.slug}`}
                                        year={listing.year ?? undefined}
                                        mileage={listing.mileage ?? undefined}
                                        fuelType={listing.fuelType ?? undefined}
                                        bodyType={listing.bodyType ?? undefined}
                                        location={listing.location ?? undefined}
                                        distanceMi={userLocation?.lat && userLocation?.lng && listing.latitude && listing.longitude
                                            ? haversineDistanceMiles(userLocation.lat, userLocation.lng, listing.latitude, listing.longitude)
                                            : null}
                                        isFeatured={true}
                                        badgeTier={listing.badgeTier}
                                        status={listing.status}
                                        bannerLabel={listing.bannerLabel}
                                        hasLinkedAuction={!!listing.linkedListingId}
                                        isDepartedSale={listing.isDepartedSale ?? false}
                                        deliveryAvailable={listing.deliveryAvailable ?? false}
                                        exteriorGrade={listing.exteriorGrade}
                                    />
                                ))}
                            </div>
                            <div className="mt-6 border-b border-[var(--border-default)]" />
                            <p className="text-xs text-[var(--text-secondary)] mt-3 mb-6">All listings below</p>
                        </div>
                    )}

                    {/* Grid */}
                    {!loading && !error && listings.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {listings.map((listing) => (
                                <CarCard
                                    key={listing.id}
                                    title={listing.title}
                                    make={listing.make}
                                    model={listing.model}
                                    price={formatPrice(listing.price)}
                                    priceMin={listing.priceMin}
                                    priceMax={listing.priceMax}
                                    image={getListingImage(listing)}
                                    images={listing.images ?? []}
                                    href={`/buy-cars/${listing.slug}`}
                                    year={listing.year ?? undefined}
                                    mileage={listing.mileage ?? undefined}
                                    fuelType={listing.fuelType ?? undefined}
                                    bodyType={listing.bodyType ?? undefined}
                                    location={listing.location ?? undefined}
                                    distanceMi={userLocation?.lat && userLocation?.lng && listing.latitude && listing.longitude
                                        ? haversineDistanceMiles(userLocation.lat, userLocation.lng, listing.latitude, listing.longitude)
                                        : null}
                                    isFeatured={listing.isFeatured}
                                    badgeTier={listing.badgeTier}
                                    status={listing.status}
                                    bannerLabel={listing.bannerLabel}
                                    hasLinkedAuction={!!listing.linkedListingId}
                                    isDepartedSale={listing.isDepartedSale ?? false}
                                    deliveryAvailable={listing.deliveryAvailable ?? false}
                                    exteriorGrade={listing.exteriorGrade}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && !error && listings.length > 0 && (
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                        />
                    )}
                </div>
            </div>

            {/* Compare Options Banner */}
            <div className="container mx-auto px-5 mt-16 mb-8">
                <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-3xl p-8 md:p-12 text-center relative overflow-hidden group shadow-2xl">
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors duration-500" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center">
                        <h2 className="text-3xl font-heading font-bold mb-3 tracking-tight">Still not sure what to Buy?</h2>
                        <p className="text-[var(--text-muted)] mb-8 max-w-xl mx-auto text-lg leading-relaxed">
                            Compare your options side-by-side and find the exact vehicle that suits your needs.
                        </p>
                        <Button
                            asChild
                            variant="default"
                            size="lg"
                            shape="pill"
                            className="bg-primary hover:bg-primary/90 text-white shadow-neon px-8 py-6 text-lg hover:scale-105 transition-transform"
                        >
                            <Link href="/compare">Compare Cars <ArrowRight className="ml-2 w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" /></Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationControls({ currentPage, totalPages, onPageChange }: {
    currentPage: number; totalPages: number; onPageChange: (page: number) => void
}) {
    if (totalPages <= 1) return null

    const pages: (number | 'ellipsis')[] = [1]
    const windowStart = Math.max(2, currentPage - 1)
    const windowEnd = Math.min(totalPages - 1, currentPage + 1)
    if (windowStart > 2) pages.push('ellipsis')
    for (let p = windowStart; p <= windowEnd; p++) pages.push(p)
    if (windowEnd < totalPages - 1) pages.push('ellipsis')
    if (totalPages > 1) pages.push(totalPages)

    const navBtn = "h-9 px-3 rounded-lg border border-[var(--border-default)] text-sm font-semibold text-[var(--text-secondary)] hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"

    return (
        <nav aria-label="Search results pages" className="mt-12 flex items-center justify-center gap-1.5 flex-wrap">
            <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className={navBtn}>
                Prev
            </button>
            {pages.map((p, i) => p === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-[var(--text-muted)] text-sm select-none">…</span>
            ) : (
                <button
                    key={p}
                    type="button"
                    aria-current={p === currentPage ? 'page' : undefined}
                    onClick={() => onPageChange(p)}
                    className={`h-9 min-w-9 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                        p === currentPage
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-primary/40 hover:text-primary'
                    }`}
                >
                    {p}
                </button>
            ))}
            <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className={navBtn}>
                Next
            </button>
        </nav>
    )
}

// ─── Filter Tag ───────────────────────────────────────────────────────────────

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
            {label}
            <button onClick={onRemove} className="ml-1 hover:opacity-60 cursor-pointer"><X size={12} /></button>
        </span>
    )
}
