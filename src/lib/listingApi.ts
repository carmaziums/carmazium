/**
 * API Client for Listing Operations
 */

export interface CreateListingRequest {
    title: string
    price: number
    mileage: number
    year: number
    vrm: string
    images: string[]
    listingType: 'AUCTION' | 'CLASSIFIED'
    make?: string
    model?: string
    description?: string
    fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'PLUGIN_HYBRID'
    transmission?: 'MANUAL' | 'AUTOMATIC' | 'SEMI_AUTOMATIC'
    status?: 'DRAFT' | 'ACTIVE' | 'SOLD'
    color?: string
    doors?: number
    seats?: number
    engineSize?: number
    bhp?: number
    features?: string[]
}

export interface CreateListingResponse {
    success: boolean
    data: {
        id: string
        slug: string
        title: string
        price: number
        createdAt: string
    }
    timestamp: string
}

/**
 * Create a new listing
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com'

export async function createListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    const response = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // TODO: Add authorization header when auth is implemented
            // 'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create listing' }))
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
}

/**
 * Listing type returned from API
 */
export interface Listing {
    id: string
    slug: string
    title: string
    description: string | null
    price: string | number
    images: string[]
    make: string | null
    model: string | null
    year: number | null
    mileage: number | null
    vrm: string | null
    fuelType: string | null
    transmission: string | null
    type: 'AUCTION' | 'CLASSIFIED'
    status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'WITHDRAWN'
    viewCount: number
    color: string | null
    doors: number | null
    seats: number | null
    engineSize: number | null
    bhp: number | null
    features: string | string[] | null // JSON string or parsed array
    createdAt: string
    updatedAt: string
}

export interface ListingsResponse {
    success: boolean
    data: Listing[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
    timestamp: string
}

export interface ListingFilters {
    minPrice?: number
    maxPrice?: number
    make?: string
    year?: number
    page?: number
    limit?: number
}

/**
 * Fetch all listings with optional filters
 */
export async function getListings(filters?: ListingFilters): Promise<ListingsResponse> {
    const params = new URLSearchParams()

    if (filters) {
        if (filters.minPrice) params.append('minPrice', filters.minPrice.toString())
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString())
        if (filters.make) params.append('make', filters.make)
        if (filters.year) params.append('year', filters.year.toString())
        if (filters.page) params.append('page', filters.page.toString())
        if (filters.limit) params.append('limit', filters.limit.toString())
    }

    const url = `${API_URL}/listings${params.toString() ? `?${params.toString()}` : ''}`

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-store', // Don't cache for fresh data
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch listings' }))
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
}

/**
 * Fetch a single listing by slug
 */
export async function getListingBySlug(slug: string): Promise<Listing> {
    const response = await fetch(`${API_URL}/listings/${slug}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Listing not found' }))
        throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Format price with commas and 2 decimal places
 */
export function formatPrice(price: number | string): string {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    if (isNaN(numPrice)) return '£0.00'
    return `£${numPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
