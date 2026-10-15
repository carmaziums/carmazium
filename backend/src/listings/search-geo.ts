/** Conservative spatial candidate bounds + exact haversine distance (miles).
 * The bounding query avoids fetching UK-wide inventory; the exact calculation
 * decides eligibility before pagination, avoiding per-page missing results.
 */
const RADIUS_MI = 3958.8;
const rad = (deg: number) => deg * Math.PI / 180;
export function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return RADIUS_MI * 2 * Math.atan2(Math.sqrt(Math.min(1,a)), Math.sqrt(Math.max(0,1-a)));
}
export function geoBounds(latitude: number, longitude: number, miles: number) {
  // 68.7 miles/latitude degree is a conservative lower bound for UK/temperate latitudes.
  const deltaLat = miles / 68.7;
  const minLat = Math.max(-90, latitude - deltaLat), maxLat = Math.min(90, latitude + deltaLat);
  const absMaxLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
  const cosLat = Math.cos(rad(absMaxLat));
  const deltaLon = cosLat < 1e-8 ? 180 : Math.min(180, miles / (68.7 * cosLat));
  if (deltaLon >= 180) return { latitude: { gte: minLat, lte: maxLat }, longitudeConstraint: null };
  const minLon = longitude - deltaLon, maxLon = longitude + deltaLon;
  const longitudeConstraint = minLon < -180
    ? { OR: [{ longitude: { gte: minLon + 360 } }, { longitude: { lte: maxLon } }] }
    : maxLon > 180
      ? { OR: [{ longitude: { gte: minLon } }, { longitude: { lte: maxLon - 360 } }] }
      : { longitude: { gte: minLon, lte: maxLon } };
  return { latitude: { gte: minLat, lte: maxLat }, longitudeConstraint };
}
