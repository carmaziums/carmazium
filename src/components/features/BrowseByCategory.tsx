"use client"

import Link from "next/link"
import { motion } from "framer-motion"

/**
 * Each category maps to a sensible combination of search query params.
 * When clicked, the user is taken to /search?...those params.
 */
const CATEGORIES = [
    {
        label: "Small and sporty",
        params: { bodyType: "HATCHBACK", search: "sporty" },
    },
    {
        label: "Eco-friendly",
        params: { fuelTypes: "Electric,Hybrid" },
    },
    {
        label: "Automatic",
        params: { transmissions: "Automatic" },
    },
    {
        label: "Seven-seater",
        params: { minSeats: "7" },
    },
    {
        label: "Affordable 4x4",
        params: { bodyType: "SUV", maxPrice: "20000" },
    },
    {
        label: "Great first cars",
        params: { maxPrice: "8000", maxEngine: "1400" },
    },
    {
        label: "Dog-friendly",
        params: { bodyType: "ESTATE" },
    },
    {
        label: "Fuel-efficient",
        params: { fuelTypes: "Hybrid,Plugin Hybrid" },
    },
] as const

function buildSearchUrl(params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString()
    return `/search?${qs}`
}

export function BrowseByCategory() {
    return (
        <section className="pt-16 pb-6 md:pt-20 md:pb-10">
            <div className="container mx-auto px-5">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-2xl md:text-3xl font-heading font-bold text-center mb-10"
                    style={{ color: "var(--text-primary)" }}
                >
                    Browse by category
                </motion.h2>

                {/* Infinite Carousel Container */}
                <div className="relative mt-8 sm:mt-12 overflow-hidden py-4">
                    {/* Visual Edge Fades for Premium Look */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-[var(--bg-body)] to-transparent" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-[var(--bg-body)] to-transparent" />

                    <motion.div
                        className="flex gap-4 md:gap-6 w-max"
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
                        style={{ paddingLeft: "1rem", paddingRight: "1rem" }}
                    >
                        {/* Duplicated items for infinite loop */}
                        {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((cat, idx) => (
                            <div key={`${cat.label}-${idx}`} className="shrink-0">
                                <Link
                                    href={buildSearchUrl(cat.params)}
                                    className="group whitespace-nowrap block"
                                >
                                    <div
                                        className="inline-flex items-center px-5 md:px-6 py-3 rounded-full text-sm md:text-base lg:text-lg font-medium border transition-all duration-300 cursor-pointer select-none shadow-sm hover:shadow-xl"
                                        style={{
                                            color: "var(--text-secondary)",
                                            borderColor: "var(--border-default)",
                                            background: "var(--bg-card)",
                                        }}
                                        onMouseEnter={(e) => {
                                            const el = e.currentTarget as HTMLElement
                                            el.style.borderColor = "#ed1c24"
                                            el.style.color = "#ed1c24"
                                            el.style.boxShadow = "0 0 16px rgba(237,28,36,0.15)"
                                        }}
                                        onMouseLeave={(e) => {
                                            const el = e.currentTarget as HTMLElement
                                            el.style.borderColor = "var(--border-default)"
                                            el.style.color = "var(--text-secondary)"
                                            el.style.boxShadow = "none"
                                        }}
                                    >
                                        {cat.label}
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
