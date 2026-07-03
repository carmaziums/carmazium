"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

interface InventoryHealthData {
    DRAFT: number
    ACTIVE: number
    OFFER_ACCEPTED: number
    SOLD: number
    WITHDRAWN: number
    avgAge: number
    staleCount: number
    agingBuckets: {
        '0-7d': number
        '8-30d': number
        '31-60d': number
        '60d+': number
    }
}

interface InventoryAgingChartProps {
    data: InventoryHealthData
    title?: string
    loading?: boolean
}

const STATUS_CONFIG = [
    { key: "ACTIVE", label: "Active", color: "bg-emerald-500", textColor: "text-emerald-400", dotColor: "#10b981" },
    { key: "DRAFT", label: "Draft", color: "bg-gray-500", textColor: "text-[var(--text-muted)]", dotColor: "#6b7280" },
    { key: "OFFER_ACCEPTED", label: "Offer Accepted", color: "bg-amber-500", textColor: "text-amber-400", dotColor: "#f59e0b" },
    { key: "SOLD", label: "Sold", color: "bg-blue-500", textColor: "text-blue-400", dotColor: "#3b82f6" },
    { key: "WITHDRAWN", label: "Withdrawn", color: "bg-red-500", textColor: "text-red-400", dotColor: "#ef4444" },
] as const

const BUCKET_CONFIG = [
    { key: "0-7d", label: "Fresh (0-7d)", color: "bg-emerald-500", barColor: "from-emerald-500 to-emerald-600" },
    { key: "8-30d", label: "Normal (8-30d)", color: "bg-blue-500", barColor: "from-blue-500 to-blue-600" },
    { key: "31-60d", label: "Aging (31-60d)", color: "bg-amber-500", barColor: "from-amber-500 to-amber-600" },
    { key: "60d+", label: "Stale (60d+)", color: "bg-red-500", barColor: "from-red-500 to-red-600" },
] as const

export function InventoryAgingChart({
    data,
    title = "Inventory Health",
    loading = false,
}: InventoryAgingChartProps) {
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100)
        return () => clearTimeout(timer)
    }, [])

    if (loading) {
        return (
            <div className="dealer-glass-card p-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] mb-6">{title}</h3>
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    const totalStock = STATUS_CONFIG.reduce((sum, s) => sum + (data[s.key as keyof InventoryHealthData] as number || 0), 0)
    const totalActive = data.ACTIVE || 0
    const totalAging = Object.values(data.agingBuckets).reduce((s, v) => s + v, 0)
    const maxBucket = Math.max(...Object.values(data.agingBuckets), 1)

    return (
        <div className="dealer-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
                {data.staleCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                        <AlertTriangle size={12} />
                        <span className="text-xs font-bold">{data.staleCount} stale</span>
                    </div>
                )}
            </div>

            {/* Status Distribution Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Stock Distribution</span>
                    <span className="text-xs font-bold text-[var(--text-muted)]">{totalStock} total</span>
                </div>
                <div className="flex h-5 gap-0.5 rounded-lg overflow-hidden">
                    {STATUS_CONFIG.map((status) => {
                        const count = data[status.key as keyof InventoryHealthData] as number || 0
                        const pct = totalStock > 0 ? (count / totalStock) * 100 : 0
                        if (pct < 1) return null
                        return (
                            <div
                                key={status.key}
                                className={`${status.color} transition-all duration-700 ease-out relative group`}
                                style={{ width: mounted ? `${pct}%` : '0%' }}
                                title={`${status.label}: ${count}`}
                            >
                                {pct > 10 && (
                                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white/90">
                                        {count}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                    {STATUS_CONFIG.map((status) => {
                        const count = data[status.key as keyof InventoryHealthData] as number || 0
                        return (
                            <div key={status.key} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: status.dotColor }} />
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{status.label}</span>
                                <span className={`text-xs font-black ${status.textColor}`}>{count}</span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Aging Heatmap Bars */}
            <div className="pt-5 border-t border-[var(--border-default)]">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Active Listing Age</span>
                    <span className="text-xs font-bold text-[var(--text-muted)]">Avg {data.avgAge}d</span>
                </div>
                <div className="space-y-2.5">
                    {BUCKET_CONFIG.map((bucket) => {
                        const count = data.agingBuckets[bucket.key as keyof typeof data.agingBuckets] || 0
                        const widthPct = maxBucket > 0 ? (count / maxBucket) * 100 : 0
                        const pctOfTotal = totalAging > 0 ? Math.round((count / totalAging) * 100) : 0

                        return (
                            <div key={bucket.key}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-[var(--text-muted)]">{bucket.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-[var(--text-muted)]">{pctOfTotal}%</span>
                                        <span className="text-[11px] font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>{count}</span>
                                    </div>
                                </div>
                                <div className="h-6 rounded-md overflow-hidden bg-black/30">
                                    <div
                                        className={`h-full rounded-md bg-gradient-to-r ${bucket.barColor} transition-all duration-700 ease-out opacity-70`}
                                        style={{ width: mounted ? `${Math.max(widthPct, count > 0 ? 3 : 0)}%` : '0%' }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
