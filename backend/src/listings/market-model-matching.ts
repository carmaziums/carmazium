import { canonicalValuationMake, canonicalValuationModel } from './vehicle-valuation-identity';

export type MarketModelMatchQuality =
    | 'EXACT_MODEL'
    | 'FAMILY_ONLY'
    | 'TYPO_RECOVERY'
    | 'TITLE_ONLY';

const normalized = (value?: string | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const TRAILING_POWERTRAIN = new Set([
    'E', 'POWER', 'EPOWER', 'HYBRID', 'PHEV',
    'MHEV', 'PLUGIN', 'PLUG', 'IN', 'ELECTRIC',
]);

function modelCore(model: string, make: string): string {
    // Canonicalise make aliases before comparing, but do not strip a
    // performance-model suffix (e.g. FIESTA ST) or generation number.
    const value = canonicalValuationModel(model, make);
    const makeTokens = normalized(canonicalValuationMake(make)).split(' ');
    const tokens = normalized(value)
        .split(/\s+/).filter(Boolean)
        .filter((token) => !makeTokens.includes(token));
    while (tokens.length > 1 && TRAILING_POWERTRAIN.has(tokens[tokens.length - 1])) {
        tokens.pop();
    }
    return tokens.join('');
}

function generation(value: string): { root: string; digit: string } | null {
    const match = value.match(/^([A-Z]{5,})([0-9])$/);
    return match ? { root: match[1], digit: match[2] } : null;
}

function oneSubstitutionOrEdit(left: string, right: string): boolean {
    if (left.length < 6 || right.length < 6 || Math.abs(left.length - right.length) > 1) {
        return false;
    }
    const l = generation(left);
    const r = generation(right);
    if ((l || r) && (!l || !r || l.digit !== r.digit)) return false;

    let i = 0;
    let j = 0;
    let errors = 0;
    while (i < left.length && j < right.length) {
        if (left[i] === right[j]) {
            i++; j++; continue;
        }
        if (++errors > 1) return false;
        if (left.length > right.length) i++;
        else if (right.length > left.length) j++;
        else { i++; j++; }
    }
    return errors + Number(i < left.length || j < right.length) === 1;
}

// A generic model must not silently match a different engine/performance car
// solely because its model name appears in the title.
const PERFORMANCE_SUFFIXES: Record<string, string[]> = {
    FIESTA: ['ST', 'RS'],
    FOCUS: ['ST', 'RS'],
    GOLF: ['R', 'GTI', 'GTD', 'GTE'],
    CIVIC: ['TYPE R'],
};

function titleConflictsWithGenericModel(title: string, requestedCore: string, variant?: string): boolean {
    const suffixes = PERFORMANCE_SUFFIXES[requestedCore] ?? [];
    if (!suffixes.length) return false;
    const titleTokens = normalized(title).split(' ');
    const requestedVariant = normalized(variant).replace(/\s+/g, '');
    for (let i = 0; i < titleTokens.length; i++) {
        if (titleTokens[i] !== requestedCore) continue;
        for (const suffix of suffixes) {
            const tokens = suffix.split(' ');
            const found = tokens.every((token, index) => titleTokens[i + index + 1] === token);
            if (found && requestedVariant !== tokens.join('')) return true;
        }
    }
    return false;
}

function titleContainsUnambiguousModel(title: string, core: string, make: string): boolean {
    const parts = normalized(title).split(' ').filter(Boolean);
    // Title-only evidence is provisional and must contain an explicit make
    // token, not a model substring embedded in another model (A1 vs A10).
    const makeKey = canonicalValuationMake(make);
    const makeParts = normalized(makeKey).split(' ');
    if (!makeParts.some((part) => parts.includes(part))) return false;
    const maxWindow = Math.min(parts.length, 5);
    for (let i = 0; i < parts.length; i++) {
        for (let n = 1; n <= maxWindow && i + n <= parts.length; n++) {
            if (modelCore(parts.slice(i, i + n).join(' '), make) === core) return true;
        }
    }
    return false;
}

export function matchMarketplaceModel(
    input: { make: string; model: string; variant?: string },
    candidate: { model?: string | null; title: string; variant?: string | null },
): MarketModelMatchQuality | null {
    if (/^[A-Z]{2}[0-9]{2}[A-Z]{3}$/.test(normalized(input.model).replace(/\s+/g, ''))) {
        return null; // A VRM accidentally in the model field is never evidence.
    }

    const target = modelCore(input.model, input.make);
    if (!target) return null;

    const other = modelCore(candidate.model ?? '', input.make);
    let quality: MarketModelMatchQuality | null = null;

    if (other) {
        if (target === other) {
            quality = 'EXACT_MODEL';
        } else {
            const a = generation(target);
            const b = generation(other);
            if (a && b && a.root === b.root && a.digit !== b.digit) {
                return null; // SPORTAGE2 is NOT an exact SPORTAGE3.
            }
            if ((a && a.root === other) || (b && b.root === target)) {
                quality = 'FAMILY_ONLY';
            } else if (oneSubstitutionOrEdit(target, other)) {
                quality = 'TYPO_RECOVERY';
            } else {
                return null; // An explicit conflicting model wins over title.
            }
        }
    } else {
        if (!titleContainsUnambiguousModel(candidate.title, target, input.make)) return null;
        quality = 'TITLE_ONLY';
    }

    if (quality && titleConflictsWithGenericModel(candidate.title, target, input.variant)) {
        return null;
    }

    // The two words ST and ST-LINE are not the same performance derivative.
    // When both derivatives are explicit, reject a conflicting high-risk one.
    const reqVariant = normalized(input.variant).replace(/\s+/g, '');
    const compVariant = normalized(candidate.variant).replace(/\s+/g, '');
    const highRisk = new Set(['ST', 'STLINE', 'RS', 'GTI', 'GTD', 'GTE']);
    if (reqVariant && compVariant && reqVariant !== compVariant
        && (highRisk.has(reqVariant) || highRisk.has(compVariant))) {
        return null;
    }
    return quality;
}
