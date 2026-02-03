"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"

export default function ServiceJobsPage() {
    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" />
                <main className="flex-1 space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold font-heading text-white">Active Jobs</h1>
                        <div className="flex gap-2">
                            <button className="bg-slate-800 text-white px-4 py-2 rounded border border-white/10 hover:border-primary/50 text-sm font-bold transition-colors">List View</button>
                            <button className="bg-transparent text-gray-400 px-4 py-2 rounded hover:text-white text-sm font-bold transition-colors">Kanban</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[
                            { client: "Michael Knight", car: "Pontiac Firebird Trans Am", service: "Full Restoration", status: "In Progress", date: "Due: Feb 20", step: 3, totalSteps: 5 },
                            { client: "Bruce Wayne", car: "Lamborghini Murciélago", service: "Performance Tuning", status: "Parts Ordered", date: "Due: Jan 30", step: 1, totalSteps: 4 },
                            { client: "Tony Stark", car: "Audi R8 e-tron", service: "Battery Cell Replacement", status: "Diagnostic", date: "Due: Tomorrow", step: 0, totalSteps: 4 },
                        ].map((job, i) => (
                            <div key={i} className="glass-card p-6 flex flex-col md:flex-row gap-6 items-center">
                                <div className="md:w-1/4">
                                    <h3 className="font-bold text-lg text-white">{job.client}</h3>
                                    <p className="text-sm text-gray-400">{job.car}</p>
                                </div>
                                <div className="md:w-1/4">
                                    <div className="inline-block px-2 py-1 rounded bg-slate-800 text-xs text-gray-300 border border-white/5 mb-1">{job.service}</div>
                                    <div className="font-bold text-emerald-400 text-sm">{job.status}</div>
                                </div>
                                <div className="flex-1 w-full">
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Progress</span>
                                        <span>{Math.round((job.step / job.totalSteps) * 100)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${(job.step / job.totalSteps) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="md:w-auto text-right">
                                    <p className="text-xs text-gray-400 mb-2">{job.date}</p>
                                    <button className="px-4 py-2 bg-slate-800 hover:bg-white/10 text-white text-sm font-bold rounded border border-white/10 transition-colors">Manage</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    )
}
