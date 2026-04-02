"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Search, X, Plus, CheckCircle, TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { getListings, type Listing, formatPrice } from "@/lib/listingApi"

export default function ComparePage() {
    const [cars, setCars] = useState<(Listing | null)[]>([null, null, null])
    const [isSelectorOpen, setIsSelectorOpen] = useState(false)
    const [activeSlot, setActiveSlot] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<Listing[]>([])
    const [isSearching, setIsSearching] = useState(false)

    const openSelector = (index: number) => {
        setActiveSlot(index)
        setIsSelectorOpen(true)
        if (searchResults.length === 0) {
            handleSearch("")
        }
    }

    const closeSelector = () => {
        setIsSelectorOpen(false)
        setActiveSlot(null)
    }

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

    // Debounced search
    useEffect(() => {
        if (!isSelectorOpen) return
        const timer = setTimeout(() => {
            handleSearch(searchQuery)
        }, 500)
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

    // Comparison Attributes
    const renderRow = (label: string, getValue: (car: Listing) => React.ReactNode) => (
        <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="py-4 px-4 font-bold text-gray-400 bg-slate-900/50 w-1/4 sticky left-0 z-10">{label}</td>
            {cars.map((car, idx) => (
                <td key={idx} className="py-4 px-4 text-center border-l border-white/5 w-1/4">
                    {car ? <span className="text-white">{getValue(car)}</span> : <span className="text-gray-600">-</span>}
                </td>
            ))}
        </tr>
    )

    return (
        <div className="min-h-screen pb-24 selection:bg-primary/30">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] border-b border-white/10 pt-32 pb-16">
                <div className="container mx-auto px-5 text-center">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-6 tracking-tight">Compare Vehicles Side-by-Side</h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Make an informed decision. Select up to 3 live listings to compare features, specs, and prices.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-5 -mt-8 relative z-10">
                <div className="glass-strong rounded-[2rem] border border-white/10 p-2 md:p-8 shadow-2xl overflow-x-auto overflow-y-hidden">
                    <table className="w-full min-w-[800px] border-collapse">
                        <thead>
                            <tr>
                                <th className="w-1/4 bg-transparent p-4 sticky left-0 z-10"></th>
                                {cars.map((car, idx) => (
                                    <th key={idx} className="w-1/4 p-4 align-top">
                                        {car ? (
                                            <div className="relative group bg-slate-800 rounded-2xl border border-white/10 overflow-hidden shadow-lg transition-transform hover:-translate-y-1">
                                                <button 
                                                    onClick={() => removeCar(idx)}
                                                    className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <div className="h-40 w-full relative">
                                                    <Image src={getListingImage(car)} alt={car.title} fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                                                </div>
                                                <div className="p-4 text-left">
                                                    <h3 className="text-white font-bold text-lg leading-tight mb-2 line-clamp-2 min-h-[2.8rem]">{car.title}</h3>
                                                    <p className="text-primary font-mono text-xl font-bold">{formatPrice(car.price)}</p>
                                                    <Link href={`/vehicle/${car.slug}`}>
                                                        <Button variant="outline" size="sm" className="w-full mt-4 border-white/20 hover:bg-white/10 text-xs text-white">View Details</Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-[280px] rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-center p-6 bg-slate-900/30 hover:bg-slate-900/50 hover:border-primary/50 transition-all cursor-pointer group"
                                                onClick={() => openSelector(idx)}>
                                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:bg-primary/20 group-hover:text-primary">
                                                    <Plus size={24} className="text-gray-400 group-hover:text-primary" />
                                                </div>
                                                <p className="text-gray-400 font-bold group-hover:text-white transition-colors">Add Vehicle</p>
                                                <p className="text-xs text-gray-500 mt-2">Click to select car</p>
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        {cars.some(c => c !== null) && (
                            <tbody>
                                {/* Key Details */}
                                <tr>
                                    <td colSpan={4} className="py-6 px-4 bg-transparent font-heading font-bold text-lg text-primary tracking-wider uppercase sticky left-0">Key Details</td>
                                </tr>
                                {renderRow("Make", c => c.make || "-")}
                                {renderRow("Model", c => c.model || "-")}
                                {renderRow("Year", c => c.year || "-")}
                                {renderRow("Mileage", c => c.mileage ? `${c.mileage.toLocaleString()} mi` : "-")}
                                {renderRow("Condition", c => {
                                    if (!c.condition) return "-"
                                    const isGood = ['EXCELLENT', 'GOOD'].includes(c.condition)
                                    const isBad = c.condition.startsWith("CAT") || c.condition === "POOR"
                                    return (
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isGood ? 'bg-emerald-500/20 text-emerald-400' : isBad ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
                                            {c.condition.replace('_', ' ')}
                                        </span>
                                    )
                                })}
                                
                                {/* Engine & Performance */}
                                <tr>
                                    <td colSpan={4} className="py-6 px-4 bg-transparent font-heading font-bold text-lg text-primary tracking-wider uppercase sticky left-0">Engine & Performance</td>
                                </tr>
                                {renderRow("Fuel Type", c => c.fuelType ? <span className="capitalize">{c.fuelType.toLowerCase().replace('_', ' ')}</span> : "-")}
                                {renderRow("Transmission", c => c.transmission ? <span className="capitalize">{c.transmission.toLowerCase()}</span> : "-")}
                                {renderRow("Engine Size", c => c.engineSize ? `${c.engineSize} cc` : "-")}
                                {renderRow("Power (BHP)", c => c.bhp ? `${c.bhp} bhp` : "-")}
                                {renderRow("CO₂ Emissions", c => c.co2Emissions ? `${c.co2Emissions} g/km` : "-")}

                                {/* Dimensions */}
                                <tr>
                                    <td colSpan={4} className="py-6 px-4 bg-transparent font-heading font-bold text-lg text-primary tracking-wider uppercase sticky left-0">Dimensions & Style</td>
                                </tr>
                                {renderRow("Body Type", c => c.bodyType ? <span className="capitalize">{c.bodyType.toLowerCase()}</span> : "-")}
                                {renderRow("Colour", c => c.color || "-")}
                                {renderRow("Doors", c => c.doors || "-")}
                                {renderRow("Seats", c => c.seats || "-")}
                            </tbody>
                        )}
                    </table>
                </div>
            </div>

            {/* Modal for Selecting Cars */}
            {isSelectorOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-xl font-bold text-white">Select Vehicle to Compare</h2>
                            <button onClick={closeSelector} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                                <Input 
                                    placeholder="Search by make, model, or title..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-12 text-lg rounded-xl focus:border-primary/50"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto p-4 flex-1">
                            {isSearching ? (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                    <Loader2 className="animate-spin mb-4" size={32} />
                                    Loading listings...
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                    <Search size={48} className="opacity-20 mb-4" />
                                    No listings found matching "{searchQuery}"
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {searchResults.map(listing => {
                                        const isAlreadySelected = cars.some(c => c?.id === listing.id)
                                        return (
                                            <div 
                                                key={listing.id}
                                                onClick={() => !isAlreadySelected && selectCar(listing)}
                                                className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${isAlreadySelected ? 'bg-slate-900/50 border-white/5 opacity-50 cursor-not-allowed' : 'bg-slate-800 border-white/10 cursor-pointer hover:border-primary/50 hover:bg-primary/5'}`}
                                            >
                                                <div className="w-20 h-16 relative rounded-lg overflow-hidden shrink-0 bg-slate-900">
                                                    <Image src={getListingImage(listing)} alt={listing.title} fill className="object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-white font-bold text-sm truncate">{listing.title}</h4>
                                                    <p className="text-gray-400 text-xs mt-1">{listing.year} • {listing.mileage?.toLocaleString()} mi</p>
                                                    <p className="text-primary font-bold text-sm mt-1">{formatPrice(listing.price)}</p>
                                                </div>
                                                {isAlreadySelected && (
                                                    <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                                                        <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                                                            <CheckCircle size={14} className="text-emerald-400" /> Selected
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
