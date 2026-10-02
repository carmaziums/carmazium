import {
    canonicalValuationCacheParts, canonicalValuationIdentity,
    sameValuationBaseIdentity,
} from './vehicle-valuation-identity';

describe('Block 2 canonical valuation base identity', () => {
    const audi = { registration: 'RO18 YWN', make: 'AUDI', model: 'Audi A1', year: 2018, mileage: 106470 };

    it('maps audit example Audi A1 and A1 to the same market-base key', () => {
        expect(canonicalValuationCacheParts(audi)).toEqual(
            canonicalValuationCacheParts({ ...audi, registration: 'RO18YWN', model: 'A1' }),
        );
        expect(sameValuationBaseIdentity(audi, { ...audi, model: 'a1' })).toBe(true);
    });

    it('normalises presentation but not a different model family', () => {
        expect(canonicalValuationIdentity({
            registration: 'BF10 XYP', make: 'VW', model: 'Volkswagen Golf', year: 2010, mileage: 138734,
        })).toEqual(canonicalValuationIdentity({
            registration: 'BF10XYP', make: 'VOLKSWAGEN', model: 'Golf', year: 2010, mileage: 138734,
        }));
        const ford = { registration: 'MR61MRK', make: 'FORD', year: 2018, mileage: 99600 };
        expect(sameValuationBaseIdentity({ ...ford, model: 'Connect' }, { ...ford, model: 'Transit Connect' }))
            .toBe(false);
    });

    it('keeps Fiesta ST separate from a plain Fiesta', () => {
        const ford = { registration: 'DN21GXH', make: 'Ford', year: 2021, mileage: 49380 };
        expect(sameValuationBaseIdentity({ ...ford, model: 'Fiesta' }, { ...ford, model: 'Fiesta ST' }))
            .toBe(false);
    });

    it('does not conflate distinct generations or variants across new journeys', () => {
        const kia = { registration: 'MC18MHZ', make: 'KIA', model: 'SPORTAGE', year: 2018, mileage: 79500 };
        expect(sameValuationBaseIdentity(kia, { ...kia, model: 'SPORTAGE3' })).toBe(false);
        expect(canonicalValuationCacheParts({ ...kia, variant: 'GT Line' }))
            .not.toEqual(canonicalValuationCacheParts({ ...kia, variant: 'base' }));
    });

    it('changes the identity when registration or mileage changes', () => {
        expect(sameValuationBaseIdentity(audi, { ...audi, registration: 'RO18YWX' })).toBe(false);
        expect(sameValuationBaseIdentity(audi, { ...audi, mileage: 106500 })).toBe(false);
    });
});
