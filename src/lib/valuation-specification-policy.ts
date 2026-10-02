/**
 * CarMazium valuation specification policy, version 2026-10-b7-v1.
 *
 * Exact source copy is shared between the backend, website and native app.
 * Do not independently edit the coefficients in individual applications.
 * A backend parity test compares the three module contents byte for byte.
 *
 * The market base always belongs to one make/model/year/mileage identity.
 * These factors adjust that ORIGINAL base; never compound from an already
 * adjusted quote, requery market data or change evidence/confidence labels.
 * Coefficients are existing provisional guides, NOT proven sale-price effects.
 */
export const SPECIFICATION_POLICY_VERSION = '2026-10-b7-v1' as const;

export interface VehicleSpecificationFacts {
    condition?: string | null;
    exteriorGrade?: number | null;
    serviceHistory?: string | null;
    owners?: string | null;
    numberOfKeys?: number | null;
    ulezCompliant?: boolean | null;
    euroStandard?: string | null;
    features?: string[] | null;
    writeOffCategory?: string | null;
    isImported?: boolean | null;
    transmission?: string | null;
    fuelType?: string | null;
    variant?: string | null;
    doors?: number | null;
    seats?: number | null;
}

export interface SpecificationPriceSnapshot {
    low: number;
    mid: number;
    high: number;
    explanation: string;
    retail: { suggestedAsking: number; suggestedMinimum: number };
    privateSale?: { low: number; mid: number; high: number };
    auction: {
        marketValue: number;
        openingBid: number;
        reserveLow: number;
        reserveHigh: number;
        suggestedReserve: number;
    };
}

export interface SpecificationAdjustmentAudit {
    policyVersion: typeof SPECIFICATION_POLICY_VERSION;
    factor: number;
    reasonCodes: string[];
    // Captures the unmodified source prices so later user edits can always
    // be applied to that SAME frozen base, including after JSON round-trips.
    base: SpecificationPriceSnapshot;
}

export interface SpecificationValuation {
    low: number;
    mid: number;
    high: number;
    explanation: string;
    retail: { suggestedAsking: number; suggestedMinimum: number };
    privateSale?: { low: number; mid: number; high: number };
    auction: {
        marketValue: number;
        openingBid: number;
        reserveLow: number;
        reserveHigh: number;
        suggestedReserve: number;
    };
    specificationAdjustment?: SpecificationAdjustmentAudit;
}

const normalized = (value?: string | null): string =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const compact = (value?: string | null): string => normalized(value).replace(/\s/g, '');
const bounded = (x: number, low: number, high: number): number =>
    Math.min(high, Math.max(low, x));

export function roundSpecificationMoney(value: number): number {
    const safe = Math.max(500, value);
    const step = safe < 10000 ? 50 : 100;
    return Math.round(safe / step) * step;
}

/**
 * The wizard computes the exterior grade from the number of independently
 * recorded defects: 0-1 -> 1, 2-3 -> 2, 4-5 -> 3, 6-7 -> 4, 8+ -> 5.
 * Missing or invalid counts are unknown, not automatically "no damage".
 */
export function exteriorGradeFromDefectCount(count?: number | null): number | null {
    if (count == null || !Number.isSafeInteger(count) || count < 0) return null;
    return Math.min(5, 1 + Math.floor(count / 2));
}

/**
 * Calculates a transparent breakdown in a stable order. No raw vehicle
 * information enters reasonCodes, analytics, cache keys or console logs.
 */
