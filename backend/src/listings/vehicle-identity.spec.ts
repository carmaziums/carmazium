import { BadRequestException } from '@nestjs/common';
import { labelValuationIdentity, verifyValuationVehicleIdentity } from './vehicle-identity';
import { calculateVehicleValuation } from './vehicle-valuation';

describe('valuation vehicle identity guard', () => {
    const vehicle = { registration: 'BF10 XYP', make: 'Volkswagen', model: 'Golf', year: 2010 };
    const lookup = { vrm: 'BF10XYP', make: 'VOLKSWAGEN', model: 'Golf', year: 2010, dataSource: 'DVLA' as const };

    it('verifies a matching registration/make/MOT model without external AI enrichment', () => {
        expect(verifyValuationVehicleIdentity(vehicle, lookup)).toMatchObject({
            status: 'MODEL_VERIFIED', makeVerified: true, modelVerified: true,
        });
    });

    it('rejects a mismatched manufacturer before the market lookup', () => {
        expect(() => verifyValuationVehicleIdentity(
            { ...vehicle, make: 'Ford' }, lookup,
        )).toThrow(BadRequestException);
    });

    it('rejects a conflicting exact model including an invented performance model', () => {
        expect(() => verifyValuationVehicleIdentity(
            { ...vehicle, model: 'Golf R' }, lookup,
        )).toThrow(/model does not match/i);
    });

    it('accepts an exact derivative when explicitly included in the MOT model', () => {
        const fiesta = {
            registration: 'AB12CDE', make: 'Ford',
            model: 'Fiesta', variant: 'ST', year: 2012,
        };
        const result = verifyValuationVehicleIdentity(fiesta, {
            vrm: 'AB12CDE', make: 'FORD', model: 'FIESTA ST',
            year: 2012, dataSource: 'DVLA',
        });
        expect(result).toMatchObject({
            status: 'MODEL_VERIFIED', modelVerified: true, derivativeVerified: true,
        });
    });

    it('rejects a conflicting manufacture year beyond one year tolerance', () => {
        expect(() => verifyValuationVehicleIdentity(
            { ...vehicle, year: 2017 }, lookup,
        )).toThrow(/year does not match/i);
    });

    it('does not claim an unverified derivative or missing MOT model is verified', () => {
        expect(verifyValuationVehicleIdentity(
            { ...vehicle, variant: 'GTI' }, lookup,
        ).status).toBe('PARTIAL');
        expect(verifyValuationVehicleIdentity(
            vehicle, { ...lookup, model: undefined },
        ).status).toBe('PARTIAL');
    });

    it('accepts a generic model versus generation suffix only provisionally', () => {
        const requested = { registration: 'AB12CDE', make: 'Kia', model: 'Sportage3', year: 2012 };
        const lookup = { vrm: 'AB12CDE', make: 'KIA', model: 'SPORTAGE', year: 2012, dataSource: 'DVLA' as const };
        expect(verifyValuationVehicleIdentity(requested, lookup)).toMatchObject({
            status: 'PARTIAL', modelVerified: false,
        });
        expect(() => verifyValuationVehicleIdentity(
            requested, { ...lookup, model: 'SPORTAGE2' },
        )).toThrow(/model does not match/i);
    });

    it('normalizes registration spacing and common manufacturer aliases', () => {
        const vw = { registration: 'BF10XYP', make: 'VW', model: 'Golf', year: 2010 };
        expect(verifyValuationVehicleIdentity(vw, lookup).status).toBe('MODEL_VERIFIED');
    });

    it('caps confidence and labels a provisional quote without changing money', () => {
        const quote = calculateVehicleValuation(
            { make: 'Volkswagen', model: 'Golf', year: 2010, mileage: 45000 },
            [{ price: 6500, year: 2010, mileage: 45000, kind: 'SALE' }],
        );
        const labelled = labelValuationIdentity(quote, verifyValuationVehicleIdentity(
            { ...vehicle, variant: 'GTI' }, lookup,
        ));
        expect(labelled.confidence).toBe('LOW');
        expect(labelled.confidenceScore).toBeLessThanOrEqual(0.49);
        expect(labelled.auction.marketValue).toBe(quote.auction.marketValue);
        expect(labelled.explanation).toContain('Only part of the vehicle identity');
    });

    it('does not label an unregistered quote as registration-verified', () => {
        expect(verifyValuationVehicleIdentity(
            { ...vehicle, registration: undefined }, null,
        )).toMatchObject({ status: 'UNVERIFIED', registrationChecked: false });
    });
});
