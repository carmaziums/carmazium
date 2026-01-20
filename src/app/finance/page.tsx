"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { FinanceCalculator } from "@/components/features/FinanceCalculator"
import { ArrowRight, CheckCircle, Shield, Banknote, Building2, Landmark, PieChart } from "lucide-react"
import { motion } from "framer-motion"

export default function FinanceHubPage() {
    return (
        <div className="min-h-screen pt-24 pb-20 bg-slate-900">
            {/* Hero Section */}
            <div className="container mx-auto px-5 mb-20 text-center relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="text-primary font-bold tracking-wider uppercase mb-4 block">CarMazium Financial Services</span>
                    <h1 className="text-4xl md:text-6xl font-heading font-bold mb-6 text-white leading-tight">
                        Smart Financing for <br /> Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-500">Dream Car</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                        Competitive rates, transparent terms, and instant pre-approval from the UK's most trusted automotive lenders.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Button size="lg" className="shadow-neon px-8">Get Pre-Approved</Button>
                        <Button variant="outline" size="lg" className="border-white/10 text-white hover:bg-white/5">View Current Rates</Button>
                    </div>
                </motion.div>

                {/* Background visual */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
            </div>

            {/* Calculator Section */}
            <section className="container mx-auto px-5 mb-24">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold font-heading mb-6">Calculate Your Monthly Payments</h2>
                        <ul className="space-y-4 mb-8">
                            {[
                                "No impact on credit score to check eligibility",
                                "Flexible terms from 12 to 60 months",
                                "Low APR starting from 5.9% (Subject to status)",
                                "Zero deposit options available"
                            ].map((item, i) => (
                                <li key={i} className="flex items-center gap-3 text-gray-300">
                                    <CheckCircle className="text-emerald-400 shrink-0" size={20} />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <div className="glass-card p-6 border-l-4 border-l-primary">
                            <h3 className="font-bold text-lg mb-2">Representative Example</h3>
                            <p className="text-sm text-gray-400">
                                Borrowing £20,000 over 48 months with a representative APR of 5.9%, an annual interest rate of 5.9% (fixed) and a deposit of £2,000.
                                The amount payable would be £425.32 per month, with a total cost of credit of £2,415.36 and a total amount payable of £22,415.36.
                            </p>
                        </div>
                    </div>
                    <div>
                        {/* Reusing existing component, configured for a generic price */}
                        <FinanceCalculator vehiclePrice={35000} />
                    </div>
                </div>
            </section>

            {/* Partners Grid */}
            <section className="py-20 bg-slate-950/50 border-y border-white/5">
                <div className="container mx-auto px-5 text-center">
                    <h2 className="text-3xl font-bold font-heading mb-12">Our Trusted Lending Partners</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { name: "Global Bank", icon: Landmark },
                            { name: "Auto Finance Co", icon: Banknote },
                            { name: "Secure Trust", icon: Shield },
                            { name: "Future Capital", icon: Building2 },
                            { name: "Prime Lenders", icon: PieChart },
                            { name: "City Finance", icon: Building2 },
                            { name: "Tech Credit", icon: Banknote },
                            { name: "Alpha Bank", icon: Landmark },
                        ].map((partner, i) => (
                            <div key={i} className="glass-card p-6 flex flex-col items-center justify-center gap-4 h-32 hover:border-primary/30 transition-colors group cursor-pointer">
                                <partner.icon className="text-gray-500 group-hover:text-white transition-colors h-8 w-8" />
                                <span className="font-bold text-gray-400 group-hover:text-white transition-colors">{partner.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Application Form */}
            <section className="container mx-auto px-5 py-24">
                <div className="max-w-3xl mx-auto glass-strong rounded-3xl p-8 md:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />

                    <div className="relative z-10 text-center mb-10">
                        <h2 className="text-3xl font-bold font-heading mb-4">Start Your Application</h2>
                        <p className="text-gray-400">Complete this quick form to see your tailored rates. It takes less than 2 minutes.</p>
                    </div>

                    <form className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-300">Annual Income</label>
                                <div className="glass-card flex items-center px-4 h-12">
                                    <span className="text-gray-500 mr-2">£</span>
                                    <input type="number" placeholder="e.g. 45000" className="bg-transparent w-full focus:outline-none text-white placeholder:text-gray-600" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-300">Employment Status</label>
                                <div className="glass-card flex items-center px-4 h-12 relative">
                                    <select className="bg-transparent w-full focus:outline-none text-white appearance-none cursor-pointer [&>option]:bg-slate-900">
                                        <option>Full-time Employed</option>
                                        <option>Self-Employed</option>
                                        <option>Retired</option>
                                        <option>Student</option>
                                    </select>
                                    <ArrowRight className="absolute right-4 text-gray-500 rotate-90" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 mt-8 p-4 bg-white/5 rounded-xl border border-white/5">
                            <input type="checkbox" className="mt-1 w-4 h-4 rounded border-gray-600 bg-transparent text-primary focus:ring-primary" />
                            <p className="text-xs text-gray-400 leading-relaxed">
                                I agree to CarMazium conducting a soft credit check. This will not affect my credit score. I understand that a hard check will only be performed if I proceed with a full application.
                            </p>
                        </div>

                        <Button size="lg" className="w-full py-6 text-lg shadow-neon mt-4">Check Eligibility Now</Button>
                    </form>
                </div>
            </section>
        </div>
    )
}
