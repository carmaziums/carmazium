"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { CarCard } from "@/components/features/CarCard"
import { Search, Filter, X, Gavel, AlertTriangle, Loader2, RotateCcw, ChevronDown } from "lucide-react"
import { getListings, formatPrice, type Listing, type ListingFilters } from "@/lib/listingApi"
import { BODY_TYPE_ICONS, BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"

// ─── Constants ───────────────────────────────────────────────────────────────

const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'Plugin Hybrid'] as const
const FUEL_MAP: Record<string, string> = {
    'Petrol': 'PETROL', 'Diesel': 'DIESEL', 'Hybrid': 'HYBRID',
    'Electric': 'ELECTRIC', 'Plugin Hybrid': 'PLUGIN_HYBRID',
}

const TRANSMISSION_TYPES = ['Manual', 'Automatic', 'Semi-Automatic'] as const
const TRANS_MAP: Record<string, string> = {
    'Manual': 'MANUAL', 'Automatic': 'AUTOMATIC', 'Semi-Automatic': 'SEMI_AUTOMATIC',
}

const YEAR_OPTIONS = [
    { label: 'Any Year', value: 0 },
    { label: '2024+', value: 2024 },
    { label: '2022+', value: 2022 },
    { label: '2020+', value: 2020 },
    { label: '2018+', value: 2018 },
    { label: '2015+', value: 2015 },
    { label: '2010+', value: 2010 },
]

const SORT_OPTIONS = [
    { label: 'Newest First', value: 'newest' },
    { label: 'Price: Low → High', value: 'price_asc' },
    { label: 'Price: High → Low', value: 'price_desc' },
    { label: 'Mileage: Low → High', value: 'mileage_asc' },
]

// ─── Filter State ────────────────────────────────────────────────────────────

interface FilterState {
    search: string
    make: string
    minPrice: string
    maxPrice: string
    year: number
    fuelTypes: string[]
    transmissions: string[]
    bodyType: string
    sortBy: string
}

