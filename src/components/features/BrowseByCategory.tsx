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
                    Browse by category
                </motion.h2>

                <div className="flex flex-col gap-5 items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="flex flex-wrap md:flex-nowrap justify-center gap-3 md:gap-3 lg:gap-4 w-full max-w-[1200px] mx-auto px-4"
                    >
                        {CATEGORIES.slice(0, 7).map((cat, idx) => (
                            <Link
                                key={cat.label}
                                href={buildSearchUrl(cat.params)}
                                className="group whitespace-nowrap"
                            >
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.35, delay: idx * 0.04 }}
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    className="inline-flex items-center px-4 md:px-5 py-2.5 rounded-full text-xs md:text-sm lg:text-base font-medium
                                        border transition-all duration-300 cursor-pointer select-none"
                                    style={{
                                        color: "var(--text-secondary)",
                                        borderColor: "var(--border-default)",
                                        background: "var(--bg-card)",
                                    }}
                                    onMouseEnter={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "#ed1c24"
                                        el.style.color = "#ed1c24"
                                        el.style.boxShadow = "0 0 16px rgba(237,28,36,0.15)"
                                    }}
                                    onMouseLeave={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "var(--border-default)"
                                        el.style.color = "var(--text-secondary)"
                                        el.style.boxShadow = "none"
                                    }}
                                >
                                    {cat.label}
                                </motion.span>
                            </Link>
                        ))}
                    </motion.div>

                    {/* Second line with only one pill */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="flex justify-center w-full"
                    >
                        {CATEGORIES.slice(7, 8).map((cat) => (
                            <Link
                                key={cat.label}
                                href={buildSearchUrl(cat.params)}
                                className="group"
                            >
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.35, delay: 0.1 }}
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    className="inline-flex items-center px-4 md:px-5 py-2.5 rounded-full text-xs md:text-sm lg:text-base font-medium
                                        border transition-all duration-300 cursor-pointer select-none"
                                    style={{
                                        color: "var(--text-secondary)",
                                        borderColor: "var(--border-default)",
                                        background: "var(--bg-card)",
                                    }}
                                    onMouseEnter={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "#ed1c24"
                                        el.style.color = "#ed1c24"
                                        el.style.boxShadow = "0 0 16px rgba(237,28,36,0.15)"
                                    }}
                                    onMouseLeave={e => {
                                        const el = e.currentTarget as HTMLElement
                                        el.style.borderColor = "var(--border-default)"
                                        el.style.color = "var(--text-secondary)"
                                        el.style.boxShadow = "none"
                                    }}
                                >
                                    {cat.label}
                                </motion.span>
                            </Link>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
