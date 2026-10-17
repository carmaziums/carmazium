/**
 * Quote history is an internal benchmark, NOT observed sale/asking evidence.
 * Never pass archived CarMazium guesses into calculateVehicleValuation as
 * market comparables: doing so creates a self-reinforcing pricing feedback loop.
 */
export const QUOTE_HISTORY_MONTHS = 12;

export interface ArchivedValuationObservation {
    createdAt: Date;
    registration: string | null;
    make: string;
    model: string;
    year: number;
    mileage: number;
    auctionPrice: number;
    retailPrice: number;
    source: string;
    liveComparableCount: number;
}

export interface HistoricalQuoteComparison {
    lookbackMonths: 12;
    vehicleCount: number;
    liveBackedVehicleCount: number;
    historicalAuctionMedian: number | null;
    historicalRetailMedian: number | null;
    mostRecentQuoteAt: string | null;
    evidenceType: 'HISTORICAL_ESTIMATES_NOT_SALES';
}

const normalize = (s?: string | null) => (s || '').trim().replace(/\s+/g, ' ').toUpperCase();
const cleanReg = (s?: string | null) => (s || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

const median = (rows: number[]): number | null => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
};

/**
 * Compare the most recent quote per distinct VRM, within the target vehicle's
 * make, model, age and mileage band. The live-backed subset is differentiated
 * from model fallbacks, and neither is fed back into the pricing engine.
 */
export function summariseHistoricalQuotes(
    rows: ArchivedValuationObservation[],
    target: { make: string; model: string; year: number; mileage: number; registration?: string },
    now = new Date(),
): HistoricalQuoteComparison {
    const lowerDate = new Date(now);
    lowerDate.setUTCMonth(lowerDate.getUTCMonth() - QUOTE_HISTORY_MONTHS);
    const uniqueVehicles = new Map<string, ArchivedValuationObservation>();

    for (const row of [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
        const reg = cleanReg(row.registration);
        if (!reg || reg === cleanReg(target.registration) || uniqueVehicles.has(reg)) continue;
        if (row.createdAt < lowerDate || row.createdAt > now) continue;
        if (normalize(row.make) !== normalize(target.make) || normalize(row.model) !== normalize(target.model)) continue;
        if (!Number.isFinite(row.year) || Math.abs(row.year - target.year) > 2) continue;
        if (!Number.isFinite(row.mileage) || Math.abs(row.mileage - target.mileage) > 40_000) continue;
        if (!Number.isFinite(row.auctionPrice) || row.auctionPrice < 250
            || !Number.isFinite(row.retailPrice) || row.retailPrice < 250) continue;
        uniqueVehicles.set(reg, row);
    }

    const all = [...uniqueVehicles.values()];
    // Only historical quotes grounded in actual contemporaneous market ads
    // can be used for this benchmark. An estimate based on our own model is
    // retained for auditing but excluded from the market-backed median.
    const liveBacked = all.filter(row =>
        (row.source === 'LIVE_UK_MARKET' || row.source === 'BLENDED_MARKET')
        && row.liveComparableCount > 0
    );

    return {
        lookbackMonths: QUOTE_HISTORY_MONTHS,
        vehicleCount: all.length,
        liveBackedVehicleCount: liveBacked.length,
        historicalAuctionMedian: median(liveBacked.map(row => row.auctionPrice)),
        historicalRetailMedian: median(liveBacked.map(row => row.retailPrice)),
        mostRecentQuoteAt: all.length > 0 ? all[0].createdAt.toISOString() : null,
        evidenceType: 'HISTORICAL_ESTIMATES_NOT_SALES',
    };
}
