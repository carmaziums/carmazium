/** Canonical native listing specs. Keep backend enum values, not UI labels. */
export const CAR_BODY_VALUES = [
  'SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE',
  'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK',
  'STATION_WAGON', 'MPV', 'VAN',
] as const;
export const HGV_BODY_VALUES = [
  'HGV_TRACTOR_UNIT', 'HGV_BOX', 'HGV_CURTAIN_SIDER', 'HGV_FLATBED',
  'HGV_TIPPER', 'HGV_DROPSIDE', 'HGV_TANKER', 'HGV_REFRIGERATED',
  'HGV_CAR_TRANSPORTER',
] as const;
export type NativeVehicleType = 'CAR' | 'HGV' | 'MOTORCYCLE';

export function normalizeNativeRegistration(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

export function normalizeNativeTransmission(value: unknown): string {
  if (typeof value !== 'string') return '';
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (key === 'MANUAL') return 'MANUAL';
  if (key === 'AUTO' || key === 'AUTOMATIC') return 'AUTOMATIC';
  if (key === 'SEMI_AUTOMATIC' || key === 'SEMIAUTOMATIC' || key === 'SEMI_AUTO') return 'SEMI_AUTOMATIC';
  if (key === 'CVT' || key === 'CONTINUOUSLY_VARIABLE') return 'CVT';
  return '';
}

export function allowedNativeBodyTypes(vehicleType: NativeVehicleType): readonly string[] {
  return vehicleType === 'HGV' ? HGV_BODY_VALUES :
    vehicleType === 'MOTORCYCLE' ? [] : CAR_BODY_VALUES;
}

export function normalizeNativeBodyType(value: unknown, vehicleType: NativeVehicleType): string {
  if (typeof value !== 'string') return '';
  const key = value.trim().toUpperCase().replace(/[\s/-]+/g, '_');
  const canonical = ({
    SALOON: 'SEDAN',
    HATCH_BACK: 'HATCHBACK',
    PICKUP: 'PICKUP_TRUCK',
    PICK_UP: 'PICKUP_TRUCK',
    STATIONWAGON: 'STATION_WAGON',
  } as Record<string, string>)[key] ?? key;
  return allowedNativeBodyTypes(vehicleType).includes(canonical) ? canonical : '';
}

/**
 * DVLA-derived details belong to the identity returned by that lookup.
 * A manual make/model/year correction must not silently reuse a previous
 * vehicle's variant, transmission, emissions or MOT evidence in a valuation.
 * DVLA sometimes omits model; in that case the seller may enter it manually.
 */
export function nativeLookupMatchesEditedVehicle(
  lookup: { make?: unknown; model?: unknown; year?: unknown } | null,
  current: { make: string; model: string; year: string | number },
): boolean {
  if (!lookup) return false;
  const normalize = (value: unknown) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : '';
  const originalMake = normalize(lookup.make);
  const originalYear = Number(lookup.year);
  if (!originalMake || !Number.isSafeInteger(originalYear) || originalYear < 1900) return false;
  if (normalize(current.make) !== originalMake || Number(current.year) !== originalYear) return false;
  const originalModel = normalize(lookup.model);
  return !originalModel || normalize(current.model) === originalModel;
}

export function preserveNativeLookupSpecs(
  current: { vrm: string; transmission: string; bodyType: string; vehicleType: NativeVehicleType },
  incoming: { vrm: string; transmission?: unknown; bodyType?: unknown },
): { transmission: string; bodyType: string } {
  const sameVehicle = !!normalizeNativeRegistration(current.vrm)
    && normalizeNativeRegistration(current.vrm) === normalizeNativeRegistration(incoming.vrm);
  return {
    transmission: (sameVehicle && normalizeNativeTransmission(current.transmission))
      || normalizeNativeTransmission(incoming.transmission),
    bodyType: (sameVehicle && normalizeNativeBodyType(current.bodyType, current.vehicleType))
      || normalizeNativeBodyType(incoming.bodyType, current.vehicleType),
  };
}
