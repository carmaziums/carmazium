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
        expect(result.explanation).toMatch(/Exact-model market evidence is limited/i);
    });

    it('calibrates a 2019 Jaguar XE automatic near the supplied retail benchmark', () => {
        const result = calculateVehicleValuation({
            make: 'Jaguar',
            model: 'XE',
            year: 2019,
            mileage: 73500,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
            variant: '2.0 GPF Portfolio Saloon 4dr Petrol Auto Euro 6 (s/s) (200 ps)',
            condition: 'GOOD',
            writeOffCategory: 'NONE',
        }, []);

        expect(result.source).toBe('CARMAZIUM_MODEL_PROFILE');
        expect(result.confidence).toBe('LOW');
        expect(result.mid).toBeGreaterThanOrEqual(9500);
        expect(result.mid).toBeLessThanOrEqual(10750);
    });

    it('keeps a manual Jaguar XE below the equivalent automatic fallback', () => {
        const automatic = calculateVehicleValuation({
            make: 'Jaguar',
            model: 'XE',
            year: 2019,
            mileage: 73500,
            fuelType: 'PETROL',
            transmission: 'AUTOMATIC',
        }, []);
        const manual = calculateVehicleValuation({
            make: 'Jaguar',
            model: 'XE',
            year: 2019,
            mileage: 73500,
            fuelType: 'PETROL',
            transmission: 'MANUAL',
        }, []);

        expect(automatic.mid).toBeGreaterThan(manual.mid);
    });

    it('reduces valuation as the automatic exterior defect grade worsens', () => {
        const grade1 = calculateVehicleValuation({ ...vehicle, exteriorGrade: 1 }, []);
        const grade3 = calculateVehicleValuation({ ...vehicle, exteriorGrade: 3 }, []);
        const grade5 = calculateVehicleValuation({ ...vehicle, exteriorGrade: 5 }, []);

        expect(grade1.mid).toBeGreaterThan(grade3.mid);
        expect(grade3.mid).toBeGreaterThan(grade5.mid);
        expect(grade5.auction.marketValue).toBeLessThan(grade1.auction.marketValue);
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

    it('does not let one cheap live advert create a misleadingly low seller floor', () => {
        const result = calculateVehicleValuation(vehicle, [
            { price: 10000, year: 2016, mileage: 46000, fuelType: 'PETROL', transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
            { price: 8995, year: 2016, mileage: 47675, fuelType: 'PETROL', transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
            { price: 7250, year: 2014, mileage: 30500, fuelType: 'PETROL', transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
            { price: 3200, year: 2014, mileage: 60000, fuelType: 'PETROL', transmission: 'MANUAL', kind: 'ACTIVE_ASK' },
        ]);

        expect(result.low).toBeGreaterThanOrEqual(result.mid * 0.84);
        expect(result.high).toBeLessThanOrEqual(result.mid * 1.16);
        expect(result.retail.suggestedMinimum).toBeGreaterThanOrEqual(result.mid * 0.89);
    });

    it('prices automatic and manual cars differently when gearbox evidence differs', () => {
        const automatic = calculateVehicleValuation(
            { ...vehicle, transmission: 'AUTOMATIC' },
            [
                { price: 8200, year: 2019, mileage: 60000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'SALE' },
                { price: 8000, year: 2019, mileage: 62000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'ACCEPTED_OFFER' },
                { price: 7900, year: 2018, mileage: 65000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
            ],
        );

        const manual = calculateVehicleValuation(
            { ...vehicle, transmission: 'MANUAL' },
            [
                { price: 8200, year: 2019, mileage: 60000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'SALE' },
                { price: 8000, year: 2019, mileage: 62000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'ACCEPTED_OFFER' },
                { price: 7900, year: 2018, mileage: 65000, fuelType: 'DIESEL', transmission: 'AUTOMATIC', kind: 'ACTIVE_ASK' },
            ],
        );

        expect(automatic.mid).toBeGreaterThan(manual.mid);
    });

    it('uses a modest transmission adjustment even when no comparables exist', () => {
        const automatic = calculateVehicleValuation(
            { ...vehicle, transmission: 'AUTOMATIC' },
            [],
        );
        const manual = calculateVehicleValuation(
            { ...vehicle, transmission: 'MANUAL' },
            [],
        );

        expect(automatic.mid).toBeGreaterThan(manual.mid);
    });


    it('uses the upper market guide for retail and lower market guide for dealer auctions', () => {
        const result = calculateVehicleValuation(vehicle, [
            { price: 9000, year: 2019, mileage: 60000, kind: 'ACTIVE_ASK' },
            { price: 9500, year: 2019, mileage: 58000, kind: 'ACTIVE_ASK' },
            { price: 10000, year: 2020, mileage: 55000, kind: 'ACTIVE_ASK' },
            { price: 10500, year: 2020, mileage: 52000, kind: 'ACTIVE_ASK' },
            { price: 11000, year: 2021, mileage: 50000, kind: 'ACTIVE_ASK' },
        ]);

        expect(result.retail.suggestedAsking).toBe(result.high);
        expect(result.retail.suggestedMinimum).toBe(result.mid);
        expect(result.auction.marketValue).toBe(result.low);
        expect(result.auction.marketValue).toBeLessThan(result.retail.suggestedAsking);
        expect(result.auction.suggestedReserve).toBeLessThanOrEqual(result.auction.marketValue);
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
