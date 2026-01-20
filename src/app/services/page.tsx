"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Search, PlusCircle, Briefcase, ArrowRight } from "lucide-react"
import { GiTowTruck, GiMagnifyingGlass, GiRibbonMedal, GiMoneyStack, GiSpanner, GiUmbrella } from "react-icons/gi"

export default function ServicesPage() {
    const [activeTab, setActiveTab] = React.useState<'services' | 'jobs' | 'post'>('services')

    const services = [
        {
            title: "Vehicle Delivery",
            icon: GiTowTruck,
            desc: "Professional vehicle delivery services ensure your car is transported safely.",
            color: "text-blue-400",
            bg: "bg-blue-500/10"
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
            link: "/finance" // Link to new Finance Hub
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
        <div className="min-h-screen pt-24 pb-20 bg-slate-900">
            {/* Hero Section */}
            <div className="container mx-auto px-5 mb-16 text-center">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 text-white">Carmazium Service Hub</h1>
                <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                    Find trusted professionals or find work. The all-in-one automotive marketplace.
                </p>

                {/* Toggle Buttons */}
                <div className="flex justify-center mb-10">
                    <div className="bg-slate-800 p-1 rounded-full inline-flex border border-white/10 shadow-lg">
                        <button
                            onClick={() => setActiveTab('services')}
                            className={`px-6 md:px-8 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'services' ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            SERVICES
                        </button>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-6 md:px-8 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'jobs' ? 'bg-primary text-white shadow-neon' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><Briefcase size={16} /> BROWSE JOBS</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('post')}
                            className={`px-6 md:px-8 py-3 rounded-full text-sm font-bold transition-all ${activeTab === 'post' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><PlusCircle size={16} /> POST A JOB</span>
                        </button>
                    </div>
                </div>

                {/* Dynamic Content based on Active Tab */}
                <div className="min-h-[400px]">

                    {/* 1. SERVICES DIRECTORY */}
                    {activeTab === 'services' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20 text-left">
                                {services.map((service, i) => (
                                    <div key={i} className="glass-card p-8 group hover:bg-white/5 transition-colors duration-300 flex flex-col h-full relative overflow-hidden">

                                        {/* Link overlay if exists */}
                                        {service.link && (
                                            <a href={service.link} className="absolute inset-0 z-20" aria-label={`Go to ${service.title}`} />
                                        )}

                                        <div className={`w-14 h-14 ${service.bg} ${service.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                            <service.icon size={28} />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-grow">{service.desc}</p>

                                        <div className="pt-6 border-t border-white/5 mt-auto flex items-center text-primary font-bold text-sm group-hover:translate-x-2 transition-transform">
                                            {service.link ? "Explore Hub" : "Find Providers"} <ArrowRight className="ml-2 w-4 h-4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 2. JOB BOARD */}
                    {activeTab === 'jobs' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold">Latest Opportunities</h2>
                                <div className="flex gap-2">
                                    <select className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none">
                                        <option>All Types</option>
                                        <option>Transport</option>
                                        <option>Inspection</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { title: "Vehicle Transport for BMW M4", loc: "London → Manchester", budget: "£350", time: "Urgent", type: "Transport" },
                                    { title: "Pre-Purchase Inspection: Audi RS6", loc: "Birmingham", budget: "£150", time: "2 days left", type: "Inspection" },
                                    { title: "Detailing & Ceramic Coating", loc: "Leeds", budget: "£600", time: "Flexible", type: "Detailing" },
                                    { title: "Mechanic Check: Engine Knock", loc: "Bristol", budget: "£80/hr", time: "ASAP", type: "Repair" },
                                ].map((job, i) => (
                                    <div key={i} className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-4 hover:border-primary/30 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-6 w-full md:w-auto">
                                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-gray-400 font-bold border border-white/5 group-hover:border-primary/50 transition-colors">
                                                {job.title.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-lg group-hover:text-primary transition-colors">{job.title}</h4>
                                                <div className="flex gap-4 text-sm text-gray-400 mt-1">
                                                    <span>📍 {job.loc}</span>
                                                    <span>⏱ {job.time}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                            <span className="font-bold text-emerald-400 text-xl">{job.budget}</span>
                                            <Button size="sm" className="px-6">Apply</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. POST A JOB */}
                    {activeTab === 'post' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto text-left">
                            <div className="glass-strong p-8 rounded-2xl border border-white/10">
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                    <PlusCircle className="text-emerald-500" /> Create a New Request
                                </h2>
                                <form className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300">Job Title</label>
                                        <Input placeholder="e.g. Transport needed for Mercedes C-Class" className="bg-slate-900 border-white/10" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-300">Service Type</label>
                                            <select className="w-full h-10 rounded-md bg-slate-900 border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white">
                                                <option>Transport</option>
                                                <option>Inspection</option>
                                                <option>Detailing</option>
                                                <option>Repair</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-300">Budget Estimate</label>
                                            <Input placeholder="e.g. £300" className="bg-slate-900 border-white/10" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-300">Description</label>
                                        <textarea
                                            className="w-full min-h-[120px] rounded-md bg-slate-900 border border-white/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white custom-scrollbar resize-none"
                                            placeholder="Describe the vehicle details, pick-up/drop-off locations, and any specific requirements..."
                                        />
                                    </div>

                                    <Button className="w-full py-6 text-lg bg-emerald-600 hover:bg-emerald-700">Post Job Now</Button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <section className="container mx-auto px-5">
                {/* Join as Pro CTA - Always visible footer for this section */}
                <div className="glass-strong p-12 rounded-3xl text-center relative overflow-hidden mt-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -z-0 translate-x-1/2 -translate-y-1/2" />
                    <div className="relative z-10">
                        <h2 className="text-3xl md:text-4xl font-bold font-heading text-white mb-6">Are you an Automotive Professional?</h2>
                        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">Join CarMazium's network of verified providers. Connect with thousands of car owners, get paid securely, and grow your business.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" className="shadow-neon px-8">Join as a Provider</Button>
                            <Button variant="outline" size="lg" className="px-8 border-white text-white hover:bg-white/10">How it Works</Button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
