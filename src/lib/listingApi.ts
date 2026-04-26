/**
 * API Client for Listing Operations
 */

export type BodyTypeValue = 'SEDAN' | 'SUV' | 'HATCHBACK' | 'COUPE' | 'CONVERTIBLE' | 'ESTATE' | 'CROSSOVER' | 'SPORTS_CAR' | 'MINIVAN' | 'PICKUP_TRUCK' | 'STATION_WAGON' | 'MPV' | 'VAN'
export type VehicleConditionValue = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CAT_S' | 'CAT_N' | 'CAT_C' | 'CAT_D'
export type EuroStandardValue = 'EURO_4' | 'EURO_5' | 'EURO_6' | 'EURO_6D'
export type VehicleTypeValue = 'CAR' | 'HGV' | 'MOTORCYCLE'

export interface CreateListingRequest {
    title: string
    price: number
    mileage: number
    year: number
    vrm: string
    images: string[]
    listingType: 'AUCTION' | 'CLASSIFIED'
    // Offer price range (enables offer system)
    priceMin?: number
    priceMax?: number
    // Vehicle identity
    make?: string
    model?: string
    vin?: string
    // Condition & compliance
    condition?: VehicleConditionValue
    ulezCompliant?: boolean
    euroStandard?: EuroStandardValue
    // Technical specs
    description?: string
    fuelType?: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'PLUGIN_HYBRID' | 'LPG' | 'HYDROGEN_CELL'
    transmission?: 'MANUAL' | 'AUTOMATIC' | 'SEMI_AUTOMATIC' | 'CVT'
    bodyType?: BodyTypeValue
    color?: string
    doors?: number
    seats?: number
    engineSize?: number
    bhp?: number
    features?: string[]
    location?: string
    co2Emissions?: number
    // DVLA extended fields
    motStatus?: string
    taxStatus?: string
    motExpiryDate?: string
    taxDueDate?: string
    markedForExport?: boolean
    monthOfFirstRegistration?: string
    wheelplan?: string
    typeApproval?: string
    status?: 'DRAFT' | 'ACTIVE' | 'SOLD'
    badgeTier?: 'FREE' | 'STANDARD' | 'PREMIUM'
    vehicleType?: VehicleTypeValue
    isImported?: boolean
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

// ─── DVLA Lookup ────────────────────────────────────────────────────────────

export interface DvlaLookupResult {
    vrm: string
    make?: string
    colour?: string
    year?: number
    engineSize?: number
    co2Emissions?: number
    fuelType?: string
    euroStandard?: string
    motStatus?: string
    motExpiryDate?: string
    taxStatus?: string
    taxDueDate?: string
    wheelplan?: string
    typeApproval?: string
    revenueWeight?: number
    markedForExport?: boolean
    monthOfFirstRegistration?: string
    dateOfLastV5CIssued?: string
    realDrivingEmissions?: string
    dataSource: 'DVLA'
}

export async function dvlaLookup(vrm: string): Promise<DvlaLookupResult> {
    return apiClient<DvlaLookupResult>('/dvla/lookup', {
        method: 'POST',
        body: JSON.stringify({ vrm }),
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
    vin: string | null
    fuelType: string | null
    transmission: string | null
    bodyType: string | null
    type: 'AUCTION' | 'CLASSIFIED'
    status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'WITHDRAWN'
    viewCount: number
    color: string | null
    doors: number | null
    seats: number | null
    engineSize: number | null
    bhp: number | null
    features: string | string[] | null
    location: string | null
    condition: VehicleConditionValue | null
    ulezCompliant: boolean | null
    euroStandard: EuroStandardValue | null
    co2Emissions: number | null
    // DVLA extended fields
    motStatus: string | null
    taxStatus: string | null
    motExpiryDate: string | null
    taxDueDate: string | null
    markedForExport: boolean | null
    monthOfFirstRegistration: string | null
    wheelplan: string | null
    typeApproval: string | null
    sellerId: string | null
    isFeatured: boolean
    featuredUntil: string | null
    badgeTier: string | null
    priceMin: string | number | null
    priceMax: string | number | null
    createdAt: string
    updatedAt: string
    // Latest offer on this listing (populated in detail view)
    offers?: LatestOffer[]
    // Added seller relation details
    seller?: {
        id: string
        firstName: string | null
        lastName: string | null
        profileImage: string | null
        dealerProfile?: {
            id: string
            companyName: string
            logo: string | null
            description: string | null
            phone: string | null
            website: string | null
        } | null
    } | null
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
    model?: string
    /** @deprecated use minYear */
    year?: number
    minYear?: number
    maxYear?: number
    minMileage?: number
    maxMileage?: number
    fuelType?: string
    transmission?: string
    bodyType?: string
    color?: string
    minDoors?: number
    minSeats?: number
    minEngine?: number
    maxEngine?: number
    maxCo2?: number
    condition?: VehicleConditionValue
    ulezCompliant?: boolean
    euroStandard?: EuroStandardValue
    vehicleType?: string
    sortBy?: string
    search?: string
    page?: number
    limit?: number
}

/**
 * Fetch all listings with optional filters
 */
export async function getListings(filters?: ListingFilters): Promise<ListingsResponse> {
    const params = new URLSearchParams()

    if (filters) {
        if (filters.minPrice !== undefined) params.append('minPrice', filters.minPrice.toString())
        if (filters.maxPrice !== undefined) params.append('maxPrice', filters.maxPrice.toString())
        if (filters.make) params.append('make', filters.make)
        if (filters.model) params.append('model', filters.model)
        if (filters.minYear !== undefined) params.append('minYear', filters.minYear.toString())
        if (filters.maxYear !== undefined) params.append('maxYear', filters.maxYear.toString())
        if (filters.year !== undefined) params.append('year', filters.year.toString())
        if (filters.minMileage !== undefined) params.append('minMileage', filters.minMileage.toString())
        if (filters.maxMileage !== undefined) params.append('maxMileage', filters.maxMileage.toString())
        if (filters.fuelType) params.append('fuelType', filters.fuelType)
        if (filters.transmission) params.append('transmission', filters.transmission)
        if (filters.bodyType) params.append('bodyType', filters.bodyType)
        if (filters.color) params.append('color', filters.color)
        if (filters.minDoors !== undefined) params.append('minDoors', filters.minDoors.toString())
        if (filters.minSeats !== undefined) params.append('minSeats', filters.minSeats.toString())
        if (filters.condition) params.append('condition', filters.condition)
        if (filters.ulezCompliant !== undefined) params.append('ulezCompliant', filters.ulezCompliant.toString())
        if (filters.euroStandard) params.append('euroStandard', filters.euroStandard)
        if (filters.vehicleType) params.append('vehicleType', filters.vehicleType)
        if (filters.sortBy) params.append('sortBy', filters.sortBy)
        if (filters.search) params.append('search', filters.search)
        if (filters.page) params.append('page', filters.page.toString())
        if (filters.limit) params.append('limit', filters.limit.toString())
    }

    return apiClient<ListingsResponse>(`/listings${params.toString() ? `?${params.toString()}` : ''}`, {
        method: 'GET',
        next: { revalidate: 60 },
    })
}

/**
 * Fetch a single listing by slug
 */
export async function getListingBySlug(slug: string): Promise<Listing> {
    const data = await apiClient<{ data: Listing }>(`/listings/${slug}`, {
        method: 'GET',
        next: { revalidate: 60 },
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

/**
 * Update listing status (authenticated)
 */
export async function updateListingStatus(listingId: string, status: string): Promise<Listing> {
    const data = await apiClient<{ data: Listing }>(`/listings/${listingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    })
    return data.data
}

/**
 * Boost a listing to Featured status for 28 days (authenticated)
 * In bypass mode: immediately activates. In Stripe mode: returns { url } for redirect.
 */
export interface BoostResult {
    bypassed?: boolean
    boostId?: string
    expiresAt?: string
    url?: string
    message?: string
}

export async function boostListing(listingId: string): Promise<BoostResult> {
    const data = await apiClient<{ data: BoostResult }>(`/featured-boost/${listingId}`, {
        method: 'POST',
    })
    return data.data
}

/**
 * Get featured listings (public)
 */
export async function getFeaturedListings(): Promise<Listing[]> {
    try {
        const data = await apiClient<{ data: Listing[] }>('/listings/featured', {
            method: 'GET',
            next: { revalidate: 300 },
        })
        return data.data || []
    } catch {
        return []
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

// ============================================================================
// PROFILE UPDATE API
// ============================================================================

export interface UpdateProfileRequest {
    firstName?: string
    lastName?: string
    phone?: string
    profileImage?: string
}

/**
 * Update current user's profile (authenticated)
 */
export async function updateProfile(data: UpdateProfileRequest): Promise<any> {
    return apiClient('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

// ============================================================================
// TRANSACTIONS & EARNINGS API
// ============================================================================

export interface Transaction {
    id: string
    listingId: string
    amount: string | number
    type: 'DEPOSIT' | 'FULL_PAYMENT' | 'COMMISSION' | 'REFUND'
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
    stripePaymentId: string | null
    description: string | null
    createdAt: string
    listing?: {
        id: string
        title: string
        slug: string
        images: string[]
        make: string | null
        model: string | null
        year: number | null
    }
}

export interface TransactionsResponse {
    success: boolean
    data: Transaction[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

export interface EarningsStats {
    available: number
    pendingClearance: number
    totalYTD: number
}

/**
 * Get user's transactions (authenticated)
 */
export async function getMyTransactions(page = 1, limit = 20): Promise<TransactionsResponse> {
    return apiClient<TransactionsResponse>(`/transactions/my?page=${page}&limit=${limit}`, {
        method: 'GET',
        cache: 'no-store',
    })
}

/**
 * Get earnings statistics (authenticated)
 */
export async function getEarningsStats(): Promise<EarningsStats> {
    const data = await apiClient<{ data: EarningsStats }>('/transactions/stats', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

// ============================================================================
// SELLER PERFORMANCE API
// ============================================================================

export interface PerformanceStats {
    totalRevenue: number
    totalViews: number
    totalListings: number
    conversionRate: number
    recentListingViews: Array<{
        id: string
        title: string
        views: number
        date: string
    }>
}

/**
 * Get seller performance analytics (authenticated)
 */
export async function getSellerPerformance(): Promise<PerformanceStats> {
    const data = await apiClient<{ data: PerformanceStats }>('/listings/performance', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

// ============================================================================
// OFFERS API FUNCTIONS
// ============================================================================

export interface LatestOffer {
    id: string
    amount: string | number
    amountMin: string | number | null
    amountMax: string | number | null
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
    message: string | null
    buyerId: string
    createdAt: string
}

export interface Offer extends LatestOffer {
    listingId: string
    updatedAt: string
    buyer?: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
        profileImage: string | null
    }
    listing?: {
        id: string
        title: string
        slug: string
        images: string[]
        price: string | number
        priceMin: string | number | null
        priceMax: string | number | null
        status: string
        make: string | null
        model: string | null
        year: number | null
    }
}

export interface OffersResponse {
    success: boolean
    data: Offer[]
    timestamp: string
}

/**
 * Buyer: Submit an offer on a listing
 */
export async function makeOffer(
    listingId: string,
    amount: number,
    message?: string,
    amountMin?: number,
    amountMax?: number,
): Promise<Offer> {
    const data = await apiClient<{ data: Offer }>('/offers', {
        method: 'POST',
        body: JSON.stringify({ listingId, amount, amountMin, amountMax, message }),
    })
    return data.data
}

/**
 * Buyer: Get all my submitted offers
 */
export async function getMyOffers(): Promise<Offer[]> {
    const data = await apiClient<OffersResponse>('/offers/my', {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

/**
 * Buyer: Get MY latest offer for a specific listing
 * Returns null if the user has not made any offer on this listing.
 */
export async function getMyOfferForListing(listingId: string): Promise<LatestOffer | null> {
    try {
        const data = await apiClient<{ data: LatestOffer | null }>(`/offers/my/${listingId}`, {
            method: 'GET',
            cache: 'no-store',
        })
        return data.data
    } catch {
        return null
    }
}

/**
 * Seller: Get all offers on a specific listing
 */
export async function getOffersForListing(listingId: string): Promise<Offer[]> {
    const data = await apiClient<OffersResponse>(`/offers/listing/${listingId}`, {
        method: 'GET',
        cache: 'no-store',
    })
    return data.data
}

/**
 * Seller: Accept or reject an offer
 */
export async function respondToOffer(
    offerId: string,
    status: 'ACCEPTED' | 'REJECTED',
): Promise<Offer> {
    const data = await apiClient<{ data: Offer }>(`/offers/${offerId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    })
    return data.data
}

/**
 * Seller: Get total count of pending offers across all their listings.
 * Used to drive the pulsating badge on the Offers sidebar tab.
 */
export async function getPendingOffersCount(): Promise<number> {
    try {
        const data = await apiClient<{ data: { count: number } }>('/offers/pending-count', {
            method: 'GET',
            cache: 'no-store',
        })
        return data.data?.count ?? 0
    } catch {
        return 0
    }
}
