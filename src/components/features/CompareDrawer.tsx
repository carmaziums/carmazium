"use client"

import { useCompare } from "@/context/CompareContext"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trash2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import Image from "next/image"
import Link from "next/link"

export function CompareDrawer() {
    const { isDrawerOpen, toggleCompareDrawer, compareList, removeFromCompare } = useCompare()

    return (
        <div className="relative z-[100]">
            <AnimatePresence>
                {isDrawerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={toggleCompareDrawer}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-full max-w-3xl bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
                                <div>
                                    <h2 className="text-xl font-bold font-heading text-white">Compare Vehicles</h2>
                                    <p className="text-sm text-gray-400">{compareList.length} / 2 Selected</p>
                                </div>
                                <button
                                    onClick={toggleCompareDrawer}
                                    className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {compareList.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                                        <p className="mb-4">No vehicles selected for comparison.</p>
                                        <Button
                                            variant="outline"
                                            onClick={toggleCompareDrawer}
                                            className="border-white/10 text-white"
                                        >
                                            Keep Browsing
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto">
                                        {/* Header Row: Images & Titles */}
                                        <div className={compareList.length === 3 ? "grid grid-cols-3 gap-4 mb-8" : "grid grid-cols-2 gap-8 mb-8"}>
                                            {compareList.map((car, i) => (
                                                <div key={car.id} className="relative">
                                                    {/* VS Badge */}
                                                    {i === 0 && compareList.length > 1 && (
                                                        <div className="absolute -right-6 top-1/2 -translate-y-1/2 z-10 bg-slate-900 border border-white/10 rounded-full w-8 h-8 flex items-center justify-center text-[10px] font-bold font-mono text-primary shadow-xl">
                                                            VS
                                                        </div>
                                                    )}

                                                    <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-white/10">
                                                        <Image src={car.images?.[0] || "/assets/images/placeholder-car.png"} alt={car.title} fill className="object-cover" />
                                                        <button
                                                            onClick={() => removeFromCompare(car.id)}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    <h3 className="font-bold text-sm leading-tight mb-2 min-h-[2.5rem]">{car.title}</h3>
                                                    <div className="text-primary font-bold">{typeof car.price === 'number' ? `£${car.price.toLocaleString('en-GB')}` : car.price}</div>
                                                </div>
                                            ))}

                                            {/* Empty Slot Placeholder */}
                                            {compareList.length < 3 && (
                                                <div className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center text-gray-500 min-h-[150px] opacity-50 hover:opacity-100 transition-opacity">
                                                    <p className="text-xs mb-2">Add another car</p>
                                                    <Link href="/search">
                                                        <Button variant="ghost" size="sm" onClick={toggleCompareDrawer} className="text-primary hover:text-white">
                                                            Browse <ArrowRight size={14} className="ml-1" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        {/* Specs Comparison Table */}
                                        <div className="space-y-1">
                                            {[
                                                { label: "Year", key: "year" },
                                                { label: "Mileage", key: "mileage", format: (v: any) => v ? `${v.toLocaleString()} mi` : "-" },
                                                { label: "Engine", key: "bhp", format: (v: any) => v ? `${v} bhp` : "-" },
                                                { label: "Transmission", key: "transmission" },
                                                { label: "Doors", key: "doors" },
                                                { label: "Seats", key: "seats" },
                                            ].map((row, idx) => (
                                                <div key={idx} className="flex flex-col md:flex-row py-3 border-b border-white/5 hover:bg-white/5 transition-colors px-2">
                                                    <div className="w-full md:w-1/4 text-gray-400 text-xs font-medium uppercase tracking-wider mb-2 md:mb-0 md:flex md:items-center">
                                                        {row.label}
                                                    </div>
                                                    <div className={`w-full md:w-3/4 grid ${compareList.length === 3 ? "grid-cols-3 gap-4" : "grid-cols-2 gap-8"}`}>
                                                        {compareList.map(car => {
                                                            const val = car[row.key as keyof typeof car];
                                                            return (
                                                                <div key={car.id} className="text-sm font-semibold">
                                                                    {row.format ? row.format(val) : (val || "-")}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className={`grid ${compareList.length === 3 ? "grid-cols-3 gap-4" : "grid-cols-2 gap-8"} mt-8`}>
                                            {compareList.map(car => (
                                                <Link key={car.id} href={`/vehicle/${car.id}`} className="block">
                                                    <Button className="w-full text-xs py-2" onClick={toggleCompareDrawer}>Details</Button>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
