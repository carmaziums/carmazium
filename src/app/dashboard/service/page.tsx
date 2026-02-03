"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { CheckCircle, XCircle, Clock, Loader2, Wrench, DollarSign, Briefcase } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getContractorStats, getContractorJobs, updateJobStatus, formatPrice, type ContractorStats, type ServiceRequest } from "@/lib/listingApi"

export default function ServiceDashboard() {
    const { user, profile, loading: authLoading } = useAuth()
    const [stats, setStats] = React.useState<ContractorStats | null>(null)
    const [jobs, setJobs] = React.useState<ServiceRequest[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updating, setUpdating] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchData() {
            if (!user) return
            try {
                setLoading(true)
                const [statsData, jobsData] = await Promise.all([
                    getContractorStats().catch(() => null),
                    getContractorJobs(1, 5).catch(() => ({ data: [] })),
                ])
                setStats(statsData)
                setJobs(jobsData.data || [])
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err)
            } finally {
                setLoading(false)
            }
        }

        if (!authLoading && user) {
            fetchData()
        }
    }, [user, authLoading])

    const handleStatusUpdate = async (requestId: string, status: string) => {
        try {
            setUpdating(requestId)
            const updated = await updateJobStatus(requestId, status)
            setJobs(prev => prev.map(j => j.id === requestId ? updated : j))
            // Refresh stats
            const newStats = await getContractorStats().catch(() => null)
            if (newStats) setStats(newStats)
        } catch (err) {
            console.error('Failed to update status:', err)
        } finally {
            setUpdating(null)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="provider" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Service Provider"} />

                <main className="flex-1 space-y-8">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-500/20 rounded-lg"><Clock size={18} className="text-yellow-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Pending</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.pendingJobs || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-500/20 rounded-lg"><Wrench size={18} className="text-blue-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Active Jobs</p>
                            <h3 className="text-3xl font-black font-heading text-white">
                                {loading ? "..." : stats?.activeJobs || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-500/20 rounded-lg"><CheckCircle size={18} className="text-emerald-400" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Completed</p>
                            <h3 className="text-3xl font-black font-heading text-emerald-400">
                                {loading ? "..." : stats?.completedJobs || 0}
                            </h3>
                        </div>
                        <div className="glass-card p-6 group hover:translate-y-[-2px] transition-transform">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-primary/20 rounded-lg"><DollarSign size={18} className="text-primary" /></div>
                            </div>
                            <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest font-bold">Earnings</p>
                            <h3 className="text-2xl font-black font-heading text-primary">
                                {loading ? "..." : formatPrice(stats?.totalEarnings || 0)}
                            </h3>
                        </div>
                    </div>

                    {/* Recent Requests Table */}
                    <div className="glass-card overflow-hidden">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
                                <Briefcase className="text-primary" /> Service Requests
                            </h2>
                            <Link href="/dashboard/service/jobs" className="text-primary hover:text-white text-sm font-bold transition-colors">View All</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-800/50 text-gray-400 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-4">Client</th>
                                        <th className="px-6 py-4">Service Type</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                                            </td>
                                        </tr>
                                    ) : jobs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                No service requests yet. Complete your contractor profile to receive jobs.
                                            </td>
                                        </tr>
                                    ) : (
                                        jobs.map((job) => (
                                            <tr key={job.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold">{job.requester.firstName} {job.requester.lastName}</div>
                                                    <div className="text-xs text-gray-400">{job.requester.email}</div>
                                                </td>
                                                <td className="px-6 py-4">{job.serviceType}</td>
                                                <td className="px-6 py-4 text-sm text-gray-300">
                                                    {new Date(job.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${job.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                            job.status === 'ACCEPTED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                                job.status === 'IN_PROGRESS' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                                    job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                                        }`}>
                                                        {job.status === 'PENDING' && <Clock size={10} />}
                                                        {job.status === 'COMPLETED' && <CheckCircle size={10} />}
                                                        {job.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 flex gap-2">
                                                    {updating === job.id ? (
                                                        <Loader2 size={16} className="animate-spin text-primary" />
                                                    ) : job.status === 'PENDING' ? (
                                                        <>
                                                            <Button
                                                                size="icon"
                                                                className="h-8 w-8 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                                                                onClick={() => handleStatusUpdate(job.id, 'ACCEPTED')}
                                                            >
                                                                <CheckCircle size={16} />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                className="h-8 w-8 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                                                                onClick={() => handleStatusUpdate(job.id, 'CANCELLED')}
                                                            >
                                                                <XCircle size={16} />
                                                            </Button>
                                                        </>
                                                    ) : job.status === 'ACCEPTED' ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleStatusUpdate(job.id, 'IN_PROGRESS')}
                                                        >
                                                            Start Work
                                                        </Button>
                                                    ) : job.status === 'IN_PROGRESS' ? (
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-500 hover:bg-emerald-600"
                                                            onClick={() => handleStatusUpdate(job.id, 'COMPLETED')}
                                                        >
                                                            Complete
                                                        </Button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
