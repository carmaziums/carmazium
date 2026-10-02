import * as cheerio from 'cheerio';
import type { ConfigService } from '@nestjs/config';
import { canonicalValuationMake, canonicalValuationModel } from './vehicle-valuation-identity';

const CAP_VRM_VALUATION_URL = 'https://soap.cap.co.uk/vrm/capvrm.asmx/VRMValuation';
const CAP_TIMEOUT_MS = 6_000;
const MAX_RESPONSE_BYTES = 128_000;

export interface LicensedBenchmarkRequest {
    registration?: string;
    make: string;
    model: string;
    year: number;
    mileage: number;
    variant?: string;
}

export interface LicensedMarketBenchmark {
    source: 'CAP_HPI';
    evidenceType: 'LICENSED_PROVIDER_BENCHMARK';
    checkedAt: string;
    // Provider values are INTERNAL ONLY, never send as website/native
    // comparables or expose as customer-facing market value.
    retail: number;
    tradeClean: number;
    tradeAverage: number;
    tradeBelow: number;
}

export type LicensedBenchmarkOutcome =
    | { status: 'DISABLED' | 'INELIGIBLE' | 'UNAVAILABLE' | 'IDENTITY_MISMATCH' }
    | { status: 'AVAILABLE'; benchmark: LicensedMarketBenchmark };

