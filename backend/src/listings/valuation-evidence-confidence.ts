import type { VehicleValuationResult } from './vehicle-valuation';

/**
 * Valuation evidence quality v1. This is a conservative, descriptive rubric,
 * NOT a measured probability of hitting the eventual achieved sale price.
 * There is deliberately no HIGH classification until Block 9 calibrates
 * against sufficient verified achieved-sale outcomes.
 */
export const CONFIDENCE_RUBRIC_VERSION = '2026-10-block8-v1' as const;

export interface ValuationConfidenceAssessment {
    rubricVersion: typeof CONFIDENCE_RUBRIC_VERSION;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    calibrationStatus: 'NOT_VALIDATED_AGAINST_ACHIEVED_SALES';
    headline: string;
    sourceExplanation: string;
    limitations: string[];
    reasonCodes: string[];
    counts: {
        uniqueUkAdverts: number;
        exactModelAdverts: number;
        provisionalModelAdverts: number;
        independentAdvertSites: number;
        verifiedCompletedAuctions: number;
        verifiedPrivateSales: number;
        acceptedOffers: number;
        otherPlatformMarketSignals: number;
    };
    checkedAt?: string;
}

type IdentityStatus = 'MODEL_VERIFIED' | 'PARTIAL' | 'UNVERIFIED';

