export type ValuationEvidenceKind =
    | 'SALE'
    | 'ACCEPTED_OFFER'
    | 'AUCTION_RESULT'
    | 'ACTIVE_ASK';

export interface VehicleValuationInput {
    make: string;
    model: string;
    year: number;
    mileage: number;
    variant?: string;
    fuelType?: string;
    transmission?: string;
    condition?: string;
    exteriorGrade?: number;
    serviceHistory?: string;
    owners?: string;
    writeOffCategory?: string;
    isImported?: boolean;
}

export interface VehicleValuationComparable {
    price: number;
    year: number | null;
    mileage: number | null;
    variant?: string | null;
    fuelType?: string | null;
    transmission?: string | null;
    writeOffCategory?: string | null;
    condition?: string | null;
    exteriorGrade?: number | null;
    serviceHistory?: string | null;
    owners?: string | null;
    isImported?: boolean | null;
    kind: ValuationEvidenceKind;
}

export interface VehicleValuationResult {
    low: number;
    mid: number;
    high: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    confidenceScore: number;
    comparables: number;
    evidence: {
        completedSales: number;
        acceptedOffers: number;
        auctionResults: number;
        activeAsks: number;
    };
    source:
        | 'CARMAZIUM_MARKET'
        | 'LIVE_UK_MARKET'
        | 'BLENDED_MARKET'
        | 'CARMAZIUM_MODEL_PROFILE'
        | 'CARMAZIUM_MODEL';
    marketEvidence?: {
        carmaziumComparables: number;
        liveUkComparables: number;
        checkedAt?: string;
        liveUkSearchStatus?: 'USED' | 'INSUFFICIENT' | 'UNAVAILABLE';
        rawLiveUkComparables?: number;
    };
    explanation: string;
    retail: {
        suggestedAsking: number;
        suggestedMinimum: number;
    };
    auction: {
        marketValue: number;
        openingBid: number;
        reserveLow: number;
        reserveHigh: number;
        suggestedReserve: number;
    };
}

const BASE_NEW_VALUES: Record<string, number> = {
    'ABARTH': 26000,
    'ALFA ROMEO': 38000,
    'AUDI': 47000,
    'BMW': 48000,
    'CITROEN': 28000,
    'CITROËN': 28000,
    'DACIA': 22000,
    'FIAT': 25000,
    'FORD': 33000,
    'HONDA': 35000,
    'HYUNDAI': 34000,
    'JAGUAR': 50000,
    'JEEP': 43000,
    'KIA': 34000,
    'LAND ROVER': 57000,
    'LEXUS': 50000,
    'MAZDA': 33000,
    'MERCEDES': 50000,
    'MERCEDES-BENZ': 50000,
    'MG': 27000,
    'MINI': 33000,
    'MITSUBISHI': 32000,
    'NISSAN': 32000,
    'PEUGEOT': 29000,
    'PORSCHE': 82000,
    'RENAULT': 29000,
    'SEAT': 30000,
    'SKODA': 34000,
    'SUBARU': 39000,
    'SUZUKI': 26000,
    'TESLA': 46000,
    'TOYOTA': 36000,
    'VAUXHALL': 29000,
    'VOLKSWAGEN': 37000,
    'VOLVO': 48000,
};

const MODEL_FALLBACK_PROFILES: Record<string, { baseNewValue: number; retainedValueAdjustment: number }> = {
    // Calibrated against a real 2019 Jaguar XE 2.0 Portfolio Auto benchmark
    // supplied during QA. The make-wide £50k Jaguar fallback is too high for
    // this model and produced a materially misleading low-confidence estimate.
    'JAGUAR|XE': { baseNewValue: 35000, retainedValueAdjustment: 0.825 },
};

