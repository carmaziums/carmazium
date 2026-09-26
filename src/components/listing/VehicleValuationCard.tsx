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
                    <p className="text-xs text-[var(--text-muted)]">Checking the vehicle's age and mileage to calculate its current market value.</p>
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

    if (valuation.source === "CARMAZIUM_MODEL" && valuation.comparables === 0) {
        return (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-5 md:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                        <AlertTriangle size={18} className="text-amber-500" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-[var(--text-primary)]">Not enough reliable market evidence yet</p>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            CarMazium does not have enough reliable market evidence to give you a trustworthy value for this vehicle yet. Please enter your own price to continue.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const confidenceClass =
        valuation.confidence === "HIGH"
            ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400"
            : valuation.confidence === "MEDIUM"
                ? "text-amber-600 border-amber-500/30 bg-amber-500/10 dark:text-amber-300"
                : "text-orange-600 border-orange-500/30 bg-orange-500/10 dark:text-orange-300"

    const primaryValue = valuation.auction.marketValue

    return (
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-[var(--bg-card)] to-[var(--bg-card)] p-5 md:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                            <Activity size={18} className="text-blue-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-500">
                                Vehicle Valuation
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                Based on the age, mileage and condition information provided for your vehicle.
                            </p>
                        </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${confidenceClass}`}>
                        {valuation.confidence} confidence
                    </span>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-500/20 bg-[var(--bg-input)] p-5 md:p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Current Market Value
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-primary)] md:text-4xl">
                        {formatPrice(primaryValue)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                        Based on the age, mileage and condition information provided for your vehicle.
                    </p>
                </div>



                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                        Guide only. Vehicle condition, specification and current market demand can affect the final selling price.
                    </p>
                    <Button type="button" onClick={onApply} className="h-10 shrink-0 gap-2 px-4">
                        <CheckCircle size={15} />
                        Use this value
                    </Button>
                </div>
            </div>
        </div>
    )
}
