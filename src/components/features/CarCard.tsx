"use client"

import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"
import { Calendar, Gauge, Fuel, Car } from "lucide-react"
import { SellerBadge } from "@/components/ui/SellerBadge"

// ─── Label Mapping ───────────────────────────────────────────────────────────

const BODY_TYPE_LABELS: Record<string, string> = {
    SEDAN: 'Sedan', SUV: 'SUV', HATCHBACK: 'Hatchback', COUPE: 'Coupé',
    CONVERTIBLE: 'Convertible', ESTATE: 'Estate', CROSSOVER: 'Crossover',
    SPORTS_CAR: 'Sports Car', MINIVAN: 'Minivan', PICKUP_TRUCK: 'Pickup',
    STATION_WAGON: 'Wagon', MPV: 'MPV', VAN: 'Van',
}

const FUEL_TYPE_LABELS: Record<string, string> = {
    PETROL: 'Petrol', DIESEL: 'Diesel', ELECTRIC: 'Electric',
    HYBRID: 'Hybrid', PLUGIN_HYBRID: 'Plug-in', LPG: 'LPG',
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CarCardProps {
    title: string
    price: string
    image: string
    href?: string
    year?: number
    mileage?: number
    fuelType?: string
    bodyType?: string
    sellerId?: string
    sellerScore?: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CarCard({
    title, price, image, href = "#",
    year, mileage, fuelType, bodyType,
    sellerId, sellerScore
}: CarCardProps) {
    const ref = useRef<HTMLDivElement>(null)

    // Motion values for 3D tilt
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // Spring physics for smooth tilt
    const mouseX = useSpring(x, { stiffness: 150, damping: 15 })
    const mouseY = useSpring(y, { stiffness: 150, damping: 15 })

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["5deg", "-5deg"])
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-5deg", "5deg"])

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (!ref.current) return
        const rect = ref.current.getBoundingClientRect()
        const xPct = (e.clientX - rect.left) / rect.width - 0.5
        const yPct = (e.clientY - rect.top) / rect.height - 0.5
        x.set(xPct)
        y.set(yPct)
    }

    function handleMouseLeave() {
        x.set(0)
        y.set(0)
    }

    const hasSpecs = year || mileage || fuelType || bodyType

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            className="glass-card h-full flex flex-col perspective-1000 overflow-visible group"
        >
            {/* Holographic Shimmer Overlay */}
            <motion.div
                style={{
                    background: useTransform(
                        [mouseX, mouseY],
                        ([latestX, latestY]: number[]) => `radial-gradient(circle at ${50 + latestX * 100}% ${50 + latestY * 100}%, rgba(255,255,255,0.15) 0%, transparent 50%)`
                    ),
                    zIndex: 20
                }}
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
            />

            <div
                className="h-[240px] bg-gradient-to-br from-slate-800/50 to-transparent flex items-center justify-center p-6 relative overflow-hidden flex-shrink-0"
                style={{ transform: "translateZ(0px)" }}
            >
                {/* Spotlight Glow */}
                <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl rounded-full scale-150 mix-blend-screen" />

                <motion.div
                    style={{ transform: "translateZ(40px)" }}
                    className="relative z-10 w-full h-full flex items-center justify-center"
                >
                    <Link href={href} className="cursor-pointer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={image}
                            alt={title}
                            className="max-h-full w-auto object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1"
                        />
                    </Link>
                </motion.div>
            </div>

            <div
                className="p-6 relative z-10 flex flex-col flex-1 border-t border-white/5 bg-gradient-to-b from-white/5 to-transparent rounded-b-2xl"
                style={{ transform: "translateZ(20px)" }}
            >
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold font-heading text-white tracking-wide group-hover:text-primary transition-colors duration-300">{title}</h3>
                    {sellerId && sellerScore !== undefined ? (
                        <SellerBadge score={sellerScore} sellerUserId={sellerId} size="sm" showLabel />
                    ) : (
                        <motion.div
                            className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking items-center flex shrink-0"
                            whileHover={{ scale: 1.1 }}
                        >
                            Verified
                        </motion.div>
                    )}
                </div>

                <p className="text-white text-2xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                    {price}
                </p>

                {/* Specs Tags */}
                {hasSpecs && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {year && (
                            <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Calendar size={10} /> {year}
                            </span>
                        )}
                        {mileage !== undefined && mileage !== null && (
                            <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Gauge size={10} /> {mileage.toLocaleString()} mi
                            </span>
                        )}
                        {fuelType && FUEL_TYPE_LABELS[fuelType] && (
                            <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Fuel size={10} /> {FUEL_TYPE_LABELS[fuelType]}
                            </span>
                        )}
                        {bodyType && BODY_TYPE_LABELS[bodyType] && (
                            <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-md">
                                <Car size={10} /> {BODY_TYPE_LABELS[bodyType]}
                            </span>
                        )}
                    </div>
                )}

                <div className="mt-auto">
                    <Link href={href} className="block w-full">
                        <Button
                            className="w-full shadow-lg text-white"
                            variant="default"
                            size="sm"
                            shape="default"
                        >
                            View Details
                        </Button>
                    </Link>
                </div>
            </div>
        </motion.div>
    )
}
