"use client"

import * as React from "react"

interface LeadFunnelData {
    NEW: number
    CONTACTED: number
    QUALIFIED: number
    NEGOTIATING: number
    WON: number
    LOST: number
}

interface LeadFunnelChartProps {
    data: LeadFunnelData
    title?: string
    loading?: boolean
}

const STAGES = [
    { key: "NEW", label: "New Leads", color: "from-blue-500 to-blue-600", barColor: "bg-blue-500", textColor: "text-blue-400", borderColor: "border-blue-500/20" },
    { key: "CONTACTED", label: "Contacted", color: "from-cyan-500 to-cyan-600", barColor: "bg-cyan-500", textColor: "text-cyan-400", borderColor: "border-cyan-500/20" },
    { key: "QUALIFIED", label: "Qualified", color: "from-violet-500 to-violet-600", barColor: "bg-violet-500", textColor: "text-violet-400", borderColor: "border-violet-500/20" },
    { key: "NEGOTIATING", label: "Negotiating", color: "from-amber-500 to-amber-600", barColor: "bg-amber-500", textColor: "text-amber-400", borderColor: "border-amber-500/20" },
    { key: "WON", label: "Won", color: "from-emerald-500 to-emerald-600", barColor: "bg-emerald-500", textColor: "text-emerald-400", borderColor: "border-emerald-500/20" },
    { key: "LOST", label: "Lost", color: "from-red-500 to-red-600", barColor: "bg-red-500", textColor: "text-red-400", borderColor: "border-red-500/20" },
] as const

export function LeadFunnelChart({
    data,
    title = "Lead Conversion Funnel",
    loading = false,
}: LeadFunnelChartProps) {
    const [hoveredStage, setHoveredStage] = React.useState<string | null>(null)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100)
        return () => clearTimeout(timer)
    }, [])

    if (loading) {
        return (
            <div className="dealer-glass-card p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">{title}</h3>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const total = Object.values(data).reduce((s, v) => s + v, 0)
    const maxCount = Math.max(...Object.values(data), 1)

    // Calculate conversion from previous stage
    const stageValues = STAGES.map(s => data[s.key as keyof LeadFunnelData] || 0)

    return (
        <div className="dealer-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total</span>
                    <span className="text-sm font-black text-white">{total}</span>
                </div>
            </div>

            <div className="space-y-3">
                {STAGES.map((stage, i) => {
                    const count = data[stage.key as keyof LeadFunnelData] || 0
                    const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0
                    const convFromPrev = i > 0 && stageValues[i - 1] > 0
                        ? Math.round((count / stageValues[i - 1]) * 100)
                        : null
                    const isHovered = hoveredStage === stage.key

                    return (
                        <div
                            key={stage.key}
                            className="group cursor-pointer"
                            onMouseEnter={() => setHoveredStage(stage.key)}
                            onMouseLeave={() => setHoveredStage(null)}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isHovered ? stage.textColor : 'text-gray-300'} transition-colors`}>
                                        {stage.label}
                                    </span>
                                    {convFromPrev !== null && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                            stage.key === 'LOST'
                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                : 'bg-white/5 text-gray-500 border border-white/5'
                                        }`}>
                                            {convFromPrev}% from prev
                                        </span>
                                    )}
                                </div>
                                <span className={`text-sm font-black tabular-nums ${stage.textColor}`}>
                                    {count}
                                </span>
                            </div>
                            <div className="relative h-8 rounded-lg overflow-hidden bg-black/30">
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r ${stage.color} transition-all duration-700 ease-out ${isHovered ? 'opacity-100' : 'opacity-60'}`}
                                    style={{ width: mounted ? `${widthPct}%` : '0%' }}
                                />
                                {/* Animated shine on hover */}
                                {isHovered && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer-sweep" />
                                )}
                                {/* Count inside bar */}
                                {widthPct > 15 && (
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3" style={{ width: `${widthPct}%` }}>
                                        <span className="text-[10px] font-black text-white/90 tabular-nums">
                                            {total > 0 ? Math.round((count / total) * 100) : 0}% of total
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Win/Loss Summary Bar */}
            {(data.WON > 0 || data.LOST > 0) && (
                <div className="mt-5 pt-5 border-t border-white/5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                        <span className="text-gray-500">Outcome Split</span>
                        <span className="text-gray-500">{data.WON + data.LOST} resolved</span>
                    </div>
                    <div className="flex h-3 gap-0.5 rounded-full overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-l-full transition-all duration-700"
                            style={{ width: `${(data.WON / (data.WON + data.LOST)) * 100}%` }}
                        />
                        <div
                            className="bg-gradient-to-r from-red-500 to-red-600 rounded-r-full transition-all duration-700"
                            style={{ width: `${(data.LOST / (data.WON + data.LOST)) * 100}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-black text-emerald-400">{data.WON} Won ({Math.round((data.WON / (data.WON + data.LOST)) * 100)}%)</span>
                        <span className="text-[10px] font-black text-red-400">{data.LOST} Lost ({Math.round((data.LOST / (data.WON + data.LOST)) * 100)}%)</span>
                    </div>
                </div>
            )}
        </div>
    )
}
