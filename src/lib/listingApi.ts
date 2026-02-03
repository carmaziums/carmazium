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

// ============================================================================
// AUTHENTICATED API CALLS (require JWT token)
// ============================================================================

import { supabase } from './supabase'

/**
 * Get current user's access token for API calls
 */
async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
}

/**
 * Seller stats response type
 */
export interface SellerStats {
    totalListings: number
    activeListings: number
    soldListings: number
    draftListings: number
    totalViews: number
    totalRevenue: number
}

/**
 * Fetch current user's listings (authenticated)
 */
export async function getMyListings(filters?: ListingFilters): Promise<ListingsResponse> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const params = new URLSearchParams()
    if (filters) {
        if (filters.page) params.append('page', filters.page.toString())
        if (filters.limit) params.append('limit', filters.limit.toString())
    }

    const url = `${API_URL}/listings/my${params.toString() ? `?${params.toString()}` : ''}`

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch your listings' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Fetch seller dashboard statistics (authenticated)
 */
export async function getSellerStats(): Promise<SellerStats> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/listings/stats`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch seller stats' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Create listing with authentication
 */
export async function createAuthenticatedListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
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
 * Delete a listing (authenticated)
 */
export async function deleteListing(listingId: string): Promise<void> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/listings/${listingId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to delete listing' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }
}

// ============================================================================
// BUYER API FUNCTIONS
// ============================================================================

export interface Bid {
    id: string
    listingId: string
    amount: string | number
    isWinning: boolean
    createdAt: string
    listing: {
        id: string
        title: string
        slug: string
        images: string[]
        price: string | number
        status: string
        make: string | null
        model: string | null
        year: number | null
    }
}

export interface BidsResponse {
    success: boolean
    data: Bid[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

export interface BuyerStats {
    activeBids: number
    wonAuctions: number
    watchlistCount: number
    totalSpent: number
}

/**
 * Get buyer's bids (authenticated)
 */
export async function getMyBids(page = 1, limit = 20): Promise<BidsResponse> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/bids/my?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch bids' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Get buyer dashboard stats (authenticated)
 */
export async function getBuyerStats(): Promise<BuyerStats> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/bids/stats`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch buyer stats' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Place a bid on a listing (authenticated)
 */
export async function placeBid(listingId: string, amount: number): Promise<Bid> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/bids`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, amount }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to place bid' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

// ============================================================================
// WATCHLIST API FUNCTIONS
// ============================================================================

export interface WatchlistItem {
    id: string
    listingId: string
    createdAt: string
    listing: {
        id: string
        title: string
        slug: string
        images: string[]
        price: string | number
        status: string
        make: string | null
        model: string | null
        year: number | null
        mileage: number | null
        viewCount: number
    }
}

export interface WatchlistResponse {
    success: boolean
    data: WatchlistItem[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

/**
 * Get user's watchlist (authenticated)
 */
export async function getWatchlist(page = 1, limit = 20): Promise<WatchlistResponse> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/watchlist?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch watchlist' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Add listing to watchlist (authenticated)
 */
export async function addToWatchlist(listingId: string): Promise<WatchlistItem> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/watchlist/${listingId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to add to watchlist' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Remove listing from watchlist (authenticated)
 */
export async function removeFromWatchlist(listingId: string): Promise<void> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/watchlist/${listingId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to remove from watchlist' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }
}

/**
 * Check if listing is in watchlist (authenticated)
 */
export async function isInWatchlist(listingId: string): Promise<boolean> {
    const token = await getAccessToken()
    if (!token) return false

    const response = await fetch(`${API_URL}/watchlist/check/${listingId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })

    if (!response.ok) return false

    const data = await response.json()
    return data.data?.inWatchlist || false
}

// ============================================================================
// SERVICE PROVIDER (CONTRACTOR) API FUNCTIONS
// ============================================================================

export interface ServiceRequest {
    id: string
    serviceType: string
    status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    description: string | null
    quotedPrice: string | number | null
    acceptedPrice: string | number | null
    scheduledDate: string | null
    completedDate: string | null
    createdAt: string
    requester: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
    }
}

export interface ServiceRequestsResponse {
    success: boolean
    data: ServiceRequest[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

export interface ContractorStats {
    pendingJobs: number
    activeJobs: number
    completedJobs: number
    totalEarnings: number
}

/**
 * Get contractor's service requests (authenticated)
 */
export async function getContractorJobs(page = 1, limit = 20): Promise<ServiceRequestsResponse> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/service-requests/contractor?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch jobs' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
}

/**
 * Get contractor dashboard stats (authenticated)
 */
export async function getContractorStats(): Promise<ContractorStats> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/service-requests/contractor/stats`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch contractor stats' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}

/**
 * Update service request status (authenticated)
 */
export async function updateJobStatus(requestId: string, status: string): Promise<ServiceRequest> {
    const token = await getAccessToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/service-requests/${requestId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update job status' }))
        throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return data.data
}


