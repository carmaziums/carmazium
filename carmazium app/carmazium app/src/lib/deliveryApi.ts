import { apiClient } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'COMPLETED';

export interface DeliveryAddress {
  street: string;
  city: string;
  postcode: string;
}

export interface DeliveryRequest {
  id: string;
  listingId: string;
  offerId?: string;
  buyerId: string;
  sellerId: string;
  deliveryAddress: DeliveryAddress;
  deliveryNotes?: string | null;
  distanceMiles: number;
  estimatedCostGbp: number;
  status: DeliveryStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryQuote {
  distanceMiles: number;
  estimatedCostGbp: number;
  withinRadius: boolean;
  ratePerMile: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Real server-computed delivery estimate (road distance via Google Maps x
 * the listing's own deliveryPricePerMile) — same calculation
 * createDeliveryRequest uses, just without creating a request. Replaces a
 * hardcoded client-side tiered formula (calcDeliveryFeeExVat, removed) that
 * didn't match what the backend actually charges, and a fabricated x1.2
 * "VAT" markup — the backend has no VAT concept for delivery at all, so
 * that multiplier was inventing a second discrepancy on top of the first
 * (mobile-production-readiness-plan.md F24). No offer or existing request
 * required; this is purely a preview.
 */
export async function getDeliveryQuote(listingId: string, postcode: string): Promise<DeliveryQuote> {
  const res = await apiClient<{ data: DeliveryQuote }>(
    `/delivery-requests/quote?listingId=${encodeURIComponent(listingId)}&postcode=${encodeURIComponent(postcode)}`,
    { method: 'GET' },
  );
  return res.data;
}

export async function createDeliveryRequest(data: {
  listingId: string;
  deliveryAddress: DeliveryAddress;
  deliveryNotes?: string;
}): Promise<DeliveryRequest> {
  const res = await apiClient<{ data: DeliveryRequest }>('/delivery-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function acceptDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/accept`, {
    method: 'PATCH',
  });
  return res.data;
}

export async function declineDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/decline`, {
    method: 'PATCH',
  });
  return res.data;
}

export async function cancelDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/cancel`, {
    method: 'PATCH',
  });
  return res.data;
}

export async function completeDeliveryRequest(id: string): Promise<DeliveryRequest> {
  const res = await apiClient<{ data: DeliveryRequest }>(`/delivery-requests/${id}/complete`, {
    method: 'PATCH',
  });
  return res.data;
}

export async function getMyDeliveryRequests(): Promise<DeliveryRequest[]> {
  const res = await apiClient<{ data: DeliveryRequest[] }>('/delivery-requests/my', {
    method: 'GET',
  });
  return res.data ?? [];
}

export async function getReceivedDeliveryRequests(): Promise<DeliveryRequest[]> {
  const res = await apiClient<{ data: DeliveryRequest[] }>('/delivery-requests/received', {
    method: 'GET',
  });
  return res.data ?? [];
}
