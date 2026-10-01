import OpenAI from 'openai';
import type {
    VehicleValuationComparable,
    VehicleValuationInput,
} from './vehicle-valuation';

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

const MODEL_POWERTRAIN_NOISE = new Set([
    'E',
    'POWER',
    'EPOWER',
    'HYBRID',
    'PHEV',
    'MHEV',
    'PLUGIN',
    'PLUG',
    'IN',
    'ELECTRIC',
]);

function modelTokens(value: string, make?: string): string[] {
    const makeTokens = new Set(
        normalize(make).split(/\s+/).filter(Boolean),
    );

    const tokens = normalize(value)
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !makeTokens.has(token));

    // Registration data sometimes appends the powertrain family to the model,
    // e.g. "X-TRAIL E-POWER". Strip only trailing powertrain words so the
    // underlying model family still has to match.
    while (
        tokens.length > 1
        && MODEL_POWERTRAIN_NOISE.has(tokens[tokens.length - 1])
    ) {
        tokens.pop();
    }

    return tokens;
}

function modelCore(value: string, make?: string): string {
    return modelTokens(value, make).join('');
}

function stripTrailingGenerationDigit(value: string): string {
    const match = value.match(/^([A-Z]{5,})\d$/);
    return match ? match[1] : value;
}

function isUkRegistrationLike(value: string): boolean {
    return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(normalize(value).replace(/\s+/g, ''));
}

function withinOneEdit(left: string, right: string): boolean {
    if (left === right) return true;
    if (Math.abs(left.length - right.length) > 1) return false;
    if (Math.min(left.length, right.length) < 5) return false;

    let i = 0;
    let j = 0;
    let edits = 0;

    while (i < left.length && j < right.length) {
        if (left[i] === right[j]) {
            i += 1;
            j += 1;
            continue;
        }

        edits += 1;
        if (edits > 1) return false;

        if (left.length > right.length) i += 1;
        else if (right.length > left.length) j += 1;
        else {
            i += 1;
            j += 1;
        }
    }

    if (i < left.length || j < right.length) edits += 1;
    return edits <= 1;
}

function modelMatches(
    input: VehicleValuationInput,
    candidateModel: string,
    title: string,
): boolean {
    // If a registration has accidentally landed in the model field, do not
    // broaden all the way to make-only evidence. That would create false
    // confidence across unrelated models.
    if (isUkRegistrationLike(input.model)) return false;

    const target = modelCore(input.model, input.make);
    const candidate = modelCore(candidateModel, input.make);
    if (!target) return false;

    const targetFamily = stripTrailingGenerationDigit(target);
    const candidateFamily = stripTrailingGenerationDigit(candidate);

    if (candidate) {
        if (target === candidate || targetFamily === candidateFamily) return true;
        if (withinOneEdit(target, candidate)) return true;
        if (withinOneEdit(targetFamily, candidateFamily)) return true;
    }

    // Some marketplace result pages provide a sparse model field but include
    // the full model in the advert title. Make/year are validated separately,
    // so checking the canonical model family in the title is still bounded.
    const titleCore = normalize(title).replace(/[^A-Z0-9]/g, '');
    if (titleCore.includes(target) || titleCore.includes(targetFamily)) return true;

    return false;
}

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

    const targetMake = normalize(input.make);
    const seen = new Set<string>();
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
        if (normalize(make) !== targetMake && !normalize(title).includes(targetMake)) continue;
        if (!modelMatches(input, model, title)) continue;
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
            sourceUrl: parsedUrl.toString(),
            sourceDomain: parsedUrl.hostname.replace(/^www\./, '').toLowerCase(),
            kind: 'ACTIVE_ASK',
        });
    }

    return rows.slice(0, 20);
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

    const response = await client.responses.create({
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
