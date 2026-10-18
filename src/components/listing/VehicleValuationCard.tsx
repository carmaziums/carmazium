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
                    <p className="text-sm font-bold text-[var(--text-primary)]">Checking the current UK market</p>
                    <p className="text-xs text-[var(--text-muted)]">We are checking live market evidence first and will use blended market data only if needed.</p>
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
            ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-400"
            : valuation.confidence === "MEDIUM"
                ? "text-amber-600 border-amber-500/30 bg-amber-500/10 dark:text-amber-300"
                : "text-orange-600 border-orange-500/30 bg-orange-500/10 dark:text-orange-300"

    // Valuation provides separate dealer-auction and retail guides. Do not
    // flatten them into a single price when the selling channel changes.
    const isAuction = mode === "auction"
    const primaryValue = isAuction
        ? valuation.auction.marketValue
        : valuation.retail.suggestedAsking
    const alternativeValue = isAuction
        ? valuation.retail.suggestedAsking
        : valuation.auction.marketValue

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
                                {isAuction ? "Dealer Auction Valuation" : "Retail Valuation"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {isAuction
                                    ? "A dealer-oriented auction guide, based on available market evidence and your vehicle details."
                                    : "A suggested retail asking price, based on available market evidence and your vehicle details."}
                            </p>
                        </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${confidenceClass}`}>
                        {valuation.confidence} confidence
                    </span>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-500/20 bg-[var(--bg-input)] p-5 md:p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {isAuction ? "Estimated dealer auction value" : "Suggested retail asking price"}
                    </p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-[var(--text-primary)] md:text-4xl">
                        {formatPrice(primaryValue)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                        {isAuction
                            ? "Dealer-focused guide, not a guaranteed winning bid or sale price. Your opening bid and reserve are set separately."
                            : "Suggested advertised asking price, not a guaranteed sale price. You can choose your own price."}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[var(--text-secondary)]">
                        {isAuction ? "Retail asking guide" : "Dealer auction guide"}: {formatPrice(alternativeValue)}
                    </p>
                    {valuation.valuationMethod === "SEPARATE_MARKETS" && (
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                            {isAuction
                                ? valuation.channelEvidence?.independentlyObservedTrade
                                    ? "Dealer guide supported by observed auction outcomes."
                                    : "Dealer guide is a model estimate; insufficient observed auction results."
                                : `Retail guide derived from ${valuation.channelEvidence?.retailComparableCount ?? 0} comparable market prices.`}
                        </p>
                    )
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
                        Guide only. Changing condition or specification adjusts this saved base value; it does not start another market search.
                    </p>
                    <Button type="button" onClick={onApply} className="h-10 shrink-0 gap-2 px-4">
                        <CheckCircle size={15} />
                        {isAuction ? "Use auction guide" : "Use retail price"}
                    </Button>
                </div>
            </div>
        </div>
    )
}
