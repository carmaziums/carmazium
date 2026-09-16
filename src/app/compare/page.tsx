"use client"

import * as React from "react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowRight,
    Award,
    Car,
    CheckCircle,
    Loader2,
    Palette,
    Plus,
    Search,
    Trophy,
    X,
    Zap,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { PageHero } from "@/components/layout/PageHero"
import { getListings, getListingBySlug, type Listing, formatPrice } from "@/lib/listingApi"

type BestValueMode = "lowest" | "highest"

function getBestIndex(
    cars: (Listing | null)[],
    getValue: (car: Listing) => number | null | undefined,
    mode: BestValueMode = "lowest"
): number | null {
    let bestIdx: number | null = null
    let bestVal: number | null = null

    cars.forEach((car, idx) => {
        if (!car) return
        const value = getValue(car)
        if (value == null) return

        if (bestVal === null || (mode === "lowest" ? value < bestVal : value > bestVal)) {
            bestVal = value
            bestIdx = idx
        }
    })

    return bestIdx
}

function getGlanceBadges(cars: (Listing | null)[]): Map<number, string[]> {
    const badges = new Map<number, string[]>()
    cars.forEach((_, index) => badges.set(index, []))

    const priceIdx = getBestIndex(cars, car => parseFloat(String(car.price)), "lowest")
    if (priceIdx !== null) badges.get(priceIdx)?.push("Best Price")

    const mileageIdx = getBestIndex(cars, car => car.mileage, "lowest")
    if (mileageIdx !== null) badges.get(mileageIdx)?.push("Lowest Miles")

    const bhpIdx = getBestIndex(cars, car => car.bhp, "highest")
    if (bhpIdx !== null) badges.get(bhpIdx)?.push("Most Power")

    const yearIdx = getBestIndex(cars, car => car.year, "highest")
    if (yearIdx !== null) badges.get(yearIdx)?.push("Newest")

    return badges
}

