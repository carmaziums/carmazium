"use client"

import Link from "next/link"
import { ArrowRight, Briefcase, PlusCircle } from "lucide-react"
import { GiTowTruck, GiMagnifyingGlass, GiRibbonMedal, GiMoneyStack, GiSpanner, GiUmbrella } from "react-icons/gi"
import { deliveryServiceEnabled } from "@/lib/featureFlags"

export default function ServicesPage() {
    const services = [
        {
            title: "Vehicle Delivery",
            icon: GiTowTruck,
            desc: "Professional vehicle delivery services ensure your car is transported safely.",
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            link: deliveryServiceEnabled ? "/services/delivery" : undefined,
            cta: deliveryServiceEnabled ? "Explore Delivery" : "Coming soon"
        },
        {
            title: "Car Inspection",
            icon: GiMagnifyingGlass,
            desc: "Access certified inspectors who conduct detailed vehicle evaluations.",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10"
        },
        {
            title: "Warranty Coverage",
            icon: GiRibbonMedal,
            desc: "Extended warranty services provide protection against unexpected failures.",
            color: "text-purple-400",
            bg: "bg-purple-500/10"
        },
        {
            title: "Vehicle Financing",
            icon: GiMoneyStack,
            desc: "Connect with financing providers offering structured solutions.",
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            link: "/finance",
            cta: "Explore Hub"
        },
        {
            title: "Maintenance",
            icon: GiSpanner,
            desc: "Routine and specialized vehicle maintenance services.",
            color: "text-primary",
            bg: "bg-primary/10"
        },
        {
            title: "Insurance",
            icon: GiUmbrella,
            desc: "Comprehensive vehicle insurance services offer coverage options.",
            color: "text-cyan-400",
            bg: "bg-cyan-500/10"
        }
    ]

    return (
        <div className="min-h-screen pt-24 pb-20">
            {/* Hero Section */}
            <div className="container mx-auto px-5 mb-16 text-center">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Carmazium Service Hub</h1>
                <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10">
                    Find trusted professionals or find work. The all-in-one automotive marketplace.
                </p>

                {/* TradeXchange actions are exposed only when the existing feature flag is enabled. */}
                {deliveryServiceEnabled && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                        <Link
                            href="/services/delivery/new"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors"
                        >
                            <PlusCircle size={16} /> Post a delivery job
                        </Link>
                        <Link
                            href="/services/jobs"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors"
                        >
                            <Briefcase size={16} /> My service jobs
                        </Link>
                    </div>
                )}

                {/* Services directory. The old mock job board/form were removed so this page never shows fake jobs. */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 text-left">
                    {services.map((service, i) => (
                        <div key={i} className="glass-card p-8 group hover:bg-[var(--bg-card)] transition-colors duration-300 flex flex-col h-full relative overflow-hidden">
                            {service.link && (
                                <Link href={service.link} className="absolute inset-0 z-20" aria-label={`Go to ${service.title}`} />
                            )}

                            <div className={`w-14 h-14 ${service.bg} ${service.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                <service.icon size={28} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
                            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6 flex-grow">{service.desc}</p>

                            <div className="pt-6 border-t border-[var(--border-default)] mt-auto flex items-center text-primary font-bold text-sm group-hover:translate-x-2 transition-transform">
                                {service.cta ?? (service.link ? "Explore Hub" : "Find Providers")} <ArrowRight className="ml-2 w-4 h-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <section className="container mx-auto px-5">
                {/* Join as Pro CTA - Always visible footer for this section */}
                <div className="glass-strong p-12 rounded-3xl text-center relative overflow-hidden mt-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-6">Are you an Automotive Professional?</h2>
                        <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">Join CarMazium's network of verified providers. Connect with thousands of car owners, get paid securely, and grow your business.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/dashboard/service/capabilities"
                                className="inline-flex items-center justify-center h-14 px-8 clip-path-carmazium bg-gradient-to-r from-primary to-[#d9161d] text-white text-lg font-bold uppercase tracking-wider shadow-lg shadow-primary/25 hover:from-[#ff4d4d] hover:to-primary transition-all"
                            >
                                Join as a Provider
                            </Link>
                            {deliveryServiceEnabled && (
                                <Link
                                    href="/services/delivery"
                                    className="inline-flex items-center justify-center h-14 px-8 clip-path-carmazium border-2 border-primary text-primary text-lg font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
                                >
                                    How it Works
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
