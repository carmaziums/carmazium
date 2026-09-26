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
  };
}

interface VehicleValuationResponse {
  success: boolean;
  data: VehicleValuation;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

const BASE_NEW_VALUES: Record<string, number> = {
  'ABARTH': 26000, 'ALFA ROMEO': 38000, 'AUDI': 47000, 'BMW': 48000,
  'CITROEN': 28000, 'CITROËN': 28000, 'DACIA': 22000, 'FIAT': 25000,
  'FORD': 33000, 'HONDA': 35000, 'HYUNDAI': 34000, 'JAGUAR': 50000,
  'JEEP': 43000, 'KIA': 34000, 'LAND ROVER': 57000, 'LEXUS': 50000,
  'MAZDA': 33000, 'MERCEDES': 50000, 'MERCEDES-BENZ': 50000, 'MG': 27000,
  'MINI': 33000, 'MITSUBISHI': 32000, 'NISSAN': 32000, 'PEUGEOT': 29000,
  'PORSCHE': 82000, 'RENAULT': 29000, 'SEAT': 30000, 'SKODA': 34000,
  'SUBARU': 39000, 'SUZUKI': 26000, 'TESLA': 46000, 'TOYOTA': 36000,
  'VAUXHALL': 29000, 'VOLKSWAGEN': 37000, 'VOLVO': 48000,
};

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

function localFallbackValuation(request: VehicleValuationRequest): VehicleValuation {
  const age = Math.max(0, new Date().getFullYear() - request.year);
  let value = BASE_NEW_VALUES[(request.make ?? '').trim().toUpperCase()] ?? 32000;

  for (let year = 1; year <= age; year += 1) {
    value *= year === 1 ? 0.78 : year <= 3 ? 0.85 : year <= 7 ? 0.89 : 0.92;
  }

  const expectedMileage = Math.max(6000, age * 8500);
  const mileageDeltaThousands = (request.mileage - expectedMileage) / 1000;
  value *= clamp(1 - mileageDeltaThousands * 0.0035, 0.72, 1.15);

  const condition = (request.condition ?? '').toUpperCase();
  if (condition === 'EXCELLENT') value *= 1.03;
  if (condition === 'FAIR') value *= 0.93;
  if (condition === 'POOR') value *= 0.84;

  const grade = Number(request.exteriorGrade);
  if (grade === 2) value *= 0.99;
  if (grade === 3) value *= 0.97;
  if (grade === 4) value *= 0.94;
  if (grade >= 5) value *= 0.90;

  const service = (request.serviceHistory ?? '').toUpperCase();
  if (service.includes('FULL')) value *= 1.02;
  if (service.includes('PARTIAL')) value *= 0.99;
  if (service === 'NONE' || service.includes('NO SERVICE')) value *= 0.96;

  const ownerNumber = Number.parseInt((request.owners ?? '').replace(/[^0-9]/g, ''), 10);
  if (ownerNumber === 1) value *= 1.02;
  if (ownerNumber === 2) value *= 1.01;
  if (ownerNumber === 4) value *= 0.98;
  if (ownerNumber >= 5) value *= 0.96;

  if (request.numberOfKeys === 1) value *= 0.985;
  value *= complianceFactor(request);
  value *= featureValueFactor(request.features);
  if (request.isImported) value *= 0.92;

  const writeOff = (request.writeOffCategory ?? '').toUpperCase();
  if (writeOff === 'CAT_N') value *= 0.82;
  if (writeOff === 'CAT_S') value *= 0.75;
  if (writeOff === 'CAT_A') value *= 0.25;
  if (writeOff === 'CAT_B') value *= 0.30;

  const transmission = transmissionFamily(request.transmission);
  if (transmission === 'AUTO') value *= 1.04;
  if (transmission === 'MANUAL') value *= 0.96;

  const mid = roundMoney(value);
  const low = roundMoney(mid * 0.85);
  const high = roundMoney(mid * 1.15);

  return {
    low,
    mid,
    high,
    confidence: 'LOW',
    confidenceScore: 0.2,
    comparables: 0,
    source: 'CARMAZIUM_MODEL',
    explanation: 'Exact-model market evidence is temporarily unavailable, so this LOW-confidence guide uses vehicle age, mileage, transmission and conservative depreciation. Use it as a starting point rather than a guaranteed sale price.',
    retail: {
      suggestedAsking: high,
      suggestedMinimum: mid,
    },
    auction: {
      marketValue: low,
      openingBid: Math.round(low * 0.70 * 100) / 100,
      reserveLow: Math.round(low * 0.90 * 100) / 100,
      reserveHigh: low,
      suggestedReserve: roundMoney(low * 0.95),
    },
    marketEvidence: {
      carmaziumComparables: 0,
      liveUkComparables: 0,
      liveUkSearchStatus: 'UNAVAILABLE',
      rawLiveUkComparables: 0,
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

  // A sparse vehicle may trigger a live UK market search on the server. Give it
  // longer than the app-wide 10s request budget so useful valuations do not
  // fail merely because current-market evidence takes a few seconds to gather.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

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
    if (!body?.data) throw new Error('Valuation response was empty');
    return body.data;
  } catch {
    // Keep the seller journey alive even during backend/network/live-market
    // outages. The server normally returns the richer market-backed result;
    // this deterministic local guide is the final LOW-confidence safety net.
    return localFallbackValuation(request);
  } finally {
    clearTimeout(timeoutId);
  }
}
