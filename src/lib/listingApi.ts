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
import { apiClient } from './apiClient'

export async function createListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    return apiClient<CreateListingResponse>('/listings', {
        method: 'POST',
        body: JSON.stringify(data),
    })
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

    return apiClient<ListingsResponse>(`/listings${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
    })
}

/**
 * Fetch a single listing by slug
 */
export async function getListingBySlug(slug: string): Promise<Listing> {
    const data = await apiClient<{ data: Listing }>(`/listings/${slug}`, {
        method: 'GET',
        cache: 'no-store',
    })
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
    const params = new URLSearchParams()
    if (filters) {
        if (filters.page) params.append('page', filters.page.toString())
        if (filters.limit) params.append('limit', filters.limit.toString())
    }

    const endpoint = `/listings/my${params.toString() ? `?${params.toString()}` : ''}`
    return apiClient<ListingsResponse>(endpoint, { method: 'GET', cache: 'no-store' })
}

/**
 * Fetch seller dashboard statistics (authenticated)
 */
export async function getSellerStats(): Promise<SellerStats> {
    const data = await apiClient<{ data: SellerStats }>('/listings/stats', { method: 'GET', cache: 'no-store' })
    return data.data
}

/**
 * Create listing with authentication
 */
export async function createAuthenticatedListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    return apiClient<CreateListingResponse>('/listings', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

/**
 * Delete a listing (authenticated)
 */
export async function deleteListing(listingId: string): Promise<void> {
    await apiClient(`/listings/${listingId}`, { method: 'DELETE' })
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
    return apiClient<BidsResponse>(`/bids/my?page=${page}&limit=${limit}`, {
        method: 'GET',
        cache: 'no-store',
    })
}

/**
 * Get buyer dashboard stats (authenticated)
 */
export async function getBuyerStats(): Promise<BuyerStats> {
    const data = await apiClient<{ data: BuyerStats }>('/bids/stats', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

/**
 * Place a bid on a listing (authenticated)
 */
export async function placeBid(listingId: string, amount: number): Promise<Bid> {
    const data = await apiClient<{ data: Bid }>('/bids', {
        method: 'POST',
        body: JSON.stringify({ listingId, amount }),
    })
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
    return apiClient<WatchlistResponse>(`/watchlist?page=${page}&limit=${limit}`, {
        method: 'GET',
        cache: 'no-store',
    })
}

/**
 * Add listing to watchlist (authenticated)
 */
export async function addToWatchlist(listingId: string): Promise<WatchlistItem> {
    const data = await apiClient<{ data: WatchlistItem }>(`/watchlist/${listingId}`, {
        method: 'POST',
    })
    return data.data
}

/**
 * Remove listing from watchlist (authenticated)
 */
export async function removeFromWatchlist(listingId: string): Promise<void> {
    await apiClient(`/watchlist/${listingId}`, {
        method: 'DELETE',
    })
}

/**
 * Check if listing is in watchlist (authenticated)
 */
export async function isInWatchlist(listingId: string): Promise<boolean> {
    try {
        const data = await apiClient<{ data: { inWatchlist: boolean } }>(`/watchlist/check/${listingId}`, {
            method: 'GET',
        })
        return data.data?.inWatchlist || false
    } catch (e) {
        return false
    }
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
 * Get contractor's service requests (jobs) (authenticated)
 */
export async function getContractorJobs(page = 1, limit = 20): Promise<ServiceRequestsResponse> {
    return apiClient<ServiceRequestsResponse>(`/service-requests/contractor?page=${page}&limit=${limit}`, {
        method: 'GET',
        cache: 'no-store',
    })
}

/**
 * Get contractor dashboard stats (authenticated)
 */
export async function getContractorStats(): Promise<ContractorStats> {
    const data = await apiClient<{ data: ContractorStats }>('/service-requests/contractor/stats', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

/**
 * Update service request status (authenticated)
 */
export async function updateJobStatus(requestId: string, status: string): Promise<ServiceRequest> {
    const data = await apiClient<{ data: ServiceRequest }>(`/service-requests/${requestId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    })
    return data.data
}



