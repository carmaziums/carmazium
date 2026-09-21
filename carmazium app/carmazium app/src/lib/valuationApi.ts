export interface VehicleValuationRequest {
  make: string;
  model: string;
  year: number;
  mileage: number;
  variant?: string;
  fuelType?: string;
  transmission?: string;
  condition?: string;
  serviceHistory?: string;
  owners?: string;
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
  if (request.serviceHistory) params.set('serviceHistory', request.serviceHistory);
  if (request.owners) params.set('owners', request.owners);
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
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('VALUATION_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
