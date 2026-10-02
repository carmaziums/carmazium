/**
 * Block 9: opt-in, reversible auction achieved-sale calibration.
 *
 * Validation uses independent, chronological, distinct-vehicle holdout data.
 * Only achieved, approved, seller-attested AUCTION outcomes paired with an
 * earlier immutable vehicle valuation are eligible. No retailer asking price,
 * accepted bid, generic Sale row or provider benchmark is an achieved outcome.
 *
 * Neither this pure module nor the DB loader knows any VRM, user name or VIN.
 */
export const AUCTION_CALIBRATION_VERSION = 'auction-outcome-v1' as const;

export type CalibrationMode = 'off' | 'shadow' | 'on';

export interface HistoricSalePrediction {
    /** Non-reversible opaque identity, only used to de-duplicate one car. */
    vehicleKey: string;
    predictedAuction: number;
    achievedAuction: number;
    predictedAt: number;
    handoverAt: number;
}

export interface AuctionCalibrationEvaluation {
    version: typeof AUCTION_CALIBRATION_VERSION;
    state: 'INSUFFICIENT' | 'NO_IMPROVEMENT' | 'VALIDATED';
    samples: number;
    trainingSamples: number;
    holdoutSamples: number;
    multiplier?: number;
    baselineHoldoutMape?: number;
    candidateHoldoutMape?: number;
    candidateHoldoutWithin20Pct?: number;
}

/** Caller must also set rights and rollout approvals before mode on. */
export function resolveCalibrationMode(
    rawMode: string | undefined,
    rightsConfirmed: string | undefined,
    rolloutApproved: string | undefined,
): CalibrationMode {
    const mode = rawMode?.trim().toLowerCase();
    if (rightsConfirmed !== 'true') return 'off';
    if (mode === 'shadow') return 'shadow';
    if (mode === 'on' && rolloutApproved === 'true') return 'on';
    return 'off';
}

const round = (value: number): number => Number(value.toFixed(4));
const error = (predicted: number, actual: number): number =>
    Math.abs(predicted - actual) / actual;
const average = (values: number[]): number =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values: number[]): number => {
    const ordered = [...values].sort((a, b) => a - b);
    const mid = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
};

/**
 * A train/holdout split prevents evaluating the cohort on the same data used
 * to derive its adjustment. Only one outcome per physical vehicle is allowed.
 * Holdout vehicles occur after training vehicles. The prediction must predate
 * its corresponding handover and not be older than 120 days.
 */
export function evaluateAchievedAuctionCalibration(
    observations: HistoricSalePrediction[],
): AuctionCalibrationEvaluation {
    const blank: AuctionCalibrationEvaluation = {
        version: AUCTION_CALIBRATION_VERSION,
        state: 'INSUFFICIENT', samples: 0,
        trainingSamples: 0, holdoutSamples: 0,
    };
    const eligible = observations
        .filter((row) => (
            /^[a-f0-9]{64}$/i.test(row.vehicleKey)
            && Number.isFinite(row.predictedAuction) && row.predictedAuction >= 500
            && Number.isFinite(row.achievedAuction) && row.achievedAuction >= 500
            && Number.isFinite(row.predictedAt) && Number.isFinite(row.handoverAt)
            && row.handoverAt > row.predictedAt
            && row.handoverAt - row.predictedAt <= 120 * 24 * 60 * 60_000
            // Extreme pairs require manual review, not automated calibration.
            && row.achievedAuction / row.predictedAuction >= 0.45
            && row.achievedAuction / row.predictedAuction <= 2.2
        ))
        .sort((a, b) => a.handoverAt - b.handoverAt
            || a.vehicleKey.localeCompare(b.vehicleKey));

    const seen = new Set<string>();
    const distinct = eligible.filter((row) => {
        if (seen.has(row.vehicleKey)) return false;
        seen.add(row.vehicleKey);
        return true;
    });

    // At least 20 earlier independent vehicles for training and 10 later,
    // held-out vehicles for evaluation. A few convenient old auctions do not
    // create a statistically credible channel adjustment.
    if (distinct.length < 30) {
        return { ...blank, samples: distinct.length };
    }

    const trainCount = Math.floor(distinct.length * 2 / 3);
    const train = distinct.slice(0, trainCount);
    const holdout = distinct.slice(trainCount);
    if (train.length < 20 || holdout.length < 10) {
        return { ...blank, samples: distinct.length,
            trainingSamples: train.length, holdoutSamples: holdout.length };
    }

    // Median multiplicative bias correction bounded to a cautious ±10%.
    // The unrounded values are used for the actual holdout evaluation.
    const ratio = median(train.map((row) =>
        row.achievedAuction / row.predictedAuction));
    const multiplier = Math.max(0.90, Math.min(1.10, ratio));
    const baselineErrors = holdout.map((row) =>
        error(row.predictedAuction, row.achievedAuction));
    const candidateErrors = holdout.map((row) =>
        error(row.predictedAuction * multiplier, row.achievedAuction));
    const baselineMape = average(baselineErrors);
    const candidateMape = average(candidateErrors);
    const within20 = candidateErrors.filter((value) => value <= 0.20).length
        / candidateErrors.length;
    // Require genuine out-of-sample improvement, not just any fitted slope.
    // Thresholds are predeclared operational gates, not accuracy guarantees.
    const validated = candidateMape <= 0.15
        && candidateMape + 0.015 <= baselineMape
        && within20 >= 0.80;

    return {
        version: AUCTION_CALIBRATION_VERSION,
        state: validated ? 'VALIDATED' : 'NO_IMPROVEMENT',
        samples: distinct.length,
        trainingSamples: train.length,
        holdoutSamples: holdout.length,
        multiplier: round(multiplier),
        baselineHoldoutMape: round(baselineMape),
        candidateHoldoutMape: round(candidateMape),
        candidateHoldoutWithin20Pct: round(within20),
    };
}
