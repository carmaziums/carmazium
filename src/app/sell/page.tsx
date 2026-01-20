"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Car, Camera, List, DollarSign, CheckCircle, ArrowRight, ArrowLeft } from "lucide-react"

export default function SellPage() {
    const [currentStep, setCurrentStep] = React.useState(1)
    const [formData, setFormData] = React.useState({
        make: "",
        model: "",
        year: "",
        mileage: ""
    })

    const [sellingMethod, setSellingMethod] = React.useState<'list' | 'retail' | null>(null)

    // Scroll to top on step change
    React.useEffect(() => {
        window.scrollTo(0, 0)
    }, [currentStep, sellingMethod])

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    // Mock Auth State (Replace with real context later)
    const [isAuthenticated, setIsAuthenticated] = React.useState(false)

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen py-20 flex items-center justify-center">
                <div className="container mx-auto px-5 max-w-md">
                    <div className="glass-card p-8 text-center relative overflow-hidden">
                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-neon">
                            <Car size={40} />
                        </div>
                        <h1 className="text-3xl font-bold font-heading mb-4 text-white">Sell Your Car</h1>
                        <p className="text-gray-300 mb-8 leading-relaxed">
                            To ensure a secure community for all our members, please sign in or create an account to list your vehicle.
                        </p>

                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-left flex items-center gap-4">
                                <CheckCircle className="text-emerald-400 shrink-0" size={20} />
                                <div>
                                    <p className="font-bold text-white text-sm">Verified Listings</p>
                                    <p className="text-xs text-gray-500">Protecting you from fraud</p>
                                </div>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-left flex items-center gap-4">
                                <DollarSign className="text-emerald-400 shrink-0" size={20} />
                                <div>
                                    <p className="font-bold text-white text-sm">Best Market Value</p>
                                    <p className="text-xs text-gray-500">Smart pricing tools included</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <Button onClick={() => setIsAuthenticated(true)} className="w-full shadow-neon">Log In to Continue</Button>
                            <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white">Create Account</Button>
                        </div>

                        {/* Bypass for demo */}
                        <p className="mt-4 text-xs text-gray-600 cursor-pointer hover:text-primary" onClick={() => setIsAuthenticated(true)}>(Demo: Click button to bypass)</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!sellingMethod) {
        return (
            <div className="min-h-screen py-20 flex items-center justify-center">
                <div className="container mx-auto px-5 max-w-5xl">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 text-white">How would you like to sell?</h1>
                        <p className="text-xl text-gray-300">Choose the method that works best for you.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Option 1: List Your Car */}
                        <div
                            onClick={() => setSellingMethod('list')}
                            className="glass-card p-10 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors" />

                            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                <List className="text-primary w-10 h-10" />
                            </div>

                            <h2 className="text-3xl font-bold mb-4 font-heading">List My Car</h2>
                            <p className="text-gray-400 mb-8 h-12">Create a public listing or auction. You control the price and manage inquiries.</p>

                            <ul className="space-y-3 mb-8 text-gray-300">
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Reach thousands of buyers</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Option for Live Auction</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> Maximize sale price</li>
                            </ul>

                            <Button className="w-full py-6 text-lg group-hover:shadow-neon">Start Listing <ArrowRight className="ml-2" /></Button>
                        </div>

                        {/* Option 2: Retail / Instant Offer */}
                        <div
                            onClick={() => setSellingMethod('retail')}
                            className="glass-card p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-colors" />

                            <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-all">
                                <DollarSign className="text-indigo-400 w-10 h-10" />
                            </div>

                            <h2 className="text-3xl font-bold mb-4 font-heading">Retail My Car</h2>
                            <p className="text-gray-400 mb-8 h-12">Get an instant cash offer or trade-in value from our trusted partner network.</p>

                            <ul className="space-y-3 mb-8 text-gray-300">
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-indigo-400" /> Sell in 24 hours</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-indigo-400" /> No haggling or meetups</li>
                                <li className="flex items-center gap-3"><CheckCircle size={18} className="text-indigo-400" /> Instant payment</li>
                            </ul>

                            <Button variant="outline" className="w-full py-6 text-lg border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-white group-hover:border-indigo-500">Get Instant Offer <ArrowRight className="ml-2" /></Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const steps = [
        { id: 1, icon: Car, title: "Vehicle Info" },
        { id: 2, icon: Camera, title: "Media" },
        { id: 3, icon: List, title: "Specs" },
        { id: 4, icon: DollarSign, title: "Pricing" },
        { id: 5, icon: CheckCircle, title: "Review" },
    ]

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-5 max-w-4xl">
                <div className="mb-8">
                    <Button
                        variant="ghost"
                        onClick={() => setSellingMethod(null)}
                        className="text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Selection
                    </Button>
                </div>

                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 text-white">
                        {sellingMethod === 'list' ? 'List Your Car' : 'Retail Your Car'}
                    </h1>
                    <p className="text-gray-300 text-lg">
                        {sellingMethod === 'list'
                            ? 'Complete the details below to publish your listing.'
                            : 'Provide vehicle details to receive your instant offer.'}
                    </p>
                </div>

                {/* Progress Bar - Dark Glass */}
                <div className="glass-card p-6 mb-8 flex justify-between relative overflow-hidden">
                    {steps.map((step, idx) => (
                        <div key={step.id} className={`flex flex-col items-center relative z-10 w-full ${currentStep >= step.id ? 'text-primary' : 'text-gray-500'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all border border-white/5 ${currentStep >= step.id ? 'bg-primary text-white shadow-neon' : 'bg-slate-800'}`}>
                                <step.icon size={20} />
                            </div>
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">{step.title}</span>
                        </div>
                    ))}
                    {/* Progress Line Background */}
                    <div className="absolute top-[40px] left-0 w-full h-1 bg-white/5 -z-0">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out shadow-neon"
                            style={{ width: `${(currentStep - 1) / (steps.length - 1) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Form Content - Dark Glass */}
                <div className="glass-card p-8 md:p-12 relative overflow-hidden">
                    {/* Background glow for form */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>

                    {/* Step 1: Vehicle Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Vehicle Identification</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Make</label>
                                    <Input placeholder="e.g. BMW" className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Model</label>
                                    <Input placeholder="e.g. M4 Competition" className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Year</label>
                                    <Input type="number" placeholder="2023" className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Mileage</label>
                                    <Input type="number" placeholder="12500" className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary" />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">VIN (Optional)</label>
                                    <Input placeholder="Enter VIN for faster details" className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Media */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Media Upload</h2>
                            <div className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Camera className="h-8 w-8 text-primary" />
                                </div>
                                <p className="text-lg font-bold text-white mb-2">Drag and drop photos here</p>
                                <p className="text-gray-400 text-sm">or click to browse files (Max 20 photos)</p>
                            </div>
                            <div className="grid grid-cols-4 gap-4 mt-4">
                                {/* Placeholders for uploaded images */}
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="aspect-video bg-slate-800 rounded-lg animate-pulse border border-white/5" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Simplified Steps 3, 4, 5 */}
                    {currentStep > 2 && (
                        <div className="text-center py-12 animate-in fade-in">
                            <div className="inline-block p-4 rounded-full bg-white/5 mb-4">
                                <DollarSign className="text-emerald-400 w-8 h-8" />
                            </div>
                            <p className="text-gray-300 text-lg mb-4 font-light">Pricing & Specs configuration coming soon via API integration.</p>
                            <p className="text-primary font-mono">Current Step: {currentStep}/5</p>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-12 pt-8 border-t border-white/10">
                        {currentStep > 1 ? (
                            <Button variant="outline" onClick={prevStep} className="px-8 border-white/20 text-white hover:bg-white/10"><ArrowLeft className="mr-2 h-4 w-4" /> Previous</Button>
                        ) : (
                            <div /> // Spacer
                        )}

                        {currentStep < 5 ? (
                            <Button onClick={nextStep} className="px-8 shadow-neon">Next Step <ArrowRight className="ml-2 h-4 w-4" /></Button>
                        ) : (
                            <Button className="px-8 bg-emerald-600 hover:bg-emerald-700 border-none shadow-[0_0_20px_rgba(16,185,129,0.4)]">Submit {sellingMethod === 'list' ? 'Listing' : 'Request'}</Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
