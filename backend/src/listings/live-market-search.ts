import OpenAI from 'openai';
import type {
    VehicleValuationComparable,
    VehicleValuationInput,
} from './vehicle-valuation';

export interface LiveUkMarketSearchResult {
    comparables: VehicleValuationComparable[];
    checkedAt: string;
}

const normalize = (value?: string | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

function modelMatches(targetModel: string, candidate: string): boolean {
    const targetTokens = normalize(targetModel).split(/\s+/).filter((token) => token.length > 1);
    const haystack = normalize(candidate);
    return targetTokens.length > 0 && targetTokens.every((token) => haystack.includes(token));
}

function isCleanComparableTitle(title: string, targetWriteOff?: string): boolean {
    if (targetWriteOff && normalize(targetWriteOff) !== 'NONE') return true;
    return !/\b(cat\s*[abns]|write[ -]?off|salvage|spares|repair|damaged|non[- ]runner)\b/i.test(title);
}

export function sanitizeLiveUkComparables(
    input: VehicleValuationInput,
    raw: unknown,
): VehicleValuationComparable[] {
    if (!Array.isArray(raw)) return [];

    const targetMake = normalize(input.make);
    const seen = new Set<string>();
    const rows: VehicleValuationComparable[] = [];

    for (const candidate of raw.slice(0, 30)) {
        if (!candidate || typeof candidate !== 'object') continue;
        const row = candidate as Record<string, unknown>;

        const title = String(row.title ?? '').trim();
        const make = String(row.make ?? '').trim();
        const model = String(row.model ?? '').trim();
        const url = String(row.url ?? '').trim();
        const price = Number(row.priceGBP);
        const year = Number(row.year);
        const mileageValue = row.mileage == null ? null : Number(row.mileage);

        if (!title || !url.startsWith('http')) continue;
        if (!Number.isFinite(price) || price < 750 || price > 500_000) continue;
        if (!Number.isInteger(year) || Math.abs(year - input.year) > 3) continue;
        if (normalize(make) !== targetMake && !normalize(title).includes(targetMake)) continue;
        if (!modelMatches(input.model, `${model} ${title}`)) continue;
        if (!isCleanComparableTitle(title, input.writeOffCategory)) continue;

        const mileage = mileageValue != null && Number.isFinite(mileageValue) && mileageValue >= 0
            ? Math.round(mileageValue)
            : null;
        if (mileage != null && Math.abs(mileage - input.mileage) > 90_000) continue;

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            continue;
        }
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') continue;

        const dedupeKey = `${parsedUrl.hostname}|${normalize(title)}|${Math.round(price)}|${mileage ?? ''}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        rows.push({
            price,
            year,
            mileage,
            variant: typeof row.variant === 'string' ? row.variant : null,
            fuelType: typeof row.fuelType === 'string' ? row.fuelType : null,
            transmission: typeof row.transmission === 'string' ? row.transmission : null,
            writeOffCategory: null,
            condition: null,
            serviceHistory: null,
            owners: null,
            isImported: null,
            kind: 'ACTIVE_ASK',
        });
    }

    return rows.slice(0, 12);
}

export async function searchLiveUkVehicleMarket(
    input: VehicleValuationInput,
    options: {
        apiKey: string;
        model: string;
        timeoutMs?: number;
    },
): Promise<LiveUkMarketSearchResult> {
    const client = new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? 18_000,
        maxRetries: 1,
    });

    const details = [
        `${input.year} ${input.make} ${input.model}`,
        input.variant ? `variant: ${input.variant}` : '',
        input.fuelType ? `fuel: ${input.fuelType}` : '',
        input.transmission ? `transmission: ${input.transmission}` : '',
        `mileage: ${input.mileage.toLocaleString('en-GB')} miles`,
    ].filter(Boolean).join(', ');

    const prompt = [
        'Find current UK used-car retail advertisements for vehicles comparable to the target below.',
        'Use reputable UK vehicle marketplaces and dealer websites discoverable on the public web.',
        'Return only actual whole-vehicle CASH asking prices in GBP from current adverts.',
        'Do not return monthly finance payments, lease prices, parts, salvage, damaged/non-runner adverts, duplicate adverts, auction bids, sold pages, or generic model landing pages.',
        'Prefer exact make/model and the same generation/variant. Prefer year within +/-2 years and mileage reasonably close to the target.',
        'Prefer the same fuel and transmission when those are supplied.',
        'If the exact model is ambiguous or fewer than 3 credible current adverts can be found, return fewer results rather than inventing listings.',
        'Every row must have a real source URL that supports that advert.',
        `Target vehicle: ${details}`,
    ].join('\n');

    const response = await client.responses.create({
        model: options.model,
        tools: [{ type: 'web_search', search_context_size: 'medium' }] as any,
        input: [{
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
        }],
        reasoning: { effort: 'none' },
        max_output_tokens: 2400,
        text: {
            format: {
                type: 'json_schema',
                name: 'uk_vehicle_market_comparables',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        comparables: {
                            type: 'array',
                            maxItems: 15,
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    title: { type: 'string' },
                                    url: { type: 'string' },
                                    priceGBP: { type: 'number' },
                                    year: { type: 'integer' },
                                    mileage: { type: ['integer', 'null'] },
                                    make: { type: 'string' },
                                    model: { type: 'string' },
                                    variant: { type: ['string', 'null'] },
                                    fuelType: { type: ['string', 'null'] },
                                    transmission: { type: ['string', 'null'] },
                                },
                                required: [
                                    'title',
                                    'url',
                                    'priceGBP',
                                    'year',
                                    'mileage',
                                    'make',
                                    'model',
                                    'variant',
                                    'fuelType',
                                    'transmission',
                                ],
                            },
                        },
                    },
                    required: ['comparables'],
                },
            },
        },
    } as any);

    let parsed: { comparables?: unknown[] } = {};
    try {
        parsed = JSON.parse(response.output_text || '{}');
    } catch {
        parsed = {};
    }

    return {
        comparables: sanitizeLiveUkComparables(input, parsed.comparables),
        checkedAt: new Date().toISOString(),
    };
}
