"use client"

import { motion } from "framer-motion"
import { Star, CheckCircle, Quote } from "lucide-react"
import Image from "next/image"

interface TestimonialProps {
    name: string
    role: string
    content: string
    rating?: number
    image?: string
    verified?: boolean
    delay?: number
}

export function TestimonialCard({
    name,
    role,
    content,
    rating = 5,
    image = "/assets/images/avatar-placeholder.png",
    verified = true,
    delay = 0
}: TestimonialProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.5 }}
            className="glass-card p-8 h-full min-h-[300px] flex flex-col relative group"
        >
            {/* Background Gradient Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full group-hover:bg-primary/10 transition-colors duration-500" />

            {/* Quote Icon */}
            <Quote className="absolute top-6 right-6 h-10 w-10 rotate-180 opacity-10 group-hover:text-primary group-hover:opacity-20 transition-colors duration-300" />

            {/* Rating */}
            <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                    <Star
                        key={i}
                        size={16}
                        className={i < rating ? "fill-primary text-primary transition-all duration-300 group-hover:scale-110" : "transition-all duration-300 group-hover:scale-110"}
                        style={{ transitionDelay: `${i * 50}ms`, ...(i >= rating ? { color: 'var(--text-faint)' } : {}) }}
                    />
                ))}
            </div>

            {/* Content */}
            <p className="text-lg leading-relaxed mb-8 italic flex-grow" style={{ color: 'var(--text-secondary)' }}>
                "{content}"
            </p>

            {/* User Info */}
            <div className="flex items-center gap-4 mt-auto border-t pt-6" style={{ borderColor: 'var(--border-default)' }}>
                <div className="relative w-12 h-12 rounded-full overflow-hidden border group-hover:border-primary/50 transition-colors" style={{ borderColor: 'var(--border-default)' }}>
                    <Image
                        src={image}
                        alt={name}
                        fill
                        sizes="48px"
                        className="object-cover"
                    />
                </div>
                <div>
                    <h4 className="font-bold flex items-center gap-2">
                        {name}
                        {verified && (
                            <CheckCircle className="text-emerald-400 h-4 w-4" aria-label="Verified Buyer" />
                        )}
                    </h4>
                    <p className="text-xs text-primary font-medium tracking-wide uppercase">{role}</p>
                </div>
            </div>
        </motion.div>
    )
}
