import { calculateVehicleValuation } from './vehicle-valuation';

describe('calculateVehicleValuation', () => {
    const vehicle = {
        make: 'Ford',
        model: 'Focus',
        year: 2019,
        mileage: 60000,
        fuelType: 'DIESEL',
        transmission: 'MANUAL',
        condition: 'GOOD',
        writeOffCategory: 'NONE',
    };

    it('uses real CarMazium transaction evidence when available', () => {
        const result = calculateVehicleValuation(vehicle, [
            { price: 7200, year: 2019, mileage: 58000, fuelType: 'DIESEL', transmission: 'MANUAL', kind: 'SALE' },
            { price: 7000, year: 2019, mileage: 64000, fuelType: 'DIESEL', transmission: 'MANUAL', kind: 'ACCEPTED_OFFER' },
            { price: 6400, year: 2019, mileage: 61000, fuelType: 'DIESEL', transmission: 'MANUAL', kind: 'AUCTION_RESULT' },
            { price: 7600, year: 2020, mileage: 52000, fuelType: 'DIESEL', transmission: 'MANUAL', kind: 'ACTIVE_ASK' },
        ]);

        expect(result.source).toBe('CARMAZIUM_MARKET');
        expect(result.comparables).toBe(4);
        expect(result.mid).toBeGreaterThanOrEqual(6500);
        expect(result.mid).toBeLessThanOrEqual(8000);
        expect(result.low).toBeLessThan(result.mid);
        expect(result.high).toBeGreaterThan(result.mid);
        expect(result.auction.openingBid).toBeLessThan(result.auction.reserveLow);
        expect(result.auction.reserveLow).toBeLessThan(result.auction.reserveHigh);
    });

    it('falls back transparently when CarMazium has no comparables', () => {
        const result = calculateVehicleValuation(vehicle, []);

        expect(result.source).toBe('CARMAZIUM_MODEL');
        expect(result.confidence).toBe('LOW');
        expect(result.comparables).toBe(0);
        expect(result.low).toBeLessThan(result.mid);
        expect(result.high).toBeGreaterThan(result.mid);
        expect(result.explanation).toMatch(/does not yet have enough comparable completed transactions/i);
    });

    it('discounts write-off vehicles relative to an otherwise identical clean vehicle', () => {
        const comps = [
            { price: 10000, year: 2019, mileage: 60000, kind: 'SALE' as const },
            { price: 9800, year: 2019, mileage: 62000, kind: 'ACCEPTED_OFFER' as const },
            { price: 10300, year: 2020, mileage: 55000, kind: 'ACTIVE_ASK' as const },
        ];

        const clean = calculateVehicleValuation(vehicle, comps);
        const catS = calculateVehicleValuation({ ...vehicle, writeOffCategory: 'CAT_S' }, comps);

        expect(catS.mid).toBeLessThan(clean.mid);
        expect(catS.mid).toBeLessThanOrEqual(clean.mid * 0.8);
    });

    it('does not double-discount a write-off when the comparable is already the same category', () => {
        const catS = { ...vehicle, writeOffCategory: 'CAT_S' };
        const result = calculateVehicleValuation(catS, [
            { price: 7000, year: 2019, mileage: 60000, writeOffCategory: 'CAT_S', kind: 'SALE' },
            { price: 6800, year: 2019, mileage: 62000, writeOffCategory: 'CAT_S', kind: 'ACCEPTED_OFFER' },
            { price: 7200, year: 2020, mileage: 55000, writeOffCategory: 'CAT_S', kind: 'ACTIVE_ASK' },
        ]);

        expect(result.mid).toBeGreaterThan(6000);
        expect(result.mid).toBeLessThan(8000);
    });

    it('does not let an extreme active asking price dominate completed outcomes', () => {
        const result = calculateVehicleValuation(vehicle, [
            { price: 7000, year: 2019, mileage: 60000, kind: 'SALE' },
            { price: 7100, year: 2019, mileage: 60000, kind: 'SALE' },
            { price: 6900, year: 2019, mileage: 60000, kind: 'ACCEPTED_OFFER' },
            { price: 7300, year: 2019, mileage: 60000, kind: 'ACTIVE_ASK' },
            { price: 25000, year: 2019, mileage: 60000, kind: 'ACTIVE_ASK' },
        ]);

        expect(result.mid).toBeLessThan(9000);
        expect(result.high).toBeLessThan(12000);
    });
});