function exactText(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function safePrice(value: string): number | null {
    const price = Number(value);
    return Number.isInteger(price) && price >= 250 && price <= 500_000
        ? price : null;
}

export function parseCapHpiVrmValuationXml(
    xml: string,
    request: LicensedBenchmarkRequest,
    checkedAt = new Date().toISOString(),
): LicensedBenchmarkOutcome {
    // The response is a fixed provider format; never resolve external XML
    // entities or process markup other than the known cap hpi XML structure.
    if (!xml || xml.length > MAX_RESPONSE_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
        return { status: 'UNAVAILABLE' };
    }

    try {
        const $ = cheerio.load(xml, { xmlMode: true });
        const result = $('VRMValuationResult').first();
        const lookup = result.children('VRMLookup').first();
        const valuation = result.children('Valuation').first();
        if (!result.length || !lookup.length || !valuation.length
            || result.children('Success').first().text().trim().toLowerCase() !== 'true'
            || lookup.children('Success').first().text().trim().toLowerCase() !== 'true'
            || lookup.children('VehicleFound').first().text().trim().toLowerCase() !== 'true'
            || valuation.children('Success').first().text().trim().toLowerCase() !== 'true'
            || result.children('MileageOutOfBounds').first().text().trim().toLowerCase() === 'true') {
            return { status: 'UNAVAILABLE' };
        }

        const providerMake = lookup.children('CAPMan').first().text().trim();
        const providerModel = lookup.children('CAPMod').first().text().trim();
        const providerDerivative = lookup.children('CAPDer').first().text().trim();
        const requestMake = canonicalValuationMake(request.make);
        if (!providerMake || !providerModel
            || canonicalValuationMake(providerMake) !== requestMake
            || canonicalValuationModel(providerModel, providerMake)
                !== canonicalValuationModel(request.model, request.make)) {
            return { status: 'IDENTITY_MISMATCH' };
        }

        // A different trim must not be accepted as a matching benchmark.
        // Exact token groups avoid confusing ST with ST-LINE.
        if (request.variant?.trim()) {
            const requestedVariant = exactText(request.variant);
            // Split on whitespace, NOT on hyphens. "ST-Line" must remain
            // STLINE and cannot be misidentified as the performance trim ST.
            const derivativeTokens = providerDerivative.toUpperCase()
                .trim()
                .split(/\s+/)
                .map(exactText);
            if (!providerDerivative || !derivativeTokens.includes(requestedVariant)) {
                return { status: 'IDENTITY_MISMATCH' };
            }
        }

        const registeredDate = lookup.children('RegisteredDate').first().text().trim();
        const registrationYear = /^\d{4}/.test(registeredDate)
            ? Number(registeredDate.slice(0, 4)) : null;
        if (registrationYear !== null && Math.abs(registrationYear - request.year) > 1) {
            return { status: 'IDENTITY_MISMATCH' };
        }

        const retail = safePrice(valuation.children('Retail').first().text());
        const tradeClean = safePrice(valuation.children('Clean').first().text());
        const tradeAverage = safePrice(valuation.children('Average').first().text());
        const tradeBelow = safePrice(valuation.children('Below').first().text());
        if (retail === null || tradeClean === null || tradeAverage === null
            || tradeBelow === null || retail < tradeClean
            || tradeClean < tradeAverage || tradeAverage < tradeBelow) {
            return { status: 'UNAVAILABLE' };
        }

        return {
            status: 'AVAILABLE',
            benchmark: {
                source: 'CAP_HPI',
                evidenceType: 'LICENSED_PROVIDER_BENCHMARK',
                checkedAt,
                retail,
                tradeClean,
                tradeAverage,
                tradeBelow,
            },
        };
    } catch {
        return { status: 'UNAVAILABLE' };
    }
}

/**
 * Optional CAP HPI licensed reference. Disabled by default. The explicit
 * permission switch is separate from subscriber credentials, because an
 * account's licence might not permit benchmarking CarMazium's own prices.
 * Values never become fake "individual live advert" comparable rows.
 */
export async function fetchLicensedCapHpiBenchmark(
    request: LicensedBenchmarkRequest,
    config: Pick<ConfigService, 'get'>,
    fetchImpl: typeof fetch = fetch,
): Promise<LicensedBenchmarkOutcome> {
    if (config.get<string>('CAP_HPI_VALUATION_ENABLED') !== 'true'
        || config.get<string>('CAP_HPI_INTERNAL_COMPARISON_RIGHTS_CONFIRMED') !== 'true') {
        return { status: 'DISABLED' };
    }
    const subscriberId = config.get<string>('CAP_HPI_SUBSCRIBER_ID');
    const password = config.get<string>('CAP_HPI_PASSWORD');
    if (!subscriberId || !password) return { status: 'DISABLED' };

    const vrm = (request.registration ?? '').toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9]{2,7}$/.test(vrm)
        || !Number.isInteger(request.mileage)
        || request.mileage < 0 || request.mileage > 1_500_000) {
        return { status: 'INELIGIBLE' };
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CAP_TIMEOUT_MS);
    try {
        // Fixed HTTPS endpoint only: neither callers nor environment can
        // redirect a VRM and credentials to an arbitrary URL.
        const response = await fetchImpl(CAP_VRM_VALUATION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/xml, text/xml',
            },
            body: new URLSearchParams({
                SubscriberID: subscriberId,
                Password: password,
                VRM: vrm,
                Mileage: String(request.mileage),
                StandardEquipmentRequired: 'false',
            }).toString(),
            signal: abort.signal,
            redirect: 'error',
        });
        if (!response.ok) return { status: 'UNAVAILABLE' };
        const size = Number(response.headers.get('content-length') || 0);
        if (size > MAX_RESPONSE_BYTES) return { status: 'UNAVAILABLE' };
        const body = await response.text();
        return parseCapHpiVrmValuationXml(body, request);
    } catch {
        // Do not log provider XML, passwords, registration or request bodies.
        // A provider failure cannot interrupt the existing live-first policy.
        return { status: 'UNAVAILABLE' };
    } finally {
        clearTimeout(timer);
    }
}

export function classifyLicensedBenchmarkDifference(
    baselineRetail: number,
    benchmark: LicensedMarketBenchmark,
): 'ALIGNED' | 'REVIEW_REQUIRED' {
    // Diagnostic only. Consumer pricing and provider benchmarks are distinct.
    return Number.isFinite(baselineRetail)
        && Math.abs(baselineRetail - benchmark.retail) <= 0.30 * benchmark.retail
        ? 'ALIGNED' : 'REVIEW_REQUIRED';
}
