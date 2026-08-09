"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Loader2, ArrowLeft, BadgeCheck } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { UserDetailModal } from "@/components/dashboard/UserDetailModal"
import { useAuth } from "@/context/AuthContext"
import { getAdminDealersKycArchive } from "@/lib/adminApi"

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
}

export default function AdminDealersPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [records, setRecords] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
    const limit = 20

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    React.useEffect(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        getAdminDealersKycArchive(page, limit)
            .then(r => { setRecords(r.data || []); setTotal(r.pagination?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load dealers'))
            .finally(() => setLoading(false))
    }, [profile, page])

    if (authLoading || (user && !profile) || (loading && records.length === 0)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <Link href="/dashboard/admin" className="inline-flex items-center text-[var(--text-muted)] hover:text-primary dark:hover:text-white mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back to Overview
                        </Link>
                        <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                            <Building2 className="text-blue-400 hidden sm:block" size={28} />
                            All Dealers
                        </h1>
                        <p className="text-[var(--text-muted)] mt-1 text-sm">{total} dealer KYC records — every status, nothing drops off once approved</p>
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">

                        {/* ── Mobile cards (< sm) ── */}
                        <div className="sm:hidden divide-y divide-[var(--border-default)]">
                            {records.map((r) => {
                                const dp = r.dealerProfile
                                const u = dp?.user
                                return (
                                    <div key={r.id} className="p-4 cursor-pointer" onClick={() => u?.id && setSelectedUserId(u.id)}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm truncate flex items-center gap-1.5">
                                                    {dp?.companyName || r.companyHouseName}
                                                    {dp?.isVerified && <BadgeCheck size={13} className="text-blue-400 shrink-0" />}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] truncate">{u?.email}</p>
                                            </div>
                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border shrink-0 ${STATUS_STYLES[r.status] || STATUS_STYLES.PENDING}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--text-muted)] mt-1">{u?.phone || 'No phone on file'} · Submitted {new Date(r.submittedAt).toLocaleDateString()}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ── Desktop table (≥ sm) ── */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                                    <tr>
                                        <th className="px-6 py-4">Company</th>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4 text-center">KYC Status</th>
                                        <th className="px-6 py-4 text-right">Submitted</th>
                                        <th className="px-6 py-4 text-right">Reviewed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]/80">
                                    {records.map((r) => {
                                        const dp = r.dealerProfile
                                        const u = dp?.user
                                        return (
                                            <tr key={r.id} className="hover:bg-[var(--bg-card)] transition-colors cursor-pointer group" onClick={() => u?.id && setSelectedUserId(u.id)}>
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-sm flex items-center gap-1.5 group-hover:text-primary transition-colors">
                                                        {dp?.companyName || r.companyHouseName}
                                                        {dp?.isVerified && <BadgeCheck size={14} className="text-blue-400" />}
                                                    </p>
                                                    <p className="text-xs text-[var(--text-muted)]">VAT {r.vatNumber}</p>
                                                </td>
                                                <td className="px-6 py-4 text-xs">
                                                    <p>{u?.firstName} {u?.lastName}</p>
                                                    <p className="text-[var(--text-muted)]">{u?.email}</p>
                                                    {u?.phone && <p className="text-[var(--text-muted)]">{u.phone}</p>}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-1 rounded border text-xs font-bold ${STATUS_STYLES[r.status] || STATUS_STYLES.PENDING}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-xs text-[var(--text-muted)]">
                                                    {new Date(r.submittedAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right text-xs text-[var(--text-muted)]">
                                                    {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}

                        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
                            <span>Showing {records.length === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
        </div>
    )
}
