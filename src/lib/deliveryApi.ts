/**
 * API Client for Delivery Request Operations (Phase 15)
 */

import { apiClient } from './apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED'

export interface DeliveryAddress {
    street: string
    city: string
    postcode: string
}

export interface DeliveryRequest {
    id: string
    listingId: string
    offerId: string
    buyerId: string
    sellerId: string
    deliveryAddress: DeliveryAddress
    deliveryNotes?: string | null
    distanceMiles: number
    estimatedCostGbp: number
    status: DeliveryStatus
    expiresAt: string
    acceptedAt?: string | null
    declinedAt?: string | null
    cancelledAt?: string | null
    completedAt?: string | null
    createdAt: string
    updatedAt: string
    listing?: {
        id: string
        title: string
        deliveryPricePerMile?: number | null
        deliveryMaxMiles?: number | null
    }
    buyer?: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string
    }
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Buyer: Create a delivery request for a listing after an offer is accepted
 */
export async function createDeliveryRequest(data: {
    listingId: string
    deliveryAddress: DeliveryAddress
    deliveryNotes?: string
}): Promise<DeliveryRequest> {
    const res = await apiClient<{ data: DeliveryRequest }>('/delivery-requests', {
        method: 'POST',
        body: JSON.stringify(data),
    })
    return res.data
}

/**
 * Seller: Accept a delivery request
 */
export async function acceptDeliveryRequest(id: string): Promise<DeliveryRequest> {
    const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/accept`, {
        method: 'PATCH',
    })
    return res.data
}

/**
 * Seller: Decline a delivery request
 */
export async function declineDeliveryRequest(id: string): Promise<DeliveryRequest> {
    const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/decline`, {
        method: 'PATCH',
    })
    return res.data
}

/**
 * Buyer: Cancel a delivery request
 */
export async function cancelDeliveryRequest(id: string): Promise<DeliveryRequest> {
    const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/cancel`, {
        method: 'PATCH',
    })
    return res.data
}

/**
 * Seller: Mark a delivery request as completed
 */
export async function completeDeliveryRequest(id: string): Promise<DeliveryRequest> {
    const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/complete`, {
        method: 'PATCH',
    })
    return res.data
}

/**
 * Buyer: Get all delivery requests I have submitted
 */
export async function getMyDeliveryRequests(): Promise<DeliveryRequest[]> {
    const res = await apiClient<{ data: DeliveryRequest[] }>('/delivery-requests/my', {
        method: 'GET',
        cache: 'no-store',
    })
    return res.data
}

/**
 * Seller: Get all delivery requests received for my listings
 */
export async function getReceivedDeliveryRequests(): Promise<DeliveryRequest[]> {
    const res = await apiClient<{ data: DeliveryRequest[] }>('/delivery-requests/received', {
        method: 'GET',
        cache: 'no-store',
    })
    return res.data
}
