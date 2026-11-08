import { ListingsService } from './listings.service';

describe('24-hour valuation price-lock identity', () => {
    const service = new ListingsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const cacheKey = (dto: Record<string, unknown>) =>
        (service as any).valuationPriceLockId(dto);

    const vehicle = {
        registration: 'EW19CFY',
        make: 'Volkswagen',
        model: 'Golf',
        year: 2019,
        mileage: 112000,
        variant: '1.5 TSI EVO R-Line',
        fuelType: 'PETROL',
        transmission: 'MANUAL',
    };

    it('reuses an identical quote for 24 hours even with VRM whitespace changes', () => {
        expect(cacheKey(vehicle)).toBe(cacheKey({ ...vehicle, registration: 'EW19 CFY' }));
    });

    it('must NEVER return a 112,000-mile quote at 112,600 miles', () => {
        expect(cacheKey(vehicle)).not.toBe(cacheKey({ ...vehicle, mileage: 112600 }));
    });

    it('does not reuse a quote from another derivative or model', () => {
        expect(cacheKey(vehicle)).not.toBe(cacheKey({ ...vehicle, variant: '2.0 GTI' }));
        expect(cacheKey(vehicle)).not.toBe(cacheKey({ ...vehicle, model: 'Polo' }));
        expect(cacheKey(vehicle)).not.toBe(cacheKey({ ...vehicle, transmission: 'AUTOMATIC' }));
    });
});
