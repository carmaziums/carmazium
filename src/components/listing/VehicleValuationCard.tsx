"use client"

import { Activity, AlertTriangle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { formatPrice } from "@/lib/listingApi"
import type { VehicleValuation } from "@/lib/valuationApi"

interface VehicleValuationCardProps {
    valuation: VehicleValuation | null
    loading: boolean
    error?: string | null
    mode: "retail" | "auction"
    compact?: boolean
    onApply: () => void
}

export function VehicleValuationCard({
    valuation,
    loading,
    error,
    mode,
    compact = false,
    onApply,
}: VehicleValuationCardProps) {
    if (!loading && !valuation && !error) return null

    if (loading) {
        return (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-blue-400 shrink-0" />
                <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Calculating your CarMazium estimate</p>
                    <p className="text-xs text-[var(--text-muted)]">Checking similar CarMazium vehicles and completed transaction signals.</p>
                </div>
            </div>
        )
    }

    if (error && !valuation) {
        return (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertTriangle size={17} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-amber-300">Valuation temporarily unavailable</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">You can continue and enter your own price. We will retry when the vehicle details change.</p>
                </div>
            </div>
        )
    }

    if (!valuation) return null

    const confidenceClass =
        valuation.confidence === "HIGH"
            ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            : valuation.confidence === "MEDIUM"
                ? "text-amber-300 border-amber-500/30 bg-amber-500/10"
                : "text-orange-300 border-orange-500/30 bg-orange-500/10"

    return (
        <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 md:p-6 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
            <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <Activity size={17} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">CarMazium Estimated Value</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                {valuation.source === "CARMAZIUM_MARKET"
                                    ? "Based on CarMazium marketplace evidence"
                                    : "Early vehicle-profile estimate while our comparable-sales dataset grows"}
                            </p>
                        </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${confidenceClass}`}>
                        {valuation.confidence} confidence
                    </span>
                </div>

                <div className={`mt-5 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                    <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Estimated range</p>
                        <p className="mt-1 text-lg md:text-xl font-black tabular-nums">
                            {formatPrice(valuation.low)}–{formatPrice(valuation.high)}
                        </p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-input)] border border-blue-500/20 p-4">
                        <p className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">
                            {mode === "auction" ? "Market value" : "Suggested asking"}
                        </p>
                        <p className="mt-1 text-xl md:text-2xl font-black text-[var(--text-primary)] tabular-nums">
                            {formatPrice(mode === "auction" ? valuation.auction.marketValue : valuation.retail.suggestedAsking)}
                        </p>
                    </div>
                    {!compact && mode === "retail" && (
                        <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Suggested offer floor</p>
                            <p className="mt-1 text-lg md:text-xl font-black tabular-nums">{formatPrice(valuation.retail.suggestedMinimum)}</p>
                        </div>
                    )}
                    {!compact && mode === "auction" && (
                        <div className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-default)] p-4">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">Suggested reserve</p>
                            <p className="mt-1 text-lg md:text-xl font-black tabular-nums">{formatPrice(valuation.auction.suggestedReserve)}</p>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                Guide {formatPrice(valuation.auction.reserveLow)}–{formatPrice(valuation.auction.reserveHigh)}
                            </p>
                        </div>
                    )}
                </div>

                {!compact && mode === "auction" && (
                    <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between gap-3">
                        <span className="text-xs text-[var(--text-muted)]">Automatic opening bid at 70% of estimated market value</span>
                        <strong className="text-sm text-emerald-400 tabular-nums">{formatPrice(valuation.auction.openingBid)}</strong>
                    </div>
                )}

                {!compact && (
                    <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">{valuation.explanation}</p>
                )}

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                        Guide only. Actual sale price depends on condition, specification, demand and buyer inspection.
                    </p>
                    <Button type="button" onClick={onApply} className="shrink-0 h-10 px-4 gap-2">
                        <CheckCircle size={15} />
                        {mode === "auction" ? "Use this valuation" : "Use suggested prices"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
