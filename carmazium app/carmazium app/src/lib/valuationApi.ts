export interface VehicleValuationRequest {
  make: string;
  model: string;
  year: number;
  mileage: number;
  variant?: string;
  fuelType?: string;
  transmission?: string;
  condition?: string;
  exteriorGrade?: number;
  serviceHistory?: string;
  owners?: string;
  numberOfKeys?: number;
  ulezCompliant?: boolean;
  euroStandard?: string;
  doors?: number;
  seats?: number;
  features?: string[];
  writeOffCategory?: string;
  isImported?: boolean;
  excludeListingId?: string;
  valuationId?: string;
  registration?: string;
}

export interface VehicleValuation {
  low: number;
  mid: number;
  high: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number;
  comparables: number;
  source:
    | 'CARMAZIUM_MARKET'
    | 'LIVE_UK_MARKET'
    | 'BLENDED_MARKET'
    | 'CARMAZIUM_MODEL_PROFILE'
    | 'CARMAZIUM_MODEL';
  explanation: string;
  retail: {
    suggestedAsking: number;
    suggestedMinimum: number;
  };
  auction: {
    marketValue: number;
    openingBid: number;
    reserveLow: number;
    reserveHigh: number;
    suggestedReserve: number;
  };
  marketEvidence?: {
    carmaziumComparables: number;
    liveUkComparables: number;
    checkedAt?: string;
    liveUkSearchStatus?: 'USED' | 'INSUFFICIENT' | 'UNAVAILABLE';
    rawLiveUkComparables?: number;
    liveUkAttempts?: number;
    blendedMarketAttempts?: number;
    valuationStrategy?: 'LIVE' | 'BLENDED' | 'FALLBACK';
  };
}

