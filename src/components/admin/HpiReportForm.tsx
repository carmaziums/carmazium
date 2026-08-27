"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
    X, Loader2, Save, Plus, Trash2, ShieldCheck, ShieldAlert, Car, FileText, Gauge, Users, AlertTriangle,
    Upload, PenLine,
} from "lucide-react"
import { HpiPdfUploadPanel } from "./HpiPdfUpload"
import {
    HPI_CHECK_DEFINITIONS, getHpiPrefill, saveHpiReport, deriveIsClear, emptyChecks,
    type HpiReportData, type HpiCheckKey,
} from "@/lib/hpiApi"

const VEHICLE_FIELDS: { key: keyof HpiReportData['vehicle']; label: string }[] = [
    { key: 'make', label: 'Make' },
    { key: 'model', label: 'Model' },
    { key: 'bodyType', label: 'Body type' },
    { key: 'fuelType', label: 'Fuel type' },
    { key: 'transmission', label: 'Transmission' },
    { key: 'engineCapacity', label: 'Engine capacity' },
    { key: 'vrm', label: 'VRM' },
    { key: 'vin', label: 'VIN' },
    { key: 'engineNumber', label: 'Engine number' },
    { key: 'colour', label: 'Colour' },
    { key: 'firstRegistered', label: 'First registered' },
    { key: 'yearOfManufacture', label: 'Year of manufacture' },
    { key: 'previousOwners', label: 'Previous owners' },
    { key: 'currentV5cIssueDate', label: 'Current V5C issue date' },
    { key: 'co2Emissions', label: 'CO2 emissions' },
]

function Field({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold">{label}</span>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mt-1 w-full h-9 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
        </label>
    )
}

function SectionCard({ title, icon: Icon, children, action }: {
    title: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    children: React.ReactNode
    action?: React.ReactNode
}) {
    return (
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <header className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Icon size={13} /> {title}
                </h4>
                {action}
            </header>
            {children}
        </section>
    )
}

/**
 * Generic add/remove editor for the three variable-length history tables.
 *
 * Operates on plain Record<string,string> rows rather than the real
 * HpiMileageEntry/HpiMotHistoryEntry/HpiSearchEntry shapes, which have
 * optional fields (e.g. `source?`) that don't structurally satisfy a
 * string-only Record — converting at each call site keeps this component
 * simple without loosening those shared payload types.
 */
