import OpenAI from 'openai';
import type {
    VehicleValuationComparable,
    VehicleValuationInput,
} from './vehicle-valuation';
import { canonicalValuationMake } from './vehicle-valuation-identity';
import { matchMarketplaceModel } from './market-model-matching';
import { deduplicateLiveMarketComparables } from './market-comparable-integrity';

export interface LiveUkMarketSearchResult {
    comparables: VehicleValuationComparable[];
    checkedAt: string;
    rawComparableCount: number;
    sourceDomains: string[];
}

export type LiveUkMarketSearchPhase = 'LIVE' | 'BLENDED';

type LiveUkMarketSearchPlan = {
    label: string;
    allowedDomains?: string[];
    instruction: string;
};

const BROAD_MARKET_DOMAINS = [
    'autotrader.co.uk',
    'cargurus.co.uk',
    'motors.co.uk',
    'theaa.com',
    'rac.co.uk',
    'pistonheads.com',
    'carwow.co.uk',
];

export function getLiveUkMarketSearchPlan(
    phase: LiveUkMarketSearchPhase,
    attempt: number,
): LiveUkMarketSearchPlan {
    const index = Math.max(1, Math.min(5, Math.trunc(attempt) || 1));

    if (phase === 'LIVE') {
        const livePlans: LiveUkMarketSearchPlan[] = [
            {
                label: 'broad-market',
                allowedDomains: BROAD_MARKET_DOMAINS,
                instruction: 'Search broadly across the main UK used-car marketplaces and prefer exact-model adverts.',
            },
            {
                label: 'cargurus',
                allowedDomains: ['cargurus.co.uk'],
                instruction: 'Search CarGurus.co.uk directly. Use current UK CarGurus listing/result pages and return multiple visible comparable adverts when available.',
            },
            {
                label: 'autotrader',
                allowedDomains: ['autotrader.co.uk'],
                instruction: 'Search Auto Trader UK directly for current exact-model adverts.',
            },
            {
                label: 'motors-aa-rac',
                allowedDomains: ['motors.co.uk', 'theaa.com', 'rac.co.uk'],
                instruction: 'Search Motors, AA Cars and RAC Cars for current UK exact-model adverts.',
            },
            {
                label: 'open-uk-web',
                instruction: 'Search the wider public UK web, including reputable franchised and independent dealer stock pages, when the major marketplaces are sparse.',
            },
        ];
        return livePlans[index - 1];
    }

    const blendedPlans: LiveUkMarketSearchPlan[] = [
        {
            label: 'cargurus-wider',
            allowedDomains: ['cargurus.co.uk'],
            instruction: 'Search CarGurus.co.uk again with a wider same-model year and mileage window. Do not change to a different model family.',
        },
        {
            label: 'autotrader-wider',
            allowedDomains: ['autotrader.co.uk'],
            instruction: 'Search Auto Trader UK again with a wider same-model year and mileage window.',
        },
        {
            label: 'marketplaces-wider',
            allowedDomains: BROAD_MARKET_DOMAINS,
            instruction: 'Search the main UK marketplaces using common model-name aliases, punctuation variants and generation naming.',
        },
        {
            label: 'dealer-web',
            instruction: 'Search reputable UK dealer inventory pages on the open web for the same model family.',
        },
        {
            label: 'rare-model-recovery',
            instruction: 'Make one final broad UK search for the same model family, tolerating common lookup spelling/formatting errors while rejecting different vehicle models.',
        },
    ];
    return blendedPlans[index - 1];
}

const normalize = (value?: string | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

function isCleanComparableTitle(title: string, targetWriteOff?: string): boolean {
    if (targetWriteOff && normalize(targetWriteOff) !== 'NONE') return true;
    return !/\b(cat\s*[abns]|write[ -]?off|salvage|spares|repair|damaged|non[- ]runner)\b/i.test(title);
}

export function sanitizeLiveUkComparables(
    input: VehicleValuationInput,
    raw: unknown,
    options?: {
        yearTolerance?: number;
        mileageTolerance?: number;
    },
): VehicleValuationComparable[] {
    if (!Array.isArray(raw)) return [];

    const targetMake = canonicalValuationMake(input.make);
    const rows: VehicleValuationComparable[] = [];

    const yearTolerance = Math.max(1, Math.min(6, options?.yearTolerance ?? 3));
    const mileageTolerance = Math.max(20_000, Math.min(150_000, options?.mileageTolerance ?? 90_000));

    for (const candidate of raw.slice(0, 45)) {
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
        if (!Number.isInteger(year) || Math.abs(year - input.year) > yearTolerance) continue;
        // A contradictory explicit make/model cannot be overruled by a
        // substring in an advert title (Fiesta is not Fiesta ST).
        const statedMake = canonicalValuationMake(make);
        if (statedMake && statedMake !== targetMake) continue;
        if (!statedMake && !normalize(title).split(' ').some((token) =>
            canonicalValuationMake(token) === targetMake)) continue;
        const modelMatchQuality = matchMarketplaceModel(input, {
            model, title, variant: typeof row.variant === 'string' ? row.variant : null,
        });
        if (!modelMatchQuality) continue;
        if (!isCleanComparableTitle(title, input.writeOffCategory)) continue;

        const mileage = mileageValue != null && Number.isFinite(mileageValue) && mileageValue >= 0
            ? Math.round(mileageValue)
            : null;
        if (mileage != null && Math.abs(mileage - input.mileage) > mileageTolerance) continue;

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            continue;
        }
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') continue;

        if (parsedUrl.username || parsedUrl.password) continue;

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
            sourceUrl: parsedUrl.toString(),
            sourceDomain: parsedUrl.hostname.replace(/^www\./, '').toLowerCase(),
            listingTitle: title,
            dealerName: typeof row.dealerName === 'string' ? row.dealerName.trim().slice(0, 100) : null,
            stockReference: typeof row.stockReference === 'string' ? row.stockReference.trim().slice(0, 40) : null,
            modelMatchQuality,
            kind: 'ACTIVE_ASK',
        });
    }

    return deduplicateLiveMarketComparables(rows, 20);
}

