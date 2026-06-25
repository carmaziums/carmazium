"use client"

import * as React from "react"

interface SourceRow { source: string; count: number }

interface Props {
    data: SourceRow[]
    title?: string
}

const SOURCE_COLORS: Record<string, string> = {
    listing_enquiry: "#3b82f6",
    chat: "#8b5cf6",
    offer: "#10b981",
    walk_in: "#f59e0b",
    phone: "#06b6d4",
    unknown: "#6b7280",
}

const SOURCE_LABELS: Record<string, string> = {
    listing_enquiry: "Listing Enquiry",
    chat: "Chat",
    offer: "Offer",
    walk_in: "Walk In",
    phone: "Phone",
    unknown: "Unknown",
}

export function LeadSourceChart({ data, title = "Lead Sources" }: Props) {
    const [hovered, setHovered] = React.useState<string | null>(null)
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t) }, [])

    const total = data.reduce((s, r) => s + r.count, 0)

    const size = 160
    const strokeWidth = 24
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const center = size / 2

    let cumulativeOffset = 0
    const arcs = data.map(row => {
        const color = SOURCE_COLORS[row.source] ?? "#6b7280"
        const pct = total > 0 ? row.count / total : 0
        const dashLength = pct * circumference
        const dashOffset = circumference - cumulativeOffset
        cumulativeOffset += dashLength
        return { ...row, color, pct, dashLength, dashOffset }
    })

    return (
        <div className="dealer-glass-card p-5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">{title}</h3>

            {total === 0 ? (
                <p className="text-xs text-gray-600 font-bold text-center py-8">No leads yet</p>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                            <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
                            {arcs.map(arc => (
                                <circle
                                    key={arc.source}
                                    cx={center} cy={center} r={radius}
                                    fill="none"
                                    stroke={arc.color}
                                    strokeWidth={hovered === arc.source ? strokeWidth + 3 : strokeWidth}
                                    strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                                    strokeDashoffset={mounted ? arc.dashOffset : circumference}
                                    strokeLinecap="round"
                                    transform={`rotate(-90 ${center} ${center})`}
                                    className="transition-all duration-700 cursor-pointer"
                                    onMouseEnter={() => setHovered(arc.source)}
                                    onMouseLeave={() => setHovered(null)}
                                />
                            ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black metallic-foil">{total}</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Total Leads</span>
                        </div>
                    </div>

                    <div className="w-full mt-4 space-y-1.5">
                        {arcs.map(arc => (
                            <div
                                key={arc.source}
                                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all ${hovered === arc.source ? 'bg-white/5' : ''}`}
                                onMouseEnter={() => setHovered(arc.source)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: arc.color }} />
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                        {SOURCE_LABELS[arc.source] ?? arc.source}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-600 font-medium">{Math.round(arc.pct * 100)}%</span>
                                    <span className="text-xs font-black text-white tabular-nums">{arc.count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
