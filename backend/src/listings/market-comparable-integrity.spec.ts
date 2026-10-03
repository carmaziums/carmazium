import { deduplicateLiveMarketComparables, sameAdvertIdentity } from './market-comparable-integrity';
import type { VehicleValuationComparable } from './vehicle-valuation';

const source = (overrides: Partial<VehicleValuationComparable> = {}): VehicleValuationComparable => ({
    sourceUrl: 'https://www.dealer.example/cars/golf-123?utm_source=google#g',
    sourceDomain: 'dealer.example',
    listingTitle: '2018 VW Golf SE 1.4',
    dealerName: 'Example Cars Birmingham',
    stockReference: 'AUTOSTOCK1246',
    price: 10995,
    year: 2018,
    mileage: 57000,
    variant: 'SE',
    fuelType: 'PETROL',
    transmission: 'MANUAL',
    kind: 'ACTIVE_ASK',
    ...overrides,
});

describe('Block 5 advert identity and cross-market dedup', () => {
    it('deduplicates one advert despite tracking links or amended asking prices', () => {
        const a = source();
        const b = source({
            sourceUrl: 'https://dealer.example/cars/golf-123?utm_campaign=sale',
            price: 10595,
        });
        expect(sameAdvertIdentity(a, b)).toBe(true);
        expect(deduplicateLiveMarketComparables([a, b])).toHaveLength(1);
    });

    it('does not collapse different cars with coincidentally identical price, mileage and trim', () => {
        const a = source({ stockReference: undefined });
        const b = source({
            sourceUrl: 'https://dealer.example/cars/golf-456',
            stockReference: undefined,
        });
        expect(sameAdvertIdentity(a, b)).toBe(false);
        expect(deduplicateLiveMarketComparables([a, b])).toHaveLength(2);
    });

    it('preserves multiple distinct adverts cited from one search results URL', () => {
        const a = source({ sourceUrl: 'https://dealer.example/search?q=golf' });
        const b = source({
            sourceUrl: 'https://dealer.example/search?q=golf',
            listingTitle: '2018 VW Golf Match',
            price: 10500, mileage: 61000,
            stockReference: undefined,
        });
        const duplicate = source({ sourceUrl: 'https://dealer.example/search?q=golf' });
        expect(deduplicateLiveMarketComparables([a, b, duplicate])).toHaveLength(2);
    });

    it('deduplicates cross-market reposts only with matching long dealer stock evidence', () => {
        const a = source();
        const repost = source({
            sourceUrl: 'https://www.cargurus.co.uk/Cars/other-golf-abc',
            sourceDomain: 'cargurus.co.uk',
            price: 11050, mileage: 57150,
        });
        expect(sameAdvertIdentity(a, repost)).toBe(true);
        expect(deduplicateLiveMarketComparables([a, repost])).toHaveLength(1);

        const otherDealer = { ...repost, dealerName: 'Different Car Dealer' };
        const otherStock = { ...repost, stockReference: 'AUTOSTOCK9999' };
        expect(sameAdvertIdentity(a, otherDealer)).toBe(false);
        expect(sameAdvertIdentity(a, otherStock)).toBe(false);
    });

    it('rejects unsafe cross-provider assumptions for large price or specification mismatches', () => {
        expect(sameAdvertIdentity(source(), source({
            sourceUrl: 'https://cargurus.co.uk/Cars/golf',
            price: 15000,
        }))).toBe(false);
        expect(sameAdvertIdentity(source(), source({
            sourceUrl: 'https://cargurus.co.uk/Cars/golf',
            variant: 'GTI',
        }))).toBe(false);
    });

    it('does not let repeated first-plan results prevent later distinct cars from being counted', () => {
        const duplicates = Array.from({ length: 20 }, (_, i) => source({
            sourceUrl: `https://dealer.example/cars/golf-123?utm_campaign=pass${i}`,
        }));
        const a = source({ sourceUrl: 'https://dealer.example/cars/456', dealerName: null, stockReference: null });
        const b = source({ sourceUrl: 'https://dealer.example/cars/789', dealerName: null, stockReference: null });
        expect(deduplicateLiveMarketComparables([...duplicates, a, b], 3)).toHaveLength(3);
    });
});
