import React from "react"
import Link from "next/link"
import { LucideIcon } from "lucide-react"

export interface MetricCardProps {
    label: string
    value: string | number
    icon: LucideIcon
    color: string
    bg: string
    border: string
    statusLabel?: string
    foilValue?: boolean
    loading?: boolean
    href?: string
    subLabel?: string
}

export function MetricCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
    border,
    statusLabel,
    foilValue = false,
    loading = false,
    href,
    subLabel,
}: MetricCardProps) {
    // Long formatted values (e.g. "£101,600.00") outgrow a fixed text-3xl on
    // narrower cards and butt right up against the card's edge — step the
    // size down as the string gets longer instead of letting it overflow.
    const valueStr = loading ? "..." : String(value)
    const sizeClass = valueStr.length > 12 ? "text-xl" : valueStr.length > 9 ? "text-2xl" : "text-3xl"

    const inner = (
        <>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2 rounded-lg border ${bg} ${border}`}>
                    <Icon size={18} className={color} />
                </div>
                {statusLabel && (
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        {statusLabel}
                    </span>
                )}
            </div>
            <h3 className={`${sizeClass} font-black font-heading relative z-10 truncate ${foilValue ? "metallic-foil" : ""}`} style={!foilValue ? { color: 'var(--text-primary)' } : undefined}>
                {valueStr}
            </h3>
            {subLabel && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5 uppercase tracking-widest font-bold relative z-10">
                    {subLabel}
                </p>
            )}
            <p className="text-[var(--text-muted)] text-xs mt-1 uppercase tracking-widest font-bold relative z-10">{label}</p>
            {/* Synthetic Sparkline */}
            <svg className="absolute bottom-0 left-0 w-full h-12 opacity-20 pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill="currentColor" className={color} />
            </svg>
        </>
    )

    if (href) {
        return (
            <Link href={href} className={`dealer-glass-card p-6 relative overflow-hidden group block hover:border-primary/30 transition-colors cursor-pointer`}>
                {inner}
            </Link>
        )
    }

    return (
        <div className="dealer-glass-card p-6 relative overflow-hidden group">
            {inner}
        </div>
    )
}
