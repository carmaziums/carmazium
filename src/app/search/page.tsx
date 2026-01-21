"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { CarCard } from "@/components/features/CarCard"
import { Search, Filter, X, Gavel, AlertTriangle } from "lucide-react"

export default function SearchPage() {
    const [isFilterOpen, setIsFilterOpen] = React.useState(false)

    return (
        <div className="min-h-screen pb-20">
            {/* Search Header */}
            <div className="glass-strong text-white py-12 px-5 border-b border-white/5">
                <div className="container mx-auto">
                    <h1 className="text-3xl md:text-4xl font-heading font-bold mb-6">Find Your Perfect Car</h1>
                    <div className="flex gap-4 max-w-4xl bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/10 flex-col md:flex-row">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input placeholder="Search make, model, or keywords..." className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/10 h-12" />
                        </div>
                        <Button size="lg" className="h-12 px-8">Search</Button>
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
                    <span className="flex items-center gap-2"><Filter size={18} /> Filters</span>
                    {isFilterOpen ? <X size={18} /> : null}
                </Button>

                {/* Sidebar */}
                <aside className={`lg:w-1/4 glass-card p-6 h-full md:sticky md:top-24 ${isFilterOpen ? 'block' : 'hidden lg:block'}`}>
                    <h3 className="font-heading font-bold text-xl mb-6 flex justify-between items-center text-white">
                        Filters <span className="text-xs text-primary font-normal cursor-pointer hover:underline">Reset All</span>
                    </h3>

                    <div className="space-y-6">
                        {/* Make Model */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase text-gray-500 tracking-wide">Make & Model</label>
                            <select className="w-full h-10 border border-white/10 rounded px-3 text-sm text-white focus:border-primary outline-none bg-slate-800 cursor-pointer">
                                <option>Any Make</option>
                                <option>BMW</option>
                                <option>Mercedes</option>
                                <option>Audi</option>
                            </select>
                            <select className="w-full h-10 border border-white/10 rounded px-3 text-sm text-white focus:border-primary outline-none bg-slate-800 cursor-pointer">
                                <option>Any Model</option>
                            </select>
                        </div>

                        {/* Price Range */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase text-gray-500 tracking-wide">Price Range</label>
                            <div className="flex gap-2">
                                <Input placeholder="Min" type="number" className="h-10 text-sm bg-slate-800 border-white/10 text-white" />
                                <Input placeholder="Max" type="number" className="h-10 text-sm bg-slate-800 border-white/10 text-white" />
                            </div>
                        </div>

                        {/* Year */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase text-gray-500 tracking-wide">Year</label>
                            <select className="w-full h-10 border border-white/10 rounded px-3 text-sm text-white focus:border-primary outline-none bg-slate-800 cursor-pointer">
                                <option>2020+</option>
                                <option>2018+</option>
                                <option>2015+</option>
                            </select>
                        </div>

                        {/* Fuel Type */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold uppercase text-gray-500 tracking-wide">Fuel Type</label>
                            <div className="space-y-2">
                                {['Petrol', 'Diesel', 'Hybrid', 'Electric'].map(fuel => (
                                    <label key={fuel} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-primary">
                                        <input type="checkbox" className="accent-primary rounded w-4 h-4 bg-slate-800 border-white/10" />
                                        {fuel}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <Button className="w-full mt-4 shadow-neon">Apply Filters</Button>
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
                        <p className="text-gray-400 text-sm">Showing <span className="font-bold text-white">24</span> vehicles</p>
                        <select className="bg-transparent border-none text-sm font-bold text-white cursor-pointer outline-none">
                            <option className="bg-slate-800 text-white">Sort by: Newest</option>
                            <option className="bg-slate-800 text-white">Price: Low to High</option>
                            <option className="bg-slate-800 text-white">Price: High to Low</option>
                            <option className="bg-slate-800 text-white">Mileage: Low to High</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Initial 6 cars for demo */}
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <CarCard
                                key={i}
                                title={`BMW M${i} Competition`}
                                price={`$${45000 + (i * 2000)}`}
                                image={i % 2 === 0 ? "/assets/images/featured-suv.png" : "/assets/images/featured-sports.png"}
                                href={`/vehicle/bmw-m${i}`}
                            />
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <Button variant="outline" size="lg" className="border-gray-300 text-gray-500 hover:text-primary hover:border-primary font-bold">Load More</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