function CompareContent() {
    const searchParams = useSearchParams()
    const slug = searchParams.get("slug")
    const [cars, setCars] = useState<(Listing | null)[]>([null, null, null])
    const [isSelectorOpen, setIsSelectorOpen] = useState(false)
    const [activeSlot, setActiveSlot] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Listing[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        if (!slug) return

        getListingBySlug(slug)
            .then(listing => {
                if (!listing) return
                setCars(previous => {
                    const next = [...previous]
                    next[0] = listing
                    return next
                })
            })
            .catch(console.error)
    }, [slug])

    const selectedCars = cars.filter(Boolean) as Listing[]
    const badges = useMemo(() => getGlanceBadges(cars), [cars])

    const handleSearch = async (query: string) => {
        setIsSearching(true)
        try {
            const result = await getListings({ search: query, limit: 12 })
            setSearchResults(result.data)
        } catch (error) {
            console.error("Search failed", error)
        } finally {
            setIsSearching(false)
        }
    }

    const openSelector = (index: number) => {
        setActiveSlot(index)
        setIsSelectorOpen(true)
        if (searchResults.length === 0) void handleSearch("")
    }

    const closeSelector = () => {
        setIsSelectorOpen(false)
        setActiveSlot(null)
    }

    useEffect(() => {
        if (!isSelectorOpen) return
        const timer = setTimeout(() => void handleSearch(searchQuery), 500)
        return () => clearTimeout(timer)
    }, [searchQuery, isSelectorOpen])

    const selectCar = (car: Listing) => {
        if (activeSlot !== null) {
            setCars(previous => {
                const next = [...previous]
                next[activeSlot] = car
                return next
            })
        }
        closeSelector()
    }

    const removeCar = (index: number) => {
        setCars(previous => {
            const next = [...previous]
            next[index] = null
            return next
        })
    }

    const getListingImage = (listing: Listing) => {
        if (listing.images?.length > 0) {
            const valid = listing.images.find(image => !image.includes("example.com"))
            if (valid) return valid
        }
        return "/assets/images/featured-sports.png"
    }

    const SectionHeader = ({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string }) => (
        <tr>
            <td colSpan={3} className="border-y border-[var(--border-default)] bg-[var(--bg-input)] px-6 py-4">
                <div className="flex items-center justify-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon size={18} />
                    </span>
                    <span className="text-sm font-black uppercase tracking-[0.12em] text-primary">{label}</span>
                </div>
            </td>
        </tr>
    )

    const renderRow = (
        label: string,
        getValue: (car: Listing) => React.ReactNode,
        bestIdx?: number | null,
        rowIndex = 0
    ) => (
        <tr className={`border-b border-[var(--border-default)] ${rowIndex % 2 === 1 ? "bg-[var(--bg-input)]/25" : ""}`}>
            {cars.map((car, idx) => (
                <td
                    key={`${label}-${idx}`}
                    className={`border-l border-[var(--border-default)] px-6 py-5 first:border-l-0 ${bestIdx === idx && car ? "bg-emerald-500/[0.055]" : ""}`}
                >
                    <div className="flex min-h-12 flex-col items-center justify-center gap-2 text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--text-faint)]">{label}</span>
                        {car ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className={`text-sm font-semibold ${bestIdx === idx ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-primary)]"}`}>
                                    {getValue(car)}
                                </span>
                                {bestIdx === idx && <Trophy size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                            </div>
                        ) : (
                            <span className="text-[var(--text-faint)]">—</span>
                        )}
                    </div>
                </td>
            ))}
        </tr>
    )

    let rowCounter = 0
    const nextRow = () => rowCounter++

    return (
        <main className="min-h-screen pb-24 pt-20">
            <PageHero
                eyebrow={<><Car size={15} /> Side-by-side comparison</>}
                title="Compare Vehicles Head-to-Head"
                description={<p>Select up to three live listings and compare the key details in one clear desktop view.</p>}
                compact
            />

            <section className="container mx-auto px-5 py-12 md:py-16">
                <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]">
                    <div className="border-b border-[var(--border-default)] px-5 py-5 md:px-7">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Build your comparison</p>
                                <h2 className="mt-1 text-xl font-bold">Choose the first vehicle, then add up to two more</h2>
                            </div>
                            <p className="text-sm text-[var(--text-muted)]">{selectedCars.length} of 3 selected</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[840px] border-collapse">
                            <thead>
                                <tr>
                                    {cars.map((car, idx) => (
                                        <th key={idx} className="w-1/3 border-l border-[var(--border-default)] p-5 align-top first:border-l-0">
                                            {car ? (
                                                <article className="group relative h-full overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-body)] text-left shadow-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCar(idx)}
                                                        aria-label={`Remove ${car.title} from comparison`}
                                                        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950/75 text-white transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                    <div className="relative h-44 w-full overflow-hidden">
                                                        <Image src={getListingImage(car)} alt={car.title} fill className="object-cover" />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                                        <span className="absolute bottom-3 left-3 rounded-lg bg-slate-950/75 px-3 py-1.5 text-base font-black text-white backdrop-blur-md">{formatPrice(car.price)}</span>
                                                    </div>
                                                    <div className="p-4">
                                                        <h3 className="min-h-10 line-clamp-2 text-base font-bold leading-5">{car.title}</h3>
                                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                                            {badges.get(idx)?.map(badge => (
                                                                <span key={badge} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                                                    <Trophy size={10} /> {badge}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <p className="mt-3 text-xs text-[var(--text-muted)]">
                                                            {car.year || "Year n/a"}{car.mileage != null ? ` · ${car.mileage.toLocaleString()} mi` : ""}{car.fuelType ? ` · ${car.fuelType.toLowerCase()}` : ""}
                                                        </p>
                                                        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                                                            <Link href={`/vehicle/${car.slug}`}>View details <ArrowRight size={12} /></Link>
                                                        </Button>
                                                    </div>
                                                </article>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => openSelector(idx)}
                                                    className={`flex h-[340px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)] ${selectedCars.length === 0 && idx === 0 ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(237,28,36,0.06)] hover:bg-primary/[0.09]" : "border-[var(--border-hover)] bg-[var(--bg-body)] hover:border-primary/45 hover:bg-primary/[0.04]"}`}
                                                >
                                                    <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${selectedCars.length === 0 && idx === 0 ? "bg-primary text-white" : "border border-[var(--border-default)] bg-[var(--bg-input)] text-primary"}`}>
                                                        <Plus size={22} />
                                                    </span>
                                                    <span className="mt-5 text-base font-black text-[var(--text-primary)]">{selectedCars.length === 0 && idx === 0 ? "Add first vehicle" : "Add vehicle"}</span>
                                                    <span className="mt-2 max-w-[13rem] text-xs font-medium leading-5 text-[var(--text-muted)]">Search and select from live CarMazium listings</span>
                                                </button>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {selectedCars.length > 0 ? (
                                <tbody>
                                    <SectionHeader icon={Award} label="Key Details" />
                                    {renderRow("Make", car => car.make || "—", null, nextRow())}
                                    {renderRow("Model", car => car.model || "—", null, nextRow())}
                                    {renderRow("Year", car => car.year || "—", getBestIndex(cars, car => car.year, "highest"), nextRow())}
                                    {renderRow("Mileage", car => car.mileage != null ? `${car.mileage.toLocaleString()} mi` : "—", getBestIndex(cars, car => car.mileage, "lowest"), nextRow())}
                                    {renderRow("Price", car => formatPrice(car.price), getBestIndex(cars, car => parseFloat(String(car.price)), "lowest"), nextRow())}
                                    {renderRow("Condition", car => car.condition ? car.condition.replace("_", " ") : "—", null, nextRow())}

                                    <SectionHeader icon={Zap} label="Engine & Performance" />
                                    {renderRow("Fuel Type", car => car.fuelType ? car.fuelType.toLowerCase().replace("_", " ") : "—", null, nextRow())}
                                    {renderRow("Transmission", car => car.transmission ? car.transmission.toLowerCase() : "—", null, nextRow())}
                                    {renderRow("Engine Size", car => car.engineSize ? `${car.engineSize} cc` : "—", getBestIndex(cars, car => car.engineSize, "highest"), nextRow())}
                                    {renderRow("Power (BHP)", car => car.bhp ? `${car.bhp} bhp` : "—", getBestIndex(cars, car => car.bhp, "highest"), nextRow())}
                                    {renderRow("CO₂ Emissions", car => car.co2Emissions ? `${car.co2Emissions} g/km` : "—", getBestIndex(cars, car => car.co2Emissions, "lowest"), nextRow())}

                                    <SectionHeader icon={Palette} label="Dimensions & Style" />
                                    {renderRow("Body Type", car => car.bodyType ? car.bodyType.toLowerCase() : "—", null, nextRow())}
                                    {renderRow("Colour", car => car.color || "—", null, nextRow())}
                                    {renderRow("Doors", car => car.doors || "—", null, nextRow())}
                                    {renderRow("Seats", car => car.seats || "—", getBestIndex(cars, car => car.seats, "highest"), nextRow())}
                                </tbody>
                            ) : (
                                <tbody>
                                    <tr>
                                        <td colSpan={3} className="border-t border-[var(--border-default)] px-6 py-10 text-center">
                                            <div className="mx-auto max-w-lg">
                                                <h3 className="text-lg font-bold">Start with one vehicle</h3>
                                                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Use the highlighted first slot above or the button below. Your existing listing search opens immediately, so there is no extra setup step.</p>
                                                <Button type="button" className="mt-5" onClick={() => openSelector(0)}><Plus size={16} /> Add first vehicle</Button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            )}
                        </table>
                    </div>
                </div>
            </section>

            {isSelectorOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="compare-selector-title">
                    <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--bg-dropdown)] shadow-2xl">
                        <div className="flex items-center justify-between gap-5 border-b border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                            <div>
                                <h2 id="compare-selector-title" className="text-xl font-bold">Select Vehicle to Compare</h2>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Search live CarMazium listings</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={closeSelector} aria-label="Close vehicle selector"><X size={18} /></Button>
                        </div>

                        <div className="border-b border-[var(--border-default)] p-5">
                            <label htmlFor="compare-search" className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[var(--text-muted)]">Search vehicles</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" size={18} />
                                <Input
                                    id="compare-search"
                                    placeholder="Search by make, model, or title..."
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    className="h-12 rounded-xl pl-12 text-base"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                            {isSearching ? (
                                <div className="flex h-48 flex-col items-center justify-center text-[var(--text-muted)]"><Loader2 className="mb-3 animate-spin" size={28} /><p className="text-sm">Loading listings...</p></div>
                            ) : searchResults.length === 0 ? (
                                <div className="flex h-48 flex-col items-center justify-center text-center"><Search size={36} className="mb-3 text-[var(--text-faint)]" /><p className="text-sm text-[var(--text-muted)]">No listings found{searchQuery ? ` for “${searchQuery}”` : ""}.</p></div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {searchResults.map(listing => {
                                        const isAlreadySelected = cars.some(car => car?.id === listing.id)
                                        return (
                                            <button
                                                type="button"
                                                key={listing.id}
                                                disabled={isAlreadySelected}
                                                onClick={() => selectCar(listing)}
                                                className="relative flex items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55"
                                            >
                                                <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-input)]">
                                                    <Image src={getListingImage(listing)} alt={listing.title} fill className="object-cover" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-bold">{listing.title}</span>
                                                    <span className="mt-1 block text-xs text-[var(--text-muted)]">{listing.year}{listing.mileage != null ? ` · ${listing.mileage.toLocaleString()} mi` : ""}</span>
                                                    <span className="mt-1 block text-sm font-bold text-primary">{formatPrice(listing.price)}</span>
                                                </span>
                                                {isAlreadySelected && (
                                                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/65 backdrop-blur-[2px]">
                                                        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"><CheckCircle size={14} className="text-emerald-400" /> Selected</span>
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default function ComparePage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
            <CompareContent />
        </Suspense>
    )
}
