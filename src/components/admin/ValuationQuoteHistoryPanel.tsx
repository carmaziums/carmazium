"use client"

import * as React from "react"
import { Archive, Search, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react"
import { getValuationQuoteHistory, type ValuationQuoteHistory } from "@/lib/adminApi"

const money = (value: number | null) =>
    value == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value)

/** Only rendered inside the existing ADMIN-restricted analytics page. */
export function ValuationQuoteHistoryPanel() {
    const [search, setSearch] = React.useState("")
    const [term, setTerm] = React.useState("")
    const [page, setPage] = React.useState(1)
    const [data, setData] = React.useState<ValuationQuoteHistory | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        let valid = true
        setLoading(true)
        setError(null)
        getValuationQuoteHistory(term, page).then(result => {
            if (valid) setData(result)
        }).catch(err => {
            if (valid) setError(err?.message || "Unable to load archived quotes")
        }).finally(() => {
            if (valid) setLoading(false)
        })
        return () => { valid = false }
    }, [term, page])

    return (
        <section className="rounded-2xl border border-amber-500/25 bg-[var(--bg-card)] overflow-hidden">
            <div className="flex flex-col gap-4 p-5 border-b border-[var(--border-default)] bg-gradient-to-r from-amber-500/10 to-teal-500/10">
                <div className="flex items-center gap-2">
                    <Archive size={20} className="text-amber-500" />
                    <h2 className="text-lg font-black text-[var(--text-primary)]">12-Month Vehicle Valuation History</h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                    Search every recorded quote by registration, make or model. Compare past CarMazium suggestions by vehicle year, with a separate count of distinct registrations. Earlier quotes are estimates, not actual sales.
                </p>
                <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setTerm(search.trim()) }}>
                    <label className="sr-only" htmlFor="quote-history-search">Search vehicle quotations</label>
                    <input
                        id="quote-history-search"
                        type="search"
                        className="min-w-0 flex-1 rounded-xl px-4 py-2.5 border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)]"
                        placeholder="Search registration, e.g. SD70XRP, or Mercedes GLB"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        maxLength={60}
                    />
                    <button type="submit" className="inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400">
                        <Search size={15} /> Search 12 months
                    </button>
                </form>
            </div>

            {error && <p className="p-4 text-sm text-red-500" role="alert">{error}</p>}
            {loading && <p className="p-4 text-sm text-[var(--text-muted)]">Loading quote history…</p>}
            {!loading && data && (
                <div className="space-y-5 p-4">
                    <p className="text-xs text-[var(--text-muted)]">{data.note}</p>
                    {data.byModel.length > 0 && (
                        <div>
                            <h3 className="flex items-center gap-2 mb-3 text-sm font-bold text-[var(--text-primary)]">
                                <TrendingUp size={16} className="text-teal-500" /> Historical quote comparison by model and year
                            </h3>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {data.byModel.slice(0, 9).map((m, index) => (
                                    <div key={index} className="rounded-xl p-3 border border-[var(--border-default)] bg-[var(--bg-input)]">
                                        <p className="font-bold text-sm">{m.year || "Unknown year"} {m.make} {m.model}</p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">{m.quotes} quotes · {m.uniqueVehicles} distinct registrations</p>
                                        <p className="mt-2 text-xs text-[var(--text-secondary)]">Median auction quotation: <strong>{money(m.auctionMedian)}</strong></p>
                                        <p className="text-xs text-[var(--text-secondary)]">Median retail quotation: <strong>{money(m.retailMedian)}</strong></p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
                        <table className="min-w-[780px] w-full text-xs">
                            <thead className="bg-[var(--bg-input)] text-[var(--text-muted)]">
                                <tr>
                                    <th className="text-left p-3">Date</th>
                                    <th className="text-left p-3">Reg</th>
                                    <th className="text-left p-3">Vehicle</th>
                                    <th className="text-right p-3">Mileage</th>
                                    <th className="text-right p-3">Auction quote</th>
                                    <th className="text-right p-3">Retail quote</th>
                                    <th className="text-left p-3">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map(row => (
                                    <tr key={row.id} className="border-t border-[var(--border-default)] hover:bg-amber-500/5">
                                        <td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                                        <td className="p-3 font-mono font-bold">{row.registration || "—"}</td>
                                        <td className="p-3">{row.year || ""} {row.make || ""} {row.model || ""}</td>
                                        <td className="p-3 text-right">{row.mileage?.toLocaleString("en-GB") ?? "—"}</td>
                                        <td className="p-3 text-right font-bold">{money(row.auctionPrice)}</td>
                                        <td className="p-3 text-right font-bold">{money(row.retailPrice)}</td>
                                        <td className="p-3">{row.source?.replaceAll("_", " ") || "Unknown"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data.rows.length === 0 && <p className="p-5 text-center text-[var(--text-muted)]">No quotes found for this search within the last 12 months.</p>}
                    </div>
                    <div className="flex justify-end items-center gap-3">
                        <button type="button" disabled={page === 1} className="px-3 py-2 border border-[var(--border-default)] rounded-lg disabled:opacity-30" onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                        <span className="text-xs font-semibold">Page {page}</span>
                        <button type="button" disabled={!data.hasMore} className="px-3 py-2 border border-[var(--border-default)] rounded-lg disabled:opacity-30" onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </section>
    )
}
