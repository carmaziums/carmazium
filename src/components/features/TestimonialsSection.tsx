"use client"

import { useRef, useEffect, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { TestimonialCard } from "@/components/ui/TestimonialCard"
import { ArrowLeft, ArrowRight, TrendingUp, Users, Clock, Award } from "lucide-react"
import { Button } from "@/components/ui/Button"

const TESTIMONIALS = [
    {
        name: "James Peterson",
        role: "Sold BMW M4",
        content: "I was skeptical about selling online, but CarMazium's auction system got me 15% more than the dealer trade-in offer. The process was completely transparent.",
        image: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
        verified: true
    },
    {
        name: "Elena Rodriguez",
        role: "Bought Porsche 911",
        content: "The verification report gave me total peace of mind. The car arrived exactly as described. Finally, a luxury marketplace that feels premium.",
        image: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
        verified: true
    },
    {
        name: "Michael Chang",
        role: "Collector",
        content: "I've used every platform out there. CarMazium's interface is miles ahead. The live auction room feels like a video game in the best way possible.",
        image: "https://i.pravatar.cc/150?u=a04258114e29026302d",
        verified: true
    },
    {
        name: "Sarah Connors",
        role: "Sold Range Rover",
        content: "Sold my car in 48 hours. The team handled all the paperwork. Exceptional service from start to finish.",
        image: "https://i.pravatar.cc/150?u=a042581f4e29026024d1",
        verified: true
    }
]

const STATS = [
    { label: "Client Satisfaction", value: "98%", icon: Users },
    { label: "Avg. Sale Time", value: "48h", icon: Clock },
    { label: "Successful Trades", value: "£200M+", icon: TrendingUp },
    { label: "Verified Dealers", value: "500+", icon: Award },
]

export function TestimonialsSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.scrollWidth - containerRef.current.offsetWidth)
        }
    }, [])

    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-slate-900/50 pointer-events-none" />
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

            <div className="container mx-auto px-5 relative z-10">
                <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-6">
                    <div>
                        <motion.h2
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="text-3xl md:text-5xl font-bold font-heading mb-4"
                        >
                            Trusted by <span className="text-primary">Thousands</span>
                        </motion.h2>
                        <p className="text-gray-400 max-w-xl text-lg">
                            Don't just take our word for it. Join the community of enthusiasts who are changing the way cars are bought and sold.
                        </p>
                    </div>

                    {/* Navigation Buttons (Visual only, drag is primary) */}
                    <div className="hidden md:flex gap-4">
                        <div className="flex gap-2">
                            <span className="text-xs text-gray-500 uppercase tracking-widest self-center mr-4">Drag to explore</span>
                        </div>
                    </div>
                </div>

                {/* Draggable Carousel */}
                <motion.div ref={containerRef} className="cursor-grab active:cursor-grabbing overflow-hidden">
                    <motion.div
                        drag="x"
                        dragConstraints={{ right: 0, left: -width }}
                        whileTap={{ cursor: "grabbing" }}
                        className="flex gap-8"
                    >
                        {TESTIMONIALS.map((testimonial, i) => (
                            <div key={i} className="min-w-[350px] md:min-w-[450px] h-full">
                                <TestimonialCard {...testimonial} delay={i * 0.1} />
                            </div>
                        ))}
                        {/* Call to Action Card in Carousel */}
                        <div className="min-w-[350px] md:min-w-[450px] h-full flex items-center justify-center p-8">
                            <div className="text-center">
                                <h3 className="text-2xl font-bold mb-4">Have a story to tell?</h3>
                                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">Share Your Experience</Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Data Visuals Strip */}
                <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-white/5 pt-12">
                    {STATS.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 + (i * 0.1) }}
                            className="flex flex-col items-center text-center group"
                        >
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-white/5 group-hover:border-primary/30">
                                <stat.icon className="text-gray-400 group-hover:text-primary transition-colors h-6 w-6" />
                            </div>
                            <div className="text-3xl font-bold font-mono text-white mb-1">{stat.value}</div>
                            <div className="text-sm text-gray-400 uppercase tracking-wider font-medium">{stat.label}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
