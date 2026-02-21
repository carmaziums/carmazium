/**
 * SellerBadge — compact reliability indicator for use on listing cards.
 *
 * Displays a star icon, numeric reliability score, and a colour-coded
 * trust tier label. Designed to sit inline inside CarCard without
 * disrupting the existing layout.
 *
 * Props
 * ─────
 *  score        — 0–5 float (reliabilityScore from SellerProfile)
 *  sellerUserId — User ID to link to /seller/[id]
 *  size         — "sm" (card use) | "md" (profile page use)
 *  showLabel    — whether to render the tier label text
 */

import Link from "next/link"
import { Star } from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface SellerBadgeProps {
    score: number
    sellerUserId: string
    size?: "sm" | "md"
    showLabel?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number): { label: string; color: string; bg: string } {
    if (score >= 4.5) return { label: "Top Seller", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" }
    if (score >= 3.5) return { label: "Trusted", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" }
    if (score >= 2.5) return { label: "Good", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" }
    if (score > 0) return { label: "New", color: "text-gray-400", bg: "bg-white/5 border-white/10" }
    return { label: "No reviews", color: "text-gray-500", bg: "bg-white/5 border-white/10" }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SellerBadge({ score, sellerUserId, size = "sm", showLabel = false }: SellerBadgeProps) {
    const tier = getTier(score)
    const iconSize = size === "sm" ? 10 : 13
    const textSize = size === "sm" ? "text-[10px]" : "text-xs"

    return (
        <Link
            href={`/seller/${sellerUserId}`}
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 border rounded-md px-2 py-0.5 transition-opacity hover:opacity-80 ${tier.bg} ${textSize}`}
            title={`Reliability Score: ${score.toFixed(1)} / 5.0`}
        >
            <Star size={iconSize} className={`fill-current ${tier.color}`} />
            <span className={`font-bold ${tier.color}`}>{score.toFixed(1)}</span>
            {showLabel && (
                <span className={`font-medium ${tier.color} ml-0.5`}>{tier.label}</span>
            )}
        </Link>
    )
}
