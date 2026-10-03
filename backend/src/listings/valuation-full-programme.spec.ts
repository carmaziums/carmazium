import {
    applyVehicleSpecificationAdjustments,
    calculateVehicleValuation,
    type VehicleValuationResult,
} from './vehicle-valuation';
import { applyEvidenceConfidence } from './valuation-evidence-confidence';
import {
    applyAchievedAuctionCalibration,
    restoreUncalibratedValuation,
} from './achieved-sale-calibration-pricing';
import { evaluateAchievedAuctionCalibration } from './achieved-sale-calibration';
import {
    calculateSpecificationAdjustment,
    exteriorGradeFromDefectCount,
} from './valuation-specification-policy';

describe('Block 10 complete valuation programme regression', () => {
    const identity = {
        make: 'VOLKSWAGEN', model: 'GOLF', year: 2018, mileage: 60_000,
    };
    const now = Date.parse('2026-10-03T12:00:00Z');
    const priceRows = [8500, 8750, 9000, 9200, 9450].map((price, i) => ({
        price, year: 2018, mileage: 60_000, kind: 'ACTIVE_ASK' as const,
        modelMatchQuality: 'EXACT_MODEL' as const,
        sourceDomain: i % 2 ? 'market-a.example' : 'market-b.example',
    }));

    function reliableAdvertQuote(): VehicleValuationResult {
        const base = calculateVehicleValuation(identity, priceRows);
        // The final live-source selection comes from the service, not the
        // pure calculator. Supply a frozen, already-sanitized live data set.
        return applyEvidenceConfidence({
            ...base,
            source: 'LIVE_UK_MARKET',
            marketEvidence: {
                carmaziumComparables: 0,
                liveUkComparables: 5,
                exactModelComparables: 5,
                provisionalModelComparables: 0,
                liveSources: ['market-a.example', 'market-b.example'],
                checkedAt: '2026-10-03T11:00:00Z',
                valuationStrategy: 'LIVE',
            },
        }, 'MODEL_VERIFIED', now);
    }

    it('retail advert evidence is not promoted into private-party or achieved auction confidence', () => {
        const base = reliableAdvertQuote();
        expect(base.source).toBe('LIVE_UK_MARKET');
        expect(base.confidence).toBe('MEDIUM');
        expect(base.confidenceAssessment?.level).toBe('MEDIUM');
        expect(base.confidenceAssessment?.counts.uniqueUkAdverts).toBe(5);
        expect(base.confidenceAssessment?.counts.exactModelAdverts).toBe(5);
        expect(base.confidenceAssessment?.counts.verifiedCompletedAuctions).toBe(0);
        expect(base.auction.evidenceBasis).toBe('PROVISIONAL_PROXY');
        expect(base.privateSale?.evidenceBasis).toBe('PROVISIONAL_PROXY');
        expect(base.confidenceAssessment?.calibrationStatus)
            .toBe('NOT_VALIDATED_AGAINST_ACHIEVED_SALES');
    });

    it('damage grade, aliases and immutable market base give identical prices after repeated edits', () => {
        const base = reliableAdvertQuote();
        const conditionA = { ...identity, variant: 'ST LINE',
            condition: 'POOR', exteriorGrade: exteriorGradeFromDefectCount(6)!,
            fuelType: 'Petrol Plug-in Hybrid', transmission: 'Semi Automatic',
        };
        const conditionB = { ...identity, variant: 'ST-LINE',
            condition: 'EXCELLENT', exteriorGrade: exteriorGradeFromDefectCount(0)!,
            fuelType: 'PETROL_PLUGIN_HYBRID', transmission: 'SEMI_AUTOMATIC',
        };
        expect(calculateSpecificationAdjustment(conditionB).factor)
            .toBeGreaterThan(calculateSpecificationAdjustment(conditionA).factor);
        const first = applyVehicleSpecificationAdjustments(base, conditionA);
        const second = applyVehicleSpecificationAdjustments(first, conditionB);
        const third = applyVehicleSpecificationAdjustments(second, conditionA);
        const direct = applyVehicleSpecificationAdjustments(base, conditionA);
        expect(third.low).toBe(direct.low);
        expect(third.retail).toEqual(direct.retail);
        expect(third.privateSale).toEqual(direct.privateSale);
        expect(third.auction).toEqual(direct.auction);
        expect(third.specificationAdjustment?.base.mid).toBe(base.mid);
        expect(third.confidenceAssessment).toEqual(base.confidenceAssessment);
        const neutral = applyVehicleSpecificationAdjustments(third, identity);
        expect(neutral.low).toBe(base.low);
        expect(neutral.mid).toBe(base.mid);
        expect(neutral.high).toBe(base.high);
        expect(neutral.auction).toEqual(base.auction);
        expect(neutral.specificationAdjustment).toBeUndefined();
    });

    it('SHADOW and unvalidated ON preserve ALL original money and source metadata', () => {
        const baseline = reliableAdvertQuote();
        const insufficient = evaluateAchievedAuctionCalibration([]);
        for (const mode of ['shadow', 'on'] as const) {
            const current = applyAchievedAuctionCalibration(baseline, insufficient, mode);
            expect(current.low).toBe(baseline.low);
            expect(current.mid).toBe(baseline.mid);
            expect(current.high).toBe(baseline.high);
            expect(current.retail).toEqual(baseline.retail);
            expect(current.privateSale).toEqual(baseline.privateSale);
            expect(current.auction).toEqual(baseline.auction);
            expect(current.confidenceAssessment).toEqual(baseline.confidenceAssessment);
            expect(restoreUncalibratedValuation(current)).toEqual(baseline);
        }
    });

    it('turning optional ON back OFF restores the old base before deterministic damage adjustments', () => {
        const baseline = reliableAdvertQuote();
        // Synthetic approval exercises only reversibility. This is NOT
        // evidence the live UK market has achieved the outcome thresholds.
        const syntheticEvaluation = {
            version: 'auction-outcome-v1' as const,
            state: 'VALIDATED' as const,
            samples: 40, trainingSamples: 27, holdoutSamples: 13,
            multiplier: 1.06,
            baselineHoldoutMape: 0.13,
            candidateHoldoutMape: 0.08,
            candidateHoldoutWithin20Pct: 1,
        };
        const enhanced = applyAchievedAuctionCalibration(
            baseline, syntheticEvaluation, 'on',
        );
        expect(enhanced.auction.marketValue).not.toBe(baseline.auction.marketValue);
        expect(enhanced.retail).toEqual(baseline.retail);
        expect(enhanced.privateSale).toEqual(baseline.privateSale);
        const saved = JSON.parse(JSON.stringify(enhanced)) as VehicleValuationResult;
        const off = restoreUncalibratedValuation(saved);
        expect(off).toEqual(baseline);
        const inputs = {
            ...identity, condition: 'POOR', exteriorGrade: 4,
            transmission: 'MANUAL', numberOfKeys: 1,
        };
        expect(applyVehicleSpecificationAdjustments(off, inputs))
            .toEqual(applyVehicleSpecificationAdjustments(baseline, inputs));
        expect(off.confidence).toBe('MEDIUM');
    });
});
