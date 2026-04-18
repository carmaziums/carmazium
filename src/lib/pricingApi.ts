const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

export interface EstimatePriceRequest {
    make: string;
    model: string;
    year: number;
    mileage: number;
    fuelType?: string;
    transmission?: string;
    condition?: string;
    location?: string;
    damageImageCount?: number;
}

export interface EstimatePriceResponse {
    low: number;
    mid: number;
    high: number;
    confidence: number;
    comparables: number;
    reasoning: string;
    damageDeduction?: number;
}

export async function estimateListingPrice(data: EstimatePriceRequest): Promise<EstimatePriceResponse> {
    const response = await fetch(`${API_URL}/pricing/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`Pricing API error (${response.status}): ${errBody}`);
    }

    return response.json();
}
