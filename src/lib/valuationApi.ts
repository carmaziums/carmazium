import { apiClient } from './apiClient'

export interface VehicleValuationRequest {
    make: string
    model: string
    year: number
    mileage: number
    variant?: string
    fuelType?: string
    transmission?: string
    condition?: string
    serviceHistory?: string
    owners?: string
    writeOffCategory?: string
    isImported?: boolean
    excludeListingId?: string
}

export interface VehicleValuation {
    low: number
    mid: number
    high: number
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    confidenceScore: number
    comparables: number
    evidence: {
        completedSales: number
        acceptedOffers: number
        auctionResults: number
        activeAsks: number
    }
    source:
        | 'CARMAZIUM_MARKET'
        | 'LIVE_UK_MARKET'
        | 'BLENDED_MARKET'
        | 'CARMAZIUM_MODEL_PROFILE'
        | 'CARMAZIUM_MODEL'
    marketEvidence?: {
        carmaziumComparables: number
        liveUkComparables: number
        checkedAt?: string
    }
    explanation: string
    retail: {
        suggestedAsking: number
        suggestedMinimum: number
    }
    auction: {
        marketValue: number
        openingBid: number
        reserveLow: number
        reserveHigh: number
        suggestedReserve: number
    }
}

interface PublicComparable {
    id: string
    make: string | null
    model: string | null
    year: number | null
    mileage: number | null
    price: number | string
    variant?: string | null
    fuelType?: string | null
    transmission?: string | null
    writeOffCategory?: string | null
}

interface PublicListingsResponse {
    data: PublicComparable[]
}

const BASE_NEW_VALUES: Record<string, number> = {
    AUDI: 47000,
    BMW: 48000,
    CITROEN: 28000,
    'CITROËN': 28000,
    DACIA: 22000,
    FIAT: 25000,
    FORD: 33000,
    HONDA: 35000,
    HYUNDAI: 34000,
    JAGUAR: 50000,
    JEEP: 43000,
    KIA: 34000,
    'LAND ROVER': 57000,
    LEXUS: 50000,
    MAZDA: 33000,
    MERCEDES: 50000,
    'MERCEDES-BENZ': 50000,
    MG: 27000,
    MINI: 33000,
    NISSAN: 32000,
    PEUGEOT: 29000,
    PORSCHE: 82000,
    RENAULT: 29000,
    SEAT: 30000,
    SKODA: 34000,
    SUZUKI: 26000,
    TESLA: 46000,
    TOYOTA: 36000,
    VAUXHALL: 29000,
    VOLKSWAGEN: 37000,
    VOLVO: 48000,
}

const MODEL_FALLBACK_PROFILES: Record<string, { baseNewValue: number; retainedValueAdjustment: number }> = {
    'JAGUAR|XE': { baseNewValue: 35000, retainedValueAdjustment: 0.825 },
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

const normalise = (value?: string | null) =>
    (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

function transmissionFamily(value?: string | null): 'MANUAL' | 'AUTO' | null {
    const normalized = normalise(value)
    if (!normalized) return null
    if (normalized === 'MANUAL') return 'MANUAL'
    if (['AUTOMATIC', 'AUTO', 'CVT', 'SEMIAUTOMATIC', 'SEMIAUTO'].includes(normalized)) return 'AUTO'
    return null
}

function roundMoney(value: number): number {
    const safe = Math.max(500, value)
    const step = safe < 10000 ? 50 : 100
    return Math.round(safe / step) * step
}

function quantile(values: number[], q: number): number {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))
    return sorted[index]
}

function profileFactor(request: VehicleValuationRequest): number {
    let factor = 1
    const condition = (request.condition ?? '').toUpperCase()
    if (condition === 'EXCELLENT') factor *= 1.03
    if (condition === 'FAIR') factor *= 0.93
    if (condition === 'POOR') factor *= 0.84

    const writeOff = (request.writeOffCategory ?? '').toUpperCase()
    if (writeOff === 'CAT_N') factor *= 0.82
    if (writeOff === 'CAT_S') factor *= 0.75
    if (writeOff === 'CAT_A') factor *= 0.25
    if (writeOff === 'CAT_B') factor *= 0.30

    const service = (request.serviceHistory ?? '').toUpperCase()
    if (service.includes('FULL')) factor *= 1.02
    if (service === 'NONE') factor *= 0.96

    if (request.owners === '1') factor *= 1.02
    if (request.owners === '4') factor *= 0.98
    if (request.owners === '5' || request.owners === '5+') factor *= 0.96
    if (request.isImported) factor *= 0.92
    return factor
}