function getModelFallbackProfile(input: VehicleValuationInput) {
    const key = `${normalizeText(input.make)}|${normalizeText(input.model)}`;
    return MODEL_FALLBACK_PROFILES[key] ?? null;
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function roundMoney(value: number): number {
    const safe = Math.max(500, value);
    const step = safe < 10000 ? 50 : 100;
    return Math.round(safe / step) * step;
}

function normalizeText(value?: string | null): string {
    return (value ?? '').trim().toUpperCase();
}

function transmissionFamily(value?: string | null): 'MANUAL' | 'AUTO' | null {
    const normalized = normalizeText(value).replace(/[^A-Z]/g, '');
    if (!normalized) return null;
    if (normalized === 'MANUAL') return 'MANUAL';
    if (['AUTOMATIC', 'AUTO', 'CVT', 'SEMIAUTOMATIC', 'SEMIAUTO'].includes(normalized)) return 'AUTO';
    return null;
}

function fallbackMid(input: VehicleValuationInput): { value: number; calibratedModelProfile: boolean } {
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - input.year);
    const modelProfile = getModelFallbackProfile(input);
    let value = modelProfile?.baseNewValue ?? BASE_NEW_VALUES[normalizeText(input.make)] ?? 32000;

    for (let year = 1; year <= age; year += 1) {
        value *= year === 1 ? 0.78 : year <= 3 ? 0.85 : year <= 7 ? 0.89 : 0.92;
    }

    const expectedMileage = Math.max(6000, age * 8500);
    const mileageDeltaThousands = (input.mileage - expectedMileage) / 1000;
    const mileageFactor = clamp(1 - mileageDeltaThousands * 0.0035, 0.72, 1.15);
    value *= mileageFactor;

    // Transmission materially affects used-car values. When no same-model
    // marketplace evidence exists, use a deliberately modest fallback
    // adjustment rather than treating manual and automatic cars identically.
    const transmission = transmissionFamily(input.transmission);
    if (transmission === 'AUTO') value *= 1.04;
    if (transmission === 'MANUAL') value *= 0.96;

    if (modelProfile) value *= modelProfile.retainedValueAdjustment;

    return {
        value: Math.max(500, value),
        calibratedModelProfile: !!modelProfile,
    };
}

function vehicleProfileFactor(input: {
    condition?: string | null;
    exteriorGrade?: number | null;
    serviceHistory?: string | null;
    owners?: string | null;
    writeOffCategory?: string | null;
    isImported?: boolean | null;
}): number {
    const condition = normalizeText(input.condition);
    const writeOff = normalizeText(input.writeOffCategory);

    let factor = 1;
    if (condition === 'EXCELLENT') factor *= 1.03;
    if (condition === 'FAIR') factor *= 0.93;
    if (condition === 'POOR') factor *= 0.84;

    // Exterior grade is computed from seller-marked defects, not chosen by the
    // seller. Keep this adjustment deliberately modest because the separate
    // condition field also influences value; this avoids double-penalising a
    // vehicle while still making higher defect grades materially affect price.
    const grade = Number(input.exteriorGrade);
    if (grade === 2) factor *= 0.99;
    if (grade === 3) factor *= 0.97;
    if (grade === 4) factor *= 0.94;
    if (grade >= 5) factor *= 0.90;

    if (writeOff === 'CAT_N') factor *= 0.82;
    if (writeOff === 'CAT_S') factor *= 0.75;
    if (writeOff === 'CAT_A') factor *= 0.25;
    if (writeOff === 'CAT_B') factor *= 0.30;

    const service = normalizeText(input.serviceHistory);
    if (service === 'FULL' || service.includes('FULL')) factor *= 1.02;
    if (service === 'NONE') factor *= 0.96;

    const owners = normalizeText(input.owners);
    if (owners === '1') factor *= 1.02;
    if (owners === '4') factor *= 0.98;
    if (owners === '5' || owners === '5+') factor *= 0.96;

    if (input.isImported) factor *= 0.92;

    return factor;
}

