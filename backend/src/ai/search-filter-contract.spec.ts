import { normalizeAiSearchFilters } from './search-filter-contract';
describe('AI search contract', () => {
    it('retains a detailed buyer request using valid website/native filter names', () => {
        expect(normalizeAiSearchFilters({ maxEngineSize: 1600, maxMileage: '62500', minYear: 2015, isImported: false, ulezCompliant: 'yes', location: 'Birmingham', transmission: 'automatic', features: 'heated seats,Invented equipment,Apple CarPlay' })).toEqual({ maxEngine: '1600', maxMileage: '62500', minYear: '2015', isImported: 'false', ulezCompliant: 'true', location: 'Birmingham', transmission: 'AUTOMATIC', features: 'Heated Seats,Apple CarPlay' });
    });
    it('normalizes pickup, saloon and multi-select enums', () => {
        expect(normalizeAiSearchFilters({ bodyType: 'pickup', fuelTypes: 'PETROL,ELECTRIC,INVALID', transmissions: 'MANUAL,CVT' })).toEqual({ bodyType: 'PICKUP_TRUCK', fuelTypes: 'PETROL,ELECTRIC', transmissions: 'MANUAL,CVT' });
        expect(normalizeAiSearchFilters({ bodyType: 'saloon' }).bodyType).toBe('SEDAN');
    });
    it('rejects unsupported keys, invalid values and nested model output', () => {
        expect(normalizeAiSearchFilters({ maxPrice: '-1', minMileage: 'NaN', maxEngine: '1.6', minYear: '10', maxOwners: '99', bodyType: 'BOAT', sellerType: {}, includeSold: true, apiKey: 'not-a-filter' })).toEqual({});
        expect(normalizeAiSearchFilters(null)).toEqual({});
    });
    it('keeps explicit zero values and never confuses false with true', () => {
        expect(normalizeAiSearchFilters({ maxPrice: 0, maxCo2: 0, isImported: 'no', ulezCompliant: 'false' })).toEqual({ maxPrice: '0', maxCo2: '0', isImported: 'false', ulezCompliant: 'false' });
    });
});
