import {
    AUCTION_CALIBRATION_VERSION,
    type AuctionCalibrationEvaluation,
} from './achieved-sale-calibration';
import type { VehicleValuationResult } from './vehicle-valuation';

type AuctionGuide = VehicleValuationResult['auction'];

export interface ValuationAuctionCalibration {
    version: typeof AUCTION_CALIBRATION_VERSION;
    mode: 'SHADOW' | 'APPLIED' | 'SKIPPED';
    evaluation: AuctionCalibrationEvaluation;
    /** Present ONLY for APPLIED so the previous calculation can be restored. */
    originalAuction?: AuctionGuide;
    originalExplanation?: string;
}

const money = (amount: number) => {
    const safe = Math.max(500, amount);
    const step = safe < 10_000 ? 50 : 100;
    return Math.round(safe / step) * step;
};

/**
 * This function also restores frozen quotations written while calibration
 * was ON. Turning the feature flag OFF restores the exact previous auction
 * guide and original explanation on the next request without deleting the
 * historical immutable market snapshot or hitting web-search providers.
 */
export function restoreUncalibratedValuation<T extends VehicleValuationResult>(input: T): T {
    const previous = input.calibration;
    if (!previous) return input;
    const restored: T = {
        ...input,
        auction: previous.originalAuction ?? input.auction,
        explanation: previous.originalExplanation ?? input.explanation,
    };
    delete restored.calibration;
    return restored;
}

export function applyAchievedAuctionCalibration<T extends VehicleValuationResult>(
    current: T,
    evaluation: AuctionCalibrationEvaluation,
    mode: 'shadow' | 'on',
): T {
    // Always calculate from a PRE-CALIBRATION quote even when the same
    // in-memory object is passed back by a caller. No stacked corrections.
    const base = restoreUncalibratedValuation(current);
    const validated = evaluation.state === 'VALIDATED'
        && evaluation.trainingSamples >= 20 && evaluation.holdoutSamples >= 10
        && evaluation.samples >= 30
        && typeof evaluation.multiplier === 'number'
        && Number.isFinite(evaluation.multiplier)
        && evaluation.multiplier >= 0.9 && evaluation.multiplier <= 1.1;
    if (mode === 'shadow' || !validated) {
        return {
            ...base,
            calibration: {
                version: AUCTION_CALIBRATION_VERSION,
                mode: mode === 'shadow' ? 'SHADOW' : 'SKIPPED',
                evaluation,
            },
        };
    }

    const factor = evaluation.multiplier!;
    const source = base.auction;
    const reserveLow = money(source.reserveLow * factor);
    const reserveHigh = Math.max(reserveLow + 50, money(source.reserveHigh * factor));
    const updated: AuctionGuide = {
        ...source,
        marketValue: money(source.marketValue * factor),
        openingBid: Math.min(
            money(source.openingBid * factor),
            Math.max(500, reserveLow - 50),
        ),
        reserveLow, reserveHigh,
        suggestedReserve: Math.max(reserveLow,
            Math.min(reserveHigh, money(source.suggestedReserve * factor))),
    };
    return {
        ...base,
        auction: updated,
        explanation: base.explanation
            + ' The indicative auction channel includes an optional correction evaluated against earlier seller-attested completed auctions using later held-out outcomes. It is not a guaranteed achieved price.',
        calibration: {
            version: AUCTION_CALIBRATION_VERSION,
            mode: 'APPLIED', evaluation,
            originalAuction: { ...source },
            originalExplanation: base.explanation,
        },
    };
}
