import type { VehicleValuationComparable } from './vehicle-valuation';

/**
 * A price/year/mileage tuple is NOT a vehicle identifier. Two genuine cars
 * can share all three, while one advert may change price between searches.
 */
function compact(value?: string | null): string {
    return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizedUrl(raw?: string | null): { url: string; collection: boolean } | null {
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
        parsed.hash = '';
        parsed.hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        for (const key of [...parsed.searchParams.keys()]) {
            if (/^(utm_.+|gclid|fbclid|msclkid|ref|referrer|source)$/i.test(key)) {
                parsed.searchParams.delete(key);
            }
        }
        parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
        parsed.searchParams.sort();
        const lastSegment = parsed.pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
        // CarGurus and dealer results can provide a SINGLE results URL for
        // several separate adverts. Never collapse those by URL alone.
        const collection = /^(search|results|result|browse|cars|stock|vehicles|cars-for-sale|used-cars|car-search|inventory|listings)$/i
            .test(lastSegment) || parsed.searchParams.has('search') || parsed.searchParams.has('filter');
        return { url: parsed.toString(), collection };
    } catch {
        return null;
    }
}

function listingMetadataScore(row: VehicleValuationComparable): number {
    return [
        row.mileage, row.variant, row.fuelType, row.transmission,
        row.listingTitle, row.dealerName, row.stockReference,
    ].filter((value) => value !== undefined && value !== null && value !== '').length
        + (row.modelMatchQuality === 'EXACT_MODEL' ? 2 : 0);
}

function sameCollectionAdvert(a: VehicleValuationComparable, b: VehicleValuationComparable): boolean {
    const au = normalizedUrl(a.sourceUrl);
    const bu = normalizedUrl(b.sourceUrl);
    return !!au && !!bu && au.collection && bu.collection && au.url === bu.url
        && !!compact(a.listingTitle) && compact(a.listingTitle) === compact(b.listingTitle)
        && a.year === b.year && a.mileage === b.mileage
        && a.price === b.price
        && compact(a.variant) === compact(b.variant)
        && compact(a.transmission) === compact(b.transmission)
        && compact(a.fuelType) === compact(b.fuelType);
}

function sameVerifiedDealerStock(a: VehicleValuationComparable, b: VehicleValuationComparable): boolean {
    const aDealer = compact(a.dealerName);
    const bDealer = compact(b.dealerName);
    const aStock = compact(a.stockReference);
    const bStock = compact(b.stockReference);
    // AI-inferred short "stock IDs" such as A1/001 are too ambiguous.
    return aDealer.length >= 6 && aDealer === bDealer
        && aStock.length >= 6 && aStock === bStock
        && a.year != null && a.year === b.year
        && a.mileage != null && b.mileage != null
        && Math.abs(a.mileage - b.mileage) <= 1000
        && Math.abs(a.price - b.price) <= Math.max(100, 0.025 * Math.min(a.price, b.price))
        && (!a.variant || !b.variant || compact(a.variant) === compact(b.variant))
        && (!a.fuelType || !b.fuelType || compact(a.fuelType) === compact(b.fuelType))
        && (!a.transmission || !b.transmission || compact(a.transmission) === compact(b.transmission));
}

export function sameAdvertIdentity(a: VehicleValuationComparable, b: VehicleValuationComparable): boolean {
    const au = normalizedUrl(a.sourceUrl);
    const bu = normalizedUrl(b.sourceUrl);

    // Specific vehicle pages are authoritative advert identifiers even when
    // asking price changes; tracking-query differences do not create new cars.
    if (au && bu && !au.collection && !bu.collection && au.url === bu.url) return true;

    // Synthetic/legacy test sources have no URL. Collapse a truly identical
    // row repeated across attempts, but never price-only matches in real
    // sourced data; independent vehicles can share a price and mileage.
    if (!au && !bu && !a.sourceUrl && !b.sourceUrl) {
        return a.price === b.price && a.year === b.year && a.mileage === b.mileage
            && compact(a.variant) === compact(b.variant)
            && compact(a.fuelType) === compact(b.fuelType)
            && compact(a.transmission) === compact(b.transmission)
            && compact(a.listingTitle) === compact(b.listingTitle);
    }
    // Search pages cannot uniquely identify a car: require an exact row
    // fingerprint or a sufficiently specific stated dealer + stock reference.
    return sameCollectionAdvert(a, b) || sameVerifiedDealerStock(a, b);
}

export function deduplicateLiveMarketComparables(
    rows: VehicleValuationComparable[],
    limit = 20,
): VehicleValuationComparable[] {
    const unique: VehicleValuationComparable[] = [];
    for (const row of rows) {
        const index = unique.findIndex((existing) => sameAdvertIdentity(existing, row));
        if (index < 0) {
            unique.push(row);
        } else if (listingMetadataScore(row) > listingMetadataScore(unique[index])) {
            unique[index] = row;
        }
    }
    // Limit AFTER de-duplication so repeated searches cannot hide good rows.
    return unique.slice(0, Math.max(0, limit));
}
