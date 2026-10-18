import { alignVehicleValuationPrices, type VehicleValuationResult } from './vehicle-valuation';

export type ValuationDemandAssessment = {
    status: 'INSUFFICIENT_DATA' | 'BALANCED' | 'HIGH_DEMAND' | 'LOW_DEMAND';
    activeComparableSupply: number;
    observedTransactions90d: number;
    retailAdjustment: number;
    tradeAdjustment: number;
};

/**
 * Demand can only be measured from observed outcomes. Views/searches alone
 * are not purchase demand, and archived CarMazium quote estimates are NOT sales.
 *
 * Only comparable first-party inventory rows are used. Sparse sample sizes
 * produce a neutral adjustment, not fictitious national demand. Future licensed
 * market supply data can be added separately with explicit provenance.
 */
export function assessFirstPartyMarketDemand(
    rows: Array<{
        status: string;
        sale?: { createdAt?: Date | string | null } | null;
        offers?: Array<{ updatedAt?: Date | string | null }> | null;
        auction?: {
            updatedAt?: Date | string | null;
            winningBidAmount?: unknown;
            sellerFundsConfirmedAt?: Date | string | null;
            buyerRefusedAt?: Date | string | null;
        } | null;
    }>,
    now = new Date(),
): ValuationDemandAssessment {
    const threshold = now.getTime() - 90 * 86400000;
    const inWindow = (date: Date | string | null | undefined) => {
        const timestamp = date ? new Date(date).getTime() : NaN;
        return Number.isFinite(timestamp) && timestamp >= threshold && timestamp <= now.getTime();
    };
    const active = rows.filter(row => row.status === 'ACTIVE').length;
    const sold = rows.filter(row =>
        inWindow(row.sale?.createdAt)
        || (
            Number(row.auction?.winningBidAmount) > 0
            && row.auction?.sellerFundsConfirmedAt != null
            && row.auction?.buyerRefusedAt == null
            && inWindow(row.auction?.sellerFundsConfirmedAt)
        )
    ).length;
    const neutral = {
        status: 'INSUFFICIENT_DATA' as const,
        activeComparableSupply: active,
        observedTransactions90d: sold,
        retailAdjustment: 1,
        tradeAdjustment: 1,
    };
    if (active < 5 || sold < 5 || active + sold < 16) return neutral;

    const velocity = sold / (active + sold);
    if (velocity >= 0.55) {
        return { ...neutral, status: 'HIGH_DEMAND', retailAdjustment: 1.02, tradeAdjustment: 1.01 };
    }
    if (velocity <= 0.18) {
        return { ...neutral, status: 'LOW_DEMAND', retailAdjustment: 0.98, tradeAdjustment: 0.99 };
    }
    return { ...neutral, status: 'BALANCED' };
}

export function applyFirstPartyDemandAdjustment(
    valuation: VehicleValuationResult,
    demand: ValuationDemandAssessment,
): VehicleValuationResult {
    const evidence = {
        ...valuation.marketEvidence,
        carmaziumComparables: valuation.marketEvidence?.carmaziumComparables ?? 0,
        liveUkComparables: valuation.marketEvidence?.liveUkComparables ?? 0,
        demand,
    };
    if (valuation.valuationMethod !== 'SEPARATE_MARKETS' || demand.status === 'INSUFFICIENT_DATA') {
        return { ...valuation, marketEvidence: evidence };
    }
    const round = (amount: number) => Math.max(500, Math.round(amount / 50) * 50);
    return alignVehicleValuationPrices({
        ...valuation,
        marketEvidence: evidence,
        retail: {
            ...valuation.retail,
            suggestedAsking: round(valuation.retail.suggestedAsking * demand.retailAdjustment),
        },
        auction: {
            ...valuation.auction,
            marketValue: round(valuation.auction.marketValue * demand.tradeAdjustment),
        },
    });
}
