import { calculateWarrantyRetailPrice, WarrantyTariffSelection } from './warranty-retail-tariff';

const base: WarrantyTariffSelection = { vehicleCategory: 'CAR', months: 12, repairLimit: 2000, labourRate: 75, extras: [] };

describe('Pulse Cars retail warranty tariff (not supplier eligibility)', () => {
    it.each([
        ['CAR', 2000, 75, 36000], ['SUV', 2000, 75, 44500],
        ['CAR', 1000, 75, 33000], ['SUV', 1000, 75, 41500],
        ['CAR', 2000, 100, 54000], ['SUV', 2000, 100, 66750],
        ['CAR', 2000, 150, 63000], ['SUV', 2000, 150, 77875],
        ['CAR', 2000, 200, 72000], ['SUV', 2000, 200, 89000],
    ])('%s / £%s repair / £%s labour totals %sp', (vehicleCategory, repairLimit, labourRate, price) => {
        expect(calculateWarrantyRetailPrice({ ...base, vehicleCategory, repairLimit, labourRate } as WarrantyTariffSelection).totalPence).toBe(price);
    });

    it.each([['CAR', 68000], ['SUV', 80750]])('adds all extras once without multiplying them for %s', (vehicleCategory, price) => {
        expect(calculateWarrantyRetailPrice({ ...base, vehicleCategory, labourRate: 100, extras: ['AIRBAGS', 'DRIVER_ASSISTANCE', 'EMISSIONS', 'MULTIMEDIA'] } as WarrantyTariffSelection).totalPence).toBe(price);
    });

    it('keeps the labour surcharge unchanged when choosing the smaller repair limit', () => {
        expect(calculateWarrantyRetailPrice({ ...base, vehicleCategory: 'SUV', repairLimit: 1000, labourRate: 150 }).totalPence).toBe(74875);
    });

    it('checks all 256 combinations for integer pence and additive extras', () => {
        const extras: WarrantyTariffSelection['extras'] = ['AIRBAGS', 'DRIVER_ASSISTANCE', 'EMISSIONS', 'MULTIMEDIA'];
        const extraAmounts = [2000, 2000, 2000, 8000];
        for (const vehicleCategory of ['CAR', 'SUV'] as const) {
            for (const repairLimit of [1000, 2000] as const) {
                for (const labourRate of [75, 100, 150, 200] as const) {
                    const selection = { ...base, vehicleCategory, repairLimit, labourRate };
                    const beforeExtras = calculateWarrantyRetailPrice(selection).totalPence;
                    for (let mask = 0; mask < 16; mask++) {
                        const selected = extras.filter((_, i) => mask & (1 << i));
                        const addition = extraAmounts.reduce((sum, price, i) => sum + ((mask & (1 << i)) ? price : 0), 0);
                        const quote = calculateWarrantyRetailPrice({ ...selection, extras: selected });
                        expect(Number.isSafeInteger(quote.totalPence)).toBe(true);
                        expect(quote.totalPence).toBe(beforeExtras + addition);
                    }
                }
            }
        }
    });

    it.each([
        { repairLimit: 5000 }, { labourRate: 125 }, { labourRate: 0 },
        { repairLimit: '2000' }, { months: 24 }, { vehicleCategory: 'CROSSOVER' },
        { extras: ['AIR_CONDITIONING'] }, { extras: ['MOT'] }, { extras: ['__proto__'] },
        { extras: ['AIRBAGS', 'AIRBAGS'] }, { extras: null },
    ])('rejects unsupported or ambiguous selections: %j', overrides => {
        expect(() => calculateWarrantyRetailPrice({ ...base, ...overrides } as WarrantyTariffSelection)).toThrow();
    });
});
