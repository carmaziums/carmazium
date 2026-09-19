import { BadRequestException } from '@nestjs/common';

const UK_POSTCODE_COMPACT = /^(GIR0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKPSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)[0-9][ABD-HJLNP-UW-Z]{2})$/i;

/** Normalise a UK postcode to the canonical outward + inward format. */
export function normaliseUkPostcode(value?: string | null): string | null {
    if (value == null) return null;
    const compact = String(value).trim().toUpperCase().replace(/\s+/g, '');
    if (!compact) return null;
    if (!UK_POSTCODE_COMPACT.test(compact)) return null;
    return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function requireUkPostcode(value: string | null | undefined, label: string): string {
    const normalised = normaliseUkPostcode(value);
    if (!normalised) {
        throw new BadRequestException(`${label} must be a valid UK postcode.`);
    }
    return normalised;
}

export function postcodeArea(value?: string | null): string | null {
    const normalised = normaliseUkPostcode(value);
    if (!normalised) return null;
    if (normalised.startsWith('GIR ')) return 'GIR';
    return normalised.match(/^[A-Z]{1,2}/)?.[0] ?? null;
}

/**
 * Null means ASAP. A supplied date must be a real future instant. Two minutes
 * of clock-skew tolerance prevents a form submitted exactly at "now" failing.
 */
export function parseFutureRequestedFor(value?: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
        throw new BadRequestException('Requested date is invalid.');
    }
    if (parsed.getTime() < Date.now() - 120_000) {
        throw new BadRequestException('Requested date cannot be in the past. Omit it for as soon as possible.');
    }
    return parsed;
}
