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
    // Prefer the longest brand prefix: MERCEDESBENZ before MERCEDES.
    // The raw make handles "VW Golf"; the canonical make handles
    // "Volkswagen Golf" when the separate make field is "VW".
    const prefixes = [...new Set([
        makeKey, clean(make), ...(makeKey === 'MERCEDES' ? ['MERCEDESBENZ'] : []),
    ])].filter(Boolean).sort((a, b) => b.length - a.length);
    let changed = true;
    while (changed) {
        changed = false;
        for (const prefix of prefixes) {
            if (value.startsWith(prefix) && value.length > prefix.length) {
                value = value.slice(prefix.length);
                changed = true;
                break;
            }
        }
    }
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
