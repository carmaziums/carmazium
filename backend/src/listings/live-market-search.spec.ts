import { getLiveUkMarketSearchPlan, sanitizeLiveUkComparables } from './live-market-search';

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


    it('dedicates one live search pass to CarGurus UK', () => {
        const plan = getLiveUkMarketSearchPlan('LIVE', 2);

        expect(plan.label).toBe('cargurus');
        expect(plan.allowedDomains).toEqual(['cargurus.co.uk']);
        expect(plan.instruction).toMatch(/CarGurus/i);
    });

    it('accepts common lookup formatting differences and a one-character model typo', () => {
        const sportage = sanitizeLiveUkComparables({
            make: 'Kia',
            model: 'SPORTAGE3',
            year: 2018,
            mileage: 79500,
        }, [{
            title: '2018 Kia Sportage 1.6 GDi 2',
            url: 'https://www.cargurus.co.uk/Cars/example-sportage',
            priceGBP: 9495,
            year: 2018,
            mileage: 79000,
            make: 'Kia',
            model: 'Sportage',
            variant: '1.6 GDi 2',
            fuelType: 'Petrol',
            transmission: 'Manual',
        }]);

        const xtrail = sanitizeLiveUkComparables({
            make: 'Nissan',
            model: 'X-TRAIL E-POWER',
            year: 2015,
            mileage: 72300,
        }, [{
            title: '2015 Nissan X-Trail Tekna',
            url: 'https://www.autotrader.co.uk/car-details/example-xtrail',
            priceGBP: 7995,
            year: 2015,
            mileage: 73000,
            make: 'Nissan',
            model: 'X-Trail',
            variant: 'Tekna',
            fuelType: 'Diesel',
            transmission: 'Manual',
        }]);

        const chery = sanitizeLiveUkComparables({
            make: 'Chery',
            model: 'CHERY TIGGA 4',
            year: 2026,
            mileage: 359,
        }, [{
            title: '2026 Chery Tiggo 4 1.5 Hybrid Aspire',
            url: 'https://www.cargurus.co.uk/Cars/example-tiggo',
            priceGBP: 18955,
            year: 2026,
            mileage: 19,
            make: 'Chery',
            model: 'Tiggo 4',
            variant: 'Aspire',
            fuelType: 'Hybrid',
            transmission: 'Automatic',
        }]);

        expect(sportage).toHaveLength(1);
        expect(xtrail).toHaveLength(1);
        expect(chery).toHaveLength(1);
        expect(chery[0]).toEqual(expect.objectContaining({
            sourceDomain: 'cargurus.co.uk',
            kind: 'ACTIVE_ASK',
        }));
    });

    it('still refuses to broaden a registration accidentally stored as a model into make-only evidence', () => {
        const rows = sanitizeLiveUkComparables({
            make: 'Mini',
            model: 'KP23TOH',
            year: 2023,
            mileage: 26000,
        }, [{
            title: '2023 MINI Countryman Cooper',
            url: 'https://www.cargurus.co.uk/Cars/example-mini',
            priceGBP: 21995,
            year: 2023,
            mileage: 26000,
            make: 'Mini',
            model: 'Countryman',
            variant: 'Cooper',
            fuelType: 'Petrol',
            transmission: 'Automatic',
        }]);

        expect(rows).toEqual([]);
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
