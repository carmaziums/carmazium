"use client"

import * as React from "react"
import { X, ShieldCheck, ShieldX, Download, Printer, CheckCircle2, XCircle, AlertTriangle, Car, Loader2, Clock, FileText, Mail } from "lucide-react"
import { apiClient } from "@/lib/apiClient"
import { HPI_CHECK_DEFINITIONS, openHpiPdf, createHpiEmailCheckout, getMyHpiEmailRequest, type HpiReportData, type HpiSummaryResponse, type HpiEmailRequestStatus } from "@/lib/hpiApi"

interface HpiCheck {
    passed: boolean
    detail: string
    category?: string | null
    agreementId?: string | null
}

interface HpiSummary {
    vrm: string
    make: string
    model: string
    colour: string
    yearOfManufacture: string
    registrationDate: string
    engineSize: string
    fuelType: string
    isClear: boolean
    purchasedAt: string
    createdAt: string
    checks: {
        stolen: HpiCheck
        writeOff: HpiCheck
        scrapped: HpiCheck
        financeOutstanding: HpiCheck
        plateChange: HpiCheck
        mileageAnomaly: HpiCheck
    }
}

interface Props {
    listingId: string
    onClose: () => void
}

const CHECK_LABELS: Record<string, string> = {
    stolen: "Stolen Vehicle",
    writeOff: "Insurance Write-Off",
    scrapped: "Scrapped / SORN",
    financeOutstanding: "Outstanding Finance",
    plateChange: "Plate Change",
    mileageAnomaly: "Mileage Consistency",
}

/** Admin-prepared reports render from structured data + the branded PDF. */
type AdminView = {
    status: 'PENDING' | 'COMPLETED'
    vrm: string
    isClear: boolean
    preparedAt: string | null
    report: HpiReportData | null
}

