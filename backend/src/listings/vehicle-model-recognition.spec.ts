import { recogniseVehicleModel } from './vehicle-model-recognition';

describe('make-aware vehicle-model recognition', () => {
    test.each([
        ['HONDA', 'Honda Jazz', 2018, 'Jazz', undefined],
        ['HONDA', 'Jazz 1.3 i-VTEC SE', 2018, 'Jazz', '1.3 i-VTEC SE'],
        ['NISSAN', 'Nissan leaf tekna 2014', 2014, 'Leaf', 'tekna'],
        ['AUDI', 'Audi A1', 2018, 'A1', undefined],
        ['TOYOTA', '2022 Toyota Yaris Cross Design', 2022, 'Yaris Cross', 'Design'],
        ['HONDA', 'Honda Civic Type R GT', 2020, 'Civic Type R', 'GT'],
        ['BMW', 'BMW 220i gran tourer', 2019, '2 Series Gran Tourer', '220I'],
        ['VOLKSWAGEN', 'Golf', 2010, 'Golf', undefined],
    ])('%s / %s uses the correct model identity', (make, model, year, expectedModel, expectedVariant) => {
        const result = recogniseVehicleModel({ make, model, year });
        expect(result.model).toBe(expectedModel);
        expect(result.variant).toBe(expectedVariant);
        expect(result.recognised).toBe(true);
    });

    it('keeps an explicit seller-provided trim after extracting engine detail', () => {
        const result = recogniseVehicleModel({
            make: 'Honda', model: 'Honda Jazz 1.3',
            variant: 'SE', year: 2017,
        });
        expect(result).toEqual(expect.objectContaining({
            model: 'Jazz', variant: '1.3 SE', recognised: true,
        }));
    });

    it('does not mistake an overlapping model name for another model', () => {
        expect(recogniseVehicleModel({
            make: 'Audi', model: 'A10', year: 2019,
        })).toEqual(expect.objectContaining({
            model: 'A10', recognised: false,
        }));
    });

    it('never invents an unknown model or silently corrects a typo', () => {
        const result = recogniseVehicleModel({
            make: 'Honda', model: 'Jaz', year: 2018,
        });
        expect(result.model).toBe('JAZ');
        expect(result.recognised).toBe(false);
        expect(result.suggestions).toContain('Jazz');
    });

    it('never treats a make, year or registration as the model', () => {
        for (const model of ['Honda', '2018 Honda', 'AB18 XYZ']) {
            expect(recogniseVehicleModel({ make: 'Honda', model, year: 2018 }).model).toBe('');
        }
    });

    it('retains uncommon valid free text as unverified, not a guessed catalogue match', () => {
        const result = recogniseVehicleModel({
            make: 'Rover', model: 'Rover An Uncatalogued Historical Model',
            year: 1972,
        });
        expect(result.model).toBe('AN UNCATALOGUED HISTORICAL MODEL');
        expect(result.recognised).toBe(false);
    });
});
