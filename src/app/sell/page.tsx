"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Car, Camera, List, DollarSign, CheckCircle, ArrowRight, ArrowLeft, Gavel, Edit, Loader2 } from "lucide-react"
import Image from "next/image"
import { ImageUpload } from "@/components/listing/ImageUpload"
import { createListing, formatPrice, type CreateListingRequest } from "@/lib/listingApi"

export default function SellPage() {
    const [currentStep, setCurrentStep] = React.useState(1)
    const [formData, setFormData] = React.useState({
        // Step 1: Vehicle Info
        make: "",
        model: "",
        year: "",
        mileage: "",

        // Step 2: Media
        images: [] as string[],

        // Step 3: Specs
        vrm: "",
        fuelType: "",
        transmission: "",
        color: "",
        doors: "",
        seats: "",
        engineSize: "",
        bhp: "",
        features: [] as string[],
        description: "",
        title: "",

        // Step 4: Pricing
        price: "",
        listingType: "" as 'CLASSIFIED' | 'AUCTION' | "",
        status: "DRAFT" as const
    })

    const [sellingMethod, setSellingMethod] = React.useState<'list' | 'retail' | null>(null)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [isAuthenticated, setIsAuthenticated] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState<string | null>(null)

    // Auto-generate title from make, model, year
    React.useEffect(() => {
        if (formData.make && formData.model && formData.year) {
            const autoTitle = `${formData.make} ${formData.model} ${formData.year}`
            if (!formData.title || formData.title === "" || formData.title.includes(formData.make)) {
                setFormData(prev => ({ ...prev, title: autoTitle }))
            }
        }
    }, [formData.make, formData.model, formData.year, formData.title])

    // Scroll to top on step change
    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep, sellingMethod])

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))
    const goToStep = (step: number) => setCurrentStep(step)

    const handleSellingMethodClick = (method: 'list' | 'retail') => {
        if (!isAuthenticated) {
            setShowLoginModal(true)
        } else {
            setSellingMethod(method)
            // Map selling method to listing type
            setFormData(prev => ({
                ...prev,
                listingType: method === 'list' ? 'CLASSIFIED' : 'AUCTION'
            }))
        }
    }

    const validateCurrentStep = (): boolean => {
        switch (currentStep) {
            case 1:
                return !!(formData.make && formData.model && formData.year && formData.mileage)
            case 2:
                return formData.images.length > 0
            case 3:
                return !!(formData.vrm && formData.fuelType && formData.transmission && formData.title)
            case 4:
                return !!(formData.price && formData.listingType)
            default:
                return true
        }
    }

    const handleNextStep = () => {
        if (!validateCurrentStep()) {
            alert("Please fill in all required fields before proceeding.")
            return
        }
        nextStep()
    }

    const handleSubmit = async () => {
        if (!validateCurrentStep()) {
            alert("Please ensure all required fields are filled.")
            return
        }

        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const listingData: CreateListingRequest = {
                title: formData.title,
                price: parseFloat(formData.price),
                mileage: parseInt(formData.mileage),
                year: parseInt(formData.year),
                vrm: formData.vrm,
                images: formData.images,
                listingType: formData.listingType as 'AUCTION' | 'CLASSIFIED',
                make: formData.make || undefined,
                model: formData.model || undefined,
                description: formData.description || undefined,
                fuelType: formData.fuelType as any || undefined,
                transmission: formData.transmission as any || undefined,
                color: formData.color || undefined,
                doors: formData.doors ? parseInt(formData.doors) : undefined,
                seats: formData.seats ? parseInt(formData.seats) : undefined,
                engineSize: formData.engineSize ? parseInt(formData.engineSize) : undefined,
                bhp: formData.bhp ? parseInt(formData.bhp) : undefined,
                features: formData.features.length > 0 ? formData.features : undefined,
                status: formData.status,
            }

            const response = await createListing(listingData)

            // Success! Redirect or show success message
            alert(`✅ Listing created successfully! Slug: ${response.data.slug}`)

            // Reset form
            setFormData({
                make: "", model: "", year: "", mileage: "",
                images: [], vrm: "", fuelType: "", transmission: "",
                color: "", doors: "", seats: "", engineSize: "", bhp: "", features: [],
                description: "", title: "", price: "",
                listingType: "", status: "DRAFT"
            })
            setCurrentStep(1)
            setSellingMethod(null)

        } catch (error) {
            console.error('Submission error:', error)
            setSubmitError(error instanceof Error ? error.message : 'Failed to create listing')
        } finally {
            setIsSubmitting(false)
        }
    }

    // Login Modal Component
    const LoginModal = () => {
        if (!showLoginModal) return null

        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-5" onClick={() => setShowLoginModal(false)}>
                <div className="glass-card p-8 max-w-md w-full relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-neon">
                        <Car size={40} />
                    </div>
                    <h2 className="text-3xl font-bold font-heading mb-4 text-white text-center">Sell Your Car</h2>
                    <p className="text-gray-300 mb-8 leading-relaxed text-center">
                        To ensure a secure community for all our members, please sign in or create an account to list your vehicle.
                    </p>

                    <div className="space-y-4 mb-8">
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

                    <div className="space-y-3">
                        <Button onClick={() => { setIsAuthenticated(true); setShowLoginModal(false); }} className="w-full shadow-neon">Log In to Continue</Button>
                        <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white">Create Account</Button>
                    </div>

                    {/* Bypass for demo */}
                    <p className="mt-4 text-xs text-gray-600 cursor-pointer hover:text-primary text-center" onClick={() => { setIsAuthenticated(true); setShowLoginModal(false); }}>(Demo: Click to bypass)</p>
                </div>
            </div>
        )
    }

    // Main Sell Page - Show selling options by default

    if (!sellingMethod) {
        return (
            <>
                <LoginModal />
                <div className="min-h-screen py-20">
                    <div className="container mx-auto px-5 max-w-5xl">
                        <div className="text-center mb-16">
                            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 text-white">How would you like to sell?</h1>
                            <p className="text-xl text-gray-300">Choose the method that works best for you.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {/* Option 1: List Your Car */}
                            <div
                                onClick={() => handleSellingMethodClick('list')}
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

                            {/* Option 2: Auction Listing */}
                            <div
                                onClick={() => handleSellingMethodClick('retail')}
                                className="glass-card p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-colors" />

                                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                    <Gavel className="text-primary w-10 h-10" />
                                </div>

                                <h2 className="text-3xl font-bold mb-4 font-heading">Auction Listing</h2>
                                <p className="text-gray-400 mb-8 h-12">Let buyers bid on your vehicle in a 7-day auction</p>

                                <ul className="space-y-3 mb-8 text-gray-300">
                                    <li className="flex items-start gap-3"><div className="mt-1"><CheckCircle size={18} className="text-emerald-400" /></div> <span>Free for sellers</span></li>
                                    <li className="flex items-start gap-3"><div className="mt-1"><CheckCircle size={18} className="text-emerald-400" /></div> <span>Buyers pay £100 winner's fee</span></li>
                                    <li className="flex items-start gap-3"><div className="mt-1"><CheckCircle size={18} className="text-emerald-400" /></div> <span>Set starting bid, reserve, and Buy It Now</span></li>
                                    <li className="flex items-start gap-3"><div className="mt-1"><CheckCircle size={18} className="text-emerald-400" /></div> <span>7-day auction duration</span></li>
                                </ul>

                                <Button className="w-full py-6 text-lg group-hover:shadow-neon">Create Auction Listing <ArrowRight className="ml-2" /></Button>
                            </div>
                        </div>


                        {/* 3 Easy Steps Section */}
                        <div className="mt-40">
                            <div className="text-center mb-20">
                                <h2 className="text-5xl md:text-6xl font-bold font-heading mb-6 text-white uppercase tracking-tight leading-tight">
                                    Sell Your Car <br /> <span className="text-primary">in 3 Easy Steps</span>
                                </h2>
                                <p className="text-gray-400 text-lg max-w-2xl mx-auto">Transform your car into cash with our simple, transparent process</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
                                {[
                                    {
                                        id: 1,
                                        img: "/assets/images/step1.jpeg",
                                        title: "Get an Instant Valuation",
                                        desc: "Skip the guesswork. Get an instant, fair valuation based on live market trends and dealer demand.",
                                        priceTag: "£26,710"
                                    },
                                    {
                                        id: 2,
                                        img: "/assets/images/step2.jpeg",
                                        title: "Get It Sold",
                                        desc: "Finish your listing. We put your car in front of 5,500+ dealers. Best offer wins.",
                                        badge: "Listing complete!"
                                    },
                                    {
                                        id: 3,
                                        img: "/assets/images/step3.jpeg",
                                        title: "Get Paid Fast",
                                        desc: "Job done! The dealer collects it for free and can pay you there and then.",
                                        badge: "You've been paid!"
                                    }
                                ].map((step, idx) => (
                                    <div key={idx} className="group">
                                        <div className="relative rounded-3xl overflow-hidden mb-6 aspect-[4/3] border border-white/10 shadow-2xl hover:shadow-[0_0_40px_rgba(237,28,36,0.15)] transition-shadow duration-500">
                                            <Image
                                                src={step.img}
                                                alt={step.title}
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                            />

                                            {/* Overlay Gradient */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                                            {/* Number Badge */}
                                            <div className="absolute top-6 left-6 w-14 h-14 bg-primary text-white font-bold text-2xl flex items-center justify-center rounded-xl shadow-lg shadow-primary/50 border border-white/10">
                                                {step.id}
                                            </div>

                                            {/* Simulated UI Overlays based on reference */}
                                            {step.priceTag && (
                                                <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl">
                                                    <div>
                                                        <div className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Your free valuation</div>
                                                        <div className="font-bold text-xl"></div>
                                                    </div>
                                                    <DollarSign size={20} className="text-primary" />
                                                </div>
                                            )}

                                            {step.id === 2 && (
                                                <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl">
                                                    <Car size={20} className="text-primary" />
                                                    <div className="font-bold text-base">Listing complete!</div>
                                                </div>
                                            )}

                                            {step.id === 3 && (
                                                <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl">
                                                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">£</div>
                                                    <div className="font-bold text-base">You've been paid!</div>
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="text-2xl font-bold font-heading text-white mb-4 uppercase tracking-wide">{step.title}</h3>
                                        <p className="text-gray-400 leading-relaxed text-base">
                                            {step.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
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
                        {sellingMethod === 'list' ? 'List Your Car' : 'Auction Your Car'}
                    </h1>
                    <p className="text-gray-300 text-lg">
                        {sellingMethod === 'list'
                            ? 'Complete the details below to publish your listing.'
                            : 'Create your auction listing to reach thousands of buyers.'}
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
                                    <label className="text-sm font-bold uppercase text-gray-400">Make *</label>
                                    <Input
                                        placeholder="e.g. BMW"
                                        value={formData.make}
                                        onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Model *</label>
                                    <Input
                                        placeholder="e.g. M4 Competition"
                                        value={formData.model}
                                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Year *</label>
                                    <Input
                                        type="number"
                                        placeholder="2023"
                                        value={formData.year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, year: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Mileage *</label>
                                    <Input
                                        type="number"
                                        placeholder="12500"
                                        value={formData.mileage}
                                        onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Media */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Media Upload</h2>
                            <ImageUpload
                                onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
                                maxImages={20}
                                existingImages={formData.images}
                            />
                        </div>
                    )}

                    {/* Step 3: Specs */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Vehicle Specifications</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">VRM (Registration) *</label>
                                    <Input
                                        placeholder="e.g. AB12 CDE"
                                        value={formData.vrm}
                                        onChange={(e) => setFormData(prev => ({ ...prev, vrm: e.target.value.toUpperCase() }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary uppercase"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Fuel Type *</label>
                                    <select
                                        value={formData.fuelType}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fuelType: e.target.value }))}
                                        className="w-full h-10 rounded-md border border-white/10 bg-slate-900/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                    >
                                        <option value="">Select fuel type</option>
                                        <option value="PETROL">Petrol</option>
                                        <option value="DIESEL">Diesel</option>
                                        <option value="ELECTRIC">Electric</option>
                                        <option value="HYBRID">Hybrid</option>
                                        <option value="PLUGIN_HYBRID">Plugin Hybrid</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Transmission *</label>
                                    <select
                                        value={formData.transmission}
                                        onChange={(e) => setFormData(prev => ({ ...prev, transmission: e.target.value }))}
                                        className="w-full h-10 rounded-md border border-white/10 bg-slate-900/50 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                    >
                                        <option value="">Select transmission</option>
                                        <option value="MANUAL">Manual</option>
                                        <option value="AUTOMATIC">Automatic</option>
                                        <option value="SEMI_AUTOMATIC">Semi-Automatic</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Colour</label>
                                    <Input
                                        placeholder="e.g. Alpine White"
                                        value={formData.color}
                                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Engine Size (cc)</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 2993"
                                        value={formData.engineSize}
                                        onChange={(e) => setFormData(prev => ({ ...prev, engineSize: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Engine Power (BHP)</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 503"
                                        value={formData.bhp}
                                        onChange={(e) => setFormData(prev => ({ ...prev, bhp: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Doors</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 3"
                                        value={formData.doors}
                                        onChange={(e) => setFormData(prev => ({ ...prev, doors: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Seats</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 5"
                                        value={formData.seats}
                                        onChange={(e) => setFormData(prev => ({ ...prev, seats: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold uppercase text-gray-400">Features</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {['Navigation', 'Leather Seats', 'Heated Seats', 'Sunroof', 'Bluetooth', 'Parking Sensors', 'Reverse Camera', 'Cruise Control', 'Climate Control', 'Apple CarPlay', 'Android Auto', 'DAB Radio', 'LED Headlights', 'Alloy Wheels', 'Tow Bar'].map((feature) => (
                                        <div
                                            key={feature}
                                            onClick={() => {
                                                setFormData(prev => {
                                                    const features = prev.features.includes(feature)
                                                        ? prev.features.filter(f => f !== feature)
                                                        : [...prev.features, feature]
                                                    return { ...prev, features }
                                                })
                                            }}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${formData.features.includes(feature)
                                                ? 'bg-primary/20 border-primary text-primary'
                                                : 'bg-slate-900/50 border-white/10 text-gray-400 hover:border-white/30'
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{feature}</span>
                                            {formData.features.includes(feature) && <CheckCircle size={16} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Listing Title *</label>
                                <Input
                                    placeholder="e.g. BMW M4 Competition 2023"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                />
                                <p className="text-xs text-gray-500">This will be the main heading for your listing</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Description (Optional)</label>
                                <Textarea
                                    placeholder="Describe your vehicle's condition, service history, features, etc."
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={6}
                                    className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary resize-none"
                                />
                                <p className="text-xs text-gray-500">{formData.description.length}/500 characters</p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Pricing */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Pricing & Listing Type</h2>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Price (£) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">£</span>
                                    <Input
                                        type="number"
                                        placeholder="25000"
                                        value={formData.price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                        className="bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary pl-8 text-lg"
                                    />
                                </div>
                                {formData.price && (
                                    <p className="text-sm text-gray-400">Display price: {formatPrice(formData.price)}</p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-bold uppercase text-gray-400">Listing Type *</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, listingType: 'CLASSIFIED' }))}
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${formData.listingType === 'CLASSIFIED'
                                            ? 'border-primary bg-primary/10 shadow-neon'
                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.listingType === 'CLASSIFIED' ? 'bg-primary' : 'bg-slate-800'
                                                }`}>
                                                <List className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="font-bold text-lg text-white">Classified</h3>
                                        </div>
                                        <p className="text-sm text-gray-400">Traditional listing with fixed price</p>
                                    </div>

                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, listingType: 'AUCTION' }))}
                                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${formData.listingType === 'AUCTION'
                                            ? 'border-primary bg-primary/10 shadow-neon'
                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.listingType === 'AUCTION' ? 'bg-primary' : 'bg-slate-800'
                                                }`}>
                                                <Gavel className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="font-bold text-lg text-white">Auction</h3>
                                        </div>
                                        <p className="text-sm text-gray-400">7-day auction with bidding</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Review */}
                    {currentStep === 5 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Review Your Listing</h2>

                            {/* Vehicle Information */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white">Vehicle Information</h3>
                                    <Button variant="ghost" size="sm" onClick={() => goToStep(1)} className="text-primary hover:text-primary/80">
                                        <Edit className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                </div>
                                <div className="glass-card p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Make</p>
                                        <p className="text-white font-medium">{formData.make}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Model</p>
                                        <p className="text-white font-medium">{formData.model}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Year</p>
                                        <p className="text-white font-medium">{formData.year}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Mileage</p>
                                        <p className="text-white font-medium">{parseInt(formData.mileage).toLocaleString()} miles</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">VRM</p>
                                        <p className="text-white font-medium">{formData.vrm}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Fuel</p>
                                        <p className="text-white font-medium">{formData.fuelType}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Transmission</p>
                                        <p className="text-white font-medium">{formData.transmission}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Colour</p>
                                        <p className="text-white font-medium">{formData.color || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Engine</p>
                                        <p className="text-white font-medium">{formData.engineSize ? `${formData.engineSize}cc` : '-'} {formData.bhp ? `(${formData.bhp} BHP)` : ''}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase">Doors / Seats</p>
                                        <p className="text-white font-medium">{formData.doors || '-'} / {formData.seats || '-'}</p>
                                    </div>
                                </div>
                                {formData.features.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-xs text-gray-500 uppercase mb-2">Features</p>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.features.map((f, i) => (
                                                <span key={i} className="text-xs bg-slate-800 text-gray-300 px-2 py-1 rounded-md border border-white/10">{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Media */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white">Media ({formData.images.length} images)</h3>
                                    <Button variant="ghost" size="sm" onClick={() => goToStep(2)} className="text-primary hover:text-primary/80">
                                        <Edit className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                </div>
                                <div className="glass-card p-6">
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                                        {formData.images.map((img, idx) => (
                                            <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                                                <Image src={img} alt={`Image ${idx + 1}`} fill className="object-cover" sizes="(max-width: 768px) 33vw, 20vw" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white">Listing Details</h3>
                                    <Button variant="ghost" size="sm" onClick={() => goToStep(3)} className="text-primary hover:text-primary/80">
                                        <Edit className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                </div>
                                <div className="glass-card p-6 space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Title</p>
                                        <p className="text-white font-bold text-xl">{formData.title}</p>
                                    </div>
                                    {formData.description && (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase mb-1">Description</p>
                                            <p className="text-gray-300 text-sm leading-relaxed">{formData.description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white">Pricing</h3>
                                    <Button variant="ghost" size="sm" onClick={() => goToStep(4)} className="text-primary hover:text-primary/80">
                                        <Edit className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                </div>
                                <div className="glass-card p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Price</p>
                                        <p className="text-white font-bold text-3xl">{formatPrice(formData.price)}</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-full ${formData.listingType === 'AUCTION' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-primary/20 text-primary'
                                        }`}>
                                        <p className="font-bold uppercase text-sm">{formData.listingType}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Error Display */}
                            {submitError && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                                    <p className="text-red-400 text-sm">{submitError}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-12 pt-8 border-t border-white/10">
                        {currentStep > 1 ? (
                            <Button variant="outline" onClick={prevStep} className="px-8 border-white/20 text-white hover:bg-white/10">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                            </Button>
                        ) : (
                            <div /> // Spacer
                        )}

                        {currentStep < 5 ? (
                            <Button onClick={handleNextStep} className="px-8 shadow-neon">
                                Next Step <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-8 bg-emerald-600 hover:bg-emerald-700 border-none shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Publishing...
                                    </>
                                ) : (
                                    <>
                                        Publish Listing <CheckCircle className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
