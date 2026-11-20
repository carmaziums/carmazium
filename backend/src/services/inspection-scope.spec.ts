import { eligibleInspectionJobScopes, providerInspectionScopes, providerSupportsInspection } from './inspection-scope';

describe('TradeXchange inspection specialisms', () => {
    it('defaults legacy providers to vehicle-only inspections', () => {
        expect(providerInspectionScopes(null)).toEqual(['VEHICLE']);
        expect(providerSupportsInspection(undefined, undefined)).toBe(true);
        expect(providerSupportsInspection(undefined, 'VEHICLE')).toBe(true);
        expect(providerSupportsInspection(undefined, 'COSMETIC')).toBe(false);
        expect(providerSupportsInspection(undefined, 'BOTH')).toBe(false);
    });

    it('limits a cosmetic-only business to cosmetic enquiries', () => {
        expect(providerInspectionScopes(['COSMETIC'])).toEqual(['COSMETIC']);
        expect(providerSupportsInspection(['COSMETIC'], 'COSMETIC')).toBe(true);
        expect(providerSupportsInspection(['COSMETIC'], 'VEHICLE')).toBe(false);
        expect(providerSupportsInspection(['COSMETIC'], 'BOTH')).toBe(false);
        expect(eligibleInspectionJobScopes(['COSMETIC'])).toEqual(['COSMETIC']);
    });

    it('requires both capabilities for a combined inspection', () => {
        expect(providerSupportsInspection(['VEHICLE'], 'BOTH')).toBe(false);
        expect(providerSupportsInspection(['VEHICLE', 'COSMETIC'], 'BOTH')).toBe(true);
        expect(eligibleInspectionJobScopes(['VEHICLE', 'COSMETIC']))
            .toEqual(['VEHICLE', 'COSMETIC', 'BOTH']);
    });

    it('does not treat unknown scopes as approved specialisms', () => {
        expect(providerInspectionScopes(['STRUCTURAL', 'UNSUPPORTED'])).toEqual([]);
        expect(providerSupportsInspection(['STRUCTURAL'], 'COSMETIC')).toBe(false);
        expect(providerSupportsInspection(['VEHICLE'], 'STRUCTURAL')).toBe(false);
        expect(eligibleInspectionJobScopes(['STRUCTURAL'])).toEqual([]);
    });
});