export async function searchLiveUkVehicleMarket(
    input: VehicleValuationInput,
    options: {
        apiKey: string;
        model: string;
        timeoutMs?: number;
        phase?: LiveUkMarketSearchPhase;
        attempt?: number;
    },
): Promise<LiveUkMarketSearchResult> {
    const client = new OpenAI({
        apiKey: options.apiKey,
        timeout: options.timeoutMs ?? 18_000,
        maxRetries: 0,
    });

    const phase = options.phase ?? 'LIVE';
    const attempt = Math.max(1, Math.min(5, Math.trunc(options.attempt ?? 1)));
    const plan = getLiveUkMarketSearchPlan(phase, attempt);

    const details = [
        `${input.year} ${input.make} ${input.model}`,
        input.variant ? `variant: ${input.variant}` : '',
        input.fuelType ? `fuel: ${input.fuelType}` : '',
        input.transmission ? `transmission: ${input.transmission}` : '',
        `mileage: ${input.mileage.toLocaleString('en-GB')} miles`,
    ].filter(Boolean).join(', ');

    const prompt = [
        'You MUST search the live web now. Find current UK used-car retail advertisements for vehicles comparable to the target below.',
        plan.instruction,
        'Return only actual whole-vehicle CASH asking prices in GBP from current adverts.',
        'Do not return monthly finance payments, lease prices, parts, salvage, damaged/non-runner adverts, duplicate adverts, auction bids, sold pages, or generic editorial/valuation pages.',
        phase === 'LIVE'
            ? 'Prefer the exact same model family, year within +/-2 years and mileage reasonably close to the target.'
            : 'This is a recovery search: keep the same model family but you may widen to roughly +/-5 years and a broader mileage range when exact adverts are sparse.',
        'Treat harmless model formatting differences as equivalent: punctuation/hyphens, a duplicated make name, a joined generation digit, or one obvious spelling error. Examples: XTRAIL = X-Trail; SPORTAGE3 = Sportage 3; TIGGA 4 may match Tiggo 4. Never substitute a different model family.',
        'Prefer the same variant, fuel and transmission when those are supplied, but do not discard an otherwise valid same-model advert solely because those details are missing.',
        'CarGurus filtered/result pages are acceptable evidence when the page visibly contains individual current adverts with price, year and mileage; return each visible advert as its own comparable row.',
        'If fewer than 3 credible current adverts can be found, return fewer results rather than inventing listings.',
        'Every row must have a real public source URL that supports the advert or the marketplace result containing it.',
        'When a single result page contains several different cars, return their actual individual titles and distinct details; never manufacture individual advert IDs.',
        'Return dealerName and stockReference only when both are explicitly shown in the source listing. Otherwise use null; never invent them.',
        `Search pass: ${phase} ${attempt} (${plan.label}).`,
        `Target vehicle: ${details}`,
    ].join('\n');

    const webSearchTool: any = {
        type: 'web_search',
        search_context_size: 'high',
    };
    if (plan.allowedDomains?.length) {
        webSearchTool.filters = {
            allowed_domains: plan.allowedDomains,
        };
    }

    // SDK timeout alone does not guarantee the underlying HTTP request is
    // aborted on all transport paths. Apply an independent abort signal to
    // ensure one search plan cannot run indefinitely.
    const abortController = new AbortController();
    const timer = setTimeout(
        () => abortController.abort(),
        options.timeoutMs ?? 18_000,
    );
    let response: any;
    try {
        response = await client.responses.create({
        model: options.model,
        tools: [webSearchTool] as any,
        tool_choice: 'required',
        input: [{
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
        }],
        reasoning: { effort: 'none' },
        max_output_tokens: 3200,
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
                                    dealerName: { type: ['string', 'null'] },
                                    stockReference: { type: ['string', 'null'] },
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
                                    'dealerName',
                                    'stockReference',
                                ],
                            },
                        },
                    },
                    required: ['comparables'],
                },
            },
        },
    } as any, { signal: abortController.signal });
    } finally {
        clearTimeout(timer);
    }

    let parsed: { comparables?: unknown[] } = {};
    try {
        parsed = JSON.parse(response.output_text || '{}');
    } catch {
        parsed = {};
    }

    const rawComparableCount = Array.isArray(parsed.comparables) ? parsed.comparables.length : 0;
    const comparables = sanitizeLiveUkComparables(
        input,
        parsed.comparables,
        phase === 'LIVE'
            ? { yearTolerance: 3, mileageTolerance: 90_000 }
            : { yearTolerance: 5, mileageTolerance: 130_000 },
    );
    const sourceDomains = [
        ...new Set(
            comparables
                .map((row) => row.sourceDomain)
                .filter((value): value is string => !!value),
        ),
    ].sort();

    return {
        comparables,
        checkedAt: new Date().toISOString(),
        rawComparableCount,
        sourceDomains,
    };
}
