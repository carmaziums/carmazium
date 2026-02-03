"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default function OrderHistoryPage() {
    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Order History</h1>

                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Order ID</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Invoice</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    <tr className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-gray-400">#ORD-2849</td>
                                        <td className="px-6 py-4 font-bold">2022 Audi RS6 Avant</td>
                                        <td className="px-6 py-4 text-sm text-gray-300">Jan 20, 2026</td>
                                        <td className="px-6 py-4 font-bold">£89,000</td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Completed</span></td>
                                        <td className="px-6 py-4"><button className="text-primary hover:text-white text-xs underline">Download</button></td>
                                    </tr>
                                    <tr className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-gray-400">#DEP-1029</td>
                                        <td className="px-6 py-4 font-bold">Auction Deposit</td>
                                        <td className="px-6 py-4 text-sm text-gray-300">Jan 15, 2026</td>
                                        <td className="px-6 py-4 font-bold">£500</td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-700/50 text-gray-300 border border-slate-600">Refundable</span></td>
                                        <td className="px-6 py-4"><button className="text-primary hover:text-white text-xs underline">Download</button></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
