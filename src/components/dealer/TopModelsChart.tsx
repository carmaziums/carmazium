"use client"

import * as React from "react"
import { Car } from "lucide-react"

interface ModelRow {
    make: string
    model: string
    units: number
    revenue: number
    avgPrice: number
}

interface Props {
    data: ModelRow[]
    title?: string
}

function formatPrice(v: number): string {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `£${(v / 1_000).toFixed(1)}k`
    return `£${v.toFixed(0)}`
}

export function TopModelsChart({ data, title = "Top Selling Models" }: Props) {
    const maxUnits = Math.max(...data.map(r => r.units), 1)

    return (
        <div className="dealer-glass-card overflow-hidden">
            <div className="p-5 border-b border-[var(--border-default)] bg-black/20">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">{title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">Ranked by units sold in selected period</p>
            </div>

            {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Car size={32} className="text-gray-700" />
                    <p className="text-xs text-[var(--text-muted)] font-bold">No sales data for this period</p>
                </div>
            ) : (
                <div className="divide-y divide-white/[0.03]">
                    {data.map((row, i) => {
                        const barPct = (row.units / maxUnits) * 100
                        return (
                            <div key={`${row.make}-${row.model}`} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                <span className={`text-xs font-black tabular-nums w-5 shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-[var(--text-secondary)]' : i === 2 ? 'text-amber-600' : 'text-[var(--text-muted)]'}`}>
                                    {i + 1}
                                </span>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {row.make} {row.model}
                                        </span>
                                        <span className="text-xs font-black text-[var(--text-muted)] tabular-nums ml-2 shrink-0">
                                            {row.units} sold
                                        </span>
                                    </div>
                                    <div className="relative h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-700"
                                            style={{ width: `${barPct}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="text-right shrink-0 hidden sm:block">
                                    <p className="text-sm font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatPrice(row.revenue)}</p>
                                    <p className="text-xs text-[var(--text-muted)] font-medium">avg {formatPrice(row.avgPrice)}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