function normalizeComparable(
    input: VehicleValuationInput,
    comparable: VehicleValuationComparable,
): { value: number; weight: number } | null {
    if (!Number.isFinite(comparable.price) || comparable.price < 250) return null;

    const compYear = comparable.year ?? input.year;
    const compMileage = comparable.mileage ?? input.mileage;

    // Normalise a nearby comparable to the target vehicle's age and mileage.
    // Newer comparable -> reduce it to target-year terms; older -> increase.
    const yearFactor = Math.pow(0.92, compYear - input.year);
    const mileageDeltaThousands = (input.mileage - compMileage) / 1000;
    const mileageFactor = clamp(1 - mileageDeltaThousands * 0.004, 0.78, 1.22);

    let value = comparable.price * yearFactor * mileageFactor;
    // Negotiated offers and auction outcomes are directly observed agreed/bid
    // prices. A Sale row is still strong evidence, but some legacy "mark sold"
    // paths recorded the advert asking price when no explicit sold price was
    // supplied, so it is weighted slightly below negotiated outcomes.
    let weight =
        comparable.kind === 'ACCEPTED_OFFER' ? 0.95 :
        comparable.kind === 'AUCTION_RESULT' ? 0.85 :
        comparable.kind === 'SALE' ? 0.75 :
        0.25;

    // Live adverts are asking prices, not achieved prices. Apply a small
    // conservative adjustment so an optimistic seller advert does not become
    // the valuation itself.
    if (comparable.kind === 'ACTIVE_ASK') value *= 0.96;

    // Normalise the comparable's known condition/history profile to the target
    // vehicle instead of applying a blanket target discount afterwards. This
    // avoids double-discounting, for example, a Cat S vehicle when the best
    // comparable is already Cat S.
    const targetProfileFactor = vehicleProfileFactor(input);
    const comparableProfileFactor = vehicleProfileFactor(comparable);
    value *= targetProfileFactor / Math.max(0.20, comparableProfileFactor);

    // Auction outcomes are normally trade-facing. Convert them to a cautious
    // retail-market equivalent before mixing them with classified evidence.
    if (comparable.kind === 'AUCTION_RESULT') value *= 1.10;

    const targetFuel = normalizeText(input.fuelType);
    const compFuel = normalizeText(comparable.fuelType);
    if (targetFuel && compFuel) weight *= targetFuel === compFuel ? 1.10 : 0.80;

    const targetTransmission = normalizeText(input.transmission);
    const compTransmission = normalizeText(comparable.transmission);
    if (targetTransmission && compTransmission) {
        if (targetTransmission === compTransmission) {
            weight *= 1.18;
        } else {
            // A mismatched gearbox should not merely get a lower statistical
            // weight; its price also needs normalising toward the target car.
            // Auto/CVT/semi-auto cars receive a modest premium over manual in
            // the sparse-data fallback, while exact same-transmission evidence
            // remains strongly preferred.
            const targetFamily = transmissionFamily(targetTransmission);
            const compFamily = transmissionFamily(compTransmission);
            if (targetFamily && compFamily && targetFamily !== compFamily) {
                value *= targetFamily === 'AUTO' ? 1.07 : 0.93;
            }
            weight *= 0.60;
        }
    }

    const targetVariant = normalizeText(input.variant);
    const compVariant = normalizeText(comparable.variant);
    if (targetVariant && compVariant) {
        weight *= targetVariant === compVariant ? 1.15 : 0.82;
    }

    const targetWriteOff = normalizeText(input.writeOffCategory || 'NONE');
    const compWriteOff = normalizeText(comparable.writeOffCategory || 'NONE');
    if (targetWriteOff && compWriteOff) {
        weight *= targetWriteOff === compWriteOff ? 1.08 : 0.72;
    }

    return { value, weight };
}

function weightedQuantile(
    rows: Array<{ value: number; weight: number }>,
    quantile: number,
): number {
    if (rows.length === 0) return 0;
    const sorted = [...rows].sort((a, b) => a.value - b.value);
    const totalWeight = sorted.reduce((sum, row) => sum + row.weight, 0);
    const threshold = totalWeight * quantile;
    let running = 0;

    for (const row of sorted) {
        running += row.weight;
        if (running >= threshold) return row.value;
    }
    return sorted[sorted.length - 1].value;
}