export function calculateSpecificationAdjustment(
    input: VehicleSpecificationFacts,
): { factor: number; reasonCodes: string[] } {
    let raw = 1;
    const reasonCodes: string[] = [];
    const add = (factor: number, code: string) => {
        if (factor !== 1) {
            raw *= factor;
            reasonCodes.push(code);
        }
    };

    const condition = compact(input.condition);
    if (condition === 'EXCELLENT') add(1.03, 'CONDITION_EXCELLENT');
    else if (condition === 'FAIR') add(0.93, 'CONDITION_FAIR');
    else if (condition === 'POOR') add(0.84, 'CONDITION_POOR');

    const grade = input.exteriorGrade;
    if (Number.isInteger(grade) && grade != null) {
        if (grade === 2) add(0.99, 'EXTERIOR_GRADE_2');
        if (grade === 3) add(0.97, 'EXTERIOR_GRADE_3');
        if (grade === 4) add(0.94, 'EXTERIOR_GRADE_4');
        if (grade === 5) add(0.90, 'EXTERIOR_GRADE_5');
    }

    const writeOff = compact(input.writeOffCategory);
    if (writeOff === 'CATN' || writeOff === 'CATEGORYN') add(0.82, 'WRITE_OFF_N');
    else if (writeOff === 'CATS' || writeOff === 'CATEGORYS') add(0.75, 'WRITE_OFF_S');
    else if (writeOff === 'CATA' || writeOff === 'CATEGORYA') add(0.25, 'WRITE_OFF_A');
    else if (writeOff === 'CATB' || writeOff === 'CATEGORYB') add(0.30, 'WRITE_OFF_B');

    const history = normalized(input.serviceHistory);
    if (history === 'NONE' || history.includes('NO SERVICE') || history.includes('NOT FULL')) {
        add(0.96, 'SERVICE_NONE_OR_UNCONFIRMED');
    } else if (history.includes('PARTIAL')) {
        add(0.99, 'SERVICE_PARTIAL');
    } else if (history.includes('FULL')) {
        add(1.02, 'SERVICE_FULL');
    }

    const ownerText = normalized(input.owners);
    const ownerMatch = ownerText.match(/^([1-9][0-9]?)$/);
    const owners = ownerMatch ? Number(ownerMatch[1]) : null;
    if (owners === 1) add(1.02, 'ONE_KEEPER');
    else if (owners === 2) add(1.01, 'TWO_KEEPERS');
    else if (owners === 4) add(0.98, 'FOUR_KEEPERS');
    else if (owners != null && owners >= 5) add(0.96, 'FIVE_PLUS_KEEPERS');

    if (input.numberOfKeys === 1) add(0.985, 'ONE_KEY');

    // Explicit ULEZ status takes priority; never stack Euro and ULEZ factors.
    if (input.ulezCompliant === true) add(1.01, 'ULEZ_COMPLIANT');
    else if (input.ulezCompliant === false) add(0.96, 'ULEZ_NONCOMPLIANT');
    else {
        const euro = compact(input.euroStandard);
        if (euro === 'EURO6' || euro === 'EURO6D') add(1.01, 'EURO_6');
        else if (euro === 'EURO5') add(0.995, 'EURO_5');
        else if (euro === 'EURO4') add(0.985, 'EURO_4');
        else if (['EURO1', 'EURO2', 'EURO3'].includes(euro)) add(0.96, 'EURO_1_TO_3');
    }

    // Equipment is categorical, not per-entry. Duplicate or reordered
    // features must never compound price uplifts.
    const features = [...new Set((input.features ?? [])
        .filter((feature): feature is string => typeof feature === 'string')
        .map(normalized)
        .filter(Boolean))];
    const contains = (...patterns: string[]) =>
        features.some((feature) => patterns.some((pattern) => feature.includes(pattern)));
    let equipment = 0;
    if (contains('PANORAMIC', 'PAN ROOF', 'SUNROOF')) equipment += 0.005;
    if (contains('LEATHER')) equipment += 0.004;
    if (contains('HEATED SEAT')) equipment += 0.003;
    if (contains('360 CAMERA', 'REVERSE CAMERA', 'REVERSING CAMERA')) equipment += 0.003;
    if (contains('NAVIGATION', 'SAT NAV')) equipment += 0.002;
    if (contains('APPLE CARPLAY', 'ANDROID AUTO')) equipment += 0.002;
    if (contains('PARKING SENSOR')) equipment += 0.002;
    if (contains('LED HEADLIGHT', 'MATRIX LED')) equipment += 0.0015;
    if (equipment) add(1 + Math.min(0.018, equipment), 'EQUIPMENT_CAPPED');

    if (input.isImported === true) add(0.92, 'IMPORTED');

    const transmission = compact(input.transmission);
    if (['AUTOMATIC', 'AUTO', 'CVT', 'SEMIAUTOMATIC', 'SEMIAUTO', 'DCT', 'DSG'].includes(transmission)) {
        add(1.03, 'AUTOMATIC_FAMILY');
    } else if (transmission === 'MANUAL') {
        add(0.98, 'MANUAL');
    }

    const fuel = compact(input.fuelType);
    if (fuel.includes('PLUGINHYBRID') || fuel.includes('PHEV')) add(1.01, 'PLUGIN_HYBRID');
    else if (fuel.includes('HYBRID')) add(1.0075, 'HYBRID');
    else if (fuel === 'DIESEL') add(0.995, 'DIESEL');
    else if (['LPG', 'BIFUEL', 'NATURALGAS'].includes(fuel)) add(0.98, 'ALTERNATIVE_FUEL');

    const variant = normalized(input.variant);
    const hasToken = (pattern: string): boolean =>
        (' ' + variant + ' ').includes(' ' + pattern + ' ');
    // A trim named AMG Line, M Sport or GR Sport is not independently
    // evidence of an AMG engine / M Competition / GR performance model.
    if (['M SPORT COMPETITION', 'M COMPETITION', 'GTI', 'TYPE R', 'GRMN',
        'N PERFORMANCE', 'VRS'].some(hasToken)
        || (hasToken('AMG') && !hasToken('AMG LINE'))) {
        add(1.02, 'PERFORMANCE_VARIANT_PROVISIONAL');
    } else if (['M SPORT', 'AMG LINE', 'S LINE', 'R LINE', 'ST LINE', 'N LINE',
        'GT LINE', 'GR SPORT', 'TITANIUM', 'VIGNALE', 'TEKNA',
        'PORTFOLIO', 'AUTOBIOGRAPHY', 'HSE', 'R DESIGN', 'INSCRIPTION',
        'EXCEL'].some(hasToken)) {
        add(1.01, 'PREMIUM_TRIM_PROVISIONAL');
    }

    if (input.doors === 5) add(1.004, 'FIVE_DOORS');
    else if (input.doors === 3) add(0.996, 'THREE_DOORS');
    else if (input.doors === 2) add(0.992, 'TWO_DOORS');

    if (input.seats != null && Number.isSafeInteger(input.seats) && input.seats >= 7) {
        add(1.008, 'SEVEN_PLUS_SEATS');
    } else if (input.seats != null && Number.isSafeInteger(input.seats)
        && input.seats >= 1 && input.seats <= 2) {
        add(0.995, 'ONE_OR_TWO_SEATS');
    }

    const factor = bounded(raw, 0.18, 1.20);
    if (factor !== raw) reasonCodes.push(factor === 0.18 ? 'POLICY_FLOOR' : 'POLICY_CEILING');
    return { factor: Math.round(factor * 1e8) / 1e8, reasonCodes };
}