interface VehicleValuationResponse {
  success: boolean;
  data: VehicleValuation;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';


const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function roundMoney(value: number): number {
  const safe = Math.max(500, value);
  const step = safe < 10000 ? 50 : 100;
  return Math.round(safe / step) * step;
}

function transmissionFamily(value?: string): 'MANUAL' | 'AUTO' | null {
  const normalized = (value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (normalized === 'MANUAL') return 'MANUAL';
  if (['AUTOMATIC', 'AUTO', 'CVT', 'SEMIAUTOMATIC', 'SEMIAUTO'].includes(normalized)) return 'AUTO';
  return null;
}

function featureValueFactor(features?: string[]): number {
  if (!features?.length) return 1;
  const values = features.map((feature) => feature.trim().toUpperCase());
  const has = (...needles: string[]) =>
    values.some((feature) => needles.some((needle) => feature.includes(needle)));

  let uplift = 0;
  if (has('PANORAMIC', 'PAN ROOF', 'SUNROOF')) uplift += 0.005;
  if (has('LEATHER')) uplift += 0.004;
  if (has('HEATED SEAT')) uplift += 0.003;
  if (has('360 CAMERA', 'REVERSE CAMERA', 'REVERSING CAMERA')) uplift += 0.003;
  if (has('NAVIGATION', 'SAT NAV')) uplift += 0.002;
  if (has('APPLE CARPLAY', 'ANDROID AUTO')) uplift += 0.002;
  if (has('PARKING SENSOR')) uplift += 0.002;
  if (has('LED HEADLIGHT', 'MATRIX LED')) uplift += 0.0015;
  return 1 + Math.min(0.018, uplift);
}

function complianceFactor(request: VehicleValuationRequest): number {
  if (request.ulezCompliant === true) return 1.01;
  if (request.ulezCompliant === false) return 0.96;

  const euro = (request.euroStandard ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (euro === 'EURO6D' || euro === 'EURO6') return 1.01;
  if (euro === 'EURO5') return 0.995;
  if (euro === 'EURO4') return 0.985;
  return 1;
}

function profileFactor(request: VehicleValuationRequest): number {
  let factor = 1;

  const condition = (request.condition ?? '').toUpperCase();
  if (condition === 'EXCELLENT') factor *= 1.03;
  if (condition === 'FAIR') factor *= 0.93;
  if (condition === 'POOR') factor *= 0.84;

  const grade = Number(request.exteriorGrade);
  if (grade === 2) factor *= 0.99;
  if (grade === 3) factor *= 0.97;
  if (grade === 4) factor *= 0.94;
  if (grade >= 5) factor *= 0.90;

  const service = (request.serviceHistory ?? '').toUpperCase();
  if (service.includes('FULL')) factor *= 1.02;
  if (service.includes('PARTIAL')) factor *= 0.99;
  if (service === 'NONE' || service.includes('NO SERVICE')) factor *= 0.96;

  const ownerNumber = Number.parseInt((request.owners ?? '').replace(/[^0-9]/g, ''), 10);
  if (ownerNumber === 1) factor *= 1.02;
  if (ownerNumber === 2) factor *= 1.01;
  if (ownerNumber === 4) factor *= 0.98;
  if (ownerNumber >= 5) factor *= 0.96;

  if (request.numberOfKeys === 1) factor *= 0.985;

  if (request.ulezCompliant === true) factor *= 1.01;
  else if (request.ulezCompliant === false) factor *= 0.96;
  else {
    const euro = (request.euroStandard ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (euro === 'EURO6D' || euro === 'EURO6') factor *= 1.01;
    if (euro === 'EURO5') factor *= 0.995;
    if (euro === 'EURO4') factor *= 0.985;
  }

  if (request.features?.length) {
    const values = request.features.map((feature) => feature.trim().toUpperCase());
    const has = (...needles: string[]) =>
      values.some((feature) => needles.some((needle) => feature.includes(needle)));
    let uplift = 0;
    if (has('PANORAMIC', 'PAN ROOF', 'SUNROOF')) uplift += 0.005;
    if (has('LEATHER')) uplift += 0.004;
    if (has('HEATED SEAT')) uplift += 0.003;
    if (has('360 CAMERA', 'REVERSE CAMERA', 'REVERSING CAMERA')) uplift += 0.003;
    if (has('NAVIGATION', 'SAT NAV')) uplift += 0.002;
    if (has('APPLE CARPLAY', 'ANDROID AUTO')) uplift += 0.002;
    if (has('PARKING SENSOR')) uplift += 0.002;
    if (has('LED HEADLIGHT', 'MATRIX LED')) uplift += 0.0015;
    factor *= 1 + Math.min(0.018, uplift);
  }

  const writeOff = (request.writeOffCategory ?? '').toUpperCase();
  if (writeOff === 'CAT_N') factor *= 0.82;
  if (writeOff === 'CAT_S') factor *= 0.75;
  if (writeOff === 'CAT_A') factor *= 0.25;
  if (writeOff === 'CAT_B') factor *= 0.30;

  if (request.isImported) factor *= 0.92;

  return factor;
}

function fuelSpecificationFactor(value?: string): number {
  const fuel = (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!fuel) return 1;
  if (fuel.includes('PLUGINHYBRID')) return 1.01;
  if (fuel.includes('HYBRID')) return 1.0075;
  if (fuel === 'DIESEL') return 0.995;
  if (['LPG', 'BIFUEL', 'NATURALGAS'].includes(fuel)) return 0.98;
  return 1;
}

function variantSpecificationFactor(value?: string): number {
  const variant = (value ?? '').trim().toUpperCase();
  if (!variant) return 1;

  const performanceMarkers = [
    'AMG', 'M SPORT COMPETITION', 'M COMPETITION', 'VRS',
    'GTI', 'TYPE R', 'GR SPORT', 'GRMN', 'N PERFORMANCE',
  ];
  if (performanceMarkers.some((marker) => variant.includes(marker))) return 1.02;

  const premiumMarkers = [
    'M SPORT', 'AMG LINE', 'S LINE', 'R LINE', 'ST LINE', 'N LINE',
    'GT LINE', 'TITANIUM', 'VIGNALE', 'TEKNA', 'PORTFOLIO',
    'AUTOBIOGRAPHY', 'HSE', 'R DESIGN', 'INSCRIPTION', 'EXCEL',
  ];
  if (premiumMarkers.some((marker) => variant.includes(marker))) return 1.01;
  return 1;
}

export function vehicleSpecificationAdjustmentFactor(request: VehicleValuationRequest): number {
  let factor = profileFactor(request);

  const transmission = transmissionFamily(request.transmission);
  if (transmission === 'AUTO') factor *= 1.03;
  if (transmission === 'MANUAL') factor *= 0.98;

  factor *= fuelSpecificationFactor(request.fuelType);
  factor *= variantSpecificationFactor(request.variant);

  if (request.doors === 5) factor *= 1.004;
  if (request.doors === 3) factor *= 0.996;
  if (request.doors === 2) factor *= 0.992;
  if ((request.seats ?? 0) >= 7) factor *= 1.008;
  if ((request.seats ?? 0) > 0 && (request.seats ?? 0) <= 2) factor *= 0.995;

  return clamp(factor, 0.18, 1.20);
}

export function applyVehicleValuationAdjustments(
  base: VehicleValuation,
  request: VehicleValuationRequest,
): VehicleValuation {
  const factor = vehicleSpecificationAdjustmentFactor(request);
  if (Math.abs(factor - 1) < 0.0001) return { ...base };

  const low = roundMoney(base.low * factor);
  const mid = roundMoney(base.mid * factor);
  const high = roundMoney(base.high * factor);
  const auctionMarketValue = roundMoney(base.auction.marketValue * factor);

  return {
    ...base,
    low,
    mid,
    high,
    explanation: `${base.explanation} Seller-provided condition and specification have then been applied to that base value.`,
    retail: {
      suggestedAsking: roundMoney(base.retail.suggestedAsking * factor),
      suggestedMinimum: roundMoney(base.retail.suggestedMinimum * factor),
    },
    auction: {
      marketValue: auctionMarketValue,
      openingBid: Math.round(auctionMarketValue * 0.70 * 100) / 100,
      reserveLow: Math.round(auctionMarketValue * 0.90 * 100) / 100,
      reserveHigh: auctionMarketValue,
      suggestedReserve: roundMoney(auctionMarketValue * 0.95),
    },
  };
}


export async function getVehicleValuation(
  request: VehicleValuationRequest,
): Promise<VehicleValuation> {
  const params = new URLSearchParams({
    make: request.make,
    model: request.model,
    year: String(request.year),
    mileage: String(request.mileage),
  });

  if (request.variant) params.set('variant', request.variant);
  if (request.fuelType) params.set('fuelType', request.fuelType);
  if (request.transmission) params.set('transmission', request.transmission);
  if (request.condition) params.set('condition', request.condition);
  if (request.exteriorGrade) params.set('exteriorGrade', String(request.exteriorGrade));
  if (request.serviceHistory) params.set('serviceHistory', request.serviceHistory);
  if (request.owners) params.set('owners', request.owners);
  if (request.numberOfKeys) params.set('numberOfKeys', String(request.numberOfKeys));
  if (request.ulezCompliant !== undefined) params.set('ulezCompliant', String(request.ulezCompliant));
  if (request.euroStandard) params.set('euroStandard', request.euroStandard);
  if (request.doors) params.set('doors', String(request.doors));
  if (request.seats) params.set('seats', String(request.seats));
  if (request.features?.length) params.set('features', request.features.join('|'));
  if (request.writeOffCategory) params.set('writeOffCategory', request.writeOffCategory);
  if (request.isImported !== undefined) params.set('isImported', String(request.isImported));
  if (request.excludeListingId) params.set('excludeListingId', request.excludeListingId);
  if (request.valuationId) params.set('valuationId', request.valuationId);
  if (request.registration) params.set('registration', request.registration);

  // A sparse vehicle may trigger a live UK market search on the server. Give it
  // longer than the app-wide 10s request budget so useful valuations do not
  // fail merely because current-market evidence takes a few seconds to gather.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 65_000);

  try {
    const response = await fetch(`${API_URL}/listings/valuation?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Valuation request failed (${response.status})`);
    }

    const body = await response.json() as VehicleValuationResponse;
    // Only the shared backend may issue a valuation. A network error must
    // never be disguised as a plausible-looking car price calculated from
    // make/age alone: this caused harmful app/website price discrepancies.
    const marketValue = Number(body?.data?.auction?.marketValue);
    if (body?.success !== true || !Number.isFinite(marketValue) || marketValue <= 0) {
      throw new Error('VALUATION_UNAVAILABLE');
    }
    return body.data;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('VALUATION_TIMEOUT');
    throw new Error('VALUATION_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
  }
}
