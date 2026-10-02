import {
    assessValuationConfidence, applyEvidenceConfidence,
    CONFIDENCE_RUBRIC_VERSION,
} from './valuation-evidence-confidence';
import type { VehicleValuationResult } from './vehicle-valuation';

const today = Date.parse('2026-10-02T12:00:00Z');

const basis = (overrides: Partial<VehicleValuationResult> = {}): VehicleValuationResult => ({
    low: 7000, mid: 8000, high: 9000,
    confidence: 'HIGH', confidenceScore: 0.91,
    normalizedComparableIqrRatio: 0.12,
    comparables: 6,
    evidence: {
        completedSales: 0, acceptedOffers: 0,
        auctionResults: 0, activeAsks: 6,
    },
    source: 'LIVE_UK_MARKET',
    explanation: 'Legacy confidence calculation',
    retail: { suggestedAsking: 9000, suggestedMinimum: 8000 },
    privateSale: {
        low: 6600, mid: 7400, high: 8000,
        evidenceBasis: 'PROVISIONAL_PROXY', verifiedSales: 0,
    },
    auction: {
        marketValue: 6800, openingBid: 5000,
        reserveLow: 6300, reserveHigh: 7300,
        suggestedReserve: 6800,
        evidenceBasis: 'PROVISIONAL_PROXY', verifiedOutcomes: 0,
    },
    marketEvidence: {
        carmaziumComparables: 0, liveUkComparables: 6,
        exactModelComparables: 6, provisionalModelComparables: 0,
        liveSources: ['a.example', 'b.example'], checkedAt: '2026-10-02T11:00:00Z',
        valuationStrategy: 'LIVE',
    },
    ...overrides,
});

