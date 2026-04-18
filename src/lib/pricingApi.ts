import { apiClient } from './apiClient';

export interface EstimatePriceRequest {
    make: string;
    model: string;
    year: number;
    mileage: number;
    fuelType?: string;
    transmission?: string;
    condition?: string;
    location?: string;
}

export interface EstimatePriceResponse {
    low: number;
    mid: number;
    high: number;
    confidence: number;
    comparables: number;
    reasoning: string;
}

export async function estimateListingPrice(data: EstimatePriceRequest): Promise<EstimatePriceResponse> {
    const json = await apiClient<{ data: EstimatePriceResponse }>('/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    return json.data;
}
