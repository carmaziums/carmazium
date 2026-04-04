"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    BODY_TYPE_ICONS,
} from "@/components/icons/BodyTypeIcons"

/**
 * Body types displayed on the homepage.
 * Each links to /search?bodyType=KEY.
 * We show a generated car image plus the SVG silhouette icon as a subtle overlay.
 */
const BODY_TYPES = [
    { key: "COUPE", label: "Coupes", image: "/assets/images/body-coupe.png" },
    { key: "CONVERTIBLE", label: "Convertibles", image: "/assets/images/body-convertible.png" },
    { key: "HATCHBACK", label: "Hatchbacks", image: "/assets/images/body-hatchback.png" },
    { key: "MPV", label: "MPVs", image: "/assets/images/body-mpv.png" },
    { key: "PICKUP_TRUCK", label: "Pickup Trucks", image: "/assets/images/body-pickup.png" },
    { key: "SEDAN", label: "Saloons", image: "/assets/images/body-saloon.png" },
    { key: "SUV", label: "SUVs", image: "/assets/images/body-suv.png" },
    { key: "ESTATE", label: "Estates", image: "/assets/images/body-estate.png" },
] as const

export function BrowseByBodyType() {
    return (
        <section className="py-16 md:py-20">
            <div className="container mx-auto px-5">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-2xl md:text-3xl font-heading font-bold text-center mb-10"
                    style={{ color: "var(--text-primary)" }}
                >
                    Browse by body type
                </motion.h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
                    {BODY_TYPES.map((bt, idx) => {
                        const Icon = BODY_TYPE_ICONS[bt.key]
                        return (
                            <motion.div
                                key={bt.key}
                                initial={{ opacity: 0, y: 25 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: idx * 0.05 }}
                            >
                                <Link
                                    href={`/search?bodyType=${bt.key}`}
                                    className="group block rounded-2xl overflow-hidden transition-all duration-300 border hover:shadow-lg"
                                    style={{
                                        background: "var(--bg-card)",
                                        borderColor: "var(--border-default)",
                                    }}
                                    onMouseEnter={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "rgba(237,28,36,0.3)"
                                        el.style.transform = "translateY(-4px)"
                                    }}
                                    onMouseLeave={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "var(--border-default)"
                                        el.style.transform = "translateY(0)"
                                    }}
                                >
                                    {/* Image */}
                                    <div className="relative w-full aspect-[4/3] overflow-hidden"
                                        style={{ background: "var(--bg-card)" }}
                                    >
                                        <Image
                                            src={bt.image}
                                            alt={bt.label}
                                            fill
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                            className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>

                                    {/* Label with icon */}
                                    <div className="flex items-center justify-center gap-2 px-3 py-3 border-t"
                                        style={{ borderColor: "var(--border-default)" }}
                                    >
                                        {Icon && (
                                            <Icon className="w-7 h-4 shrink-0 transition-colors duration-200 text-[var(--text-muted)] group-hover:text-primary"
                                            />
                                        )}
                                        <span className="text-sm md:text-base font-semibold transition-colors duration-200 group-hover:text-primary"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            {bt.label}
                                        </span>
                                    </div>
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
