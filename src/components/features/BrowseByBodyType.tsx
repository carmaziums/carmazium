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

                {/* Infinite Carousel Container */}
                <div className="relative mt-8 sm:mt-12 overflow-hidden py-4">
                    {/* Visual Edge Fades for Premium Look */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-[var(--bg-body)] to-transparent" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-[var(--bg-body)] to-transparent" />

                    <motion.div
                        className="flex gap-6 md:gap-10 w-max"
                        animate={{
                            x: ["0%", "-33.3333%"],
                        }}
                        transition={{
                            x: {
                                repeat: Infinity,
                                repeatType: "loop",
                                duration: 35,
                                ease: "linear",
                            },
                        }}
                        whileHover={{ animationPlayState: "paused" }}
                        style={{ paddingLeft: "2rem", paddingRight: "2rem" }}
                    >
                {/* Duplicated items for infinite loop */}
                {[...BODY_TYPES, ...BODY_TYPES, ...BODY_TYPES].map((bt, idx) => {
                    return (
                        <div
                            key={`${bt.key}-${idx}`}
                            className="w-[140px] sm:w-[170px] md:w-[200px] shrink-0"
                        >
                            <Link
                                href={`/search?bodyType=${bt.key}`}
                                className="group block aspect-square rounded-[1.5rem] overflow-hidden transition-all duration-500 bg-white shadow-sm hover:shadow-xl"
                                onMouseEnter={e => {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.transform = "translateY(-6px)"
                                }}
                                onMouseLeave={e => {
                                    const el = e.currentTarget as HTMLElement
                                    el.style.transform = "translateY(0)"
                                }}
                            >
                                <div className="h-full flex flex-col p-3 sm:p-4">
                                    {/* Image Section - Centered & Clean */}
                                    <div className="relative flex-grow flex items-center justify-center bg-transparent">
                                        <Image
                                            src={bt.image}
                                            alt={bt.label}
                                            fill
                                            sizes="(max-width: 640px) 140px, (max-width: 768px) 170px, 200px"
                                            className="object-contain p-0.5 group-hover:scale-110 transition-transform duration-700 ease-out mix-blend-multiply brightness-[1.1] contrast-[1.1]"
                                        />
                                    </div>

                                    {/* Label Section - Bold & Clean */}
                                    <div className="pt-1 text-center">
                                        <h3 className="text-sm sm:text-base md:text-lg font-extrabold tracking-tight text-[#02162b]">
                                            {bt.label}
                                        </h3>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    )
                })}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
