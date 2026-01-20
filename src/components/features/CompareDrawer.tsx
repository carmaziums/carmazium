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
                                        <div className="grid grid-cols-2 gap-8 mb-8">
                                            {compareList.map((car, i) => (
                                                <div key={car.id} className="relative">
                                                    {/* VS Badge */}
                                                    {i === 0 && compareList.length > 1 && (
                                                        <div className="absolute -right-12 top-1/2 -translate-y-1/2 z-10 bg-slate-900 border border-white/10 rounded-full w-10 h-10 flex items-center justify-center text-xs font-bold font-mono text-primary shadow-xl">
                                                            VS
                                                        </div>
                                                    )}

                                                    <div className="relative aspect-video rounded-xl overflow-hidden mb-4 border border-white/10">
                                                        <Image src={car.image} alt={car.title} fill className="object-cover" />
                                                        <button
                                                            onClick={() => removeFromCompare(car.id)}
                                                            className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    <h3 className="font-bold text-lg leading-tight mb-2 min-h-[3rem]">{car.title}</h3>
                                                    <div className="text-primary font-bold text-xl">{car.price}</div>
                                                </div>
                                            ))}

                                            {/* Empty Slot Placeholder */}
                                            {compareList.length === 1 && (
                                                <div className="border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center text-gray-500 min-h-[200px] opacity-50 hover:opacity-100 transition-opacity">
                                                    <p className="text-sm mb-4">Add another car</p>
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
                                                { label: "Mileage", key: "mileage" },
                                                { label: "Engine", key: "engine" },
                                                { label: "Transmission", key: "transmission" },
                                                { label: "Doors", key: "doors" },
                                                { label: "Seats", key: "seats" },
                                            ].map((row, idx) => (
                                                <div key={idx} className="grid grid-cols-3 items-center py-4 border-b border-white/5 hover:bg-white/5 transition-colors rounded-lg px-2">
                                                    {/* Center Label */}
                                                    <div className="col-span-3 flex justify-between md:grid md:grid-cols-3 md:items-center">
                                                        <div className="text-left md:text-center md:col-start-2 md:row-start-1 text-gray-400 text-sm font-medium uppercase tracking-wider order-2 md:order-1">
                                                            {row.label}
                                                        </div>

                                                        {/* Car 1 Value */}
                                                        <div className="text-left font-semibold md:col-start-1 md:row-start-1 order-1 md:order-2">
                                                            {compareList[0]?.specs[row.key as keyof typeof compareList[0]['specs']] || "-"}
                                                        </div>

                                                        {/* Car 2 Value */}
                                                        <div className="text-right font-semibold md:col-start-3 md:row-start-1 order-3">
                                                            {compareList[1]?.specs[row.key as keyof typeof compareList[0]['specs']] || (compareList.length < 2 ? <span className="text-gray-600">-</span> : "-")}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="grid grid-cols-2 gap-8 mt-8">
                                            {compareList.map(car => (
                                                <Link key={car.id} href={`/vehicle/${car.id}`} className="block">
                                                    <Button className="w-full" onClick={toggleCompareDrawer}>View Details</Button>
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
