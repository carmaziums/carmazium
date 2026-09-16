"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Gavel, Handshake, MapPin, Phone, ShieldCheck, Sparkles, Users } from "lucide-react"
import { AccordionItem } from "@/components/ui/Accordion"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"

const PRINCIPLES = [
    { icon: Handshake, title: "Marketplace, not vehicle seller", text: "CarMazium provides the platform, tools and introductions. Vehicle purchase funds are agreed and paid directly between buyer and seller." },
    { icon: Gavel, title: "More than one selling route", text: "Sellers can choose a free dealer auction or advertise directly to retail buyers instead of being forced into one route to market." },
    { icon: ShieldCheck, title: "Clearer decisions", text: "Listings, verification tools, comparison features and inspection options are designed to help users complete their own checks before purchase or handover." },
    { icon: Users, title: "One automotive network", text: "Partner Accounts bring vehicle dealers and approved service providers into the same ecosystem while keeping each capability and workflow distinct." },
]

export default function AboutPage() {
    const { user } = useAuth()
    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            <section className="relative min-h-[68vh] flex items-center justify-center overflow-hidden select-none" style={{ marginTop: "-80px", paddingTop: "80px" }}>
                <div className="absolute inset-0">
                    <video autoPlay muted loop playsInline preload="none" poster="/assets/videos/about-cinematic-poster.jpg" className="absolute inset-0 h-full w-full object-cover">
                        <source src="/assets/videos/about-cinematic.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/55 to-slate-950/30" />
                </div>
                <div className="container mx-auto px-6 relative z-10 text-center text-white">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-4xl">
                        <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-red-300">About CarMazium</p>
                        <h1 className="text-4xl md:text-6xl font-black font-heading tracking-tight mb-6">A clearer way to buy, sell and support vehicle transactions</h1>
                        <p className="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto leading-relaxed">CarMazium is a UK automotive marketplace combining retail listings, dealer auctions and TradeXchange services in one connected platform.</p>
                    </motion.div>
                </div>
            </section>

            <section className="py-20 md:py-24 container mx-auto px-6">
                <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                    <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">The marketplace model</p>
                        <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight mb-6">Choice for sellers. Information for buyers. Opportunities for partners.</h2>
                        <div className="space-y-5 text-base md:text-lg leading-relaxed text-[var(--text-muted)]">
                            <p>Private sellers can choose between a free dealer auction and a retail listing. Verified traders can bid in auctions, while retail buyers can browse public listings and deal directly with sellers.</p>
                            <p>TradeXchange extends that journey with vehicle delivery and recovery, independent inspections, finance enquiries and warranty enquiries. Each service keeps its own workflow so customers can see what they are using before they commit.</p>
                            <p>CarMazium does not hold vehicle sale funds. Buyers and sellers remain responsible for agreeing the vehicle transaction, completing appropriate checks and arranging payment and handover directly.</p>
                        </div>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button asChild size="lg"><Link href="/how-it-works">How it works <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                            <Button asChild variant="outline" size="lg"><Link href="/auctions">Explore TradeXchange</Link></Button>
                        </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative h-[480px] overflow-hidden rounded-3xl border border-[var(--border-default)] shadow-2xl">
                        <Image src="/assets/images/featured-sports.png" alt="CarMazium automotive marketplace" fill className="object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-bold backdrop-blur"><Sparkles size={13} /> Built around the vehicle journey</div>
                            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-200">From listing and bidding to inspection, collection, finance and warranty enquiries, the platform keeps the next action visible and understandable.</p>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="border-y border-[var(--border-default)] py-20 md:py-24" style={{ background: "var(--bg-card)" }}>
                <div className="container mx-auto px-6">
                    <div className="mx-auto mb-12 max-w-3xl text-center">
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">What guides the product</p>
                        <h2 className="text-3xl md:text-5xl font-black font-heading tracking-tight">Straightforward by design</h2>
                    </div>
                    <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {PRINCIPLES.map((item, index) => (
                            <motion.article key={item.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="h-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-6">
                                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10"><item.icon size={22} className="text-primary" /></div>
                                <h3 className="mb-2 text-lg font-bold font-heading">{item.title}</h3>
                                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{item.text}</p>
                            </motion.article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-20 container mx-auto px-6">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-10 text-center"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">Contact CarMazium</p><h2 className="text-3xl md:text-4xl font-black font-heading">Get in touch</h2></div>
                    <div className="grid gap-5 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><MapPin className="text-primary" size={21} /></div><h3 className="mb-2 text-lg font-bold">Birmingham office</h3><p className="text-[var(--text-muted)] leading-relaxed">181-187 Hunters Rd<br />Lozells, Birmingham<br />B19 1ES, United Kingdom</p></div>
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-7"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Phone className="text-primary" size={21} /></div><h3 className="mb-2 text-lg font-bold">Speak to us</h3><p className="text-[var(--text-muted)]"><a href="tel:+441218385040" className="font-bold text-primary hover:underline">0121 838 5040</a><br />Monday – Friday, 9am – 6pm GMT</p></div>
                    </div>
                </div>
            </section>

            <section className="py-20 border-y border-[var(--border-default)]" style={{ background: "var(--bg-card)" }}>
                <div className="container mx-auto px-6"><div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10"><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary">Questions</p><h2 className="text-3xl md:text-4xl font-black font-heading">Frequently asked questions</h2></div>
                    <AccordionItem title="Is CarMazium involved in the sale of vehicles?" defaultOpen><p>CarMazium is a marketplace platform. Vehicle purchases, sale-price payments and handover arrangements are made directly between buyer and seller.</p></AccordionItem>
                    <AccordionItem title="How do dealer auctions work?"><p>Private sellers can list a vehicle for auction free of charge. Verified motor traders can bid, and the successful dealer pays the applicable platform fee before the parties arrange inspection, payment and handover.</p></AccordionItem>
                    <AccordionItem title="What is TradeXchange?"><p>TradeXchange brings together vehicle auctions, delivery and recovery, inspection, finance enquiries and warranty enquiries. Delivery and Inspection are paid service-job workflows; Finance and Warranty use matched enquiries.</p></AccordionItem>
                    <AccordionItem title="What checks should buyers complete?"><p>Review the listing information and available vehicle data, arrange an independent inspection where appropriate, and complete your normal ownership, history, condition and payment checks before purchase.</p></AccordionItem>
                </div></div>
            </section>

            {!user && <section className="py-20 container mx-auto px-6"><div className="mx-auto max-w-4xl rounded-3xl border border-primary/25 bg-primary/5 p-9 text-center md:p-12"><h2 className="mb-3 text-3xl font-black font-heading">Ready to use CarMazium?</h2><p className="mx-auto mb-7 max-w-2xl text-[var(--text-muted)]">Create an account to list a vehicle, manage enquiries or build a Partner Account for automotive business services.</p><Button asChild size="lg"><Link href="/auth/signup">Create an account <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></section>}
        </div>
    )
}
