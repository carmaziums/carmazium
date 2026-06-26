"use client"

import * as React from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface RevenueDataPoint {
    month: string
    revenue: number
    unitsSold: number
}

interface RevenueAreaChartProps {
    data: RevenueDataPoint[]
    height?: number
    title?: string
    subtitle?: string
    loading?: boolean
}

export function RevenueAreaChart({
    data,
    height = 280,
    title = "Revenue & Sales Trend",
    subtitle,
    loading = false,
}: RevenueAreaChartProps) {
    const svgRef = React.useRef<SVGSVGElement>(null)
    const [tooltip, setTooltip] = React.useState<{
        x: number; y: number; point: RevenueDataPoint
    } | null>(null)
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
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</h3>
                        {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                <div className="animate-pulse" style={{ height }}>
                    <div className="w-full h-full bg-white/[0.02] rounded-xl" />
                </div>
            </div>
        )
    }

    const pad = { top: 24, right: 60, bottom: 44, left: 60 }
    const w = dimensions.width - pad.left - pad.right
    const h = dimensions.height - pad.top - pad.bottom

    // Revenue line
    const maxRev = Math.max(...data.map((d) => d.revenue), 1)
    const minRev = Math.min(...data.map((d) => d.revenue))
    const revRange = maxRev - minRev || 1

    // Units bars
    const maxUnits = Math.max(...data.map((d) => d.unitsSold), 1)

    const revenuePoints = data.map((d, i) => ({
        x: pad.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w),
        y: pad.top + h - ((d.revenue - minRev) / revRange) * h,
        ...d,
    }))

    // Build smooth SVG path for revenue
    const pathD = revenuePoints
        .map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`
            const prev = revenuePoints[i - 1]
            const cpx = (prev.x + p.x) / 2
            return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
        })
        .join(" ")

    const areaD = `${pathD} L ${revenuePoints[revenuePoints.length - 1].x} ${pad.top + h} L ${revenuePoints[0].x} ${pad.top + h} Z`

    // Y-axis labels (Revenue)
    const yTicks = 5
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
        const val = minRev + (revRange / (yTicks - 1)) * i
        return { val, y: pad.top + h - (i / (yTicks - 1)) * h }
    })

    // Right Y-axis labels (Units)
    const yUnitsLabels = Array.from({ length: yTicks }, (_, i) => {
        const val = (maxUnits / (yTicks - 1)) * i
        return { val: Math.round(val), y: pad.top + h - (i / (yTicks - 1)) * h }
    })

    // Bar dimensions
    const barWidth = Math.max(12, Math.min(40, w / data.length * 0.5))

    // Overall trend
    const trendPct = data.length >= 2
        ? ((data[data.length - 1].revenue - data[0].revenue) / (data[0].revenue || 1)) * 100
        : 0

    function formatCurrency(val: number): string {
        if (val >= 1000000) return `£${(val / 1000000).toFixed(1)}M`
        if (val >= 1000) return `£${(val / 1000).toFixed(0)}k`
        return `£${val.toFixed(0)}`
    }

    function formatMonth(ym: string): string {
        const [year, month] = ym.split('-')
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${months[parseInt(month) - 1]} ${year.slice(2)}`
    }

    return (
        <div className="dealer-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</h3>
                    {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-4">
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-[2px] bg-emerald-400 rounded-full" /> Revenue
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40" /> Units
                        </span>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                        trendPct >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                        {trendPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trendPct).toFixed(1)}%
                    </div>
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
                    {yLabels.map(({ val, y }, i) => (
                        <g key={i}>
                            <line
                                x1={pad.left}
                                y1={y}
                                x2={pad.left + w}
                                y2={y}
                                stroke="rgba(255,255,255,0.04)"
                                strokeDasharray="4 4"
                            />
                            <text x={pad.left - 8} y={y + 3} textAnchor="end" fill="#4b5563" fontSize={9} fontWeight={700}>
                                {formatCurrency(val)}
                            </text>
                        </g>
                    ))}

                    {/* Right Y-axis labels (Units) */}
                    {yUnitsLabels.map(({ val, y }, i) => (
                        <text key={`units-${i}`} x={pad.left + w + 8} y={y + 3} textAnchor="start" fill="#6366f1" fontSize={9} fontWeight={700} opacity={0.5}>
                            {val}
                        </text>
                    ))}

                    {/* Unit bars */}
                    {data.map((d, i) => {
                        const barH = (d.unitsSold / maxUnits) * h
                        const barX = pad.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w) - barWidth / 2
                        const barY = pad.top + h - barH
                        return (
                            <rect
                                key={`bar-${i}`}
                                x={barX}
                                y={barY}
                                width={barWidth}
                                height={barH}
                                rx={4}
                                fill="rgba(59, 130, 246, 0.15)"
                                stroke="rgba(59, 130, 246, 0.25)"
                                strokeWidth={1}
                            />
                        )
                    })}

                    {/* Revenue area fill */}
                    <defs>
                        <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <path d={areaD} fill="url(#revAreaGrad)" />

                    {/* Revenue line */}
                    <path
                        d={pathD}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.25))" }}
                    />

                    {/* Data points & hover zones */}
                    {revenuePoints.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r={4} fill="#10b981" stroke="#0f172a" strokeWidth={2} />
                            <rect
                                x={p.x - 20}
                                y={pad.top}
                                width={40}
                                height={h}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setTooltip({ x: p.x, y: p.y, point: data[i] })}
                            />
                        </g>
                    ))}

                    {/* X-axis labels */}
                    {revenuePoints.map((p, i) => {
                        const showEvery = data.length > 12 ? 3 : data.length > 6 ? 2 : 1
                        if (i % showEvery !== 0 && i !== data.length - 1) return null
                        return (
                            <text
                                key={i}
                                x={p.x}
                                y={pad.top + h + 24}
                                textAnchor="middle"
                                fill="#4b5563"
                                fontSize={9}
                                fontWeight={700}
                                style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
                            >
                                {formatMonth(p.month)}
                            </text>
                        )
                    })}
                </svg>

                {/* Tooltip */}
                {tooltip && (
                    <div
                        className="absolute pointer-events-none z-20 bg-slate-800/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl backdrop-blur-lg transition-all duration-150"
                        style={{
                            left: tooltip.x,
                            top: tooltip.y - 75,
                            transform: "translateX(-50%)",
                        }}
                    >
                        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">{formatMonth(tooltip.point.month)}</p>
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-emerald-400 font-black text-lg leading-none">{formatCurrency(tooltip.point.revenue)}</p>
                                <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">Revenue</p>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div>
                                <p className="text-blue-400 font-black text-lg leading-none">{tooltip.point.unitsSold}</p>
                                <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">Units</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
