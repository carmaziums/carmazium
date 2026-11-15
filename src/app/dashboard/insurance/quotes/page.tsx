"use client"

import * as React from "react"
import { Loader2, ClipboardList, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import {
    getInsuranceQuotes,
    updateInsuranceStatus,
    formatCurrency,
    type InsuranceQuote,
} from "@/lib/partnerApi"

export default function InsuranceQuotesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [quotes, setQuotes] = React.useState<InsuranceQuote[]>([])
    const [loading, setLoading] = React.useState(true)
    const [updating, setUpdating] = React.useState<string | null>(null)
    const [actionError, setActionError] = React.useState<string | null>(null)
    const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 15

    const [loadError, setLoadError] = React.useState<string | null>(null)
    const [retry, setRetry] = React.useState(0)
    const mutationPending = React.useRef(false)

    React.useEffect(() => {
        let alive = true
        async function fetchData() {
            if (!user) return
            try {
                setLoading(true)
                setLoadError(null)
                setQuotes([])
                const res = await getInsuranceQuotes(page, limit, statusFilter)
                if (!alive) return
                setQuotes(res.data)
                setTotal(res.total)
                if (page > 1 && !res.data.length) setPage(Math.max(1, Math.ceil(res.total / limit)))
            } catch (err) {
                if (!alive) return
                setLoadError('Could not load insurance information. Please retry.')
                console.error('Failed to fetch quotes:', err)
            } finally {
                if (alive) setLoading(false)
            }
        }
        if (!authLoading && user) void fetchData()
        return () => { alive = false }
    }, [user, authLoading, page, statusFilter, retry])

    const handleStatusUpdate = async (id: string, status: string) => {
        if (mutationPending.current || loading || loadError) return
        let quotedPrice: number | undefined
        let coverageType: string | undefined
        if (status === 'QUOTED') {
            const rawPrice = window.prompt('Enter the annual insurance premium in pounds (£).')
            if (rawPrice === null) return
            quotedPrice = Number(rawPrice)
            if (!Number.isFinite(quotedPrice) || quotedPrice <= 0) {
                setActionError('Enter a valid annual premium before sending a quote.')
                return
            }
            const rawCoverage = window.prompt('Enter the coverage type (for example, Comprehensive).')
            if (rawCoverage === null) return
            coverageType = rawCoverage.trim()
            if (coverageType.length < 2) {
                setActionError('Enter the coverage type before sending a quote.')
                return
            }
        }

        try {
            mutationPending.current = true
            setUpdating(id)
            setActionError(null)
            const updated = await updateInsuranceStatus(id, status, quotedPrice, coverageType)
            setLoading(true)
            setQuotes([])
            setRetry(value => value + 1)
        } catch (err: any) {
            console.error('Failed to update status:', err)
            setActionError(err?.message || 'Could not update this record.')
        } finally {
            mutationPending.current = false
            setUpdating(null)
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    const filtered = quotes

    const totalPages = Math.ceil(total / limit)

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="insurance" userName={userName} userType="Insurance Partner" />

                <div className="flex-1 min-w-0 space-y-6">
                    {loadError && <div role="alert" className="rounded-xl border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">{loadError}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-3 font-bold underline">Retry</button></div>}
                    {actionError && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                            {actionError}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h1 className="text-2xl font-black font-heading flex items-center gap-2">
                            <ClipboardList className="text-primary" /> Insurance Quotes
                        </h1>

                        <div className="flex gap-2 flex-wrap">
                            {["ALL", "PENDING", "QUOTED", "ACCEPTED", "EXPIRED", "REJECTED"].map(s => (
                                <button
                                    key={s}
                                    disabled={!!updating}
                                    onClick={() => { if (s === statusFilter && page === 1) setRetry(value => value + 1); setStatusFilter(s); setPage(1); setLoading(true); setQuotes([]) }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s
                                        ? 'bg-primary text-white'
                                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-white/10 hover:text-primary dark:hover:'}`}
                                >
                                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Applicant</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Driver Age</th>
                                        <th className="px-6 py-4 text-center">NCB Years</th>
                                        <th className="px-6 py-4 text-center">Convictions</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]/80">
                                    {loading ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></td></tr>
                                    ) : loadError ? (<tr><td colSpan={8} className="p-6">Quote list unavailable. Retry above.</td></tr>) : filtered.length === 0 ? (
                                        <tr><td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)] italic">No quotes found.</td></tr>
                                    ) : (
                                        filtered.map((quote) => (
                                            <tr key={quote.id} className="hover:bg-[var(--bg-card)] transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold">{quote.user?.firstName} {quote.user?.lastName}</div>
                                                    <div className="text-xs text-[var(--text-muted)]">{quote.user?.email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm">{quote.listing?.title || 'Unknown'}</div>
                                                    <div className="text-xs text-[var(--text-muted)]">{formatCurrency(quote.listing?.price || 0)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">{quote.driverAge}</td>
                                                <td className="px-6 py-4 text-center">{quote.ncbYears}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {quote.hasConvictions ? (
                                                        <span className="text-red-700 dark:text-red-400 flex items-center justify-center gap-1"><AlertCircle size={12} /> Yes</span>
                                                    ) : (
                                                        <span className="text-emerald-700 dark:text-emerald-400">No</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${quote.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                        quote.status === 'QUOTED' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' :
                                                            quote.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' :
                                                                quote.status === 'EXPIRED' ? 'bg-gray-500/10 text-[var(--text-muted)] border-gray-500/20' :
                                                                    'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'}`}>
                                                        {quote.status === 'PENDING' && <Clock size={10} />}
                                                        {quote.status === 'ACCEPTED' && <CheckCircle size={10} />}
                                                        {quote.status === 'REJECTED' && <XCircle size={10} />}
                                                        {quote.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                                    {new Date(quote.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {updating === quote.id ? (
                                                        <Loader2 size={16} className="animate-spin text-primary inline" />
                                                    ) : quote.status === 'PENDING' ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <Button size="sm" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500 hover:text-primary dark:hover:text-white border border-blue-500/20 h-8 text-xs"
                                                                onClick={() => handleStatusUpdate(quote.id, 'QUOTED')}>Quote</Button>
                                                            <Button size="sm" variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 h-8 text-xs"
                                                                onClick={() => handleStatusUpdate(quote.id, 'REJECTED')}>Reject</Button>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="p-4 border-t border-[var(--border-default)] flex justify-between items-center">
                                <span className="text-sm text-[var(--text-muted)]">Page {page} of {totalPages} ({total} total)</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={loading || !!updating || page <= 1} onClick={() => { setLoading(true); setQuotes([]); setPage(p => p - 1) }} className="text-xs">Previous</Button>
                                    <Button size="sm" variant="outline" disabled={loading || !!updating || page >= totalPages} onClick={() => { setLoading(true); setQuotes([]); setPage(p => p + 1) }} className="text-xs">Next</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
