"use client"

import * as React from "react"
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"

export interface KPIMetric {
    id: string
    label: string
    value: string | number
    prefix?: string
    suffix?: string
    icon: LucideIcon
    trend?: number // percentage change
    trendLabel?: string
    accentColor: string // tailwind color class like "text-emerald-400"
    accentBg: string
    accentBorder: string
}

interface KPIGridProps {
    metrics: KPIMetric[]
    loading?: boolean
    columns?: number
}

function KPICard({ metric, loading }: { metric: KPIMetric; loading?: boolean }) {
    const { label, value, prefix, suffix, icon: Icon, trend, trendLabel, accentColor, accentBg, accentBorder } = metric

    const trendPositive = trend && trend > 0
    const trendNegative = trend && trend < 0
    const TrendIcon = trendPositive ? TrendingUp : trendNegative ? TrendingDown : Minus

    return (
        <div className="dealer-glass-card p-5 group relative overflow-hidden">
            {/* Ambient glow */}
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 ${accentBg}`} />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl border ${accentBg} ${accentBorder} shadow-lg`}>
                    <Icon size={16} className={accentColor} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                        trendPositive ? "bg-emerald-500/10 text-emerald-400" :
                        trendNegative ? "bg-red-500/10 text-red-400" :
                        "bg-gray-500/10 text-gray-400"
                    }`}>
                        <TrendIcon size={10} />
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <h3 className="text-3xl font-black font-heading text-white tracking-tight leading-none">
                    {loading ? (
                        <span className="inline-block w-20 h-8 bg-white/5 rounded-lg animate-pulse" />
                    ) : (
                        <>
                            {prefix && <span className="text-lg text-gray-400 font-bold mr-0.5">{prefix}</span>}
                            <span className="metallic-foil">{value}</span>
                            {suffix && <span className="text-base text-gray-500 font-bold ml-1">{suffix}</span>}
                        </>
                    )}
                </h3>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-gray-400 text-xs uppercase tracking-[0.15em] font-bold">{label}</p>
                    {trendLabel && (
                        <span className="text-xs text-gray-600 font-medium">{trendLabel}</span>
                    )}
                </div>
            </div>

            {/* Bottom sparkline accent */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className={`h-full bg-gradient-to-r from-transparent ${accentColor.replace("text-", "via-")} to-transparent`} />
            </div>
        </div>
    )
}

export function KPIGrid({ metrics, loading = false, columns = 5 }: KPIGridProps) {
    const gridClass = columns === 5
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        : columns === 4
        ? "grid-cols-2 md:grid-cols-4"
        : columns === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-2"

    return (
        <div className={`grid ${gridClass} gap-4`}>
            {metrics.map((metric) => (
                <KPICard key={metric.id} metric={metric} loading={loading} />
            ))}
        </div>
    )
}
