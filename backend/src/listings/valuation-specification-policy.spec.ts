import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    applySpecificationToFrozenValuation,
    calculateSpecificationAdjustment,
    exteriorGradeFromDefectCount,
    SPECIFICATION_POLICY_VERSION,
} from './valuation-specification-policy';

const frozen = {
    low: 8_000, mid: 10_000, high: 12_000,
    source: 'LIVE_UK_MARKET' as const,
    confidence: 'MEDIUM' as const,
    confidenceScore: 0.61,
    comparables: 7,
    marketEvidence: { liveUkAttempts: 2, liveUkComparables: 5 },
    explanation: 'Frozen live UK market base.',
    retail: {
        suggestedAsking: 12_200,
        suggestedMinimum: 10_500,
        evidenceBasis: 'OBSERVED' as const, observedAsks: 5,
    },
    privateSale: {
        low: 7_800, mid: 9_000, high: 10_000,
        evidenceBasis: 'PROVISIONAL_PROXY' as const, verifiedSales: 0,
    },
    auction: {
        marketValue: 7_000, openingBid: 5_000,
        reserveLow: 6_400, reserveHigh: 7_600,
        suggestedReserve: 7_000,
        evidenceBasis: 'OBSERVED' as const, verifiedOutcomes: 6,
    },
};

