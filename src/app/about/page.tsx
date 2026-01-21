"use client"

import Image from "next/image"
import { Users, Globe, Award, TrendingUp, Handshake, Target, Rocket } from "lucide-react"
import { motion, useScroll, useTransform } from "framer-motion"
import { AnimatedCounter } from "@/components/ui/AnimatedCounter"
import { AccordionItem } from "@/components/ui/Accordion"
import { TestimonialsSection } from "@/components/features/TestimonialsSection"
import { Button } from "@/components/ui/Button"
import { useRef } from "react"
import Link from "next/link"

export default function AboutPage() {
    const targetRef = useRef(null)
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    })



    return (
        <div className="min-h-screen bg-slate-900 pb-20 overflow-x-hidden">

            {/* Cinematic Hero Section */}
            <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 w-full h-full">
                    {/* Reusing hero video or similar cinematic visual */}
                    <div className="absolute inset-0 bg-slate-900/40 z-10" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover blur-[2px] scale-105"
                    >
                        <source src="/assets/videos/about-cinematic.mov" type="video/quicktime" />
                        <source src="/assets/videos/about-cinematic.mov" type="video/mp4" /> {/* Fallback if it's actually MP4 container */}
                    </video>
                </div>

                <div className="container mx-auto px-5 relative z-20 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-bold font-heading mb-6 text-white drop-shadow-2xl">
                            Redefining <span className="text-primary italic">Excellence</span> <br /> in Automotive Trading
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
                            CarMazium bridges the gap between digital convenience and showroom luxury. We are not just a marketplace; we are the future of car buying.
                        </p>
                    </motion.div>
                </div>
            </section>



            {/* Our Story & Values */}
            <section className="py-24 container mx-auto px-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="relative">
                            <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
                            <h2 className="text-4xl font-bold font-heading mb-8 relative z-10">Driven by <span className="text-primary">Passion</span>, <br />Powered by Tech.</h2>
                        </div>
                        <p className="text-gray-400 text-lg leading-relaxed mb-6">
                            Founded in 2024, CarMazium emerged from a simple observation: the luxury car market was stuck in the past. High fees, opaque processes, and outdated interfaces were the norm. Use believed there was a better way.
                        </p>
                        <p className="text-gray-400 text-lg leading-relaxed mb-8">
                            We combined deep automotive expertise with cutting-edge web technology to create a platform that respects your time and intelligence. Real-time auctions, verified verification, and instant financing—all in one place.
                        </p>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="glass-card p-6 flex flex-col gap-4 group hover:border-primary/50 transition-colors">
                                <Target className="text-primary h-8 w-8 group-hover:scale-110 transition-transform" />
                                <div>
                                    <h4 className="font-bold text-white mb-1">Our Mission</h4>
                                    <p className="text-sm text-gray-400">To democratize access to premium vehicles through transparency.</p>
                                </div>
                            </div>
                            <div className="glass-card p-6 flex flex-col gap-4 group hover:border-primary/50 transition-colors">
                                <Rocket className="text-primary h-8 w-8 group-hover:scale-110 transition-transform" />
                                <div>
                                    <h4 className="font-bold text-white mb-1">Our Vision</h4>
                                    <p className="text-sm text-gray-400">A world where buying a dream car is as easy as ordering a pizza.</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="relative h-[600px] w-full rounded-3xl overflow-hidden glass-strong p-2 group" ref={targetRef}>
                        <div className="relative h-full w-full rounded-2xl overflow-hidden">
                            <Image
                                src="/assets/images/featured-sports.png"
                                alt="Our Story"
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-1000"
                            />
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 to-slate-900/80 pointer-events-none" />

                            {/* Live Stats Overlay */}
                            <div className="absolute bottom-10 left-10 right-10 grid grid-cols-2 gap-8 text-white">
                                <div>
                                    <div className="text-4xl font-bold font-mono text-primary"><AnimatedCounter value={50000} suffix="+" /></div>
                                    <div className="text-sm opacity-80 uppercase tracking-widest mt-1">Users</div>
                                </div>
                                <div>
                                    <div className="text-4xl font-bold font-mono text-primary"><AnimatedCounter value={200} prefix="£" suffix="M+" /></div>
                                    <div className="text-sm opacity-80 uppercase tracking-widest mt-1">Traded</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <TestimonialsSection />

            {/* Team Section */}
            <section className="py-24 bg-slate-900/50">
                <div className="container mx-auto px-5">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6">Meet The <span className="text-primary">Visionaries</span></h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg">The diverse team of petrolheads and engineers working behind the scenes.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { name: "Alex Morgan", role: "Chief Executive Officer", desc: "Former F1 strategist turned tech entrepreneur.", delay: 0 },
                            { name: "Sarah Jenkins", role: "Head of Operations", desc: "15 years experience in luxury logistics.", delay: 0.1 },
                            { name: "David Chen", role: "Lead Engineer", desc: "Building scalable systems for the future of trade.", delay: 0.2 },
                        ].map((member, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: member.delay }}
                                className="glass-card p-6 text-center group hover:-translate-y-2 transition-transform duration-300"
                            >
                                <div className="relative h-48 w-48 mx-auto bg-slate-800 rounded-full mb-6 overflow-hidden border-4 border-white/5 group-hover:border-primary/50 transition-colors">
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                                        <Users className="text-white/20 h-20 w-20 group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-primary transition-colors">{member.name}</h3>
                                <p className="text-primary/80 font-medium text-sm mb-4 uppercase tracking-wider">{member.role}</p>
                                <p className="text-gray-400">{member.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-24 container mx-auto px-5">
                <div className="max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6">Frequently Asked <span className="text-primary">Questions</span></h2>
                        <p className="text-gray-400 text-lg">Everything you need to know about the CarMazium experience.</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                    >
                        <AccordionItem title="How does CarMazium verify vehicles?" defaultOpen>
                            <p>Every vehicle listed on CarMazium undergoes a rigorous 150-point inspection by our certified mechanics. We check everything from engine performance and transmission health to paint depth and interior condition. A detailed report is available for every listing, ensuring complete transparency.</p>
                        </AccordionItem>
                        <AccordionItem title="How do the live auctions work?">
                            <p>Our live auctions are real-time, competitive bidding events. Once you register and get verified, you can join a live auction room, place bids, and watch the action unfold. Auctions typically last 15-30 minutes, and if you win, our team handles all the paperwork and logistics.</p>
                        </AccordionItem>
                        <AccordionItem title="Can I sell my car on CarMazium?">
                            <p>Absolutely. We offer a premium selling experience. You can submit your vehicle details, and if it meets our criteria, we'll arrange for an inspection and photography session. You can choose to list it for a fixed price or put it up for auction to maximize its value.</p>
                        </AccordionItem>
                        <AccordionItem title="What financing options are available?">
                            <p>We partner with leading financial institutions to offer competitive financing rates. You can apply directly through our platform, get pre-approved in minutes, and customize your payment plan. We also accept external financing if you have your own lender.</p>
                        </AccordionItem>
                        <AccordionItem title="Are there any hidden fees?">
                            <p>Transparency is one of our core values. We charge a flat buyer's fee displayed clearly on every listing. For sellers, we take a small commission only when the car helps sells. There are no hidden processing fees or surprise charges at checkout.</p>
                        </AccordionItem>
                    </motion.div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 container mx-auto px-5">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="glass-strong rounded-3xl p-16 text-center relative overflow-hidden group border border-white/10"
                >
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('/assets/images/hero-bg.png')] opacity-10 blur-sm bg-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-4xl font-bold text-white mb-8">Ready to start your journey?</h2>
                        <p className="text-gray-300 mb-10 text-lg">Join the fastest growing luxury automotive community today.</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-6">
                            <Link href="/search">
                                <Button size="lg" className="px-10 py-6 text-lg shadow-neon w-full sm:w-auto">Browse Inventory</Button>
                            </Link>
                            <Link href="/how-it-works">
                                <Button size="lg" variant="outline" className="px-10 py-6 text-lg border-white/20 text-white hover:bg-white/10 w-full sm:w-auto">How It Works</Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button size="lg" variant="ghost" className="px-10 py-6 text-lg text-white/70 hover:text-white hover:bg-white/5 w-full sm:w-auto">Create Account</Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </section>
        </div>
    )
}
