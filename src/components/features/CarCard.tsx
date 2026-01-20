"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useRef } from "react"

interface CarCardProps {
    title: string
    price: string
    image: string
    href?: string
}

export function CarCard({ title, price, image, href = "#" }: CarCardProps) {
    const ref = useRef<HTMLDivElement>(null)

    // Motion values for 3D tilt
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    // Spring physics for smooth tilt
    const mouseX = useSpring(x, { stiffness: 150, damping: 15 })
    const mouseY = useSpring(y, { stiffness: 150, damping: 15 })

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["5deg", "-5deg"])
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-5deg", "5deg"])

    // Shimmer effect calculations
    const shimmerX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"])
    const shimmerY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"])

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
        if (!ref.current) return

        const rect = ref.current.getBoundingClientRect()

        const width = rect.width
        const height = rect.height

        const mouseXFormatted = e.clientX - rect.left
        const mouseYFormatted = e.clientY - rect.top

        const xPct = mouseXFormatted / width - 0.5
        const yPct = mouseYFormatted / height - 0.5

        x.set(xPct)
        y.set(yPct)
    }

    function handleMouseLeave() {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
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
                {/* Creative Spotlight Glow effect - Indigo/Blueish instead of Red */}
                <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl rounded-full scale-150 mix-blend-screen" />

                <motion.div
                    style={{ transform: "translateZ(40px)" }}
                    className="relative z-10 w-full h-full flex items-center justify-center"
                >
                    {/* Wrap image in Link for better UX */}
                    <Link href={href} className="cursor-pointer">
                        <Image
                            src={image}
                            alt={title}
                            width={400}
                            height={300}
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
                    <motion.div
                        className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking items-center flex"
                        whileHover={{ scale: 1.1 }}
                    >
                        Verified
                    </motion.div>
                </div>

                <p className="text-white text-2xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-6">
                    {price}
                </p>

                <div className="mt-auto">
                    {/* Make the button use the default red gradient variant for high contrast */}
                    <Link href={href} className="block w-full">
                        <Button
                            className="w-full shadow-lg text-white"
                            variant="default" // Changed from outline to default
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