export function HpiReportModal({ listingId, onClose }: Props) {
    const [summary, setSummary] = React.useState<HpiSummary | null>(null)
    const [adminView, setAdminView] = React.useState<AdminView | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [pdfLoading, setPdfLoading] = React.useState(false)
    const printRef = React.useRef<HTMLDivElement>(null)

    // Buyer's own £9.99 "email me a copy" purchase — separate from the free
    // in-app view above. Only offered for admin-prepared reports: legacy
    // OneAutoAPI rows have no structured data for the PDF pipeline to render.
    const [emailRequest, setEmailRequest] = React.useState<HpiEmailRequestStatus | null>(null)
    const [emailRequestLoading, setEmailRequestLoading] = React.useState(false)
    const [emailCheckoutLoading, setEmailCheckoutLoading] = React.useState(false)
    const [emailError, setEmailError] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchSummary() {
            try {
                const res = await apiClient<{ success: boolean; data: HpiSummaryResponse }>(`/hpi/listing/${listingId}/summary`)
                // Reports prepared by CarMazium staff carry structured data;
                // pre-existing OneAutoAPI rows keep the original shape.
                if (res.data?.format === 'ADMIN') {
                    setAdminView(res.data)
                    refreshEmailRequest()
                } else {
                    setSummary(res.data as unknown as HpiSummary)
                }
            } catch (e: any) {
                setError(e?.message || "Failed to load HPI report")
            } finally {
                setLoading(false)
            }
        }
        fetchSummary()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listingId])

    async function refreshEmailRequest() {
        setEmailRequestLoading(true)
        try {
            setEmailRequest(await getMyHpiEmailRequest(listingId))
        } catch {
            // Non-critical — the "email me a copy" button just falls back to its default state.
        } finally {
            setEmailRequestLoading(false)
        }
    }

    async function handleEmailMeCopy() {
        setEmailCheckoutLoading(true)
        setEmailError(null)
        try {
            const returnPath = window.location.pathname
            const { url } = await createHpiEmailCheckout(listingId, returnPath)
            window.location.href = url
        } catch (e: any) {
            setEmailError(e?.message || 'Failed to start checkout')
            setEmailCheckoutLoading(false)
        }
    }

    const handleOpenPdf = async () => {
        setPdfLoading(true)
        setError(null)
        try {
            await openHpiPdf(listingId)
        } catch (e: any) {
            setError(e?.message || 'Failed to open the report PDF')
        } finally {
            setPdfLoading(false)
        }
    }

    function handlePrint() {
        if (!printRef.current) return
        const win = window.open("", "_blank")
        if (!win) return
        win.document.write(`
            <html><head><title>HPI Report — ${summary?.vrm}</title>
            <style>
                body { font-family: Arial, sans-serif; color: #111; padding: 32px; }
                h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
                h2 { font-size: 14px; color: #555; margin: 0 0 24px; font-weight: normal; }
                .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
                .cell { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
                .cell-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 4px; letter-spacing: 0.05em; }
                .cell-value { font-size: 14px; font-weight: bold; }
                .check { display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid; }
                .pass { background: #f0fdf4; border-color: #bbf7d0; }
                .fail { background: #fff7ed; border-color: #fed7aa; }
                .check-title { font-weight: bold; font-size: 13px; margin-bottom: 2px; }
                .check-detail { font-size: 12px; color: #555; }
                .status-pass { color: #16a34a; font-size: 18px; }
                .status-fail { color: #ea580c; font-size: 18px; }
                .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 16px; }
                .clear { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; color: #15803d; font-weight: bold; }
                .not-clear { background: #fff7ed; border: 2px solid #ea580c; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; color: #c2410c; font-weight: bold; }
            </style></head><body>
            ${printRef.current.innerHTML}
            </body></html>
        `)
        win.document.close()
        win.focus()
        win.print()
        win.close()
    }

    const allChecks = summary ? Object.entries(summary.checks) : []
    const passCount = allChecks.filter(([, c]) => c.passed).length

    if (adminView) {
        const r = adminView.report
        const isPending = adminView.status !== 'COMPLETED' || !r
        const failed = r ? HPI_CHECK_DEFINITIONS.filter(d => r.checks?.[d.key]?.passed === false) : []

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl">
                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[var(--bg-dropdown)] backdrop-blur border-b border-[var(--border-default)]">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <ShieldCheck size={18} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-bold text-[var(--text-primary)] text-lg">Vehicle History Report</h2>
                                <p className="text-xs text-[var(--text-muted)] truncate">
                                    {adminView.vrm}
                                    {adminView.preparedAt && ` · Prepared ${new Date(adminView.preparedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors shrink-0">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
                        )}

                        {isPending ? (
                            <div className="text-center py-10">
                                <Clock size={40} className="mx-auto mb-4 text-amber-400 opacity-80" />
                                <h3 className="font-bold text-lg text-[var(--text-primary)]">Report being prepared</h3>
                                <p className="text-sm text-[var(--text-muted)] mt-2 max-w-sm mx-auto leading-relaxed">
                                    Our team is compiling the vehicle history report for this car. It&apos;ll appear
                                    here as soon as it&apos;s ready.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className={`rounded-xl border p-4 flex items-center gap-3 ${adminView.isClear
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : 'bg-amber-500/10 border-amber-500/30'}`}>
                                    {adminView.isClear
                                        ? <ShieldCheck size={22} className="text-emerald-400 shrink-0" />
                                        : <ShieldX size={22} className="text-amber-400 shrink-0" />}
                                    <div>
                                        <p className={`font-bold ${adminView.isClear ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {adminView.isClear ? 'All checks passed' : `${failed.length} check${failed.length === 1 ? '' : 's'} not passed`}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {adminView.isClear
                                                ? 'No adverse history recorded in the supplied check'
                                                : failed.map(f => f.label.replace(/^Not |^No /, '')).join(', ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {([
                                        ['Make', r!.vehicle?.make],
                                        ['Model', r!.vehicle?.model],
                                        ['Year', r!.vehicle?.yearOfManufacture],
                                        ['Fuel', r!.vehicle?.fuelType],
                                        ['Transmission', r!.vehicle?.transmission],
                                        ['Colour', r!.vehicle?.colour],
                                    ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                                        <div key={label} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-2.5">
                                            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</p>
                                            <p className="text-sm font-bold truncate">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-1.5">
                                    {HPI_CHECK_DEFINITIONS.map(def => {
                                        const entry = r!.checks?.[def.key]
                                        const passed = entry?.passed !== false
                                        return (
                                            <div key={def.key} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${passed
                                                ? 'bg-emerald-500/5 border-emerald-500/20'
                                                : 'bg-red-500/5 border-red-500/25'}`}>
                                                {passed
                                                    ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                                    : <XCircle size={15} className="text-red-400 shrink-0" />}
                                                <span className="text-sm flex-1 min-w-0">{def.label}</span>
                                                {!passed && entry?.note && (
                                                    <span className="text-xs text-red-300 shrink-0">{entry.note}</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                <button
                                    onClick={handleOpenPdf}
                                    disabled={pdfLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {pdfLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                    Open full report (PDF)
                                </button>

                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    CarMazium presents vehicle-history information from a supplied
                                    {r!.sourceName ? ` ${r!.sourceName}` : ' third-party check'}
                                    {r!.sourceCheckDate ? ` dated ${r!.sourceCheckDate}` : ''}. CarMazium did not originate or
                                    independently verify the underlying third-party data.
                                </p>
                            </>
                        )}

                        {/* Buyer's own paid copy — separate from the free view above,
                            available whether the report is still pending or complete
                            since payment just queues delivery for whenever it's ready. */}
                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <Mail size={15} className="text-primary shrink-0" />
                                <p className="text-sm font-bold text-[var(--text-primary)]">Email me a copy</p>
                            </div>

                            {emailError && <p className="text-xs text-red-400">{emailError}</p>}

                            {emailRequest?.status === 'SENT' ? (
                                <p className="text-xs text-emerald-400 font-semibold">
                                    Emailed to you on {emailRequest.sentAt ? new Date(emailRequest.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                </p>
                            ) : emailRequest?.status === 'PENDING' ? (
                                <p className="text-xs text-amber-400 font-semibold">
                                    {isPending
                                        ? "Paid — we'll email this to you the moment the report is ready."
                                        : "Payment received — your copy is on its way to your inbox."}
                                </p>
                            ) : emailRequest?.status === 'FAILED' ? (
                                <p className="text-xs text-red-400">We couldn&apos;t send your copy. Please contact support and we&apos;ll get it resent.</p>
                            ) : (
                                <>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Get this report sent straight to your inbox as a PDF{isPending ? ' — as soon as it\'s ready' : ''}, for £9.99.
                                    </p>
                                    <button
                                        onClick={handleEmailMeCopy}
                                        disabled={emailCheckoutLoading || emailRequestLoading}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--bg-input)] border border-primary/30 text-primary text-xs font-black uppercase tracking-widest hover:bg-primary/10 transition-colors disabled:opacity-50"
                                    >
                                        {emailCheckoutLoading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                        Email me a copy — £9.99
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[var(--bg-dropdown)] backdrop-blur border-b border-[var(--border-default)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <ShieldCheck size={18} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="font-bold text-[var(--text-primary)] text-lg">HPI Check Report</h2>
                            {summary && (
                                <p className="text-xs text-[var(--text-muted)]">
                                    {summary.vrm} · Generated {new Date(summary.purchasedAt || summary.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {summary && (
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-primary dark:hover:text-white text-xs font-bold transition-colors"
                            >
                                <Printer size={13} /> Print
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={32} className="animate-spin text-primary" />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                            <AlertTriangle size={18} />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {summary && (
                        <div ref={printRef}>
                            {/* Print header */}
                            <div className="hidden print:block mb-6">
                                <h1>HPI Check Report — Carmazium</h1>
                                <h2>{summary.make} {summary.model} ({summary.vrm})</h2>
                            </div>

                            {/* Overall status */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${summary.isClear ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                                {summary.isClear
                                    ? <CheckCircle2 size={22} className="shrink-0" />
                                    : <AlertTriangle size={22} className="shrink-0" />
                                }
                                <div>
                                    <p className="font-bold text-sm">
                                        {summary.isClear ? "Clear — No major issues detected" : "Attention Required — Issues found"}
                                    </p>
                                    <p className="text-xs opacity-80">
                                        {passCount}/{allChecks.length} checks passed
                                    </p>
                                </div>
                            </div>

                            {/* Vehicle identity */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Car size={14} className="text-primary" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Vehicle Details</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {[
                                        { label: "Registration", value: summary.vrm },
                                        { label: "Make", value: summary.make },
                                        { label: "Model", value: summary.model },
                                        { label: "Year", value: summary.yearOfManufacture },
                                        { label: "Colour", value: summary.colour },
                                        { label: "Fuel Type", value: summary.fuelType },
                                        { label: "Engine Size", value: summary.engineSize },
                                        { label: "Reg. Date", value: summary.registrationDate ? new Date(summary.registrationDate).toLocaleDateString("en-GB") : "" },
                                    ].map(({ label, value }) => value ? (
                                        <div key={label} className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)]">
                                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mb-1">{label}</p>
                                            <p className="text-sm font-bold">{value}</p>
                                        </div>
                                    ) : null)}
                                </div>
                            </div>

                            {/* Checks */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-primary" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">History Checks</p>
                                </div>
                                <div className="space-y-2">
                                    {allChecks.map(([key, check]) => (
                                        <div
                                            key={key}
                                            className={`flex items-start gap-3 p-4 rounded-xl border ${check.passed ? "bg-emerald-500/5 border-emerald-500/15" : "bg-red-500/5 border-red-500/20"}`}
                                        >
                                            <div className="shrink-0 mt-0.5">
                                                {check.passed
                                                    ? <CheckCircle2 size={18} className="text-emerald-400" />
                                                    : <XCircle size={18} className="text-red-400" />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold ${check.passed ? "text-emerald-300" : "text-red-300"}`}>
                                                    {CHECK_LABELS[key] ?? key}
                                                </p>
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5">{check.detail}</p>
                                                {check.category && (
                                                    <p className="text-xs text-amber-400 mt-1 font-semibold">Category: {check.category}</p>
                                                )}
                                            </div>
                                            <div className="shrink-0">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${check.passed ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                                    {check.passed ? "PASS" : "FAIL"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Disclaimer */}
                            <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)]">
                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                    This HPI check was performed by Carmazium via OneAutoAPI and reflects data available at the time of purchase.
                                    Results are based on DVLA, insurance industry, and finance house records. Carmazium is not liable for any discrepancies.
                                    Report generated: {new Date(summary.purchasedAt || summary.createdAt).toLocaleString("en-GB")}.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
