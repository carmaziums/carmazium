"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default function EarningsPage() {
    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="seller" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Earnings</h1>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="glass-card p-6">
                            <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Available for Payout</p>
                            <h3 className="text-4xl font-bold text-emerald-400 font-heading">£12,450.00</h3>
                            <button className="mt-4 w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-bold text-sm hover:bg-emerald-500 hover:text-white transition-all">Request Payout</button>
                        </div>
                        <div className="glass-card p-6">
                            <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Pending Clearance</p>
                            <h3 className="text-4xl font-bold text-white font-heading">£2,300.00</h3>
                        </div>
                        <div className="glass-card p-6">
                            <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Total Earnings (YTD)</p>
                            <h3 className="text-4xl font-bold text-white font-heading">£98,750.00</h3>
                        </div>
                    </div>

                    <div className="glass-card overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <h3 className="font-bold text-lg text-white">Recent Transactions</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Description</th>
                                        <th className="px-6 py-4">Reference</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {[
                                        { date: "Jan 18, 2026", desc: "Sale: 2019 Porsche 911 Carrera 4S", ref: "TX-92837", amount: "+£98,500.00", status: "Cleared" },
                                        { date: "Jan 18, 2026", desc: "Platform Fee (4.5%)", ref: "FE-2938", amount: "-£4,432.50", status: "Cleared" },
                                        { date: "Jan 15, 2026", desc: "Listing Enhancement Pack", ref: "AD-1029", amount: "-£150.00", status: "Cleared" },
                                    ].map((tx, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-300">{tx.date}</td>
                                            <td className="px-6 py-4 font-bold">{tx.desc}</td>
                                            <td className="px-6 py-4 text-xs font-mono text-gray-400">{tx.ref}</td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${tx.amount.startsWith("+") ? "text-emerald-400" : "text-white"}`}>{tx.amount}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{tx.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