const INITIAL_FILTERS: FilterState = {
    search: '',
    make: '',
    minPrice: '',
    maxPrice: '',
    year: 0,
    fuelTypes: [],
    transmissions: [],
    bodyType: '',
    sortBy: 'newest',
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function FilterSection({ title, children, defaultOpen = false }: {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [open, setOpen] = React.useState(defaultOpen)

    return (
        <div className="border-b border-white/5 pb-4">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-sm font-bold uppercase text-gray-400 tracking-wide hover:text-gray-300 transition-colors cursor-pointer py-1"
            >
                {title}
                <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && <div className="mt-3">{children}</div>}
        </div>
    )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SearchPage() {
    const [isFilterOpen, setIsFilterOpen] = React.useState(false)
    const [listings, setListings] = React.useState<Listing[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [totalCount, setTotalCount] = React.useState(0)
    const [filters, setFilters] = React.useState<FilterState>(INITIAL_FILTERS)
    const [appliedFilters, setAppliedFilters] = React.useState<FilterState>(INITIAL_FILTERS)

    // Count active filters for badge
    const activeFilterCount = React.useMemo(() => {
        let count = 0
        if (appliedFilters.make) count++
        if (appliedFilters.minPrice || appliedFilters.maxPrice) count++
        if (appliedFilters.year) count++
        if (appliedFilters.fuelTypes.length) count++
        if (appliedFilters.transmissions.length) count++
        if (appliedFilters.bodyType) count++
        return count
    }, [appliedFilters])

    // Build API filters from state
    const buildApiFilters = React.useCallback((state: FilterState): ListingFilters => {
        const apiFilters: ListingFilters = { limit: 20 }
        if (state.search) apiFilters.search = state.search
        if (state.make) apiFilters.make = state.make
        if (state.minPrice) apiFilters.minPrice = parseFloat(state.minPrice)
        if (state.maxPrice) apiFilters.maxPrice = parseFloat(state.maxPrice)
        if (state.year) apiFilters.year = state.year
        if (state.fuelTypes.length === 1) apiFilters.fuelType = FUEL_MAP[state.fuelTypes[0]]
        if (state.transmissions.length === 1) apiFilters.transmission = TRANS_MAP[state.transmissions[0]]
        if (state.bodyType) apiFilters.bodyType = state.bodyType
        if (state.sortBy && state.sortBy !== 'newest') apiFilters.sortBy = state.sortBy
        return apiFilters
    }, [])

    // Fetch listings
    const fetchListings = React.useCallback(async (filterState: FilterState) => {
        try {
            setLoading(true)
            setError(null)
            const apiFilters = buildApiFilters(filterState)
            const response = await getListings(apiFilters)

            let data = response.data

            // Client-side multi-select filtering (API only supports single value)
            if (filterState.fuelTypes.length > 1) {
                const mapped = filterState.fuelTypes.map(f => FUEL_MAP[f])
                data = data.filter(l => l.fuelType && mapped.includes(l.fuelType))
            }
            if (filterState.transmissions.length > 1) {
                const mapped = filterState.transmissions.map(t => TRANS_MAP[t])
                data = data.filter(l => l.transmission && mapped.includes(l.transmission))
            }

            setListings(data)
            setTotalCount(response.pagination.total)
        } catch (err) {
            console.error('Failed to fetch listings:', err)
            setError(err instanceof Error ? err.message : 'Failed to load listings')
        } finally {
            setLoading(false)
        }
    }, [buildApiFilters])

    // Initial fetch
    React.useEffect(() => {
        fetchListings(INITIAL_FILTERS)
    }, [fetchListings])

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleApplyFilters = () => {
        setAppliedFilters({ ...filters })
        fetchListings(filters)
        setIsFilterOpen(false)
    }

    const handleResetFilters = () => {
        setFilters(INITIAL_FILTERS)
        setAppliedFilters(INITIAL_FILTERS)
        fetchListings(INITIAL_FILTERS)
    }

    const handleSearch = () => {
        const updated = { ...filters }
        setAppliedFilters(updated)
        fetchListings(updated)
    }

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch()
    }

    const handleSortChange = (value: string) => {
        const updated = { ...appliedFilters, sortBy: value }
        setFilters(prev => ({ ...prev, sortBy: value }))
        setAppliedFilters(updated)
        fetchListings(updated)
    }

    const toggleFuelType = (fuel: string) => {
        setFilters(prev => ({
            ...prev,
            fuelTypes: prev.fuelTypes.includes(fuel)
                ? prev.fuelTypes.filter(f => f !== fuel)
                : [...prev.fuelTypes, fuel],
        }))
    }

    const toggleTransmission = (trans: string) => {
        setFilters(prev => ({
            ...prev,
            transmissions: prev.transmissions.includes(trans)
                ? prev.transmissions.filter(t => t !== trans)
                : [...prev.transmissions, trans],
        }))
    }

    // Image fallback
    const getListingImage = (listing: Listing) => {
        if (listing.images && listing.images.length > 0) {
            const valid = listing.images.find(img => !img.includes('example.com'))
            if (valid) return valid
        }
        return listing.type === 'AUCTION'
            ? "/assets/images/featured-suv.png"
            : "/assets/images/featured-sports.png"
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen pb-20">
            {/* Search Header */}
            <div className="glass-strong text-white py-12 px-5 border-b border-white/5">
                <div className="container mx-auto">
                    <h1 className="text-3xl md:text-4xl font-heading font-bold mb-6">Find Your Perfect Car</h1>
                    <div className="flex gap-4 max-w-4xl bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/10 flex-col md:flex-row">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search make, model, or keywords..."
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                onKeyDown={handleSearchKeyDown}
                                className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/10 h-12"
                            />
                        </div>
                        <Button size="lg" className="h-12 px-8" onClick={handleSearch}>Search</Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-5 py-8 flex flex-col lg:flex-row gap-8">
                {/* Mobile Filter Toggle */}
                <Button
                    className="lg:hidden w-full flex items-center justify-between"
                    variant="outline"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                    <span className="flex items-center gap-2">
                        <Filter size={18} /> Filters
                        {activeFilterCount > 0 && (
                            <span className="bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                        )}
                    </span>
                    {isFilterOpen ? <X size={18} /> : null}
                </Button>

                {/* Sidebar */}
                <aside className={`lg:w-1/4 glass-card p-6 h-fit lg:sticky lg:top-24 ${isFilterOpen ? 'block' : 'hidden lg:block'}`}>
                    <h3 className="font-heading font-bold text-xl mb-6 flex justify-between items-center text-white">
                        Filters
                        {activeFilterCount > 0 && (
                            <button
                                onClick={handleResetFilters}
                                className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-1"
                            >
                                <RotateCcw size={12} /> Reset All
                            </button>
                        )}
                    </h3>

                    <div className="space-y-4">
                        {/* Body Type — Collapsible Dropdown */}
                        <FilterSection title="Body Type" defaultOpen={false}>
                            <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                                {BODY_TYPE_KEYS.map((key) => {
                                    const Icon = BODY_TYPE_ICONS[key]
                                    const label = BODY_TYPE_LABELS[key]
                                    const isActive = filters.bodyType === key
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setFilters(prev => ({
                                                ...prev,
                                                bodyType: prev.bodyType === key ? '' : key,
                                            }))}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${isActive
                                                    ? 'bg-primary/15 text-primary border border-primary/30'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                                                }`}
                                        >
                                            <Icon className="w-8 h-4 shrink-0" />
                                            <span>{label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </FilterSection>

                        {/* Make */}
                        <FilterSection title="Make" defaultOpen={true}>
                            <Input
                                placeholder="e.g. BMW, Audi..."
                                value={filters.make}
                                onChange={(e) => setFilters(prev => ({ ...prev, make: e.target.value }))}
                                className="h-10 text-sm bg-slate-800 border-white/10 text-white placeholder:text-gray-500"
                            />
                        </FilterSection>

                        {/* Price Range */}
                        <FilterSection title="Price Range" defaultOpen={true}>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Min"
                                    type="number"
                                    value={filters.minPrice}
                                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                                    className="h-10 text-sm bg-slate-800 border-white/10 text-white"
                                />
                                <Input
                                    placeholder="Max"
                                    type="number"
                                    value={filters.maxPrice}
                                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                                    className="h-10 text-sm bg-slate-800 border-white/10 text-white"
                                />
                            </div>
                        </FilterSection>

                        {/* Year */}
                        <FilterSection title="Year" defaultOpen={false}>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                                className="w-full h-10 border border-white/10 rounded px-3 text-sm text-white focus:border-primary outline-none bg-slate-800 cursor-pointer"
                            >
                                {YEAR_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </FilterSection>

                        {/* Fuel Type */}
                        <FilterSection title="Fuel Type" defaultOpen={false}>
                            <div className="space-y-2">
                                {FUEL_TYPES.map(fuel => (
                                    <label key={fuel} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-primary transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.fuelTypes.includes(fuel)}
                                            onChange={() => toggleFuelType(fuel)}
                                            className="accent-primary rounded w-4 h-4 bg-slate-800 border-white/10"
                                        />
                                        {fuel}
                                    </label>
                                ))}
                            </div>
                        </FilterSection>

                        {/* Transmission */}
                        <FilterSection title="Transmission" defaultOpen={false}>
                            <div className="space-y-2">
                                {TRANSMISSION_TYPES.map(trans => (
                                    <label key={trans} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-primary transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.transmissions.includes(trans)}
                                            onChange={() => toggleTransmission(trans)}
                                            className="accent-primary rounded w-4 h-4 bg-slate-800 border-white/10"
                                        />
                                        {trans}
                                    </label>
                                ))}
                            </div>
                        </FilterSection>

                        <Button className="w-full mt-2 shadow-neon" onClick={handleApplyFilters}>Apply Filters</Button>
                    </div>

                    {/* Auction Promo Card */}
                    <div className="mt-8 p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-2xl -z-10 group-hover:bg-primary/30 transition-colors" />

                        <div className="flex items-center gap-2 mb-3">
                            <Gavel className="text-primary" size={20} />
                            <h3 className="font-bold text-white text-lg">Live Auctions</h3>
                        </div>

                        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                            Live marketplace for verified buyers and sellers.
                        </p>

                        <ul className="space-y-2 mb-4">
                            {[
                                "Real-time competitive bidding",
                                "Open to all verified members",
                                "Vehicles sold as-seen",
                                "Secure buyer protection"
                            ].map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                    <div className="mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div>
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-3">
                            <h4 className="text-amber-500 font-bold text-xs mb-1 flex items-center gap-1">
                                <AlertTriangle size={12} /> Verification Required
                            </h4>
                            <p className="text-[10px] text-amber-200/70 leading-relaxed">
                                To list or bid, register as a verified member. Complete KYC verification after signup.
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Results Grid */}
                <div className="lg:w-3/4">
                    <div className="flex justify-between items-center mb-6">
                        <p className="text-gray-400 text-sm">
                            {loading ? (
                                <span>Loading...</span>
                            ) : (
                                <>Showing <span className="font-bold text-white">{listings.length}</span> of <span className="font-bold text-white">{totalCount}</span> vehicles</>
                            )}
                        </p>
                        <select
                            value={appliedFilters.sortBy}
                            onChange={(e) => handleSortChange(e.target.value)}
                            className="bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white cursor-pointer outline-none hover:border-white/20"
                        >
                            {SORT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Active Filters Tags */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                            {appliedFilters.bodyType && (
                                <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    {BODY_TYPE_LABELS[appliedFilters.bodyType]}
                                    <button onClick={() => { const u = { ...appliedFilters, bodyType: '' }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            )}
                            {appliedFilters.make && (
                                <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    Make: {appliedFilters.make}
                                    <button onClick={() => { const u = { ...appliedFilters, make: '' }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            )}
                            {(appliedFilters.minPrice || appliedFilters.maxPrice) && (
                                <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    Price: {appliedFilters.minPrice ? `£${appliedFilters.minPrice}` : '£0'} – {appliedFilters.maxPrice ? `£${appliedFilters.maxPrice}` : '∞'}
                                    <button onClick={() => { const u = { ...appliedFilters, minPrice: '', maxPrice: '' }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            )}
                            {appliedFilters.year > 0 && (
                                <span className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    Year: {appliedFilters.year}+
                                    <button onClick={() => { const u = { ...appliedFilters, year: 0 }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            )}
                            {appliedFilters.fuelTypes.map(f => (
                                <span key={f} className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    {f}
                                    <button onClick={() => { const u = { ...appliedFilters, fuelTypes: appliedFilters.fuelTypes.filter(x => x !== f) }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            ))}
                            {appliedFilters.transmissions.map(t => (
                                <span key={t} className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
                                    {t}
                                    <button onClick={() => { const u = { ...appliedFilters, transmissions: appliedFilters.transmissions.filter(x => x !== t) }; setFilters(u); setAppliedFilters(u); fetchListings(u) }} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                            <p className="text-gray-400">Loading listings...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <div className="glass-card p-8 text-center">
                            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Failed to Load Listings</h3>
                            <p className="text-gray-400 mb-4">{error}</p>
                            <Button onClick={() => fetchListings(appliedFilters)}>Try Again</Button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && listings.length === 0 && (
                        <div className="glass-card p-8 text-center">
                            <Search className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No Listings Found</h3>
                            <p className="text-gray-400 mb-4">
                                {activeFilterCount > 0
                                    ? 'Try adjusting your filters or clearing them.'
                                    : 'Be the first to list your car!'}
                            </p>
                            {activeFilterCount > 0 ? (
                                <Button onClick={handleResetFilters}>Clear All Filters</Button>
                            ) : (
                                <Button onClick={() => window.location.href = '/sell'}>Sell Your Car</Button>
                            )}
                        </div>
                    )}

                    {/* Listings Grid */}
                    {!loading && !error && listings.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {listings.map((listing) => (
                                <CarCard
                                    key={listing.id}
                                    title={listing.title}
                                    price={formatPrice(listing.price)}
                                    image={getListingImage(listing)}
                                    href={`/buy-cars/${listing.slug}`}
                                    year={listing.year ?? undefined}
                                    mileage={listing.mileage ?? undefined}
                                    fuelType={listing.fuelType ?? undefined}
                                    bodyType={listing.bodyType ?? undefined}
                                />
                            ))}
                        </div>
                    )}

                    {/* Load More */}
                    {!loading && !error && listings.length > 0 && listings.length < totalCount && (
                        <div className="mt-12 text-center">
                            <Button variant="outline" size="lg" className="border-gray-300 text-gray-500 hover:text-primary hover:border-primary font-bold">Load More</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
