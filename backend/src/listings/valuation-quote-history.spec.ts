import { summariseHistoricalQuotes, type ArchivedValuationObservation } from './valuation-quote-history';
import { calculateVehicleValuation } from './vehicle-valuation';

describe('12-month quotation history comparator', () => {
    const now = new Date('2026-10-17T12:00:00.000Z');
    const target = { make: 'Mercedes-Benz', model: 'GLB', year: 2020, mileage: 50000, registration: 'SD70XRP' };
    const sample = (registration: string, override: Partial<ArchivedValuationObservation> = {}): ArchivedValuationObservation => ({
        createdAt: new Date('2026-09-17T12:00:00.000Z'),
        registration, make: 'Mercedes-Benz', model: 'GLB', year: 2020, mileage: 49000,
        auctionPrice: 16500, retailPrice: 19800, source: 'LIVE_UK_MARKET', liveComparableCount: 6,
        ...override,
    });

    it('keeps one quote per distinct registration and excludes the subject vehicle', () => {
        const output = summariseHistoricalQuotes([
            sample('AA70AAA', { auctionPrice: 14000, createdAt: new Date('2026-05-01') }),
            sample('AA70AAA', { auctionPrice: 17000 }),
            sample('BB70BBB', { auctionPrice: 20000 }),
            sample('SD70XRP', { auctionPrice: 99999 }),
        ], target, now);
        expect(output.vehicleCount).toBe(2);
        expect(output.liveBackedVehicleCount).toBe(2);
        expect(output.historicalAuctionMedian).toBe(18500);
        expect(output.evidenceType).toBe('HISTORICAL_ESTIMATES_NOT_SALES');
    });

    it('excludes old quotations, different models, far-off mileage and fallback guesses from market-backed medians', () => {
        const output = summariseHistoricalQuotes([
            sample('AA70AAA', { auctionPrice: 16000 }),
            sample('BB70BBB', { source: 'CARMAZIUM_MODEL', liveComparableCount: 0, auctionPrice: 28000 }),
            sample('CC70CCC', { createdAt: new Date('2025-09-01') }),
            sample('DD70DDD', { model: 'GLA' }),
            sample('EE70EEE', { mileage: 200000 }),
            sample('FF70FFF', { year: 2015 }),
        ], target, now);
        expect(output.vehicleCount).toBe(2);
        expect(output.liveBackedVehicleCount).toBe(1);
        expect(output.historicalAuctionMedian).toBe(16000);
        expect(output.historicalRetailMedian).toBe(19800);
    });

    it('never feeds prior internal guesses back into pricing calculation', () => {
        const fallback = calculateVehicleValuation(target, []);
        const history = summariseHistoricalQuotes([
            sample('AA70AAA', { source: 'CARMAZIUM_MODEL', liveComparableCount: 0, auctionPrice: 98000 }),
        ], target, now);
        expect(history.historicalAuctionMedian).toBeNull();
        expect(calculateVehicleValuation(target, []).auction.marketValue)
            .toBe(fallback.auction.marketValue);
        expect(history.lookbackMonths).toBe(12);
    });
});
