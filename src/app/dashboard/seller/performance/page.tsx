"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { AnimatedCounter } from "@/components/ui/AnimatedCounter"
import { TrendingUp, Users, Eye, MousePointerClick, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { motion } from "framer-motion"

export default function PerformancePage() {
    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="seller" />

                <main className="flex-1 space-y-8">
                    <div className="mb-2">
                        <h1 className="text-3xl font-bold font-heading text-white">Performance Analytics</h1>
                        <p className="text-gray-400">Track your verified listing performance and reach.</p>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: "Total Revenue", value: "£1,240k", change: "+12%", icon: DollarSign, trend: "up" },
                            { label: "Profile Views", value: "85.2k", change: "+5.4%", icon: Eye, trend: "up" },
                            { label: "Listing Clicks", value: "12.8k", change: "-2.1%", icon: MousePointerClick, trend: "down" },
                            { label: "Conversion Rate", value: "3.2%", change: "+0.8%", icon: TrendingUp, trend: "up" },
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-2 bg-slate-800 rounded-lg text-gray-400"><stat.icon size={18} /></div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${stat.trend === "up" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                                        {stat.trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {stat.change}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Chart Area (Mock Visual) */}
                    <div className="glass-card p-6">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-white">Engagement Overview</h3>
                                <p className="text-sm text-gray-400">Daily views vs. Unique visitors</p>
                            </div>
                            <div className="flex gap-2">
                                <select className="bg-slate-800 border border-white/10 text-white text-sm rounded-lg px-3 py-1 outline-none">
                                    <option>Last 7 Days</option>
                                    <option>Last 30 Days</option>
                                    <option>This Year</option>
                                </select>
                            </div>
                        </div>

                        {/* CSS-only Bar Chart Concept */}
                        <div className="h-[300px] flex items-end gap-2 md:gap-4 px-2">
                            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className="flex-1 bg-slate-800/50 rounded-t-lg relative group overflow-hidden"
                                >
                                    <div className="absolute bottom-0 w-full bg-gradient-to-t from-primary/80 to-primary/20 h-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                    {/* Tooltip */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 pointer-events-none">
                                        {h * 10} Views
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-4 text-xs text-gray-500 uppercase tracking-widest px-2">
                            <span>Jan 01</span>
                            <span>Jan 07</span>
                            <span>Jan 14</span>
                            <span>Today</span>
                        </div>
                    </div>

                    {/* Recent Inquiries */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                            <h3 className="text-xl font-bold text-white">Recent Inquiries</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer">
                                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-gray-400">
                                        <Users size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <h4 className="font-bold text-white text-sm">Potential Buyer #{i + 88}</h4>
                                            <span className="text-xs text-gray-500">2h ago</span>
                                        </div>
                                        <p className="text-xs text-gray-400">Inquired about 2023 Mercedes-Benz G63...</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
