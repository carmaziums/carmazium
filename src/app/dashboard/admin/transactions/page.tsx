"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Receipt, Loader2, ArrowLeft, ChevronDown, Upload, ShieldCheck, Clock, PenLine } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { UserDetailModal } from "@/components/dashboard/UserDetailModal"
import { HpiPdfUpload } from "@/components/admin/HpiPdfUpload"
import { HpiReportForm } from "@/components/admin/HpiReportForm"
import { useAuth } from "@/context/AuthContext"
import { getAdminTransactions } from "@/lib/adminApi"
import { formatPrice } from "@/lib/listingApi"

const TYPE_LABELS: Record<string, string> = {
    DEPOSIT: "Deposit",
    FULL_PAYMENT: "Full Payment",
    COMMISSION: "Auction Fee",
    REFUND: "Refund",
    HPI_REPORT: "HPI Report",
    HPI_REPORT_EMAIL: "HPI Report (emailed)",
    LISTING_FEE: "Listing Fee",
    BOOST: "Boost",
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
    REFUNDED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

/**
 * Transactions that bought a vehicle history report. These are the rows where
 * an admin might owe the payer something, so they get the report controls.
 */
const HPI_TYPES = ['HPI_REPORT', 'HPI_REPORT_EMAIL']

/**
 * The report controls for an HPI transaction, shown wherever a ledger row is
 * expanded.
 *
 * The ledger is where an admin lands when checking what someone paid for, so
 * it is the natural place to discover an unfulfilled report — and now the place
 * to fix it, without navigating to the queue and finding the listing again.
 */
function HpiTransactionActions({ tx, onUpload, onFillForm }: {
    tx: any
    onUpload: (t: { id: string; title: string; hasPdf: boolean }) => void
    onFillForm: (t: { id: string; title: string; hasPdf: boolean }) => void
}) {
    if (!HPI_TYPES.includes(tx.type) || !tx.listing) return null

    const report = tx.listing.hpiReport
    const target = {
        id: tx.listing.id,
        title: tx.listing.title,
        hasPdf: !!report?.pdfUploadedAt,
    }
    const done = report?.status === 'COMPLETED'

    return (
        <div className={`mt-3 p-3 rounded-lg border ${done
            ? 'border-emerald-500/25 bg-emerald-500/5'
            : 'border-primary/30 bg-primary/5'}`}>
            <div className="flex items-start gap-2.5">
                {done
                    ? <ShieldCheck size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    : <Clock size={15} className="text-primary shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${done ? 'text-emerald-400' : 'text-primary'}`}>
                        {!report
                            ? 'No report record for this payment'
                            : done
                                ? `Report ${report.pdfUploadedAt ? 'uploaded' : 'prepared'}${report.isClear ? ' · all checks passed' : ' · adverse history'}`
                                : 'Report outstanding — this payer is still owed one'}
                    </p>
                    {!report && (
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            The payment cleared but no report row exists. Attaching one here creates it.
                        </p>
                    )}
                </div>
            </div>
            <div className="flex gap-2 mt-2.5">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUpload(target) }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors cursor-pointer"
                >
                    <Upload size={12} /> {target.hasPdf ? 'Replace PDF' : 'Upload PDF'}
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onFillForm(target) }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-primary/40 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/10 transition-colors cursor-pointer"
                >
                    <PenLine size={12} /> Fill in form
                </button>
            </div>
        </div>
    )
}