function getModelFallbackProfile(request: VehicleValuationRequest) {
    const key = `${(request.make ?? '').trim().toUpperCase()}|${(request.model ?? '').trim().toUpperCase()}`
    return MODEL_FALLBACK_PROFILES[key] ?? null
}

function modelFallbackMid(request: VehicleValuationRequest): { value: number; calibratedModelProfile: boolean } {
    const age = Math.max(0, new Date().getFullYear() - request.year)
    const modelProfile = getModelFallbackProfile(request)
    let value = modelProfile?.baseNewValue ?? BASE_NEW_VALUES[(request.make ?? '').trim().toUpperCase()] ?? 32000

    for (let year = 1; year <= age; year += 1) {
        value *= year === 1 ? 0.78 : year <= 3 ? 0.85 : year <= 7 ? 0.89 : 0.92
    }

    const expectedMileage = Math.max(6000, age * 8500)
    const mileageDeltaThousands = (request.mileage - expectedMileage) / 1000
    value *= clamp(1 - mileageDeltaThousands * 0.0035, 0.72, 1.15)
    value *= profileFactor(request)

    const transmission = transmissionFamily(request.transmission)
    if (transmission === 'AUTO') value *= 1.04
    if (transmission === 'MANUAL') value *= 0.96

    if (modelProfile) value *= modelProfile.retainedValueAdjustment

    return {
        value: Math.max(500, value),
        calibratedModelProfile: !!modelProfile,
    }
}

function finishEstimate(
    request: VehicleValuationRequest,
    values: number[],
): VehicleValuation {
    const fallbackResult = modelFallbackMid(request)
    const fallback = fallbackResult.value
    let marketMid = values.length ? quantile(values, 0.5) : fallback

    if (values.length === 1) marketMid = marketMid * 0.45 + fallback * 0.55
    if (values.length === 2) marketMid = marketMid * 0.65 + fallback * 0.35

    const mid = roundMoney(marketMid)
    const lowBase = values.length >= 4 ? quantile(values, 0.25) : mid * (values.length ? 0.88 : 0.82)
    const highBase = values.length >= 4 ? quantile(values, 0.75) : mid * (values.length ? 1.12 : 1.18)
    const rangeFloor = mid * 0.85
    const rangeCeiling = mid * 1.15
    const low = roundMoney(Math.min(Math.max(lowBase, rangeFloor), mid * 0.93))
    const high = roundMoney(Math.max(Math.min(highBase, rangeCeiling), mid * 1.07))

    const confidenceScore = values.length >= 8 ? 0.48 : values.length >= 3 ? 0.38 : values.length ? 0.28 : 0.18
    const confidence: VehicleValuation['confidence'] = confidenceScore >= 0.45 ? 'MEDIUM' : 'LOW'
    const source: VehicleValuation['source'] = values.length
        ? 'CARMAZIUM_MARKET'
        : fallbackResult.calibratedModelProfile
            ? 'CARMAZIUM_MODEL_PROFILE'
            : 'CARMAZIUM_MODEL'

    return {
        low,
        mid,
        high,
        confidence,
        confidenceScore,
        comparables: values.length,
        evidence: {
            completedSales: 0,
            acceptedOffers: 0,
            auctionResults: 0,
            activeAsks: values.length,
        },
        source,
        explanation: values.length
            ? `Based on ${values.length} similar live CarMazium asking price${values.length === 1 ? '' : 's'}. Completed transaction evidence will be added when available.`
            : fallbackResult.calibratedModelProfile
                ? 'CarMazium has limited live marketplace evidence for this exact vehicle, so this uses a calibrated model-specific depreciation profile with age, mileage and transmission.'
                : 'CarMazium does not yet have enough reliable market evidence for this exact vehicle. Enter your own price rather than relying on a generic make-level estimate.',
        retail: {
            // Retail uses the upper market guide.
            suggestedAsking: high,
            suggestedMinimum: mid,
        },
        auction: {
            // Auction uses the lower dealer-buy guide so traders retain
            // realistic preparation, warranty and resale margin.
            marketValue: low,
            openingBid: Math.round(low * 0.70 * 100) / 100,
            reserveLow: Math.round(low * 0.90 * 100) / 100,
            reserveHigh: Math.round(low * 1.00 * 100) / 100,
            suggestedReserve: roundMoney(low * 0.95),
        },
    }
}

