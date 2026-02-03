"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default function ServiceProviderSettingsPage() {
    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">Service Provider Settings</h1>

                    <div className="glass-card p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-1/3">
                                <div className="w-24 h-24 rounded-full bg-slate-800 mx-auto md:mx-0 flex items-center justify-center text-3xl font-bold text-primary mb-4 border-2 border-dashed border-primary/50 relative overflow-hidden group cursor-pointer hover:border-primary transition-colors shadow-neon">
                                    SP
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">Logo</div>
                                </div>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Business Information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-sm text-gray-400">Business Name</label>
                                            <input type="text" defaultValue="Apex Customs" className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Contact Email</label>
                                            <input type="email" defaultValue="contact@apexcustoms.com" className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm text-gray-400">Phone</label>
                                            <input type="text" defaultValue="+1 234 567 890" className="w-full bg-slate-800 border border-white/10 rounded px-4 py-2 text-white focus:border-primary outline-none transition-colors" />
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xl font-bold text-white mb-4 border-b border-white/10 pb-2">Service Preferences</h3>
                                    <div className="space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800" />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Accept new job requests</span>
                                        </label>
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary bg-slate-800" />
                                            <span className="text-gray-300 group-hover:text-white transition-colors">Display business in public directory</span>
                                        </label>
                                    </div>
                                </section>

                                <div className="pt-4">
                                    <button className="bg-primary text-white font-bold py-3 px-8 rounded shadow-neon hover:bg-red-600 transition-colors">Save Business Details</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
