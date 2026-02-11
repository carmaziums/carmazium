"use client"

import * as React from "react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getContractorJobs, updateJobStatus, type ServiceRequest } from "@/lib/listingApi"
import { Loader2, Briefcase, AlertCircle, CheckCircle, Play, Clock } from "lucide-react"

export default function ServiceJobsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [jobs, setJobs] = React.useState<ServiceRequest[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [updatingId, setUpdatingId] = React.useState<string | null>(null)

    const fetchJobs = React.useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await getContractorJobs(1, 50)
            setJobs(data.data || [])
        } catch (err) {
            console.error("Failed to fetch jobs:", err)
            setError("Could not load jobs")
        } finally {
            setLoading(false)
        }
    }, [])

    React.useEffect(() => {
        if (!user || authLoading) return
        fetchJobs()
    }, [user, authLoading, fetchJobs])

    const handleStatusUpdate = async (jobId: string, newStatus: string) => {
        try {
            setUpdatingId(jobId)
            await updateJobStatus(jobId, newStatus)
            await fetchJobs()
        } catch (err) {
            console.error("Failed to update status:", err)
        } finally {
            setUpdatingId(null)
        }
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const statusConfig: Record<string, { color: string; icon: React.ElementType; next?: { label: string; status: string } }> = {
        PENDING: { color: "bg-amber-500/20 text-amber-400", icon: Clock, next: { label: "Accept", status: "ACCEPTED" } },
        ACCEPTED: { color: "bg-blue-500/20 text-blue-400", icon: Play, next: { label: "Start Work", status: "IN_PROGRESS" } },
        IN_PROGRESS: { color: "bg-purple-500/20 text-purple-400", icon: Play, next: { label: "Complete", status: "COMPLETED" } },
        COMPLETED: { color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle },
        CANCELLED: { color: "bg-red-500/20 text-red-400", icon: AlertCircle },
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="provider" userName={userName} userType="Service Provider" />
                <main className="flex-1 space-y-6">
                    <h1 className="text-3xl font-bold font-heading text-white mb-6">My Jobs</h1>

                    {error && (
                        <div className="glass-card p-4 border border-red-500/30 flex items-center gap-3 text-red-400">
                            <AlertCircle size={20} /> {error}
                        </div>
                    )}

                    {jobs.length === 0 ? (
                        <div className="glass-card p-12 text-center text-gray-400">
                            <Briefcase size={56} className="mx-auto mb-4 opacity-30" />
                            <p className="text-xl font-medium">No jobs assigned yet</p>
                            <p className="text-sm mt-2 max-w-md mx-auto">When customers request your services, their jobs will appear here for you to manage.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {jobs.map(job => {
                                const config = statusConfig[job.status] || statusConfig.PENDING
                                const StatusIcon = config.icon
                                return (
                                    <div key={job.id} className="glass-card p-6 hover:border-white/20 transition-colors">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-bold text-white">
                                                        {job.requester?.firstName || "Customer"} {job.requester?.lastName || ""}
                                                    </h3>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${config.color}`}>
                                                        <StatusIcon size={12} /> {job.status.replaceAll('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 text-sm">
                                                    <span className="text-gray-300 font-medium">{job.serviceType.replaceAll('_', ' ')}</span>
                                                    {job.description && <> — {job.description}</>}
                                                </p>
                                                <div className="flex gap-6 mt-2 text-xs text-gray-500">
                                                    <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                                                    {job.scheduledDate && <span>Scheduled: {new Date(job.scheduledDate).toLocaleDateString()}</span>}
                                                    {job.quotedPrice && <span>Quote: £{Number(job.quotedPrice).toLocaleString()}</span>}
                                                </div>
                                            </div>
                                            {config.next && (
                                                <button
                                                    onClick={() => handleStatusUpdate(job.id, config.next!.status)}
                                                    disabled={updatingId === job.id}
                                                    className="bg-primary text-white font-bold py-2 px-6 rounded shadow-neon hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                                                >
                                                    {updatingId === job.id ? <Loader2 size={16} className="animate-spin" /> : config.next.label}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
