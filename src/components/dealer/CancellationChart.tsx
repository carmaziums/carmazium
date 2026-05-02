"use client"

import * as React from "react"

interface CancellationData {
    label: string
    cancelled: number
    total: number
}

interface CancellationChartProps {
    data: CancellationData[]
    title?: string
    loading?: boolean
}

export function CancellationChart({
    data,
    title = "Cancellation Rates",
    loading = false,
}: CancellationChartProps) {
    if (loading || data.length === 0) {
        return (
            <div className="dealer-glass-card p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">{title}</h3>
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-8 bg-white/[0.02] rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const maxTotal = Math.max(...data.map((d) => d.total))

    return (
        <div className="dealer-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</h3>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500/60" /> Cancelled
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/30" /> Completed
                    </span>
                </div>
            </div>

            <div className="space-y-3">
                {data.map((item, i) => {
                    const rate = item.total > 0 ? (item.cancelled / item.total) * 100 : 0
                    const completedWidth = item.total > 0 ? ((item.total - item.cancelled) / maxTotal) * 100 : 0
                    const cancelledWidth = item.total > 0 ? (item.cancelled / maxTotal) * 100 : 0

                    return (
                        <div key={i} className="group">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">{item.label}</span>
                                <span className={`text-[11px] font-black tabular-nums ${
                                    rate > 15 ? "text-red-400" : rate > 5 ? "text-amber-400" : "text-emerald-400"
                                }`}>
                                    {rate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex h-7 gap-0.5 rounded-lg overflow-hidden bg-black/30">
                                <div
                                    className="bg-emerald-500/25 border-r border-white/5 transition-all duration-700 ease-out flex items-center justify-end pr-1.5"
                                    style={{ width: `${completedWidth}%` }}
                                >
                                    <span className="text-[9px] font-bold text-emerald-400/80 tabular-nums">
                                        {item.total - item.cancelled}
                                    </span>
                                </div>
                                <div
                                    className="bg-red-500/30 transition-all duration-700 ease-out flex items-center justify-end pr-1.5"
                                    style={{ width: `${cancelledWidth}%` }}
                                >
                                    {cancelledWidth > 5 && (
                                        <span className="text-[9px] font-bold text-red-400/80 tabular-nums">
                                            {item.cancelled}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
