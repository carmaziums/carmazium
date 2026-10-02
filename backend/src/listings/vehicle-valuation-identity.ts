/**
 * Market-base identity, deliberately narrower than vehicle-registration identity.
 * Canonicalise harmless label differences, but keep model generations and trims
 * distinct: CONNECT !== TRANSIT CONNECT and FIESTA !== FIESTA ST.
 */
export interface ValuationBaseIdentityInput {
    registration?: string | null;
    make: string;
    model: string;
    year: number;
    mileage: number;
    variant?: string | null;
}

const clean = (input?: string | null) =>
    (input ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

export function canonicalValuationMake(input: string): string {
    const make = clean(input);
    const aliases: Record<string, string> = {
        VW: 'VOLKSWAGEN',
        MERCEDESBENZ: 'MERCEDES',
        MERCEDESBENZCARS: 'MERCEDES',
    };
    return aliases[make] ?? make;
}

export function canonicalValuationModel(model: string, make: string): string {
    const makeKey = canonicalValuationMake(make);
    let value = clean(model);
    // Registry, MOT and manual input can return "Audi A1" or "A1".
    // Remove ONLY a full repeated manufacturer prefix; never fuzzy-match
    // short model names or strip generation/performance suffixes.
    while (makeKey && value.startsWith(makeKey) && value.length > makeKey.length) {
        value = value.slice(makeKey.length);
    }
    // Source data sometimes expands the prefix with the full manufacturer
    // while the request uses a documented alias such as VW.
    return value;
}

export function canonicalValuationIdentity(input: ValuationBaseIdentityInput) {
    return {
        registration: clean(input.registration),
        make: canonicalValuationMake(input.make),
        model: canonicalValuationModel(input.model, input.make),
        year: Number(input.year),
        mileage: Number(input.mileage),
    };
}

export function canonicalValuationCacheParts(input: ValuationBaseIdentityInput): string[] {
    const identity = canonicalValuationIdentity(input);
    // The first market request may supply a variant. Do not let the base
    // for an explicit performance derivative contaminate a generic quote
    // for the same registration, nor silently combine two different trims.
    // Later specification adjustments within the same valuationId keep
    // the existing immutable journey contract.
    const parts = [
        identity.registration, identity.make, identity.model,
        String(identity.year), String(identity.mileage),
    ];
    const variant = clean(input.variant);
    // Keep the historical hash for ordinary vehicles without a specified
    // variant so existing 24-hour snapshots remain addressable.
    if (variant) parts.push(variant);
    return parts;
}

export function sameValuationBaseIdentity(
    left: ValuationBaseIdentityInput,
    right: ValuationBaseIdentityInput,
): boolean {
    const a = canonicalValuationIdentity(left);
    const b = canonicalValuationIdentity(right);
    return a.registration === b.registration
        && a.make === b.make
        && a.model === b.model
        && a.year === b.year
        && a.mileage === b.mileage;
}
