"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, Clock, Loader2, PenLine, ShieldCheck, Upload } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { UserDetailModal } from "@/components/dashboard/UserDetailModal"
import { HpiPdfUpload } from "@/components/admin/HpiPdfUpload"
import { HpiReportForm } from "@/components/admin/HpiReportForm"
import { Button } from "@/components/ui/Button"
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
    KYC_VERIFICATION: "Dealer KYC",
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    FAILED: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    REFUNDED: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
}

const HPI_TYPES = ["HPI_REPORT", "HPI_REPORT_EMAIL"]
const HPI_LISTING_FEE_AMOUNTS = new Set([10, 25])

function isHpiEligibleTransaction(tx: any) {
    if (tx.status !== "COMPLETED") return false
    if (HPI_TYPES.includes(tx.type)) return true
    return tx.type === "LISTING_FEE" && HPI_LISTING_FEE_AMOUNTS.has(Number(tx.amount))
}

function HpiTransactionActions({ tx, onUpload, onFillForm }: {
    tx: any
    onUpload: (target: { id: string; title: string; hasPdf: boolean }) => void
    onFillForm: (target: { id: string; title: string; hasPdf: boolean }) => void
}) {
    if (!isHpiEligibleTransaction(tx) || !tx.listing) return null

    const report = tx.listing.hpiReport
    const target = {
        id: tx.listing.id,
        title: tx.listing.title,
        hasPdf: !!report?.pdfUploadedAt,
    }
    const done = report?.status === "COMPLETED"

    return (
        <div className={`mt-4 rounded-xl border p-4 ${done ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-primary/30 bg-primary/[0.05]"}`}>
            <div className="flex items-start gap-2.5">
                {done
                    ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Clock size={16} className="mt-0.5 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold ${done ? "text-emerald-700 dark:text-emerald-300" : "text-primary"}`}>
                        {!report
                            ? "No report record for this payment"
                            : done
                                ? `Report ${report.pdfUploadedAt ? "uploaded" : "prepared"}${report.isClear ? " · all checks passed" : " · adverse history"}`
                                : "Report outstanding — this payer is still owed one"}
                    </p>
                    {!report && (
                        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">The payment cleared but no report row exists. Attaching one here creates it.</p>
                    )}
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    onClick={(event) => { event.stopPropagation(); onUpload(target) }}
                >
                    <Upload size={13} /> {target.hasPdf ? "Replace PDF" : "Upload PDF"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => { event.stopPropagation(); onFillForm(target) }}
                >
                    <PenLine size={13} /> Fill in form
                </Button>
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

    function reloadTransactions() {
        getAdminTransactions(page, limit)
            .then(result => {
                setTransactions(result.data || [])
                setTotal(result.pagination?.total || 0)
            })
            .catch(fetchError => setError(fetchError.message || "Failed to load transactions"))
    }

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.replace("/auth/login")
                return
            }
            if (profile?.role !== "ADMIN") {
                router.replace("/dashboard")
                return
            }
        }
    }, [user, profile, authLoading, router])

    React.useEffect(() => {
        if (profile?.role !== "ADMIN") return
        setLoading(true)
        setError(null)
        getAdminTransactions(page, limit)
            .then(result => {
                setTransactions(result.data || [])
                setTotal(result.pagination?.total || 0)
            })
            .catch(fetchError => setError(fetchError.message || "Failed to load transactions"))
            .finally(() => setLoading(false))
    }, [profile, page])

    if (authLoading || (user && !profile) || (loading && transactions.length === 0)) {
        return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== "ADMIN") return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split("@")[0] || "Admin")

    return (
        <div className="min-h-screen pb-12 pt-20">
            <div className="container mx-auto flex flex-col gap-8 px-5 lg:flex-row">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="min-w-0 flex-1">
                    <Link
                        href="/dashboard/admin"
                        className="mb-4 inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-[var(--text-muted)] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                        <ArrowLeft size={16} /> Back to Overview
                    </Link>

                    <PageHeader title="Transaction Ledger" subHeader={`${total} total transactions · financial records are read-only in this view`} />

                    {hpiSuccess && (
                        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{hpiSuccess}</div>
                    )}
                    {error && (
                        <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-700 dark:text-red-300"><strong>Error:</strong> {error}</div>
                    )}

                    <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[var(--shadow-card)]" aria-label="Transaction ledger">
                        <div className="sm:hidden divide-y divide-[var(--border-default)]">
                            {transactions.map((transaction) => (
                                <article key={transaction.id} className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                            onClick={() => transaction.user?.id && setSelectedUserId(transaction.user.id)}
                                        >
                                            <p className="truncate text-sm font-bold">{transaction.user?.firstName} {transaction.user?.lastName}</p>
                                            <p className="truncate text-xs text-[var(--text-muted)]">{transaction.user?.email}</p>
                                        </button>
                                        <span className={`shrink-0 text-sm font-black tabular-nums ${transaction.type === "REFUND" ? "text-red-600 dark:text-red-400" : ""}`}>
                                            {transaction.type === "REFUND" ? "-" : ""}{formatPrice(Number(transaction.amount))}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs font-bold text-[var(--text-secondary)]">{TYPE_LABELS[transaction.type] || transaction.type}</span>
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${STATUS_STYLES[transaction.status] || STATUS_STYLES.PENDING}`}>{transaction.status}</span>
                                        <span className="text-xs text-[var(--text-muted)]">{new Date(transaction.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {transaction.listing && <p className="mt-2 truncate text-xs text-[var(--text-muted)]">{transaction.listing.title}</p>}
                                    <HpiTransactionActions tx={transaction} onUpload={setHpiUploadTarget} onFillForm={setHpiFormTarget} />
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full min-w-[980px] border-collapse text-left">
                                <thead className="sticky top-0 z-10 border-b-2 border-[var(--border-default)] bg-[var(--bg-input)] text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-muted)] shadow-sm">
                                    <tr>
                                        <th scope="col" className="px-6 py-4">User</th>
                                        <th scope="col" className="px-6 py-4">Vehicle</th>
                                        <th scope="col" className="px-6 py-4 text-center">Type</th>
                                        <th scope="col" className="px-6 py-4 text-center">Status</th>
                                        <th scope="col" className="px-6 py-4 text-right">Amount</th>
                                        <th scope="col" className="px-6 py-4 text-right">Date</th>
                                        <th scope="col" className="w-10 px-3 py-4"><span className="sr-only">Details</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-default)]">
                                    {transactions.map((transaction, index) => (
                                        <React.Fragment key={transaction.id}>
                                            <tr
                                                className={`cursor-pointer transition-colors hover:bg-primary/[0.035] ${index % 2 === 1 ? "bg-[var(--bg-input)]/20" : ""}`}
                                                onClick={() => setExpandedTxId(expandedTxId === transaction.id ? null : transaction.id)}
                                            >
                                                <td className="px-6 py-4 text-xs">
                                                    <button
                                                        type="button"
                                                        className="group block max-w-[220px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            if (transaction.user?.id) setSelectedUserId(transaction.user.id)
                                                        }}
                                                    >
                                                        <span className="block truncate font-semibold group-hover:text-primary">{transaction.user?.firstName} {transaction.user?.lastName}</span>
                                                        <span className="mt-0.5 block truncate text-[var(--text-muted)]">{transaction.user?.email}</span>
                                                        {transaction.user?.dealerProfile?.companyName && (
                                                            <span className="mt-1 inline-flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                                                {transaction.user.dealerProfile.companyName}{transaction.user.dealerProfile.isVerified ? " ✓" : ""}
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="max-w-[200px] px-6 py-4 text-xs">
                                                    {transaction.listing ? (
                                                        <div>
                                                            <p className="truncate font-medium">{transaction.listing.title}</p>
                                                            <p className="mt-0.5 text-[var(--text-muted)]">{transaction.listing.year} {transaction.listing.make}</p>
                                                        </div>
                                                    ) : <span className="text-[var(--text-muted)]">—</span>}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">{TYPE_LABELS[transaction.type] || transaction.type}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${STATUS_STYLES[transaction.status] || STATUS_STYLES.PENDING}`}>{transaction.status}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-black tabular-nums">
                                                    <span className={transaction.type === "REFUND" ? "text-red-600 dark:text-red-400" : ""}>{transaction.type === "REFUND" ? "-" : ""}{formatPrice(Number(transaction.amount))}</span>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right text-xs text-[var(--text-muted)]">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                                                <td className="px-3 py-4 text-right text-[var(--text-muted)]">
                                                    <ChevronDown size={15} className={`inline-block transition-transform ${expandedTxId === transaction.id ? "rotate-180" : ""}`} aria-hidden="true" />
                                                </td>
                                            </tr>

                                            {expandedTxId === transaction.id && (
                                                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-input)]/60">
                                                    <td colSpan={7} className="px-6 py-5">
                                                        <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-4">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Transaction ID</p>
                                                                <p className="mt-1 break-all font-mono">{transaction.id}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Stripe Reference</p>
                                                                <p className="mt-1 break-all font-mono">{transaction.stripePaymentId || "—"}</p>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Description</p>
                                                                <p className="mt-1 leading-5">{transaction.description || "—"}</p>
                                                            </div>
                                                        </div>
                                                        <HpiTransactionActions tx={transaction} onUpload={setHpiUploadTarget} onFillForm={setHpiFormTarget} />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-xs font-medium text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                            <span>Showing {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>Previous</Button>
                                <Button variant="outline" size="sm" onClick={() => setPage(current => current + 1)} disabled={page * limit >= total}>Next</Button>
                            </div>
                        </div>
                    </section>
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
                        setHpiSuccess("HPI report uploaded — the seller and any waiting buyers have been notified.")
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
                        setHpiSuccess("HPI report saved — the seller and any waiting buyers have been notified.")
                        reloadTransactions()
                    }}
                />
            )}
        </div>
    )
}
