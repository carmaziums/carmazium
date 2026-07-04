import * as React from "react"
import { Zap } from "lucide-react"

interface FeaturedBadgeProps {
    /** If true, shows a smaller inline pill variant. Default: false (card overlay). */
    compact?: boolean
    daysRemaining?: number
}

/**
 * Reusable Featured Listing badge.
 * Card variant: absolute-positioned overlay for listing cards.
 * Compact variant: small inline pill for table rows.
 */
export function FeaturedBadge({ compact = false, daysRemaining }: FeaturedBadgeProps) {
    if (compact) {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider border border-amber-400/50 bg-amber-400/10 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.15)] flex-shrink-0"
            >
                <Zap size={10} className="fill-amber-400 text-amber-400" />
                FEATURED
                {daysRemaining !== undefined && (
                    <span className="ml-1 font-bold text-amber-300">
                        {daysRemaining}D LEFT
                    </span>
                )}
            </span>
        )
    }

    return (
        <div
            className="absolute top-0 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-b-lg text-[11px] font-black tracking-wide text-[#1A1A1A] select-none shadow-[0_4px_20px_rgba(245,158,11,0.5)]"
            style={{
                background: "linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)",
                transform: "translateZ(50px)"
            }}
        >
            <Zap size={12} className="fill-[#1A1A1A] text-[#1A1A1A]" />
            FEATURED
        </div>
    )
}
