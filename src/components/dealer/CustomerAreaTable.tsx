"use client"

import * as React from "react"
import { MapPin } from "lucide-react"

interface AreaRow { postcode: string; count: number; revenue: number }

interface Props {
    data: AreaRow[]
    title?: string
}

function formatPrice(v: number): string {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `£${(v / 1_000).toFixed(1)}k`
    return `£${v.toFixed(0)}`
}

export function CustomerAreaTable({ data, title = "Customers by Area" }: Props) {
    const maxCount = Math.max(...data.map(r => r.count), 1)

    return (
        <div className="dealer-glass-card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-default)] bg-black/20 flex items-center gap-2">
                <MapPin size={14} className="text-rose-400" />
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
                    <p className="text-xs text-[var(--text-muted)] font-medium">UK postcode areas (set when closing a deal)</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <MapPin size={28} className="text-gray-700" />
                    <p className="text-xs text-[var(--text-muted)] font-bold text-center px-4">
                        No postcode data yet.<br />
                        <span className="text-gray-700 font-medium">Buyer postcodes can be recorded when closing deals.</span>
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-white/[0.03]">
                    {data.map((row, i) => {
                        const barPct = (row.count / maxCount) * 100
                        return (
                            <div key={row.postcode} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                                <span className={`text-xs font-black tabular-nums w-4 shrink-0 ${i === 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
                                    {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-black">{row.postcode}</span>
                                        <span className="text-xs font-bold text-[var(--text-muted)] tabular-nums ml-2">{row.count} sale{row.count !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="relative h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-rose-500/70 rounded-full transition-all duration-700"
                                            style={{ width: `${barPct}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="text-xs font-black  tabular-nums shrink-0">{formatPrice(row.revenue)}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
