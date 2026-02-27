"use client"

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
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border border-amber-400/40 bg-amber-400/10 text-amber-400"
                style={{ animation: "featuredPulse 2.5s ease-in-out infinite" }}
            >
                <Zap size={10} className="fill-amber-400 text-amber-400" />
                FEATURED
                {daysRemaining !== undefined && (
                    <span className="ml-1 font-normal text-amber-300/70 text-[10px]">
                        {daysRemaining}d left
                    </span>
                )}
                <style>{`
                    @keyframes featuredPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.0); }
                        50% { box-shadow: 0 0 8px 2px rgba(251,191,36,0.25); }
                    }
                `}</style>
            </span>
        )
    }

    return (
        <div
            className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-900 select-none"
            style={{
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                boxShadow: "0 2px 12px rgba(251,191,36,0.5)",
                animation: "featuredCardPulse 2.5s ease-in-out infinite",
            }}
        >
            <Zap size={11} className="fill-amber-900" />
            FEATURED
            <style>{`
                @keyframes featuredCardPulse {
                    0%, 100% { box-shadow: 0 2px 12px rgba(251,191,36,0.5); }
                    50% { box-shadow: 0 2px 20px rgba(251,191,36,0.8); }
                }
            `}</style>
        </div>
    )
}