describe('Block 8 conservative, auditable evidence-quality rubric', () => {
    it('never promotes plentiful advert asking prices to HIGH or calls a score a probability', () => {
        const r = assessValuationConfidence(basis(), {
            identityStatus: 'MODEL_VERIFIED', now: today,
        });
        expect(r.confidence).toBe('MEDIUM');
        expect(r.confidenceScore).toBeLessThan(0.65);
        expect(r.assessment.calibrationStatus).toBe('NOT_VALIDATED_AGAINST_ACHIEVED_SALES');
        expect(r.assessment.counts.uniqueUkAdverts).toBe(6);
        expect(r.assessment.reasonCodes).toContain('LIMITED_VERIFIED_OUTCOMES');
        expect(r.assessment.sourceExplanation).toMatch(/asking prices, not confirmed selling prices/i);
        expect(r.assessment.rubricVersion).toBe(CONFIDENCE_RUBRIC_VERSION);
    });

    it('keeps one or two live adverts LOW regardless of the legacy score', () => {
        for (const n of [1, 2]) {
            const r = assessValuationConfidence(basis({
                marketEvidence: {
                    carmaziumComparables: 0,
                    liveUkComparables: n, exactModelComparables: n,
                    liveSources: ['a.example', 'b.example'],
                    checkedAt: '2026-10-02T11:00:00Z',
                },
            }), { identityStatus: 'MODEL_VERIFIED', now: today });
            expect(r.confidence).toBe('LOW');
            expect(r.assessment.reasonCodes).toContain('SPARSE_UK_ADVERTS');
        }
    });

    it('rejects provisional-only matches, one-site records and unverifiable freshness', () => {
        for (const evidence of [
            { liveUkComparables: 5, exactModelComparables: 0, provisionalModelComparables: 5,
              liveSources: ['a.example', 'b.example'], checkedAt: '2026-10-02T11:00:00Z' },
            { liveUkComparables: 5, exactModelComparables: 5,
              liveSources: ['a.example'], checkedAt: '2026-10-02T11:00:00Z' },
            { liveUkComparables: 5, exactModelComparables: 5,
              liveSources: ['a.example', 'b.example'], checkedAt: '2026-09-20T00:00:00Z' },
            { liveUkComparables: 5, exactModelComparables: 5,
              liveSources: ['a.example', 'b.example'], checkedAt: 'invalid-date' },
        ]) {
            const r = assessValuationConfidence(basis({ marketEvidence: { carmaziumComparables: 0, ...evidence } }),
                { identityStatus: 'MODEL_VERIFIED', now: today });
            expect(r.confidence).toBe('LOW');
        }
    });

    it('downgrades widely dispersed asking prices and missing normalized spread evidence', () => {
        for (const spread of [0.36, 1.8, undefined]) {
            const r = assessValuationConfidence(basis({
                normalizedComparableIqrRatio: spread,
            }), { identityStatus: 'MODEL_VERIFIED', now: today });
            expect(r.confidence).toBe('LOW');
            expect(r.assessment.reasonCodes).toContain('NORMALIZED_PRICE_SPREAD_UNCERTAIN');
        }
    });

    it('does not label three incoherent auction outcomes MEDIUM merely because they are completed', () => {
        const r = assessValuationConfidence(basis({
            source: 'CARMAZIUM_MARKET',
            auction: {
                ...basis().auction, verifiedOutcomes: 3,
                evidenceBasis: 'PROVISIONAL_PROXY',
            },
            marketEvidence: { carmaziumComparables: 3, liveUkComparables: 0 },
        }), { identityStatus: 'MODEL_VERIFIED', now: today });
        expect(r.confidence).toBe('LOW');
        expect(r.assessment.reasonCodes).toContain('LIMITED_VERIFIED_OUTCOMES');
    });

    it('treats a partial or missing identity as LOW even with diverse, fresh, exact adverts', () => {
        for (const status of ['PARTIAL', 'UNVERIFIED'] as const) {
            const r = assessValuationConfidence(basis(),
                { identityStatus: status, now: today });
            expect(r.confidence).toBe('LOW');
            expect(r.assessment.reasonCodes).toContain('IDENTITY_PARTIAL_OR_UNKNOWN');
        }
        expect(assessValuationConfidence(basis(), { now: today }).confidence).toBe('LOW');
    });

    it('does not count historical sold or accepted-offer signals as independently verified transactions', () => {
        const r = assessValuationConfidence(basis({
            source: 'CARMAZIUM_MARKET',
            comparables: 12,
            evidence: {
                completedSales: 7, acceptedOffers: 5, auctionResults: 0, activeAsks: 0,
            },
            marketEvidence: {
                carmaziumComparables: 12, liveUkComparables: 0,
            },
        }), { identityStatus: 'MODEL_VERIFIED', now: today });
        expect(r.confidence).toBe('LOW');
        expect(r.assessment.counts.verifiedCompletedAuctions).toBe(0);
        expect(r.assessment.counts.acceptedOffers).toBe(5);
        expect(r.assessment.reasonCodes).toContain('ACCEPTED_OFFERS_NOT_COMPLETED_SALES');
    });

    it('describes properly recorded completed-auction evidence, not independent bank verification', () => {
        const r = assessValuationConfidence(basis({
            source: 'CARMAZIUM_MARKET',
            evidence: {
                completedSales: 0, acceptedOffers: 0, auctionResults: 4, activeAsks: 0,
            },
            auction: { ...basis().auction,
                evidenceBasis: 'OBSERVED', verifiedOutcomes: 4 },
            marketEvidence: {
                carmaziumComparables: 4, liveUkComparables: 0,
            },
        }), { identityStatus: 'MODEL_VERIFIED', now: today });
        expect(r.confidence).toBe('MEDIUM');
        expect(r.assessment.counts.verifiedCompletedAuctions).toBe(4);
        expect(r.assessment.reasonCodes).toContain('HANDOVER_IS_SELLER_ATTESTATION');
        expect(r.confidence).not.toBe('HIGH');
    });

    it('stays LOW for an internal fallback despite a legacy HIGH score and many unrelated records', () => {
        const model = applyEvidenceConfidence(basis({
            source: 'CARMAZIUM_MODEL',
            comparables: 0,
            marketEvidence: {
                carmaziumComparables: 0, liveUkComparables: 0,
                liveUkSearchStatus: 'UNAVAILABLE', valuationStrategy: 'FALLBACK',
            },
        }), 'MODEL_VERIFIED', today);
        expect(model.confidence).toBe('LOW');
        expect(model.confidenceScore).toBe(0.20);
        expect(model.confidenceAssessment?.reasonCodes).toContain('MODEL_ONLY_ESTIMATE');
        expect(model.confidenceAssessment?.headline).toMatch(/model-based guide/);
    });

    it('reports blended live and platform counts separately without inflating verified sale evidence', () => {
        const r = assessValuationConfidence(basis({
            source: 'BLENDED_MARKET',
            marketEvidence: {
                carmaziumComparables: 7, liveUkComparables: 6,
                exactModelComparables: 6, provisionalModelComparables: 0,
                liveSources: ['a.example', 'b.example'], checkedAt: '2026-10-02T11:00:00Z',
            },
        }), { identityStatus: 'MODEL_VERIFIED', now: today });
        expect(r.assessment.counts.otherPlatformMarketSignals).toBe(7);
        expect(r.assessment.counts.uniqueUkAdverts).toBe(6);
        expect(r.assessment.counts.verifiedCompletedAuctions).toBe(0);
        expect(r.assessment.sourceExplanation).toMatch(/combined with 7 separate/);
        expect(r.assessment.limitations.join(' ')).not.toMatch(/bank-verified payments/);
    });
});
