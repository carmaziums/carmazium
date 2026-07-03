"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { Star, ShieldCheck, UserCheck, Quote } from "lucide-react"

export default function ReviewsPage() {
    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5">

                {/* Header */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">Trust & Experiences</h1>
                    <p className="text-xl text-[var(--text-secondary)]">Join thousands of satisfied customers who have found their dream cars through CarMazium's secure and transparent platform.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <ShieldCheck size={32} />
                        </div>
                        <h3 className="text-4xl font-bold mb-2">100%</h3>
                        <p className="text-[var(--text-muted)]">Verified Sellers</p>
                    </div>
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <UserCheck size={32} />
                        </div>
                        <h3 className="text-4xl font-bold mb-2">50k+</h3>
                        <p className="text-[var(--text-muted)]">Happy Customers</p>
                    </div>
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                            <Star size={32} />
                        </div>
                        <h3 className="text-4xl font-bold mb-2">4.9/5</h3>
                        <p className="text-[var(--text-muted)]">Average Rating</p>
                    </div>
                </div>

                {/* Reviews Grid */}
                <h2 className="text-3xl font-heading font-bold mb-8 text-center">Recent Reviews</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="glass-card p-8 relative">
                            <Quote className="absolute top-6 right-6 opacity-5" size={48} />
                            <div className="flex gap-1 text-yellow-400 mb-4">
                                {[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} fill="currentColor" />)}
                            </div>
                            <p className="text-[var(--text-secondary)] mb-6 relative z-10">"Absolutely fantastic service. The car was exactly as described and the handover was smooth. Highly recommend CarMazium for luxury purchases."</p>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full" style={{ background: 'var(--bg-input)' }}></div>
                                <div>
                                    <h4 className="font-bold text-sm">James Wilson</h4>
                                    <p className="text-xs text-[var(--text-muted)]">Bought a Porsche 911</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}