function priceSnapshot(quote: SpecificationValuation): SpecificationPriceSnapshot {
    return {
        low: quote.low, mid: quote.mid, high: quote.high,
        explanation: quote.explanation,
        retail: {
            suggestedAsking: quote.retail.suggestedAsking,
            suggestedMinimum: quote.retail.suggestedMinimum,
        },
        privateSale: quote.privateSale ? {
            low: quote.privateSale.low, mid: quote.privateSale.mid,
            high: quote.privateSale.high,
        } : undefined,
        auction: {
            marketValue: quote.auction.marketValue,
            openingBid: quote.auction.openingBid,
            reserveLow: quote.auction.reserveLow,
            reserveHigh: quote.auction.reserveHigh,
            suggestedReserve: quote.auction.suggestedReserve,
        },
    };
}

/**
 * Recalculate from the ORIGINAL frozen base, even when an already-adjusted
 * backend quote is forwarded to this helper by web/native, when seller edits
 * specification twice, or after quote JSON serialization.
 */
export function applySpecificationToFrozenValuation<T extends SpecificationValuation>(
    quote: T,
    input: VehicleSpecificationFacts,
): T {
    const original = quote.specificationAdjustment?.base ?? priceSnapshot(quote);
    const { factor, reasonCodes } = calculateSpecificationAdjustment(input);

    const retail = {
        ...quote.retail,
        suggestedAsking: roundSpecificationMoney(original.retail.suggestedAsking * factor),
        suggestedMinimum: roundSpecificationMoney(original.retail.suggestedMinimum * factor),
    };
    const privateSale = original.privateSale ? {
        ...quote.privateSale,
        low: roundSpecificationMoney(original.privateSale.low * factor),
        mid: roundSpecificationMoney(original.privateSale.mid * factor),
        high: roundSpecificationMoney(original.privateSale.high * factor),
    } : undefined;
    const reserveLow = roundSpecificationMoney(original.auction.reserveLow * factor);
    const reserveHigh = Math.max(
        reserveLow + 50,
        roundSpecificationMoney(original.auction.reserveHigh * factor),
    );
    const auction = {
        ...quote.auction,
        marketValue: roundSpecificationMoney(original.auction.marketValue * factor),
        openingBid: Math.min(
            roundSpecificationMoney(original.auction.openingBid * factor),
            Math.max(500, reserveLow - 50),
        ),
        reserveLow,
        reserveHigh,
        suggestedReserve: Math.max(
            reserveLow,
            Math.min(reserveHigh, roundSpecificationMoney(original.auction.suggestedReserve * factor)),
        ),
    };

    if (factor === 1) {
        // Do not repeatedly append explanatory copy or carry an old factor
        // when a customer returns from edited specifications to neutral data.
        return {
            ...quote,
            low: original.low, mid: original.mid, high: original.high,
            explanation: original.explanation,
            retail,
            privateSale,
            auction,
            specificationAdjustment: undefined,
        };
    }

    return {
        ...quote,
        low: roundSpecificationMoney(original.low * factor),
        mid: roundSpecificationMoney(original.mid * factor),
        high: roundSpecificationMoney(original.high * factor),
        retail, privateSale, auction,
        explanation: original.explanation
            + ' Seller-provided condition and specification have then been applied to that base value.',
        specificationAdjustment: {
            policyVersion: SPECIFICATION_POLICY_VERSION,
            factor,
            reasonCodes,
            base: original,
        },
    };
}
