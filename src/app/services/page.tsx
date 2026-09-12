"use client"

import Link from "next/link"
import { ArrowRight, Briefcase } from "lucide-react"
import { GiTowTruck, GiMagnifyingGlass, GiRibbonMedal, GiMoneyStack } from "react-icons/gi"
import {
    deliveryServiceEnabled,
    inspectionServiceEnabled,
    financeServiceEnabled,
    warrantyServiceEnabled,
} from "@/lib/featureFlags"

export default function ServicesPage() {
    const services = [
        {
            title: "Delivery & Recovery",
            icon: GiTowTruck,
            desc: "Post a single-car, multi-car or recovery job and let approved transport businesses compete with fixed-price quotes.",
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            link: deliveryServiceEnabled ? "/services/delivery" : undefined,
            cta: deliveryServiceEnabled ? "Arrange transport" : "Coming soon",
            badge: "Competitive quotes",
        },
        {
            title: "Vehicle Inspections",
            icon: GiMagnifyingGlass,
            desc: "Request an independent vehicle inspection and receive quotes from approved inspection providers before you commit to a car.",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            link: inspectionServiceEnabled ? "/services/inspection" : undefined,
            cta: inspectionServiceEnabled ? "Book an inspection" : "Coming soon",
            badge: "Competitive quotes",
        },
        {
            title: "Vehicle Finance",
            icon: GiMoneyStack,
            desc: "Send one finance enquiry to approved matching providers. Providers respond with their own terms; CarMazium does not lend or guarantee approval.",
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            link: financeServiceEnabled ? "/services/finance" : undefined,
            cta: financeServiceEnabled ? "Request finance options" : "Coming soon",
            badge: "Provider enquiries",
        },
        {
            title: "Warranty Providers",
            icon: GiRibbonMedal,
            desc: "Tell us about the vehicle and cover you want. Approved warranty providers can respond with suitable products and indicative prices.",
            color: "text-purple-400",
            bg: "bg-purple-500/10",
            link: warrantyServiceEnabled ? "/services/warranty" : undefined,
            cta: warrantyServiceEnabled ? "Request warranty options" : "Coming soon",
            badge: "Provider enquiries",
        },
    ]

    return (
        <div className="min-h-screen pt-24 pb-20">
            <div className="container mx-auto px-5 mb-16 text-center">
                <p className="text-primary text-xs font-black uppercase tracking-[0.22em] mb-3">TradeXchange Services</p>
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Everything around the vehicle, in one place</h1>
                <p className="text-lg text-[var(--text-secondary)] max-w-3xl mx-auto mb-10">
                    Transport and inspections use competitive provider quotes with protected payment through CarMazium.
                    Finance and warranty use matched enquiries to approved providers, with no CarMazium service-job fee or payout.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
                    {(deliveryServiceEnabled || inspectionServiceEnabled) && (
                        <Link
                            href="/services/jobs"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors"
                        >
                            <Briefcase size={16} /> My transport & inspection jobs
                        </Link>
                    )}
                    {(financeServiceEnabled || warrantyServiceEnabled) && (
                        <Link
                            href="/services/leads"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold hover:border-primary/40 transition-colors"
                        >
                            <Briefcase size={16} /> My finance & warranty enquiries
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20 text-left max-w-5xl mx-auto">
                    {services.map((service) => (
                        <div key={service.title} className="glass-card p-8 group hover:bg-[var(--bg-card)] transition-colors duration-300 flex flex-col h-full relative overflow-hidden">
                            {service.link && <Link href={service.link} className="absolute inset-0 z-20" aria-label={`Go to ${service.title}`} />}
                            <div className="flex items-start justify-between gap-3 mb-6">
                                <div className={`w-14 h-14 ${service.bg} ${service.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                    <service.icon size={28} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest rounded-full border border-[var(--border-default)] px-3 py-1 text-[var(--text-muted)]">
                                    {service.badge}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
                            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-6 flex-grow">{service.desc}</p>
                            <div className="pt-6 border-t border-[var(--border-default)] mt-auto flex items-center text-primary font-bold text-sm group-hover:translate-x-2 transition-transform">
                                {service.cta} <ArrowRight className="ml-2 w-4 h-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <section className="container mx-auto px-5">
                <div className="glass-strong p-10 md:p-12 rounded-3xl text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-5">Run an automotive service business?</h2>
                        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
                            Apply for the service areas you provide. CarMazium approves each capability separately so customers only meet providers cleared for that work.
                        </p>
                        <Link
                            href="/dashboard/service/capabilities"
                            className="inline-flex items-center justify-center h-14 px-8 clip-path-carmazium bg-gradient-to-r from-primary to-[#d9161d] text-white text-lg font-bold uppercase tracking-wider shadow-lg shadow-primary/25 hover:from-[#ff4d4d] hover:to-primary transition-all"
                        >
                            Join as a Provider
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}
