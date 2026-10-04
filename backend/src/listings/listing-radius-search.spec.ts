import { distanceMiles, radiusBoundingBox, requireRadiusCoordinates } from './listing-radius-search';

describe('accurate full-inventory spherical radius geometry', () => {
    it('preserves non-radius queries without changing old filters', () => {
        expect(requireRadiusCoordinates({})).toBeNull();
    });

    it.each([
        { latitude: 51, maxDistanceMi: 25 },
        { longitude: -1, maxDistanceMi: 25 },
        { latitude: 51, longitude: -1 },
        { latitude: NaN, longitude: -1, maxDistanceMi: 50 },
        { latitude: 92, longitude: -1, maxDistanceMi: 50 },
        { latitude: 51, longitude: -181, maxDistanceMi: 50 },
        { latitude: 51, longitude: -1, maxDistanceMi: 0 },
        { latitude: 51, longitude: -1, maxDistanceMi: 201 },
    ])('rejects missing, malformed or unbounded centre and radius %#', (input) => {
        expect(() => requireRadiusCoordinates(input)).toThrow();
    });

    it('uses real spherical distance, not a bounding rectangle, for eligibility', () => {
        const london = { latitude: 51.5074, longitude: -0.1278, maxDistanceMi: 10 };
        const bounds = radiusBoundingBox(london);
        expect(distanceMiles(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
        expect(distanceMiles(51.5074, -0.1278, 51.6, -0.13)).toBeLessThan(10);
        expect(distanceMiles(51.5074, -0.1278, 52.4862, -1.8904)).toBeGreaterThan(100);
        expect(bounds.minLat).toBeLessThan(london.latitude);
        expect(bounds.maxLat).toBeGreaterThan(london.latitude);
        // Just inside BOTH bounding intervals but outside their spherical circle.
        const edge = { lat: london.latitude + 0.12, lon: london.longitude + 0.20 };
        expect(edge.lat).toBeLessThan(bounds.maxLat);
        expect(edge.lon).toBeLessThan(bounds.lonRanges[0].max);
        expect(distanceMiles(london.latitude, london.longitude, edge.lat, edge.lon)).toBeGreaterThan(10);
    });

    it('keeps UK prime-meridian crossings and dateline crossings complete', () => {
        const uk = radiusBoundingBox({ latitude: 51.5, longitude: -0.13, maxDistanceMi: 30 });
        expect(uk.lonRanges[0].min).toBeLessThan(0);
        expect(uk.lonRanges[0].max).toBeGreaterThan(0);
        const dateline = radiusBoundingBox({ latitude: 51.5, longitude: 179.9, maxDistanceMi: 100 });
        expect(dateline.lonRanges).toHaveLength(2);
        expect(dateline.lonRanges[0].max).toBe(180);
        expect(dateline.lonRanges[1].min).toBe(-180);
    });

    it('covers all longitudes when the circle reaches a pole', () => {
        const bounds = radiusBoundingBox({ latitude: 89.5, longitude: 2, maxDistanceMi: 100 });
        expect(bounds.lonRanges).toEqual([{ min: -180, max: 180 }]);
    });
});
