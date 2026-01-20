"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { AccordionItem } from "@/components/ui/Accordion"
import { FinanceCalculator } from "@/components/features/FinanceCalculator"
import { ArrowLeft, Camera, CheckCircle, ShieldCheck, Cog, Music, Car as CarIcon, MapPin, Share2, Heart, Scale } from "lucide-react"
import { useCompare } from "@/context/CompareContext"

export default function VehicleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    // Mock data generation based on ID to simulate different cars
    const isSecondCar = id === "2"

    const vehicle = {
        id: id, // Use actual param ID
        title: isSecondCar ? "2024 BMW M4 Competition" : "2024 Porsche 911 Carrera GTS",
        subtitle: isSecondCar ? "3.0L Twin-Turbo Inline-6 | 8-Speed Auto" : "3.0L Twin-Turbo Flat-6 | PDK Automatic",
        price: isSecondCar ? "£85,000" : "£115,000",
        images: isSecondCar ? [
            "/assets/images/featured-sedan.png",
            "/assets/images/featured-suv.png"
        ] : [
            "/assets/images/featured-sports.png",
            "/assets/images/featured-suv.png",
            "/assets/images/featured-sedan.png"
        ],
        specs: isSecondCar ? {
            year: "2024",
            mileage: "2,500 miles",
            engine: "503 bhp",
            transmission: "Automatic",
            doors: "2",
            seats: "4"
        } : {
            year: "2024",
            mileage: "< 100 miles",
            engine: "473 bhp",
            transmission: "Automatic (PDK)",
            doors: "2",
            seats: "4"
        }
    }

    const [activeImage, setActiveImage] = React.useState(0)

    const { addToCompare, removeFromCompare, isInCompare } = useCompare()
    const isCompared = isInCompare(vehicle.id)

    const handleCompare = () => {
        if (isCompared) {
            removeFromCompare(vehicle.id)
        } else {
            addToCompare({
                id: vehicle.id,
                title: vehicle.title,
                price: vehicle.price,
                image: vehicle.images[0],
                specs: {
                    year: vehicle.specs.year,
                    mileage: vehicle.specs.mileage,
                    engine: vehicle.specs.engine,
                    transmission: vehicle.specs.transmission,
                    doors: vehicle.specs.doors,
                    seats: vehicle.specs.seats
                }
            })
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 pt-24 pb-12 relative">
            {/* Background gradient from original css */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] to-[#1e293b] -z-10" />

            <div className="container mx-auto px-5">
                {/* Breadcrumb & Header */}
                <div className="mb-8">
                    <Link href="/search" className="text-gray-400 hover:text-primary text-sm flex items-center mb-4 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Back to Inventory
                    </Link>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold font-heading text-white mb-2">{vehicle.title}</h1>
                            <p className="text-gray-300 text-lg">{vehicle.subtitle}</p>
                        </div>
                        <div className="flex gap-4">
                            <Button
                                variant={isCompared ? "default" : "outline"}
                                className={`rounded-full ${isCompared ? 'bg-primary border-primary text-white' : 'border-gray-600 text-gray-400 hover:text-white hover:border-white'}`}
                                onClick={handleCompare}
                            >
                                <Scale size={20} className="mr-2" /> {isCompared ? "Compared" : "Compare"}
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-white hover:border-white">
                                <Share2 size={20} />
                            </Button>
                            <Button variant="outline" size="icon" className="rounded-full border-gray-600 text-gray-400 hover:text-red-500 hover:border-red-500">
                                <Heart size={20} />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Gallery & Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Gallery */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-4">
                            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4 group">
                                <Image
                                    src={vehicle.images[activeImage] || vehicle.images[0]}
                                    alt={vehicle.title}
                                    fill
                                    className="object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
                                    <Camera size={16} /> 1/45
                                </div>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                                {vehicle.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImage(idx)}
                                        className={`relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${activeImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                    >
                                        <Image src={img} alt={`Thumb ${idx}`} fill className="object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Key Info */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Key Information</h3>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { label: "Year", value: "2024" },
                                    { label: "Doors", value: "2" },
                                    { label: "Mileage", value: "< 100 miles" },
                                    { label: "Seats", value: "4" },
                                    { label: "Engine", value: "473 bhp" },
                                    { label: "Colour", value: "Carmine Red" }, // Could add color dot
                                    { label: "Trans", value: "Automatic (PDK)" },
                                    { label: "Warranty", value: "3 Years" },
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-gray-400 text-sm">{item.label}</span>
                                        <span className="text-white font-semibold text-sm">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Features Accordion */}
                        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-8">
                            <h3 className="text-xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Vehicle Features</h3>
                            <div className="space-y-1">
                                <AccordionItem title="Interior Features" icon={<CarIcon size={18} />}>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Heated leather seats with memory function</li>
                                        <li>Carbon fibre dashboard trim</li>
                                        <li>Alcantara steering wheel</li>
                                    </ul>
                                </AccordionItem>
                                <AccordionItem title="Security" icon={<ShieldCheck size={18} />}>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Alarm system with interior surveillance</li>
                                        <li>Porsche Vehicle Tracking System (PVTS)</li>
                                    </ul>
                                </AccordionItem>
                                <AccordionItem title="Entertainment" icon={<Music size={18} />}>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Bose Surround Sound System</li>
                                        <li>Apple CarPlay / Android Auto</li>
                                    </ul>
                                </AccordionItem>
                                <AccordionItem title="Engine / Drivetrain" icon={<Cog size={18} />}>
                                    <p>3.0-litre twin-turbocharged boxer 6 engine producing 473 bhp and 570 Nm of torque.</p>
                                </AccordionItem>
                            </div>
                        </div>

                        {/* Finance Calculator */}
                        <FinanceCalculator vehiclePrice={115000} />
                    </div>

                    {/* Right Column: Sticky Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-28 bg-slate-800 rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                            <div className="h-1 bg-primary w-full absolute top-0" />
                            <div className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary font-bold text-xl">CM</div>
                                    <div>
                                        <h4 className="text-white font-bold">CarMazium Premium</h4>
                                        <p className="text-xs text-primary flex items-center gap-1"><CheckCircle size={12} /> Verified Dealer</p>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <div className="text-4xl font-bold text-white mb-2">{vehicle.price}</div>
                                    <div className="inline-block bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded text-xs font-bold mb-4">
                                        Best Price Guarantee
                                    </div>
                                    <p className="text-xs text-gray-400">Price includes VAT. Financing available from 5.9% APR.</p>
                                </div>

                                <div className="space-y-3">
                                    <Button className="w-full py-6 text-lg" shape="default">Enquire Now</Button>
                                    <Button variant="outline" className="w-full py-6 text-lg border-white/20 text-white hover:bg-white/10">Buy Online</Button>
                                </div>
                            </div>

                            <div className="bg-white/5 p-4 flex items-center justify-center gap-2 text-gray-400 text-xs hover:text-white cursor-pointer transition-colors">
                                <MapPin size={14} /> View Location
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
