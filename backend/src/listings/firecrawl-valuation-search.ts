import type { VehicleValuationInput } from './vehicle-valuation';
import { sanitizeLiveUkComparables, type LiveUkMarketSearchResult } from './live-market-search';

type WebHit = { title?: string; url?: string; markdown?: string };
type FetchLike = typeof fetch;

export interface FirecrawlValuationOptions {
    apiKey: string;
    /** Only domains independently approved for extraction and valuation use. */
    approvedDomains: string[];
    maxResults?: number;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}

function canonicalDomains(domains: string[]): string[] {
    return [...new Set(domains.map(x => x.trim().toLowerCase().replace(/^www\./, ''))
        .filter(x => /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(x) && !x.endsWith('.local')))].slice(0, 10);
}

function allowedUrl(value: string, domains: string[]): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        const host = url.hostname.toLowerCase();
        if (!domains.some(domain => host === domain || host.endsWith('.' + domain))) return null;
        return url.toString();
    } catch {
        return null;
    }
}

function singleNumber(values: number[]): number | null {
    const unique = [...new Set(values.filter(Number.isFinite))];
    return unique.length === 1 ? unique[0] : null;
}

/**
 * Search snippets are NEVER comparable evidence. Only scraped current vehicle
 * adverts with a unique full cash price and explicit mileage can contribute.
 * Ambiguous multi-car/sold/finance pages deliberately fail closed.
 */
export function parseVerifiedAdvert(
    input: VehicleValuationInput,
    hit: WebHit,
    approvedDomains: string[],
): Record<string, unknown> | null {
    const url = allowedUrl(hit.url ?? '', canonicalDomains(approvedDomains));
    const markdown = hit.markdown?.slice(0, 18000) ?? '';
    if (!url || markdown.length < 65) return null;
    const plain = markdown.replace(/\*\*/g, '').replace(/\u00a0/g, ' ');
    const title = plain.match(/^#\s+([^\n]{5,180})/m)?.[1]?.trim() || hit.title || '';
    if (!title.toUpperCase().includes(input.make.toUpperCase())) return null;
    const modelWords = input.model.toUpperCase().split(/[\s-]+/).filter(x => x.length > 1);
    if (!modelWords.every(word => title.toUpperCase().includes(word))) return null;
    if (/^\s*(?:status\s*:\s*)?(?:sold|reserved|deposit taken|not available|out of stock)\s*$/im.test(plain)) return null;
    if (/\b(?:cat [abns]|salvage|non.?runner|spares or repairs)\b/i.test(title)) return null;
    const year = Number(title.match(/\b(?:19|20)\d{2}\b/)?.[0]);
    if (!Number.isInteger(year) || Math.abs(year - input.year) > 2) return null;

    const prices = [...plain.matchAll(/£\s*(\d{1,3}(?:,\d{3})+|\d{4,6})(?!\d)/g)]
        .map(m => Number(m[1].replace(/,/g, '')))
        .filter(n => n >= 750 && n <= 500000);
    const price = singleNumber(prices);
    const mileageTokens = [...plain.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:miles|mi\b)/gi)]
        .map(m => Number(m[1].replace(/,/g, '')))
        .filter(n => n >= 0 && n <= 1_500_000);
    const mileage = singleNumber(mileageTokens);
    if (price == null || mileage == null) return null;

    const top = (title + ' ' + plain.slice(0, 1500)).toUpperCase();
    const spec = (input.variant ?? '').toUpperCase();
    const engine = spec.match(/\b\d\.\d\b/)?.[0];
    if (engine && !top.includes(engine)) return null;
    const trims = ['R-LINE', 'AMG LINE', 'S LINE', 'M SPORT', 'ST-LINE', 'GTI', 'GTD', 'GTE', 'TEKNA', 'VRS'];
    const expectedTrim = trims.find(trim => spec.replace(/-/g, ' ').includes(trim.replace(/-/g, ' ')));
    if (expectedTrim && !top.replace(/-/g, ' ').includes(expectedTrim.replace(/-/g, ' '))) return null;
    const fuel = (input.fuelType ?? '').toUpperCase();
    if (fuel && !top.includes(fuel.replace(/_/g, ' '))) return null;
    const gearbox = (input.transmission ?? '').toUpperCase();
    if (gearbox.includes('MANUAL') && !/\bMANUAL\b/i.test(top)) return null;
    if (gearbox.includes('AUTO') && !/\bAUTO(?:MATIC)?\b|\bDSG\b|\bCVT\b/i.test(top)) return null;

    return {
        title, url, priceGBP: price, year, mileage,
        make: input.make, model: input.model,
        variant: title, fuelType: input.fuelType ?? null,
        transmission: input.transmission ?? null,
    };
}

/**
 * Optional provider: one bounded search, up to five scraped pages, no retries,
 * no auto top-up, and no persistent copy of third-party adverts. Caller MUST
 * gate on explicit enablement, approved usage rights and available credits.
 */
export async function searchFirecrawlValuationMarket(
    input: VehicleValuationInput,
    options: FirecrawlValuationOptions,
): Promise<LiveUkMarketSearchResult> {
    const checkedAt = new Date().toISOString();
    const empty = (): LiveUkMarketSearchResult => ({
        comparables: [], checkedAt, rawComparableCount: 0, sourceDomains: [],
    });
    const domains = canonicalDomains(options.approvedDomains);
    if (!options.apiKey || domains.length === 0) return empty();
    const limit = Math.max(1, Math.min(5, Math.trunc(options.maxResults ?? 4)));
    const timeout = Math.max(1000, Math.min(18_000, options.timeoutMs ?? 12_000));
    const query = [
        input.year, input.make, input.model, input.variant ?? '',
        input.fuelType ?? '', input.transmission ?? '',
        Math.round(input.mileage / 1000) + '000 miles', 'UK used car for sale',
    ].filter(Boolean).join(' ').slice(0, 320);
    try {
        const res = await (options.fetchImpl ?? fetch)('https://api.firecrawl.dev/v2/search', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + options.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query, limit, sources: ['web'], country: 'GB', safe: true,
                includeDomains: domains,
                scrapeOptions: { formats: ['markdown'], onlyMainContent: true, maxAge: 0 },
            }),
            signal: AbortSignal.timeout(timeout),
        });
        if (!res.ok) return empty();
        const response = await res.json() as { success?: boolean; data?: { web?: WebHit[] } };
        if (response.success !== true || !Array.isArray(response.data?.web)) return empty();
        const valid = response.data.web.slice(0, limit)
            .map(hit => parseVerifiedAdvert(input, hit, domains))
            .filter((row): row is Record<string, unknown> => row !== null);
        const comparables = sanitizeLiveUkComparables(input, valid);
        return {
            comparables, checkedAt, rawComparableCount: response.data.web.length,
            sourceDomains: [...new Set(comparables.map(row => row.sourceDomain).filter((x): x is string => !!x))],
        };
    } catch {
        return empty();
    }
}
