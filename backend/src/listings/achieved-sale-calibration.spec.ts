import {
    auditedAuctionIds,
} from './achieved-sale-calibration-loader';
import {
    evaluateAchievedAuctionCalibration,
    resolveCalibrationMode,
    type HistoricSalePrediction,
} from './achieved-sale-calibration';
import {
    applyAchievedAuctionCalibration,
    restoreUncalibratedValuation,
} from './achieved-sale-calibration-pricing';
import type { VehicleValuationResult } from './vehicle-valuation';

const date = Date.parse('2026-01-01T12:00:00Z');
const pairs = (trainingRatio: number, laterRatio = trainingRatio): HistoricSalePrediction[] =>
    Array.from({ length: 30 }, (_, index) => {
        const predicted = 7000 + index * 55;
        return {
            vehicleKey: index.toString(16).padStart(64, '0'),
            predictedAuction: predicted,
            achievedAuction: predicted * (index < 20 ? trainingRatio : laterRatio),
            predictedAt: date + index * 7 * 86_400_000,
            handoverAt: date + index * 7 * 86_400_000 + 86_400_000,
        };
    });

const oldQuote = (): VehicleValuationResult => ({
    low: 7700, mid: 9000, high: 10500,
    confidence: 'MEDIUM', confidenceScore: 0.56, comparables: 5,
    source: 'BLENDED_MARKET',
    explanation: 'Original unmodified market evidence.',
    evidence: {
        completedSales: 0, acceptedOffers: 0,
        auctionResults: 0, activeAsks: 5,
    },
    marketEvidence: {
        carmaziumComparables: 1, liveUkComparables: 4,
        valuationStrategy: 'BLENDED',
    },
    retail: { suggestedAsking: 11000, suggestedMinimum: 9500,
        evidenceBasis: 'OBSERVED', observedAsks: 4 },
    privateSale: {
        low: 7300, mid: 8200, high: 9000,
        evidenceBasis: 'PROVISIONAL_PROXY', verifiedSales: 0,
    },
    auction: {
        marketValue: 6800, openingBid: 4800,
        reserveLow: 6100, reserveHigh: 7100, suggestedReserve: 6700,
        evidenceBasis: 'PROVISIONAL_PROXY', verifiedOutcomes: 0,
    },
});

