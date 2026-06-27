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

// ─── Fee formula (server uses the same tiered logic) ─────────────────────────

/**
 * Calculates delivery fee in GBP excluding VAT.
 * Tiers: ≤10mi = £30 flat; 11-30mi = £30 + (d-10)×£2; >30mi = £70 + (d-30)×£1.50
 */
export function calcDeliveryFeeExVat(miles: number): number {
  if (miles <= 10) return 30;
  if (miles <= 30) return 30 + (miles - 10) * 2;
  return 70 + (miles - 30) * 1.5;
}

// ─── API Functions ────────────────────────────────────────────────────────────

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