export function calculateVehicleValuation(
    input: VehicleValuationInput,
    comparables: VehicleValuationComparable[],
): VehicleValuationResult {
    const fallbackResult = fallbackMid(input);
    const fallback = fallbackResult.value;
    const normalized = comparables
        .map((row) => normalizeComparable(input, row))
        .filter((row): row is { value: number; weight: number } => !!row);

    // Remove extreme outliers only when enough evidence exists to identify them.
    let usable = normalized;
    if (normalized.length >= 5) {
        const median = weightedQuantile(normalized, 0.5);
        usable = normalized.filter((row) =>
            row.value >= median * 0.50 && row.value <= median * 1.80,
        );
    }

    const evidence = {
        completedSales: comparables.filter((row) => row.kind === 'SALE').length,
        acceptedOffers: comparables.filter((row) => row.kind === 'ACCEPTED_OFFER').length,
        auctionResults: comparables.filter((row) => row.kind === 'AUCTION_RESULT').length,
        activeAsks: comparables.filter((row) => row.kind === 'ACTIVE_ASK').length,
    };

    const strongEvidence = evidence.completedSales + evidence.acceptedOffers + evidence.auctionResults;
    const activeEvidence = evidence.activeAsks;
    const totalWeight = usable.reduce((sum, row) => sum + row.weight, 0);

    let marketMid = usable.length > 0 ? weightedQuantile(usable, 0.5) : fallback;
    if (usable.length === 1) marketMid = marketMid * 0.45 + fallback * 0.55;
    if (usable.length === 2) marketMid = marketMid * 0.65 + fallback * 0.35;

    const mid = roundMoney(marketMid);

    let lowRaw: number;
    let highRaw: number;
    if (usable.length >= 4) {
        lowRaw = weightedQuantile(usable, 0.25);
        highRaw = weightedQuantile(usable, 0.75);
    } else {
        lowRaw = mid * (usable.length === 0 ? 0.82 : 0.88);
        highRaw = mid * (usable.length === 0 ? 1.18 : 1.12);
    }

    // Keep ranges honest but useful. Sparse asking-price evidence can contain
    // a single badly priced advert; do not let that one advert turn a £10k car
    // into a displayed £5k–£11k "valuation". Completed transaction evidence is
    // allowed a little more dispersion, but even then we cap the visible range.
    const rangeFloor = strongEvidence > 0 ? mid * 0.80 : mid * 0.85;
    const rangeCeiling = strongEvidence > 0 ? mid * 1.20 : mid * 1.15;
    lowRaw = Math.max(lowRaw, rangeFloor);
    highRaw = Math.min(highRaw, rangeCeiling);

    // Also avoid false precision: even a tight cluster should still be shown as
    // a guide rather than an exact guaranteed sale price.
    lowRaw = Math.min(lowRaw, mid * 0.93);
    highRaw = Math.max(highRaw, mid * 1.07);

    const low = roundMoney(Math.min(lowRaw, mid));
    const high = roundMoney(Math.max(highRaw, mid));

    const confidenceScore = usable.length === 0
        ? 0.20
        : clamp(
            0.25 +
            Math.min(0.42, strongEvidence * 0.08) +
            Math.min(0.18, activeEvidence * 0.025) +
            Math.min(0.08, totalWeight * 0.01),
            0.25,
            0.90,
        );

    const confidence =
        confidenceScore >= 0.68 ? 'HIGH' :
        confidenceScore >= 0.45 ? 'MEDIUM' :
        'LOW';

    const source =
        usable.length > 0
            ? 'CARMAZIUM_MARKET'
            : fallbackResult.calibratedModelProfile
                ? 'CARMAZIUM_MODEL_PROFILE'
                : 'CARMAZIUM_MODEL';

    const explanation =
        source === 'CARMAZIUM_MODEL_PROFILE'
            ? 'CarMazium has limited live marketplace evidence for this exact vehicle, so this estimate uses a calibrated model-specific depreciation profile together with age, mileage and transmission.'
            : source === 'CARMAZIUM_MODEL'
                ? 'Exact-model market evidence is limited, so this LOW-confidence guide uses vehicle age, mileage, transmission and a conservative make-level depreciation model. It is a starting point rather than a guaranteed sale price.'
                : strongEvidence > 0
                    ? `Based on ${usable.length} similar CarMazium vehicles, including ${strongEvidence} completed sale, accepted-offer or auction outcome signal${strongEvidence === 1 ? '' : 's'}.`
                    : `Based on ${usable.length} similar live CarMazium asking prices. Completed-sale evidence for this exact vehicle is still limited.`;

    // Retail should show the stronger end of the observed asking market.
    // Sellers can still choose their own figure, but the platform does not
    // encourage them to under-list a clean retail vehicle.
    const suggestedAsking = high;
    const suggestedMinimum = mid;

    // Dealer auctions need a visibly lower guide than retail so traders can
    // buy with realistic preparation, warranty and resale margin. Use the
    // lower end of the market range as the dealer-buy guide, then calculate
    // the opening/reserve guidance from that lower anchor.
    const auctionMarketValue = low;
    const openingBid = Math.round(auctionMarketValue * 0.70 * 100) / 100;
    const reserveLow = Math.round(auctionMarketValue * 0.90 * 100) / 100;
    const reserveHigh = Math.round(auctionMarketValue * 1.00 * 100) / 100;
    const suggestedReserve = roundMoney(auctionMarketValue * 0.95);

    return {
        low,
        mid,
        high,
        confidence,
        confidenceScore: Number(confidenceScore.toFixed(2)),
        comparables: usable.length,
        evidence,
        source,
        explanation,
        retail: {
            suggestedAsking,
            suggestedMinimum,
        },
        auction: {
            marketValue: auctionMarketValue,
            openingBid,
            reserveLow,
            reserveHigh,
            suggestedReserve,
        },
    };
}