describe('Block 9 holdout-gated achieved auction calibration', () => {
    it('starts OFF, even when someone supplies ON without review and rollout approvals', () => {
        expect(resolveCalibrationMode(undefined, undefined, undefined)).toBe('off');
        expect(resolveCalibrationMode('on', 'false', 'true')).toBe('off');
        expect(resolveCalibrationMode('on', 'true', 'false')).toBe('off');
        expect(resolveCalibrationMode('shadow', 'true', undefined)).toBe('shadow');
        expect(resolveCalibrationMode('on', 'true', 'true')).toBe('on');
    });

    it('will not fit on fewer than 30 DISTINCT physical vehicles', () => {
        const duplicate = Array.from({ length: 90 }, (_, i) =>
            ({ ...pairs(1.07)[i % 29] }));
        expect(evaluateAchievedAuctionCalibration(duplicate).state).toBe('INSUFFICIENT');
        expect(evaluateAchievedAuctionCalibration(duplicate).samples).toBe(29);
        expect(evaluateAchievedAuctionCalibration([])).toMatchObject({
            state: 'INSUFFICIENT', samples: 0,
        });
    });

    it('requires a quote BEFORE the actual auction, valid chronology and plausible price pairs', () => {
        const input = pairs(1.08);
        input[0].predictedAt = input[0].handoverAt + 1000;
        input[1].achievedAuction = 2;
        input[2].vehicleKey = 'a customer registration';
        input[3].predictedAt -= 121 * 86_400_000;
        const e = evaluateAchievedAuctionCalibration(input);
        expect(e.state).toBe('INSUFFICIENT');
        expect(e.samples).toBe(26);
    });

    it('learns only from earlier training vehicles and passes truly later heldout error gates', () => {
        const e = evaluateAchievedAuctionCalibration(pairs(1.08));
        expect(e).toMatchObject({
            state: 'VALIDATED', samples: 30,
            trainingSamples: 20, holdoutSamples: 10,
            multiplier: 1.08,
        });
        expect(e.candidateHoldoutMape).toBeLessThan(e.baselineHoldoutMape!);
        expect(e.candidateHoldoutWithin20Pct).toBe(1);
    });

    it('never activates if future auction outcomes diverge from past training data', () => {
        const e = evaluateAchievedAuctionCalibration(pairs(1.09, 0.88));
        expect(e.state).toBe('NO_IMPROVEMENT');
        expect(e.trainingSamples).toBe(20);
        expect(e.holdoutSamples).toBe(10);
    });

    it('limits price correction to ±10% and does not apply a spurious positive fit', () => {
        const e = evaluateAchievedAuctionCalibration(pairs(1.18));
        expect(e.multiplier).toBe(1.10);
        expect(e.state).toBe('VALIDATED');
        expect(e.candidateHoldoutMape).toBeGreaterThan(0);
    });

    it('does not confuse seller-attested handover with individual approved audit IDs', () => {
        const ids = auditedAuctionIds(
            '3ce3af8d-8103-4a26-a2ad-420aca42bccd,not-an-id,3ce3af8d-8103-4a26-a2ad-420aca42bccd');
        expect(ids.size).toBe(1);
        expect(ids.has('not-an-id')).toBe(false);
    });

    it('SHADOW produces the EXACT old figures, irrespective of a successful fit', () => {
        const base = oldQuote();
        const evaluated = evaluateAchievedAuctionCalibration(pairs(1.08));
        const shadow = applyAchievedAuctionCalibration(base, evaluated, 'shadow');
        expect(shadow.auction).toEqual(base.auction);
        expect(shadow.retail).toEqual(base.retail);
        expect(shadow.privateSale).toEqual(base.privateSale);
        expect(shadow.mid).toBe(base.mid);
        expect(shadow.calibration?.mode).toBe('SHADOW');
        expect(restoreUncalibratedValuation(shadow)).toEqual(base);
    });

    it('ON only updates auction prices after holdout qualification and OFF restores precisely', () => {
        const base = oldQuote();
        const approved = evaluateAchievedAuctionCalibration(pairs(1.08));
        const active = applyAchievedAuctionCalibration(base, approved, 'on');
        expect(active.calibration?.mode).toBe('APPLIED');
        expect(active.auction.marketValue).toBeGreaterThan(base.auction.marketValue);
        expect(active.auction.openingBid).toBeLessThan(active.auction.reserveLow);
        expect(active.auction.suggestedReserve).toBeLessThanOrEqual(active.auction.reserveHigh);
        expect(active.auction.suggestedReserve).toBeGreaterThanOrEqual(active.auction.reserveLow);
        expect(active.mid).toBe(base.mid);
        expect(active.retail).toEqual(base.retail);
        expect(active.privateSale).toEqual(base.privateSale);
        expect(active.marketEvidence).toEqual(base.marketEvidence);
        expect(active.confidence).toBe('MEDIUM');
        // Prove the "off" rollback works even after JSON/DB serialization.
        const frozen = JSON.parse(JSON.stringify(active)) as typeof active;
        expect(restoreUncalibratedValuation(frozen)).toEqual(base);
        expect(restoreUncalibratedValuation(
            applyAchievedAuctionCalibration(active, approved, 'on'))).toEqual(base);
    });

    it('ON with insufficient/incoherent outcomes leaves legacy prices intact', () => {
        const base = oldQuote();
        const rejected = evaluateAchievedAuctionCalibration(pairs(1.09, 0.85));
        const stopped = applyAchievedAuctionCalibration(base, rejected, 'on');
        expect(stopped.calibration?.mode).toBe('SKIPPED');
        expect(stopped.auction).toEqual(base.auction);
        expect(restoreUncalibratedValuation(stopped)).toEqual(base);
    });
});