export default function AdminTransactionsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [transactions, setTransactions] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)
    const [expandedTxId, setExpandedTxId] = React.useState<string | null>(null)
    const [hpiUploadTarget, setHpiUploadTarget] = React.useState<{ id: string; title: string; hasPdf: boolean } | null>(null)
    const [hpiFormTarget, setHpiFormTarget] = React.useState<{ id: string; title: string; hasPdf: boolean } | null>(null)
    const [hpiSuccess, setHpiSuccess] = React.useState<string | null>(null)
    const limit = 20

    /** Re-pull the page so a just-attached report shows as fulfilled. */
    function reloadTransactions() {
        getAdminTransactions(page, limit)
            .then(r => { setTransactions(r.data || []); setTotal(r.pagination?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load transactions'))
    }

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
        getAdminTransactions(page, limit)
            .then(r => { setTransactions(r.data || []); setTotal(r.pagination?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load transactions'))
            .finally(() => setLoading(false))
    }, [profile, page])

    if (authLoading || (user && !profile) || (loading && transactions.length === 0)) {
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
                            <Receipt className="text-emerald-400 hidden sm:block" size={28} />
                            Transaction Ledger
                        </h1>
                        <p className="text-[var(--text-muted)] mt-1 text-sm">{total} total transactions</p>
                        {hpiSuccess && (
                            <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                                {hpiSuccess}
                            </div>
                        )}
                    </div>

                    {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200"><strong>Error:</strong> {error}</div>}

                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">

                        {/* ── Mobile cards (< sm) ── */}
                        <div className="sm:hidden divide-y divide-[var(--border-default)]">
                            {transactions.map((t) => (
                                <div key={t.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => t.user?.id && setSelectedUserId(t.user.id)}>
                                            <p className="text-sm font-bold truncate">{t.user?.firstName} {t.user?.lastName}</p>
                                            <p className="text-xs text-[var(--text-muted)] truncate">{t.user?.email}</p>
                                        </div>
                                        <span className={`text-sm font-black shrink-0 ${t.type === 'REFUND' ? 'text-red-400' : ''}`}>
                                            {t.type === 'REFUND' ? '-' : ''}{formatPrice(Number(t.amount))}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="inline-flex px-2 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-card)] text-xs font-bold text-[var(--text-secondary)]">
                                            {TYPE_LABELS[t.type] || t.type}
                                        </span>
                                        <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-bold ${STATUS_STYLES[t.status] || STATUS_STYLES.PENDING}`}>
                                            {t.status}
                                        </span>
                                        <span className="text-xs text-[var(--text-secondary)]">{new Date(t.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {t.listing && (
                                        <p className="text-xs text-[var(--text-muted)] mt-1 truncate">{t.listing.title}</p>
                                    )}
                                    <HpiTransactionActions
                                        tx={t}
                                        onUpload={setHpiUploadTarget}
                                        onFillForm={setHpiFormTarget}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* ── Desktop table (≥ sm) ── */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Vehicle</th>
                                        <th className="px-6 py-4 text-center">Type</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-right">Date</th>
                                        <th className="px-6 py-4 text-right w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]/80">
                                    {transactions.map((t) => (
                                        <React.Fragment key={t.id}>
                                        <tr className="hover:bg-[var(--bg-card)] transition-colors cursor-pointer" onClick={() => setExpandedTxId(expandedTxId === t.id ? null : t.id)}>
                                            <td className="px-6 py-4 text-xs">
                                                <div className="group inline-block" onClick={(e) => { e.stopPropagation(); if (t.user?.id) setSelectedUserId(t.user.id) }}>
                                                    <p className="font-medium group-hover:text-primary transition-colors">{t.user?.firstName} {t.user?.lastName}</p>
                                                    <p className="text-[var(--text-muted)]">{t.user?.email}</p>
                                                    {t.user?.dealerProfile?.companyName && (
                                                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            {t.user.dealerProfile.companyName}{t.user.dealerProfile.isVerified ? ' ✓' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs max-w-[160px]">
                                                {t.listing ? (
                                                    <div>
                                                        <p className="truncate">{t.listing.title}</p>
                                                        <p className="text-[var(--text-muted)]">{t.listing.year} {t.listing.make}</p>
                                                    </div>
                                                ) : <span className="text-[var(--text-muted)]">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--bg-card)] text-xs font-bold text-[var(--text-secondary)]">
                                                    {TYPE_LABELS[t.type] || t.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex px-2 py-1 rounded border text-xs font-bold ${STATUS_STYLES[t.status] || STATUS_STYLES.PENDING}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-sm">
                                                <span className={t.type === 'REFUND' ? 'text-red-400' : ''}>
                                                    {t.type === 'REFUND' ? '-' : ''}{formatPrice(Number(t.amount))}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-[var(--text-muted)]">
                                                {new Date(t.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-2 py-4 text-right text-[var(--text-muted)]">
                                                <ChevronDown size={14} className={`transition-transform inline-block ${expandedTxId === t.id ? 'rotate-180' : ''}`} />
                                            </td>
                                        </tr>
                                        {expandedTxId === t.id && (
                                            <tr className="bg-[var(--bg-input)]">
                                                <td colSpan={7} className="px-6 py-4">
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Transaction ID</p>
                                                            <p className="font-mono break-all">{t.id}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Stripe Reference</p>
                                                            <p className="font-mono break-all">{t.stripePaymentId || '—'}</p>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">Description</p>
                                                            <p>{t.description || '—'}</p>
                                                        </div>
                                                    </div>
                                                    <HpiTransactionActions
                                                        tx={t}
                                                        onUpload={setHpiUploadTarget}
                                                        onFillForm={setHpiFormTarget}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>{/* end hidden sm:block */}

                        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
                            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-50" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />

            {hpiUploadTarget && (
                <HpiPdfUpload
                    listingId={hpiUploadTarget.id}
                    listingTitle={hpiUploadTarget.title}
                    hasExistingPdf={hpiUploadTarget.hasPdf}
                    onClose={() => setHpiUploadTarget(null)}
                    onSaved={() => {
                        setHpiUploadTarget(null)
                        setHpiSuccess('HPI report uploaded — the seller and any waiting buyers have been notified.')
                        reloadTransactions()
                    }}
                />
            )}
            {hpiFormTarget && (
                <HpiReportForm
                    listingId={hpiFormTarget.id}
                    listingTitle={hpiFormTarget.title}
                    hasExistingPdf={hpiFormTarget.hasPdf}
                    onClose={() => setHpiFormTarget(null)}
                    onSaved={() => {
                        setHpiSuccess('HPI report saved — the seller and any waiting buyers have been notified.')
                        reloadTransactions()
                    }}
                />
            )}
        </div>
    )
}