describe('Block 7 deterministic specification policy', () => {
    it('keeps the exact same policy source in backend, web and native', () => {
        const backend = readFileSync(resolve(__dirname, './valuation-specification-policy.ts'), 'utf8');
        const website = readFileSync(resolve(__dirname, '../../../src/lib/valuation-specification-policy.ts'), 'utf8');
        const native = readFileSync(resolve(__dirname,
            '../../../carmazium app/carmazium app/src/lib/valuation-specification-policy.ts'), 'utf8');
        expect(website).toBe(backend);
        expect(native).toBe(backend);
        expect(SPECIFICATION_POLICY_VERSION).toBe('2026-10-b7-v1');
    });

    it.each([
        [0, 1], [1, 1], [2, 2], [3, 2], [4, 3],
        [5, 3], [6, 4], [7, 4], [8, 5], [22, 5],
    ])('maps %d separately marked defects to exterior grade %d', (count, grade) => {
        expect(exteriorGradeFromDefectCount(count)).toBe(grade);
    });

    it('does not manufacture a zero-defect grade from absent/invalid damage reports', () => {
        expect(exteriorGradeFromDefectCount(undefined)).toBeNull();
        expect(exteriorGradeFromDefectCount(-1)).toBeNull();
        expect(exteriorGradeFromDefectCount(Number.NaN)).toBeNull();
    });

    it('treats variant punctuation, gearbox aliases and fuel punctuation consistently', () => {
        const a = calculateSpecificationAdjustment({
            variant: 'ST-LINE', transmission: 'Semi-Automatic',
            fuelType: 'Petrol Plug-in Hybrid',
        });
        const b = calculateSpecificationAdjustment({
            variant: 'ST LINE', transmission: 'SEMI_AUTOMATIC',
            fuelType: 'PETROL_PLUGIN_HYBRID',
        });
        expect(a).toEqual(b);
        expect(a.reasonCodes).toEqual([
            'AUTOMATIC_FAMILY', 'PLUGIN_HYBRID', 'PREMIUM_TRIM_PROVISIONAL',
        ]);
        expect(calculateSpecificationAdjustment({ variant: 'AMG Line' }).reasonCodes)
            .toEqual(['PREMIUM_TRIM_PROVISIONAL']);
        expect(calculateSpecificationAdjustment({ variant: 'AMG 63' }).reasonCodes)
            .toEqual(['PERFORMANCE_VARIANT_PROVISIONAL']);
    });

    it('ignores repeated, reordered or equivalent feature names', () => {
        const features = ['Leather', 'Heated Seats', 'Apple CarPlay', 'SUNROOF', 'LEATHER'];
        const result = calculateSpecificationAdjustment({ features });
        const reordered = calculateSpecificationAdjustment({
            features: ['sunroof', 'Apple CarPlay', 'heated seats', 'leather'],
        });
        expect(result).toEqual(reordered);
        expect(result.reasonCodes).toEqual(['EQUIPMENT_CAPPED']);
    });

    it('does not mistakenly reward no service history or stack Euro over verified ULEZ', () => {
        const noHistory = calculateSpecificationAdjustment({ serviceHistory: 'No service history' });
        expect(noHistory.reasonCodes).toEqual(['SERVICE_NONE_OR_UNCONFIRMED']);
        expect(noHistory.factor).toBeLessThan(1);
        expect(calculateSpecificationAdjustment({
            ulezCompliant: false, euroStandard: 'Euro 6',
        }).reasonCodes).toEqual(['ULEZ_NONCOMPLIANT']);
        expect(calculateSpecificationAdjustment({
            ulezCompliant: true, euroStandard: 'Euro 4',
        }).reasonCodes).toEqual(['ULEZ_COMPLIANT']);
        expect(calculateSpecificationAdjustment({ euroStandard: 'Euro-6d' }).reasonCodes)
            .toEqual(['EURO_6']);
    });

    it('handles owner count formatting, missing inputs and explicit neutral values', () => {
        expect(calculateSpecificationAdjustment({ owners: '5+' }).reasonCodes)
            .toEqual(['FIVE_PLUS_KEEPERS']);
        expect(calculateSpecificationAdjustment({ owners: '1' }).reasonCodes)
            .toEqual(['ONE_KEEPER']);
        expect(calculateSpecificationAdjustment({})).toEqual({
            factor: 1, reasonCodes: [],
        });
        expect(calculateSpecificationAdjustment({
            exteriorGrade: 1, doors: undefined, seats: undefined,
            isImported: false, ulezCompliant: undefined,
        })).toEqual({ factor: 1, reasonCodes: [] });
    });

    it('caps extreme adjustments and records the cap in the audit', () => {
        const result = calculateSpecificationAdjustment({
            writeOffCategory: 'CAT_A', exteriorGrade: 5,
            condition: 'POOR', serviceHistory: 'NONE', isImported: true,
        });
        expect(result.factor).toBeGreaterThanOrEqual(0.18);
        expect(result.factor).toBeLessThanOrEqual(1.2);
        expect(result.reasonCodes).toContain('WRITE_OFF_A');
    });

    it('repeated application uses the frozen ORIGINAL base, never compounds the price', () => {
        const spec = {
            condition: 'FAIR', exteriorGrade: 3, serviceHistory: 'Partial',
            owners: '5+', numberOfKeys: 1, transmission: 'CVT',
        };
        const once = applySpecificationToFrozenValuation(frozen, spec);
        const twice = applySpecificationToFrozenValuation(once, spec);
        const roundTripped = applySpecificationToFrozenValuation(
            JSON.parse(JSON.stringify(once)) as typeof once, spec);
        expect(twice).toEqual(once);
        expect(roundTripped).toEqual(once);
        expect(once.specificationAdjustment?.policyVersion).toBe(SPECIFICATION_POLICY_VERSION);
        expect(once.specificationAdjustment?.base.mid).toBe(10_000);
        expect(once.explanation.split('Seller-provided').length).toBe(2);
    });

    it('seller edits are path-independent: A -> B equals base -> B in every channel', () => {
        const a = { condition: 'POOR', exteriorGrade: 4, transmission: 'MANUAL' };
        const b = {
            condition: 'EXCELLENT', exteriorGrade: 1, transmission: 'AUTOMATIC',
            ulezCompliant: true, numberOfKeys: 2,
        };
        const amended = applySpecificationToFrozenValuation(
            applySpecificationToFrozenValuation(frozen, a), b);
        const direct = applySpecificationToFrozenValuation(frozen, b);
        expect(amended).toEqual(direct);
        expect(amended.marketEvidence).toEqual(frozen.marketEvidence);
        expect(amended.retail.observedAsks).toBe(5);
        expect(amended.auction.verifiedOutcomes).toBe(6);
        expect(amended.auction.openingBid).toBeLessThan(amended.auction.reserveLow);
        expect(amended.privateSale.low).toBeLessThanOrEqual(amended.privateSale.mid);
    });

    it('returning to neutral restores the exact initial prices and explanation', () => {
        const altered = applySpecificationToFrozenValuation(frozen, {
            condition: 'POOR', writeOffCategory: 'CAT_S',
        });
        const neutral = applySpecificationToFrozenValuation(altered, {});
        for (const key of ['low', 'mid', 'high', 'retail', 'privateSale', 'auction', 'explanation'] as const) {
            expect(neutral[key]).toEqual(frozen[key]);
        }
        expect(neutral.specificationAdjustment).toBeUndefined();
        expect(neutral.confidenceScore).toBe(frozen.confidenceScore);
    });

    it('does not mutate frozen input objects or alter observed/provisional evidence labels', () => {
        const before = JSON.stringify(frozen);
        const changed = applySpecificationToFrozenValuation(frozen, {
            fuelType: 'Diesel', features: ['Leather'],
        });
        expect(JSON.stringify(frozen)).toBe(before);
        expect(changed.confidence).toBe(frozen.confidence);
        expect(changed.source).toBe(frozen.source);
        expect(changed.auction.evidenceBasis).toBe('OBSERVED');
        expect(changed.privateSale.evidenceBasis).toBe('PROVISIONAL_PROXY');
    });
});