function RowEditor({ rows, columns, onChange, addLabel, blank }: {
    rows: Record<string, string>[]
    columns: { key: string; label: string; placeholder?: string }[]
    onChange: (rows: Record<string, string>[]) => void
    addLabel: string
    blank: Record<string, string>
}) {
    return (
        <div className="space-y-2">
            {rows.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] italic">None added — this section is omitted from the PDF.</p>
            )}
            {rows.map((row, i) => (
                <div key={i} className="flex items-end gap-2">
                    {columns.map((col) => (
                        <div key={col.key} className="flex-1 min-w-0">
                            <Field
                                label={i === 0 ? col.label : ''}
                                value={row[col.key] ?? ''}
                                placeholder={col.placeholder}
                                onChange={(v) => {
                                    const next = [...rows]
                                    next[i] = { ...next[i], [col.key]: v }
                                    onChange(next)
                                }}
                            />
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                        className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 flex items-center justify-center transition-colors"
                        title="Remove row"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() => onChange([...rows, { ...blank }])}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
                <Plus size={13} /> {addLabel}
            </button>
        </div>
    )
}

export function HpiReportForm({ listingId, listingTitle, hasExistingPdf, onClose, onSaved }: {
    listingId: string
    listingTitle?: string
    /** Whether a PDF is already attached — switches the upload tab to replace mode. */
    hasExistingPdf?: boolean
    onClose: () => void
    onSaved?: () => void
}) {
    const [data, setData] = React.useState<HpiReportData | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    // Both routes to a finished report live in this one modal. An admin who
    // opens the form and then realises they already have the supplied PDF
    // shouldn't have to close it and find a different button.
    const [mode, setMode] = React.useState<'form' | 'pdf'>('form')

    React.useEffect(() => {
        let cancelled = false
        getHpiPrefill(listingId)
            .then((d) => {
                if (cancelled) return
                // Older saved reports may predate a field being added — merge so
                // the form never renders undefined into a controlled input.
                setData({
                    ...d,
                    checks: { ...emptyChecks(), ...(d.checks || {}) },
                    motHistory: d.motHistory ?? [],
                    mileageHistory: d.mileageHistory ?? [],
                    previousSearches: d.previousSearches ?? [],
                })
            })
            .catch((e) => !cancelled && setError(e?.message || 'Failed to load the vehicle details'))
            .finally(() => !cancelled && setLoading(false))
        return () => { cancelled = true }
    }, [listingId])

    const patch = (fn: (draft: HpiReportData) => void) => {
        setData((prev) => {
            if (!prev) return prev
            const next: HpiReportData = JSON.parse(JSON.stringify(prev))
            fn(next)
            return next
        })
    }

    const handleSave = async () => {
        if (!data) return
        setSaving(true)
        setError(null)
        try {
            await saveHpiReport(listingId, data)
            onSaved?.()
            onClose()
        } catch (e: any) {
            setError(e?.message || 'Failed to save the report')
        } finally {
            setSaving(false)
        }
    }

    if (typeof document === 'undefined') return null

    const isClear = data ? deriveIsClear(data.checks) : false
    const failedCount = data
        ? HPI_CHECK_DEFINITIONS.filter((d) => data.checks?.[d.key]?.passed === false).length
        : 0

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-3xl h-full bg-[var(--bg-dropdown)] border-l border-[var(--border-default)] shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 p-5 border-b border-[var(--border-default)] space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black uppercase tracking-tight">Prepare HPI Report</h3>
                            {listingTitle && <p className="text-xs text-[var(--text-muted)] truncate">{listingTitle}</p>}
                        </div>
                        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Two ways to finish the same report — either completes it. */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setMode('form')}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-colors ${mode === 'form'
                                ? 'bg-primary/10 border-primary/50 text-primary'
                                : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                        >
                            <PenLine size={14} /> Fill in form
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('pdf')}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-colors ${mode === 'pdf'
                                ? 'bg-primary/10 border-primary/50 text-primary'
                                : 'bg-[var(--bg-card)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
                        >
                            <Upload size={14} /> Upload PDF
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {mode === 'pdf' && (
                        <>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                Attach the supplied third-party report as-is. This becomes the document buyers
                                download, in place of the one generated from the form.
                            </p>
                            <HpiPdfUploadPanel
                                listingId={listingId}
                                hasExistingPdf={hasExistingPdf}
                                onSaved={() => { onSaved?.(); onClose() }}
                            />
                        </>
                    )}

                    {mode === 'form' && loading && (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
                    )}
                    {mode === 'form' && error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-start gap-2">
                            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
                        </div>
                    )}

                    {mode === 'form' && data && (
                        <>
                            {/* Outcome preview — derived, never entered directly */}
                            <div className={`rounded-xl border p-4 flex items-center gap-3 ${isClear
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-amber-500/10 border-amber-500/30'}`}>
                                {isClear
                                    ? <ShieldCheck size={20} className="text-emerald-400 shrink-0" />
                                    : <ShieldAlert size={20} className="text-amber-400 shrink-0" />}
                                <div>
                                    <p className={`font-bold text-sm ${isClear ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {isClear ? 'ALL CHECKS PASSED' : `${failedCount} check${failedCount === 1 ? '' : 's'} not passed`}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        This is derived from the checks below and printed on the report.
                                    </p>
                                </div>
                            </div>

                            <SectionCard title="Data source" icon={FileText}>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field
                                        label="Source name"
                                        value={data.sourceName}
                                        placeholder="AutoTrader Vehicle Check"
                                        onChange={(v) => patch((d) => { d.sourceName = v })}
                                    />
                                    <Field
                                        label="Source check date"
                                        value={data.sourceCheckDate}
                                        placeholder="19 August 2026"
                                        onChange={(v) => patch((d) => { d.sourceCheckDate = v })}
                                    />
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
                                    Printed in the disclosure paragraph. The report states CarMazium presents this
                                    third-party check rather than originating it, so both must be accurate.
                                </p>
                            </SectionCard>

                            <SectionCard title="Vehicle details" icon={Car}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {VEHICLE_FIELDS.map(({ key, label }) => (
                                        <Field
                                            key={String(key)}
                                            label={label}
                                            value={String(data.vehicle?.[key] ?? '')}
                                            onChange={(v) => patch((d) => { d.vehicle[key] = v })}
                                        />
                                    ))}
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                                    Prefilled from the listing&apos;s DVLA data — correct anything the supplied check disagrees with.
                                </p>
                            </SectionCard>

                            <SectionCard title="Check results" icon={ShieldCheck}>
                                <div className="space-y-1.5">
                                    {HPI_CHECK_DEFINITIONS.map((def) => {
                                        const entry = data.checks?.[def.key as HpiCheckKey]
                                        const passed = entry?.passed !== false
                                        return (
                                            <div key={def.key} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)]">
                                                <button
                                                    type="button"
                                                    onClick={() => patch((d) => {
                                                        d.checks[def.key as HpiCheckKey] = {
                                                            ...d.checks[def.key as HpiCheckKey],
                                                            passed: !passed,
                                                        }
                                                    })}
                                                    className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border transition-colors ${passed
                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-red-500/15 text-red-400 border-red-500/30'}`}
                                                >
                                                    {passed ? 'Passed' : 'Not passed'}
                                                </button>
                                                <span className="text-sm flex-1 min-w-0 truncate">{def.label}</span>
                                                {!passed && (
                                                    <input
                                                        value={entry?.note ?? ''}
                                                        onChange={(e) => patch((d) => {
                                                            d.checks[def.key as HpiCheckKey] = {
                                                                ...d.checks[def.key as HpiCheckKey],
                                                                passed: false,
                                                                note: e.target.value,
                                                            }
                                                        })}
                                                        placeholder="Detail, e.g. Category N"
                                                        className="w-52 shrink-0 h-8 rounded-md bg-[var(--bg-card)] border border-[var(--border-default)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </SectionCard>

                            <SectionCard title="MOT" icon={FileText}>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <Field label="Status" value={data.motStatus ?? ''} placeholder="Passed"
                                        onChange={(v) => patch((d) => { d.motStatus = v })} />
                                    <Field label="MOT expiry" value={data.motExpiry ?? ''} placeholder="7 March 2027"
                                        onChange={(v) => patch((d) => { d.motExpiry = v })} />
                                    <Field label="Mileage recording" value={data.motMileageRecording ?? ''} placeholder="66,319 miles"
                                        onChange={(v) => patch((d) => { d.motMileageRecording = v })} />
                                    <Field label="Current advisory" value={data.motCurrentAdvisory ?? ''} placeholder="Front brake disc worn…"
                                        onChange={(v) => patch((d) => { d.motCurrentAdvisory = v })} />
                                </div>
                                <RowEditor
                                    rows={data.motHistory.map((r) => ({ date: r.date, detail: r.detail }))}
                                    columns={[
                                        { key: 'date', label: 'Date', placeholder: '26 Feb 2026' },
                                        { key: 'detail', label: 'Result', placeholder: 'Pass - 63,512 mi - 0 advisories' },
                                    ]}
                                    blank={{ date: '', detail: '' }}
                                    addLabel="Add MOT history row"
                                    onChange={(rows) => patch((d) => {
                                        d.motHistory = rows.map((r) => ({ date: r.date ?? '', detail: r.detail ?? '' }))
                                    })}
                                />
                            </SectionCard>

                            <SectionCard title="Mileage history" icon={Gauge}>
                                <RowEditor
                                    rows={data.mileageHistory.map((r) => ({ date: r.date, mileage: r.mileage, source: r.source ?? '' }))}
                                    columns={[
                                        { key: 'date', label: 'Date', placeholder: '27 Feb 2026' },
                                        { key: 'mileage', label: 'Mileage', placeholder: '66,319' },
                                        { key: 'source', label: 'Source', placeholder: 'MOT' },
                                    ]}
                                    blank={{ date: '', mileage: '', source: 'MOT' }}
                                    addLabel="Add mileage row"
                                    onChange={(rows) => patch((d) => {
                                        d.mileageHistory = rows.map((r) => ({ date: r.date ?? '', mileage: r.mileage ?? '', source: r.source ?? '' }))
                                    })}
                                />
                            </SectionCard>

                            <SectionCard title="Keepers & searches" icon={Users}>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <Field label="Number of previous keepers" value={data.previousKeepers ?? ''}
                                        onChange={(v) => patch((d) => { d.previousKeepers = v })} />
                                    <Field label="Last keeper change" value={data.lastKeeperChange ?? ''} placeholder="14 May 2015"
                                        onChange={(v) => patch((d) => { d.lastKeeperChange = v })} />
                                </div>
                                <RowEditor
                                    rows={data.previousSearches.map((r) => ({ type: r.type, date: r.date }))}
                                    columns={[
                                        { key: 'type', label: 'Search type', placeholder: 'Motor Trade & Other' },
                                        { key: 'date', label: 'Date', placeholder: '25 July 2026' },
                                    ]}
                                    blank={{ type: 'Motor Trade & Other', date: '' }}
                                    addLabel="Add previous search"
                                    onChange={(rows) => patch((d) => {
                                        d.previousSearches = rows.map((r) => ({ type: r.type ?? '', date: r.date ?? '' }))
                                    })}
                                />
                            </SectionCard>
                        </>
                    )}
                </div>

                {mode === 'form' && data && (
                    <div className="shrink-0 p-5 border-t border-[var(--border-default)] flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save &amp; complete report
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-3 rounded-xl border border-[var(--border-default)] text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