export function assessValuationConfidence(
    valuation: VehicleValuationResult,
    input: {
        identityStatus?: IdentityStatus;
        // Pure and deterministic in tests and on frozen snapshots.
        now?: number;
    } = {},
): { confidence: 'LOW' | 'MEDIUM'; confidenceScore: number; assessment: ValuationConfidenceAssessment } {
    const identity = input.identityStatus
        ?? valuation.identityVerification?.status
        ?? 'UNVERIFIED';
    const evidence = valuation.marketEvidence;
    const live = valuation.source === 'LIVE_UK_MARKET' || valuation.source === 'BLENDED_MARKET';
    const fallbackModel = valuation.source === 'CARMAZIUM_MODEL'
        || valuation.source === 'CARMAZIUM_MODEL_PROFILE';

    const uniqueUkAdverts = live ? Math.max(0, evidence?.liveUkComparables ?? 0) : 0;
    const exact = Math.min(uniqueUkAdverts, Math.max(0, evidence?.exactModelComparables ?? 0));
    const provisional = Math.min(uniqueUkAdverts - exact,
        Math.max(0, evidence?.provisionalModelComparables ?? 0));
    const sites = live ? new Set((evidence?.liveSources ?? []).filter(Boolean)
        .map((x) => x.trim().toLowerCase())).size : 0;
    const verifiedAuctions = Math.max(0, valuation.auction.verifiedOutcomes ?? 0);
    const verifiedPrivate = Math.max(0, valuation.privateSale?.verifiedSales ?? 0);
    const acceptedOffers = Math.max(0, valuation.evidence?.acceptedOffers ?? 0);
    const otherSignals = Math.max(0, evidence?.carmaziumComparables ?? (live ? 0 : valuation.comparables));

    const rawCheckedAt = evidence?.checkedAt;
    const parsed = rawCheckedAt ? Date.parse(rawCheckedAt) : NaN;
    const now = input.now ?? Date.now();
    const usableTimestamp = Number.isFinite(parsed) && parsed <= now + 5 * 60_000
        && parsed > 0;
    const checkedAt = usableTimestamp ? new Date(parsed).toISOString() : undefined;
    const isFresh = usableTimestamp && now - parsed <= 24 * 60 * 60_000
        && now - parsed >= -5 * 60_000;

    // Three exact, independent, reasonably fresh active adverts spanning
    // at least two cited sources are moderate ASKING evidence, not proof of
    // an achieved price. Verified completed auctions are kept separate.
    const strongAsking = live && uniqueUkAdverts >= 3 && exact >= 3
        && sites >= 2 && isFresh;
    const verifiedOutcomeCohort = verifiedAuctions >= 3 || verifiedPrivate >= 3;
    const fullyIdentified = identity === 'MODEL_VERIFIED';
    const medium = !fallbackModel && fullyIdentified
        && (strongAsking || verifiedOutcomeCohort);
    const confidence: 'LOW' | 'MEDIUM' = medium ? 'MEDIUM' : 'LOW';
    // This numeric field is retained for API compatibility. It is a
    // bounded rubric indicator, NOT a percentage chance of accuracy.
    const confidenceScore = fallbackModel ? 0.20 : medium
        ? Math.min(0.64, 0.52 + Math.min(0.12,
            uniqueUkAdverts * 0.012 + (verifiedAuctions + verifiedPrivate) * 0.015))
        : Math.min(0.44, 0.28 + Math.min(0.16,
            uniqueUkAdverts * 0.015 + (verifiedAuctions + verifiedPrivate) * 0.020));

    let sourceExplanation: string;
    if (valuation.source === 'LIVE_UK_MARKET') {
        sourceExplanation = `${uniqueUkAdverts} distinct UK advert${uniqueUkAdverts === 1 ? '' : 's'} found through live market search. These are advertised asking prices, not confirmed selling prices.`;
    } else if (valuation.source === 'BLENDED_MARKET') {
        sourceExplanation = `${uniqueUkAdverts} distinct UK advert${uniqueUkAdverts === 1 ? '' : 's'} combined with ${otherSignals} separate CarMazium marketplace signal${otherSignals === 1 ? '' : 's'}. Asking prices and historical platform signals are different evidence types.`;
    } else if (valuation.source === 'CARMAZIUM_MARKET') {
        sourceExplanation = `Current external UK adverts were unavailable; this guide uses ${Math.max(valuation.comparables, otherSignals)} CarMazium marketplace signal${Math.max(valuation.comparables, otherSignals) === 1 ? '' : 's'}, which may include asking prices, accepted offers and completed transactions.`;
    } else {
        sourceExplanation = valuation.source === 'CARMAZIUM_MODEL_PROFILE'
            ? 'Live marketplace evidence was unavailable; this is a model-specific age-and-mileage depreciation estimate, not an observed sale price.'
            : 'Live marketplace evidence was unavailable; this is a broad age-and-mileage depreciation estimate, not an observed sale price.';
    }

    const limitations: string[] = [];
    const codes: string[] = [];
    if (!fullyIdentified) {
        limitations.push('The exact vehicle identity or derivative is not fully independently verified.');
        codes.push('IDENTITY_PARTIAL_OR_UNKNOWN');
    }
    if (fallbackModel) {
        limitations.push('No usable current, exact-model live-market comparison was available.');
        codes.push('MODEL_ONLY_ESTIMATE');
    } else if (live) {
        if (uniqueUkAdverts < 3) {
            limitations.push('Fewer than three distinct current UK adverts were accepted.');
            codes.push('SPARSE_UK_ADVERTS');
        }
        if (exact < 3) {
            limitations.push(exact === 0
                ? 'Exact-model matching evidence has not been confirmed for the accepted UK adverts.'
                : 'Fewer than three adverts have an independently supported exact-model match.');
            codes.push('EXACT_MODEL_EVIDENCE_LIMITED');
        }
        if (provisional > 0) {
            limitations.push('Some advert matches are provisional model-family, spelling or title-only matches.');
            codes.push('PROVISIONAL_MODEL_MATCHES');
        }
        if (sites < 2) {
            limitations.push('Fewer than two independently identified UK advert sources contributed.');
            codes.push('LIMITED_ADVERT_SOURCE_DIVERSITY');
        }
        if (!isFresh) {
            limitations.push(usableTimestamp
                ? 'The last accepted live-market evidence is over 24 hours old.'
                : 'A valid time for the accepted live-market evidence was not available.');
            codes.push('LIVE_EVIDENCE_FRESHNESS_LIMITED');
        }
    }
    if (verifiedAuctions > 0) {
        limitations.push('Completed auction handovers reflect seller-confirmed funds, not independently bank-verified payments.');
        codes.push('HANDOVER_IS_SELLER_ATTESTATION');
    }
    // Three recorded outcomes are enough for a descriptive, provisional
    // channel-specific comparison, NOT an accuracy-calibration dataset.
    if (!verifiedOutcomeCohort) {
        limitations.push('The estimate lacks a sufficient verified achieved-sale cohort for a descriptive channel comparison.');
        codes.push('LIMITED_VERIFIED_OUTCOMES');
    }
    if (acceptedOffers > 0) {
        limitations.push('An accepted offer is not evidence that a vehicle was handed over or paid for.');
        codes.push('ACCEPTED_OFFERS_NOT_COMPLETED_SALES');
    }
    limitations.push('This is indicative evidence strength, not a measured probability or a guaranteed sale price.');
    codes.push('NO_OUTCOME_CALIBRATION');

    const headline = confidence === 'MEDIUM'
        ? 'Several qualifying market signals are available, but achieved-sale accuracy has not yet been calibrated.'
        : fallbackModel
            ? 'This is a low-evidence model-based guide, not a current observed market valuation.'
            : 'Market evidence has important gaps; treat this as a provisional guide.';

    return {
        confidence,
        confidenceScore: Number(confidenceScore.toFixed(2)),
        assessment: {
            rubricVersion: CONFIDENCE_RUBRIC_VERSION,
            level: confidence,
            calibrationStatus: 'NOT_VALIDATED_AGAINST_ACHIEVED_SALES',
            headline,
            sourceExplanation,
            limitations,
            reasonCodes: codes,
            counts: {
                uniqueUkAdverts, exactModelAdverts: exact,
                provisionalModelAdverts: provisional,
                independentAdvertSites: sites,
                verifiedCompletedAuctions: verifiedAuctions,
                verifiedPrivateSales: verifiedPrivate,
                acceptedOffers,
                otherPlatformMarketSignals: otherSignals,
            },
            ...(checkedAt ? { checkedAt } : {}),
        },
    };
}

/** Always apply before freezing a base. The identity label is appended later. */
export function applyEvidenceConfidence(
    valuation: VehicleValuationResult,
    status: IdentityStatus,
    now?: number,
): VehicleValuationResult {
    const { confidence, confidenceScore, assessment } = assessValuationConfidence(
        valuation, { identityStatus: status, now },
    );
    return { ...valuation, confidence, confidenceScore, confidenceAssessment: assessment };
}
