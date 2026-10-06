/**
 * Spherical distance used only after a conservative database bounding-box
 * prefilter. No PostGIS, paid infrastructure, migration or user geocoding.
 */
const EARTH_MILES = 3958.7613;
const RAD = Math.PI / 180;

export interface RadiusCoordinates {
    latitude: number;
    longitude: number;
    maxDistanceMi: number;
}

export function requireRadiusCoordinates(input: {
    latitude?: number;
    longitude?: number;
    maxDistanceMi?: number;
}): RadiusCoordinates | null {
    const { latitude, longitude, maxDistanceMi } = input;
    if (latitude === undefined && longitude === undefined && maxDistanceMi === undefined) return null;
    if (latitude === undefined || longitude === undefined || maxDistanceMi === undefined ||
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(maxDistanceMi) || maxDistanceMi <= 0 || maxDistanceMi > 200) {
        throw new Error('Provide valid latitude, longitude and maxDistanceMi (0–200 miles) together');
    }
    return { latitude, longitude, maxDistanceMi };
}

export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const dLat = (bLat - aLat) * RAD;
    const dLon = (bLng - aLng) * RAD;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_MILES * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

export function radiusBoundingBox({ latitude, longitude, maxDistanceMi }: RadiusCoordinates) {
    const deltaLat = maxDistanceMi / EARTH_MILES / RAD;
    // The rectangle is a conservative prefilter, NOT the definitive result;
    // we always check spherical distance for exact inclusion.
    const minLat = Math.max(-90, latitude - deltaLat - 0.001);
    const maxLat = Math.min(90, latitude + deltaLat + 0.001);
    const edgeCosine = Math.min(Math.abs(Math.cos(minLat * RAD)),
        Math.abs(Math.cos(maxLat * RAD)), Math.abs(Math.cos(latitude * RAD)));
    if (minLat <= -90 || maxLat >= 90 || edgeCosine < 1e-5) {
        return { minLat, maxLat, lonRanges: [{ min: -180, max: 180 }] };
    }
    const deltaLng = maxDistanceMi / EARTH_MILES / edgeCosine / RAD + 0.001;
    if (deltaLng >= 180) return { minLat, maxLat, lonRanges: [{ min: -180, max: 180 }] };
    const west = longitude - deltaLng;
    const east = longitude + deltaLng;
    const lonRanges = west < -180 ? [
        { min: west + 360, max: 180 }, { min: -180, max: east },
    ] : east > 180 ? [
        { min: west, max: 180 }, { min: -180, max: east - 360 },
    ] : [{ min: west, max: east }];
    return { minLat, maxLat, lonRanges };
}
