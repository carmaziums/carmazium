"use client"

import * as React from "react"

export const dynamic = 'force-dynamic';
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Car, Camera, List, DollarSign, CheckCircle, ArrowRight, ArrowLeft, Gavel, Loader2, X } from "lucide-react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function SellPage() {
    const [currentStep, setCurrentStep] = React.useState(1)
    const [isUploading, setIsUploading] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [formData, setFormData] = React.useState({
        make: "",
        model: "",
        year: "",
        mileage: "",
        fuelType: "PETROL",
        transmission: "AUTOMATIC",
        vrm: "",
        price: "",
        listingType: "CLASSIFIED",
        images: [] as string[]
    })

    const [sellingMethod, setSellingMethod] = React.useState<'list' | 'retail' | null>(null)
    const [showLoginModal, setShowLoginModal] = React.useState(false)
    const [isAuthenticated, setIsAuthenticated] = React.useState(false)

    React.useEffect(() => {
        window.scrollTo(0, 0)
    }, [currentStep, sellingMethod])

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5))
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        const newImages = [...formData.images]

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { data, error } = await supabase.storage
                .from('listings')
                .upload(filePath, file)

            if (error) {
                console.error('Error uploading image:', error.message)
                continue
            }

            const { data: { publicUrl } } = supabase.storage
                .from('listings')
                .getPublicUrl(filePath)

            newImages.push(publicUrl)
        }

        setFormData(prev => ({ ...prev, images: newImages }))
        setIsUploading(false)
    }

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }))
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)
        try {
            const response = await fetch('/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    year: parseInt(formData.year),
                    mileage: parseInt(formData.mileage),
                    price: parseFloat(formData.price)
                })
            })

            if (response.ok) {
                alert('Listing created successfully!')
                window.location.href = '/dashboard/seller/listings'
            } else {
                const errorText = await response.text()
                console.error('API Error Response:', errorText)
                try {
                    const errorJson = JSON.parse(errorText)
                    alert(`Error: ${errorJson.message || 'Failed to create listing'}`)
                } catch (e) {
                    alert(`Server Error: ${response.status} ${response.statusText}`)
                }
            }
        } catch (err) {
            console.error('Submission error:', err)
            alert(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Login Modal Component (Omitted for brevity, keep original)
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
                    <div className="space-y-3">
                        <Button onClick={() => { setIsAuthenticated(true); setShowLoginModal(false); }} className="w-full shadow-neon">Log In to Continue</Button>
                        <Button variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white">Create Account</Button>
                    </div>
                    <p className="mt-4 text-xs text-gray-600 cursor-pointer hover:text-primary text-center" onClick={() => { setIsAuthenticated(true); setShowLoginModal(false); }}>(Demo: Click to bypass)</p>
                </div>
            </div>
        )
    }

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
                            <div onClick={() => setSellingMethod('list')} className="glass-card p-10 cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10 group-hover:bg-primary/20 transition-colors" />
                                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                    <List className="text-primary w-10 h-10" />
                                </div>
                                <h2 className="text-3xl font-bold mb-4 font-heading">List My Car</h2>
                                <p className="text-gray-400 mb-8 h-12">Create a public listing or auction. You control the price.</p>
                                <Button className="w-full py-6 text-lg group-hover:shadow-neon">Start Listing <ArrowRight className="ml-2" /></Button>
                            </div>

                            <div onClick={() => setSellingMethod('retail')} className="glass-card p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10 group-hover:bg-indigo-500/20 transition-colors" />
                                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-8 border border-white/10 group-hover:border-primary/50 group-hover:shadow-[0_0_30px_rgba(237,28,36,0.2)] transition-all">
                                    <Gavel className="text-primary w-10 h-10" />
                                </div>
                                <h2 className="text-3xl font-bold mb-4 font-heading">Auction Listing</h2>
                                <p className="text-gray-400 mb-8 h-12">Let buyers bid on your vehicle in a 7-day auction.</p>
                                <Button className="w-full py-6 text-lg group-hover:shadow-neon">Create Auction <ArrowRight className="ml-2" /></Button>
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
                                    { id: 1, img: "/assets/images/step1.jpeg", title: "Get Valuation", desc: "Skip the guesswork. Get an instant, fair valuation based on live market trends." },
                                    { id: 2, img: "/assets/images/step2.jpeg", title: "Get It Sold", desc: "Finish your listing. We put your car in front of 5,500+ dealers. Best offer wins." },
                                    { id: 3, img: "/assets/images/step3.jpeg", title: "Get Paid Fast", desc: "Job done! The dealer collects it for free and can pay you there and then." }
                                ].map((step, idx) => (
                                    <div key={idx} className="group">
                                        <div className="relative rounded-3xl overflow-hidden mb-6 aspect-[4/3] border border-white/10 shadow-2xl hover:shadow-[0_0_40px_rgba(237,28,36,0.15)] transition-shadow duration-500">
                                            <div className="absolute inset-0 bg-slate-800 animate-pulse" />
                                            {/* We use Image here, but assuming path exists in public */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                            <div className="absolute top-6 left-6 w-14 h-14 bg-primary text-white font-bold text-2xl flex items-center justify-center rounded-xl shadow-lg border border-white/10">
                                                {step.id}
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-bold font-heading text-white mb-4 uppercase tracking-wide">{step.title}</h3>
                                        <p className="text-gray-400 leading-relaxed text-base">{step.desc}</p>
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
        { id: 4, icon: DollarSign, title: "Pricing" },
        { id: 5, icon: CheckCircle, title: "Review" },
    ]

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-5 max-w-4xl">
                <div className="mb-8">
                    <Button variant="ghost" onClick={() => setSellingMethod(null)} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                </div>

                {/* Progress Bar */}
                <div className="glass-card p-6 mb-8 flex justify-between relative overflow-hidden">
                    {steps.map((step) => (
                        <div key={step.id} className={`flex flex-col items-center relative z-10 w-full ${currentStep >= steps.indexOf(step) + 1 ? 'text-primary' : 'text-gray-500'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all border border-white/5 ${currentStep >= steps.indexOf(step) + 1 ? 'bg-primary text-white shadow-neon' : 'bg-slate-800'}`}>
                                <step.icon size={20} />
                            </div>
                            <span className="text-[10px] md:text-xs font-bold uppercase tracking-wide">{step.title}</span>
                        </div>
                    ))}
                </div>

                {/* Form Content */}
                <div className="glass-card p-8 md:p-12 relative overflow-hidden">
                    {/* Step 1: Vehicle Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Vehicle Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Make</label>
                                    <Input name="make" value={formData.make} onChange={handleInputChange} placeholder="e.g. BMW" className="bg-slate-900/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Model</label>
                                    <Input name="model" value={formData.model} onChange={handleInputChange} placeholder="e.g. M4" className="bg-slate-900/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Year</label>
                                    <Input name="year" type="number" value={formData.year} onChange={handleInputChange} placeholder="2023" className="bg-slate-900/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Mileage</label>
                                    <Input name="mileage" type="number" value={formData.mileage} onChange={handleInputChange} placeholder="12500" className="bg-slate-900/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">VRM (Reg)</label>
                                    <Input name="vrm" value={formData.vrm} onChange={handleInputChange} placeholder="e.g. AB12 CDE" className="bg-slate-900/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Transmission</label>
                                    <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option value="AUTOMATIC">Automatic</option>
                                        <option value="MANUAL">Manual</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Fuel Type</label>
                                    <select name="fuelType" value={formData.fuelType} onChange={handleInputChange} className="w-full h-10 px-3 rounded-md bg-slate-900/50 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary">
                                        <option value="PETROL">Petrol</option>
                                        <option value="DIESEL">Diesel</option>
                                        <option value="ELECTRIC">Electric</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Media */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Media Upload</h2>
                            <div className="relative border-2 border-dashed border-white/20 rounded-xl p-12 text-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                {isUploading ? (
                                    <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
                                ) : (
                                    <Camera className="h-12 w-12 text-primary mx-auto mb-4" />
                                )}
                                <p className="text-lg font-bold text-white mb-2">{isUploading ? 'Uploading...' : 'Click to upload photos'}</p>
                                <p className="text-gray-400 text-sm">Max 20 photos. Formats: JPG, PNG, WEBP.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                {formData.images.map((url, idx) => (
                                    <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-white/10 group">
                                        <Image src={url} alt={`Upload ${idx}`} fill className="object-cover" />
                                        <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Pricing */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Pricing</h2>
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold uppercase text-gray-400">Asking Price (£)</label>
                                    <Input name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="e.g. 25000" className="bg-slate-900/50 border-white/10 text-white text-2xl h-16" />
                                </div>
                                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                                    <p className="text-sm text-gray-300">Tip: Setting a competitive price helps your listing sell faster. Check our valuation tool for guidance.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {currentStep === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold font-heading mb-6 border-b border-white/10 pb-4 text-white">Final Review</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 text-gray-300">
                                    <p><span className="text-gray-500 uppercase text-xs font-bold block mb-1">Vehicle</span> <span className="text-white font-bold text-xl">{formData.year} {formData.make} {formData.model}</span></p>
                                    <p><span className="text-gray-500 uppercase text-xs font-bold block mb-1">Mileage</span> <span className="text-white font-bold">{formData.mileage} miles</span></p>
                                    <p><span className="text-gray-500 uppercase text-xs font-bold block mb-1">Price</span> <span className="text-primary font-bold text-2xl">£{formData.price}</span></p>
                                </div>
                                <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10">
                                    {formData.images[0] ? (
                                        <Image src={formData.images[0]} alt="Primary" fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-gray-600">No images</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-12 pt-8 border-t border-white/10">
                        {currentStep > 1 ? (
                            <Button variant="outline" onClick={prevStep} className="px-8 border-white/20 text-white">Previous</Button>
                        ) : <div />}

                        {currentStep < 4 ? (
                            <Button onClick={nextStep} disabled={isUploading} className="px-8 shadow-neon">
                                Next Step <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={isSubmitting} className="px-8 bg-emerald-600 hover:bg-emerald-700 shadow-neon">
                                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                                Publish Listing
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div >
    )
}
