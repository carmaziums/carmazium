"use client"

import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface DataPoint {
    label: string
    value: number
}

interface BidVolumeChartProps {
    data: DataPoint[]
    height?: number
    lineColor?: string
    fillColor?: string
    title?: string
    subtitle?: string
    loading?: boolean
}

export function BidVolumeChart({
    data,
    height = 240,
    lineColor = "#ed1c24",
    fillColor = "rgba(237, 28, 36, 0.08)",
    title = "Bid Volume",
    subtitle,
    loading = false,
}: BidVolumeChartProps) {
    const svgRef = React.useRef<SVGSVGElement>(null)
    const [tooltip, setTooltip] = React.useState<{ x: number; y: number; point: DataPoint } | null>(null)
    const [dimensions, setDimensions] = React.useState({ width: 600, height })

    React.useEffect(() => {
        const container = svgRef.current?.parentElement
        if (!container) return
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({ width: entry.contentRect.width, height })
            }
        })
        observer.observe(container)
        return () => observer.disconnect()
    }, [height])

    if (loading || data.length === 0) {
        return (
            <div className="dealer-glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
                        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                <div className="animate-pulse" style={{ height }}>
                    <div className="w-full h-full bg-white/[0.02] rounded-xl" />
                </div>
            </div>
        )
    }

    const pad = { top: 20, right: 16, bottom: 40, left: 50 }
    const w = dimensions.width - pad.left - pad.right
    const h = dimensions.height - pad.top - pad.bottom

    const maxVal = Math.max(...data.map((d) => d.value))
    const minVal = Math.min(...data.map((d) => d.value))
    const range = maxVal - minVal || 1

    const points = data.map((d, i) => ({
        x: pad.left + (i / (data.length - 1)) * w,
        y: pad.top + h - ((d.value - minVal) / range) * h,
        ...d,
    }))

    // Build smooth SVG path
    const pathD = points
        .map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`
            const prev = points[i - 1]
            const cpx = (prev.x + p.x) / 2
            return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
        })
        .join(" ")

    const areaD = `${pathD} L ${points[points.length - 1].x} ${pad.top + h} L ${points[0].x} ${pad.top + h} Z`

    // Y-axis labels
    const yTicks = 5
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
        const val = minVal + (range / (yTicks - 1)) * i
        return { val: Math.round(val), y: pad.top + h - (i / (yTicks - 1)) * h }
    })

    // Overall trend
    const trendPct = data.length >= 2
        ? ((data[data.length - 1].value - data[0].value) / (data[0].value || 1)) * 100
        : 0

    return (
        <div className="dealer-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
                    {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    trendPct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                }`}>
                    {trendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(trendPct).toFixed(1)}%
                </div>
            </div>

            <div className="relative" style={{ height }}>
                <svg
                    ref={svgRef}
                    width="100%"
                    height={dimensions.height}
                    className="overflow-visible"
                    onMouseLeave={() => setTooltip(null)}
                >
                    {/* Grid lines */}
                    {yLabels.map(({ val, y }) => (
                        <g key={val}>
                            <line
                                x1={pad.left}
                                y1={y}
                                x2={pad.left + w}
                                y2={y}
                                stroke="var(--border-default)"
                                strokeDasharray="4 4"
                            />
                            <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize={10} fontWeight={600}>
                                {val}
                            </text>
                        </g>
                    ))}

                    {/* Area fill */}
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path d={areaD} fill="url(#areaGrad)" />

                    {/* Line */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: `drop-shadow(0 0 6px ${lineColor}40)` }}
                    />

                    {/* Data points & hover zones */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r={3.5} fill={lineColor} stroke="#0f172a" strokeWidth={2} />
                            <rect
                                x={p.x - 20}
                                y={pad.top}
                                width={40}
                                height={h}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setTooltip({ x: p.x, y: p.y, point: { label: p.label, value: p.value } })}
                            />
                        </g>
                    ))}

                    {/* X-axis labels (show every other one if crowded) */}
                    {points.map((p, i) => {
                        const showEvery = data.length > 14 ? 3 : data.length > 7 ? 2 : 1
                        if (i % showEvery !== 0 && i !== data.length - 1) return null
                        return (
                            <text
                                key={i}
                                x={p.x}
                                y={pad.top + h + 24}
                                textAnchor="middle"
                                fill="var(--text-muted)"
                                fontSize={9}
                                fontWeight={700}
                                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                            >
                                {p.label}
                            </text>
                        )
                    })}
                </svg>

                {/* Tooltip */}
                {tooltip && (
                    <div
                        className="absolute pointer-events-none z-20 bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-lg px-3 py-2 shadow-xl backdrop-blur-lg transition-all duration-150"
                        style={{
                            left: tooltip.x,
                            top: tooltip.y - 50,
                            transform: "translateX(-50%)",
                        }}
                    >
                        <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-bold">{tooltip.point.label}</p>
                        <p className="font-black text-lg">{tooltip.point.value}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
