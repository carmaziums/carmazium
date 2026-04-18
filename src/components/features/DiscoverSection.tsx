"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/Button"

export function DiscoverSection() {
    return (
        <section className="relative overflow-hidden">
            {/* Background — brand gradient from dark secondary to primary */}
            <div
                className="absolute inset-0"
                style={{
                    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 40%, #1e293b 60%, #2d1215 85%, #ed1c24 100%)",
                }}
            />
            {/* Subtle radial glow behind center car */}
            <div className="absolute inset-0 pointer-events-none" style={{
                background: "radial-gradient(ellipse 50% 80% at 50% 70%, rgba(237,28,36,0.12) 0%, transparent 70%)",
            }} />

            <div className="relative z-10 pt-16 pb-0">
                <div className="container mx-auto px-5">
                    {/* Heading */}
                    <motion.h2
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                        className="text-4xl md:text-5xl lg:text-6xl font-bold font-heading text-white text-center mb-4 drop-shadow-lg"
                    >
                        Discover your perfect car
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.15 }}
                        className="text-gray-300 text-center text-lg md:text-xl max-w-2xl mx-auto mb-12"
                    >
                        Explore thousands of verified vehicles from trusted sellers
                    </motion.p>

                    {/* CTA */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.25 }}
                        className="flex justify-center mb-12"
                    >
                        <Link href="/search">
                            <Button size="lg" shape="pill" className="px-10 py-6 text-lg shadow-neon hover:scale-105 transition-transform">
                                Browse All Cars <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                    </motion.div>
                </div>

                {/* Three Cars — Hero Image — FULL WIDTH edge-to-edge */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="relative w-full"
                >
                    <div 
                        className="relative w-full overflow-hidden aspect-[5/2] md:aspect-[1360/389]"
                        style={{ 
                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%)',
                            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%)'
                        }}
                    >
                        <Image
                            src="/assets/images/discover-hero.png"
                            alt="Discover your perfect car — Blue pickup, Red SUV, White sedan"
                            fill
                            sizes="100vw"
                            className="object-cover object-center"
                            priority
                        />
                    </div>
                </motion.div>
            </div>

            {/* Bottom transition overlay — merges the section gradient into the page background */}
            <div className="absolute bottom-0 left-0 right-0 h-16 md:h-48 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent z-20 pointer-events-none" />
        </section>
    )
}