async function getBrowserFallbackValuation(
    request: VehicleValuationRequest,
): Promise<VehicleValuation> {
    const params = new URLSearchParams({
        make: request.make,
        model: request.model,
        minYear: String(Math.max(1950, request.year - 3)),
        maxYear: String(request.year + 3),
        maxMileage: String(request.mileage + 50000),
        vehicleType: 'CAR',
        listingType: 'CLASSIFIED',
        limit: '50',
    })

    const response = await apiClient<PublicListingsResponse>(`/listings?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
    })

    const targetModel = normalise(request.model)
    const targetFuel = normalise(request.fuelType)
    const targetTransmission = normalise(request.transmission)

    const values = (response.data ?? [])
        .filter((row) =>
            row.id !== request.excludeListingId &&
            normalise(row.make) === normalise(request.make) &&
            normalise(row.model) === targetModel,
        )
        .map((row) => {
            const price = Number(row.price)
            if (!Number.isFinite(price) || price < 250) return null

            const compYear = row.year ?? request.year
            const compMileage = row.mileage ?? request.mileage
            let value = price * Math.pow(0.92, compYear - request.year)
            value *= clamp(1 - ((request.mileage - compMileage) / 1000) * 0.004, 0.78, 1.22)

            // Do not exclude a useful comparable for a different powertrain;
            // reduce its influence instead by nudging it toward the conservative
            // side before it enters the median pool.
            if (targetFuel && normalise(row.fuelType) && normalise(row.fuelType) !== targetFuel) value *= 0.96

            const rowTransmission = normalise(row.transmission)
            if (targetTransmission && rowTransmission && rowTransmission !== targetTransmission) {
                const targetFamily = transmissionFamily(request.transmission)
                const compFamily = transmissionFamily(row.transmission)
                if (targetFamily && compFamily && targetFamily !== compFamily) {
                    value *= targetFamily === 'AUTO' ? 1.07 : 0.93
                }
            }

            // Public fallback data is live asking-price evidence, not an
            // achieved transaction price, so keep the estimate conservative.
            value *= 0.96
            value *= profileFactor(request)
            return value
        })
        .filter((value): value is number => value !== null)
        .sort((a, b) => a - b)

    // Trim obvious asking-price outliers when enough listings exist.
    const cleaned = values.length >= 5
        ? values.filter((value) => {
            const median = quantile(values, 0.5)
            return value >= median * 0.55 && value <= median * 1.75
        })
        : values

    return finishEstimate(request, cleaned)
}

export async function getVehicleValuation(
    request: VehicleValuationRequest,
): Promise<VehicleValuation> {
    try {
        const params = new URLSearchParams({
            make: request.make,
            model: request.model,
            year: String(request.year),
            mileage: String(request.mileage),
        })
        if (request.variant) params.set('variant', request.variant)
        if (request.fuelType) params.set('fuelType', request.fuelType)
        if (request.transmission) params.set('transmission', request.transmission)
        if (request.condition) params.set('condition', request.condition)
        if (request.serviceHistory) params.set('serviceHistory', request.serviceHistory)
        if (request.owners) params.set('owners', request.owners)
        if (request.writeOffCategory) params.set('writeOffCategory', request.writeOffCategory)
        if (request.isImported !== undefined) params.set('isImported', String(request.isImported))
        if (request.excludeListingId) params.set('excludeListingId', request.excludeListingId)

        const response = await apiClient<{ data: VehicleValuation }>(`/listings/valuation?${params.toString()}`, {
            method: 'GET',
            cache: 'no-store',
        })
        return response.data
    } catch {
        // The valuation API is deliberately non-blocking. If a backend deploy
        // is temporarily behind the web deploy (or the endpoint is unavailable),
        // sellers still get a conservative first-party estimate from currently
        // live CarMazium adverts rather than hitting a dead end.
        return getBrowserFallbackValuation(request)
    }
}
