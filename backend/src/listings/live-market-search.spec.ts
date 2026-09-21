import { sanitizeLiveUkComparables } from './live-market-search';

describe('sanitizeLiveUkComparables', () => {
    const input = {
        make: 'Toyota',
        model: 'Land Cruiser',
        year: 2022,
        mileage: 19800,
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        writeOffCategory: 'NONE',
    };

    it('keeps credible exact-model UK asking-price evidence and removes duplicates/noise', () => {
        const rows = sanitizeLiveUkComparables(input, [
            {
                title: '2022 Toyota Land Cruiser 2.8 D-4D Invincible Auto',
                url: 'https://dealer.example/land-cruiser-1',
                priceGBP: 42995,
                year: 2022,
                mileage: 22000,
                make: 'Toyota',
                model: 'Land Cruiser',
                variant: 'Invincible',
                fuelType: 'Diesel',
                transmission: 'Automatic',
            },
            {
                title: '2022 Toyota Land Cruiser 2.8 D-4D Invincible Auto',
                url: 'https://dealer.example/land-cruiser-1',
                priceGBP: 42995,
                year: 2022,
                mileage: 22000,
                make: 'Toyota',
                model: 'Land Cruiser',
                variant: 'Invincible',
                fuelType: 'Diesel',
                transmission: 'Automatic',
            },
            {
                title: '2021 Toyota Corolla Hybrid',
                url: 'https://dealer.example/corolla',
                priceGBP: 18995,
                year: 2021,
                mileage: 18000,
                make: 'Toyota',
                model: 'Corolla',
                variant: null,
                fuelType: 'Hybrid',
                transmission: 'Automatic',
            },
            {
                title: '2022 Toyota Land Cruiser CAT S damaged repair',
                url: 'https://dealer.example/damaged',
                priceGBP: 20000,
                year: 2022,
                mileage: 20000,
                make: 'Toyota',
                model: 'Land Cruiser',
                variant: null,
                fuelType: 'Diesel',
                transmission: 'Automatic',
            },
        ]);

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(expect.objectContaining({
            price: 42995,
            year: 2022,
            mileage: 22000,
            kind: 'ACTIVE_ASK',
        }));
    });

    it('rejects implausibly distant years and invalid prices', () => {
        const rows = sanitizeLiveUkComparables(input, [
            {
                title: '2012 Toyota Land Cruiser',
                url: 'https://dealer.example/old',
                priceGBP: 19995,
                year: 2012,
                mileage: 80000,
                make: 'Toyota',
                model: 'Land Cruiser',
                variant: null,
                fuelType: 'Diesel',
                transmission: 'Automatic',
            },
            {
                title: '2022 Toyota Land Cruiser',
                url: 'https://dealer.example/monthly',
                priceGBP: 399,
                year: 2022,
                mileage: 20000,
                make: 'Toyota',
                model: 'Land Cruiser',
                variant: null,
                fuelType: 'Diesel',
                transmission: 'Automatic',
            },
        ]);

        expect(rows).toEqual([]);
    });
});
