"use client"

import * as React from "react"
import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Search, X, Plus, CheckCircle, Loader2, Trophy, Fuel, Gauge, Cog, Palette, DoorOpen, Users, Zap, Award, ArrowRight, Car } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { getListings, getListingBySlug, type Listing, formatPrice } from "@/lib/listingApi"
import { motion, AnimatePresence } from "framer-motion"

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helper: best-value detection                                            */
/* ────────────────────────────────────────────────────────────────────────── */

type BestValueMode = "lowest" | "highest"

function getBestIndex(
    cars: (Listing | null)[],
    getValue: (c: Listing) => number | null | undefined,
    mode: BestValueMode = "lowest"
): number | null {
    let bestIdx: number | null = null
    let bestVal: number | null = null
    cars.forEach((car, idx) => {
        if (!car) return
        const v = getValue(car)
        if (v == null) return
        if (bestVal === null || (mode === "lowest" ? v < bestVal : v > bestVal)) {
            bestVal = v
            bestIdx = idx
        }
    })
    return bestIdx
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  At-a-glance badges                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function getGlanceBadges(cars: (Listing | null)[]): Map<number, string[]> {
    const badges = new Map<number, string[]>()
    cars.forEach((_, i) => badges.set(i, []))

    const priceIdx = getBestIndex(cars, c => parseFloat(String(c.price)), "lowest")
    if (priceIdx !== null) badges.get(priceIdx)!.push("Best Price")

    const mileIdx = getBestIndex(cars, c => c.mileage, "lowest")
    if (mileIdx !== null) badges.get(mileIdx)!.push("Lowest Miles")

    const bhpIdx = getBestIndex(cars, c => c.bhp, "highest")
    if (bhpIdx !== null) badges.get(bhpIdx)!.push("Most Power")

    const yearIdx = getBestIndex(cars, c => c.year, "highest")
    if (yearIdx !== null) badges.get(yearIdx)!.push("Newest")

    return badges
}

function CompareContent() {
    const searchParams = useSearchParams()
    const slug = searchParams.get('slug')

    const [cars, setCars] = useState<(Listing | null)[]>([null, null, null])
    
    // On load, fetch the slug if provided and put it in the first slot
    useEffect(() => {
        if (slug) {
            getListingBySlug(slug).then(listing => {
                if (listing) {
                    setCars(prev => {
                        const newCars = [...prev]
                        newCars[0] = listing
                        return newCars
                    })
                }
            }).catch(console.error)
        }
    }, [slug])

    const [isSelectorOpen, setIsSelectorOpen] = useState(false)
    const [activeSlot, setActiveSlot] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Listing[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const selectedCars = cars.filter(Boolean) as Listing[]
    const badges = useMemo(() => getGlanceBadges(cars), [cars])

    const openSelector = (index: number) => {
        setActiveSlot(index)
        setIsSelectorOpen(true)
        if (searchResults.length === 0) handleSearch("")
    }
    const closeSelector = () => { setIsSelectorOpen(false); setActiveSlot(null) }

    const handleSearch = async (query: string) => {
        setIsSearching(true)
        try {
            const res = await getListings({ search: query, limit: 12 })
            setSearchResults(res.data)
        } catch (error) {
            console.error("Search failed", error)
        } finally {
            setIsSearching(false)
        }
    }

    useEffect(() => {
        if (!isSelectorOpen) return
        const timer = setTimeout(() => handleSearch(searchQuery), 500)
        return () => clearTimeout(timer)
    }, [searchQuery, isSelectorOpen])

    const selectCar = (car: Listing) => {
        if (activeSlot !== null) {
            const newCars = [...cars]
            newCars[activeSlot] = car
            setCars(newCars)
        }
        closeSelector()
    }

    const removeCar = (index: number) => {
        const newCars = [...cars]
        newCars[index] = null
        setCars(newCars)
    }

    const getListingImage = (listing: Listing) => {
        if (listing.images?.length > 0) {
            const valid = listing.images.find(img => !img.includes('example.com'))
            if (valid) return valid
        }
        return "/assets/images/featured-sports.png"
    }

    /* ── Section renderer ─────────────────────────────────────────────────── */

    const SectionHeader = ({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) => (
        <tr>
            <td colSpan={3} className="pt-8 pb-4 px-6 sticky left-0 z-10 backdrop-blur-md border-y" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-3 justify-center">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
                        <Icon size={18} className="text-primary" />
                    </div>
                    <span className="font-heading font-bold text-base tracking-wide uppercase text-primary">{label}</span>
                </div>
            </td>
        </tr>
    )

    /* ── Row renderer with best-value highlighting ────────────────────────── */

    const renderRow = (
        label: string,
        getValue: (car: Listing) => React.ReactNode,
        bestIdx?: number | null,
        rowIndex?: number
    ) => {
        const isEven = typeof rowIndex === "number" && rowIndex % 2 === 0
        return (
            <tr className={`border-b transition-colors group ${isEven ? 'bg-white/[0.02]' : ''}`}
                style={{ borderColor: 'var(--border-default)' }}>
                {cars.map((car, idx) => (
                    <td key={idx} className={`py-5 px-6 relative transition-colors border-l ${bestIdx === idx && car ? 'bg-emerald-500/[0.06]' : ''}`}
                        style={{ borderColor: idx === 0 ? 'transparent' : 'var(--border-default)' }}>
                        <div className="flex flex-col items-center justify-center gap-2 text-center w-full">
                            <span className="text-[10px] font-bold tracking-widest uppercase opacity-40 block" style={{ color: 'var(--text-muted)' }}>
                                {label}
                            </span>
                            {car ? (
                                <div className="flex items-center justify-center gap-2">
                                    <span className={`text-[15px] font-medium leading-tight ${bestIdx === idx ? 'text-emerald-400 font-bold' : ''}`}
                                        style={bestIdx !== idx ? { color: 'var(--text-primary)' } : undefined}>
                                        {getValue(car)}
                                    </span>
                                    {bestIdx === idx && (
                                        <Trophy size={13} className="text-emerald-400 shrink-0" />
                                    )}
                                </div>
                            ) : (
                                <span style={{ color: 'var(--text-faint)' }}>—</span>
                            )}
                        </div>
                    </td>
                ))}
            </tr>
        )
    }

    let rowCounter = 0
    const nextRow = () => rowCounter++

    return (
        <div className="min-h-screen pb-24 selection:bg-primary/30">
            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div className="relative overflow-hidden pt-32 pb-20">
                <div className="absolute inset-0 dark:bg-gradient-to-br dark:from-slate-900 dark:via-[#1a2744] dark:to-slate-900" />
                <div className="absolute inset-0 opacity-0 dark:opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

                <div className="container mx-auto px-5 text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                            <Car size={16} className="text-primary" />
                            <span className="text-primary text-sm font-semibold tracking-wide">Side-by-Side Comparison</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-[var(--text-primary)] mb-6 tracking-tight">
                            Compare Vehicles <span className="text-primary">Head-to-Head</span>
                        </h1>
                        <p className="text-lg text-[var(--text-muted)] max-w-2xl mx-auto leading-relaxed">
                            Make an informed decision. Select up to 3 live listings to compare features, specifications, and pricing — all in one view.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* ── Comparison Area ──────────────────────────────────────────── */}
            <div className="container mx-auto px-5 -mt-10 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="rounded-[2rem] border overflow-hidden shadow-2xl"
                    style={{
                        background: 'var(--bg-header)',
                        backdropFilter: 'blur(20px)',
                        borderColor: 'var(--border-default)',
                    }}
                >
                    {/* Scroll container with fade edges */}
                    <div className="relative">
                        <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-l from-slate-900/60 to-transparent z-20 pointer-events-none md:hidden" />
                        <div className="overflow-x-auto overflow-y-hidden">
                            <table className="w-full min-w-[800px] border-collapse">
                                {/* ── Vehicle Cards Header ─────────────────── */}
                                <thead>
                                    <tr>
                                        {cars.map((car, idx) => (
                                            <th key={idx} className="w-1/3 p-4 align-top">
                                                <AnimatePresence mode="wait">
                                                    {car ? (
                                                        <motion.div
                                                            key={car.id}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            transition={{ duration: 0.3 }}
                                                            className="relative group rounded-2xl border overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                                                        >
                                                            {/* Remove button */}
                                                            <button
                                                                onClick={() => removeCar(idx)}
                                                                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:scale-110"
                                                            >
                                                                <X size={14} />
                                                            </button>

                                                            {/* Image */}
                                                            <div className="h-44 w-full relative">
                                                                <Image src={getListingImage(car)} alt={car.title} fill className="object-cover" />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                                                                {/* Price tag */}
                                                                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-[var(--border-default)]">
                                                                    <span className="text-primary font-mono text-lg font-bold">{formatPrice(car.price)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Info */}
                                                            <div className="p-4 text-left space-y-3">
                                                                <h3 className="font-bold text-base leading-tight line-clamp-2 min-h-[2.5rem]" style={{ color: 'var(--text-primary)' }}>{car.title}</h3>

                                                                {/* At-a-glance badges */}
                                                                {badges.get(idx)!.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {badges.get(idx)!.map(badge => (
                                                                            <span key={badge} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                                                                <Trophy size={10} /> {badge}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Quick specs */}
                                                                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                    {car.year && <span>{car.year}</span>}
                                                                    {car.mileage && <><span className="opacity-30">|</span><span>{car.mileage.toLocaleString()} mi</span></>}
                                                                    {car.fuelType && <><span className="opacity-30">|</span><span className="capitalize">{car.fuelType.toLowerCase()}</span></>}
                                                                </div>

                                                                <Link href={`/vehicle/${car.slug}`}>
                                                                    <Button variant="outline" size="sm" className="w-full mt-1 text-xs border-[var(--border-default)] hover:bg-primary/10 hover:border-primary/30 hover:text-primary group/btn">
                                                                        View Details <ArrowRight size={12} className="ml-1 transition-transform group-hover/btn:translate-x-0.5" />
                                                                    </Button>
                                                                </Link>
                                                            </div>
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div
                                                            key={`empty-${idx}`}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="h-[340px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 transition-all cursor-pointer group"
                                                            style={{
                                                                borderColor: 'var(--border-default)',
                                                                background: 'var(--bg-card)',
                                                            }}
                                                            onClick={() => openSelector(idx)}
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.borderColor = 'rgba(237,28,36,0.4)'
                                                                e.currentTarget.style.background = 'rgba(237,28,36,0.05)'
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.borderColor = 'var(--border-default)'
                                                                e.currentTarget.style.background = 'var(--bg-card)'
                                                            }}
                                                        >
                                                            {/* Pulsing ring */}
                                                            <div className="relative mb-5">
                                                                <div className="absolute inset-0 w-16 h-16 rounded-full bg-primary/20 animate-ping opacity-20" />
                                                                <div className="relative w-16 h-16 rounded-full flex items-center justify-center border border-[var(--border-default)] group-hover:scale-110 transition-transform group-hover:border-primary/40" style={{ background: 'var(--bg-input)' }}>
                                                                    <Plus size={24} className="transition-colors group-hover:text-primary" style={{ color: 'var(--text-muted)' }} />
                                                                </div>
                                                            </div>
                                                            <p className="font-bold transition-colors group-hover:text-primary text-base" style={{ color: 'var(--text-muted)' }}>Add Vehicle</p>
                                                            <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>Click to select a car</p>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* ── Comparison Body ──────────────────────── */}
                                {selectedCars.length > 0 && (
                                    <tbody>
                                        {/* Key Details */}
                                        <SectionHeader icon={Award} label="Key Details" />
                                        {renderRow("Make", c => c.make || "—", null, nextRow())}
                                        {renderRow("Model", c => c.model || "—", null, nextRow())}
                                        {renderRow("Year", c => c.year || "—", getBestIndex(cars, c => c.year, "highest"), nextRow())}
                                        {renderRow("Mileage", c => c.mileage ? `${c.mileage.toLocaleString()} mi` : "—", getBestIndex(cars, c => c.mileage, "lowest"), nextRow())}
                                        {renderRow("Price", c => formatPrice(c.price), getBestIndex(cars, c => parseFloat(String(c.price)), "lowest"), nextRow())}
                                        {renderRow("Condition", c => {
                                            if (!c.condition) return "—"
                                            const isGood = ['EXCELLENT', 'GOOD'].includes(c.condition)
                                            const isBad = c.condition.startsWith("CAT") || c.condition === "POOR"
                                            return (
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-block ${isGood ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : isBad ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-white/10 border border-[var(--border-default)]'}`}
                                                    style={!isGood && !isBad ? { color: 'var(--text-primary)' } : undefined}>
                                                    {c.condition.replace('_', ' ')}
                                                </span>
                                            )
                                        }, null, nextRow())}

                                        {/* Engine & Performance */}
                                        <SectionHeader icon={Zap} label="Engine & Performance" />
                                        {renderRow("Fuel Type", c => c.fuelType ? <span className="capitalize">{c.fuelType.toLowerCase().replace('_', ' ')}</span> : "—", null, nextRow())}
                                        {renderRow("Transmission", c => c.transmission ? <span className="capitalize">{c.transmission.toLowerCase()}</span> : "—", null, nextRow())}
                                        {renderRow("Engine Size", c => c.engineSize ? `${c.engineSize} cc` : "—", getBestIndex(cars, c => c.engineSize, "highest"), nextRow())}
                                        {renderRow("Power (BHP)", c => c.bhp ? `${c.bhp} bhp` : "—", getBestIndex(cars, c => c.bhp, "highest"), nextRow())}
                                        {renderRow("CO₂ Emissions", c => c.co2Emissions ? `${c.co2Emissions} g/km` : "—", getBestIndex(cars, c => c.co2Emissions, "lowest"), nextRow())}

                                        {/* Dimensions & Style */}
                                        <SectionHeader icon={Palette} label="Dimensions & Style" />
                                        {renderRow("Body Type", c => c.bodyType ? <span className="capitalize">{c.bodyType.toLowerCase()}</span> : "—", null, nextRow())}
                                        {renderRow("Colour", c => c.color || "—", null, nextRow())}
                                        {renderRow("Doors", c => c.doors || "—", null, nextRow())}
                                        {renderRow("Seats", c => c.seats || "—", getBestIndex(cars, c => c.seats, "highest"), nextRow())}

                                        {/* Bottom spacing */}
                                        <tr><td colSpan={4} className="h-6" /></tr>
                                    </tbody>
                                )}

                                {/* Empty state */}
                                {selectedCars.length === 0 && (
                                    <tbody>
                                        <tr>
                                            <td colSpan={3} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center border border-[var(--border-default)]" style={{ background: 'var(--bg-input)' }}>
                                                        <Car size={32} style={{ color: 'var(--text-faint)' }} />
                                                    </div>
                                                    <p className="text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>Select vehicles above to begin comparing</p>
                                                    <p className="text-sm" style={{ color: 'var(--text-faint)' }}>Choose up to 3 cars to see a detailed side-by-side breakdown</p>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ── Vehicle Selection Modal ──────────────────────────────────── */}
            <AnimatePresence>
                {isSelectorOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ duration: 0.25 }}
                            className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border shadow-2xl"
                            style={{ background: 'var(--bg-dropdown)', borderColor: 'var(--border-default)' }}
                        >
                            {/* Modal header */}
                            <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                                <div>
                                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Select Vehicle to Compare</h2>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Search from your live listings database</p>
                                </div>
                                <button onClick={closeSelector}
                                    className="p-2.5 rounded-xl transition-all hover:scale-105"
                                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                                >
                                    <X size={18} style={{ color: 'var(--text-muted)' }} />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="p-5 border-b" style={{ borderColor: 'var(--border-default)' }}>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--text-faint)' }} />
                                    <Input
                                        placeholder="Search by make, model, or title..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="pl-12 h-12 text-base rounded-xl border"
                                        style={{
                                            background: 'var(--bg-input)',
                                            borderColor: 'var(--border-default)',
                                            color: 'var(--text-primary)',
                                        }}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Results grid */}
                            <div className="overflow-y-auto p-4 flex-1 custom-scrollbar">
                                {isSearching ? (
                                    <div className="flex flex-col items-center justify-center h-48">
                                        <Loader2 className="animate-spin mb-4" size={28} style={{ color: 'var(--text-muted)' }} />
                                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading listings...</p>
                                    </div>
                                ) : searchResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48">
                                        <Search size={40} className="opacity-10 mb-4" style={{ color: 'var(--text-faint)' }} />
                                        <p style={{ color: 'var(--text-faint)' }}>No listings found matching &ldquo;{searchQuery}&rdquo;</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {searchResults.map(listing => {
                                            const isAlreadySelected = cars.some(c => c?.id === listing.id)
                                            return (
                                                <motion.div
                                                    key={listing.id}
                                                    whileHover={!isAlreadySelected ? { scale: 1.02 } : undefined}
                                                    whileTap={!isAlreadySelected ? { scale: 0.98 } : undefined}
                                                    onClick={() => !isAlreadySelected && selectCar(listing)}
                                                    className={`relative flex items-center gap-4 p-3 rounded-xl border transition-all ${isAlreadySelected
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'cursor-pointer'
                                                        }`}
                                                    style={{
                                                        background: isAlreadySelected ? 'var(--bg-card)' : 'var(--bg-card)',
                                                        borderColor: isAlreadySelected ? 'var(--border-default)' : 'var(--border-default)',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isAlreadySelected) {
                                                            e.currentTarget.style.borderColor = 'rgba(237,28,36,0.4)'
                                                            e.currentTarget.style.background = 'rgba(237,28,36,0.05)'
                                                        }
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.borderColor = 'var(--border-default)'
                                                        e.currentTarget.style.background = 'var(--bg-card)'
                                                    }}
                                                >
                                                    <div className="w-20 h-16 relative rounded-lg overflow-hidden shrink-0"
                                                        style={{ background: 'var(--bg-input)' }}>
                                                        <Image src={getListingImage(listing)} alt={listing.title} fill className="object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{listing.title}</h4>
                                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{listing.year} • {listing.mileage?.toLocaleString()} mi</p>
                                                        <p className="text-primary font-bold text-sm mt-1">{formatPrice(listing.price)}</p>
                                                    </div>
                                                    {isAlreadySelected && (
                                                        <div className="absolute inset-0 rounded-xl flex items-center justify-center"
                                                            style={{ background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(2px)' }}>
                                                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border"
                                                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                                                <CheckCircle size={14} className="text-emerald-400" /> Selected
                                                            </span>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>}>
            <CompareContent />
        </Suspense>
    )
}
