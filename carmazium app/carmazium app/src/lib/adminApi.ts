import { apiClient } from './apiClient';

// Native admin phase 1. Every call below is copied from the website's
// `src/lib/adminApi.ts` (same endpoint, method and body) — the backend
// rejects unknown DTO fields, so do not add a property here that web does
// not send. Money-moving admin actions (payouts, mark-paid, retry, refunds,
// assign-winner, auction price edits) are deliberately NOT ported: they stay
// on the website admin console.

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalAuctions: number;
  activeAuctions: number;
  endedAuctions: number;
  totalBids: number;
  totalRevenue: number;
}

export interface AdminUsersPage {
  data: any[];
  pagination?: { total: number; page: number; limit: number; totalPages?: number };
}

export type DealerKycBusinessType = 'PRIVATE_LIMITED' | 'SOLE_PROPRIETORSHIP';

export interface KycFieldDecision {
  field: string;
  status: 'APPROVED' | 'REJECTED';
  note?: string;
}

/** Web: getAdminStats — GET /admin/stats */
export async function getAdminStats(): Promise<AdminStats> {
  const result = await apiClient<{ data: AdminStats }>('/admin/stats');
  return result.data;
}

/** Web: getPendingListingReviews — GET /admin/listings/pending-review */
export async function getPendingListingReviews(): Promise<any[]> {
  const result = await apiClient<{ data: any[] }>('/admin/listings/pending-review');
  return result.data;
}

/** Web: approveListing — POST /admin/listings/:id/approve (no body) */
export async function approveListing(listingId: string) {
  return apiClient<any>(`/admin/listings/${listingId}/approve`, { method: 'POST' });
}

/** Web: rejectListing — POST /admin/listings/:id/reject { reason } (RejectListingDto: 10–1000 chars) */
export async function rejectListing(listingId: string, reason: string) {
  return apiClient<any>(`/admin/listings/${listingId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Web: getPendingKycList — GET /admin/dealers/kyc-pending */
export async function getPendingKycList(): Promise<any[]> {
  const result = await apiClient<{ data: any[] }>('/admin/dealers/kyc-pending');
  return result.data;
}

/** Web: reviewKyc — PATCH /admin/dealers/kyc/:id/review { fields, businessType? } (ReviewKycDto) */
export async function reviewKyc(
  id: string,
  fields: KycFieldDecision[],
  businessType?: DealerKycBusinessType,
) {
  return apiClient<any>(`/admin/dealers/kyc/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ fields, ...(businessType ? { businessType } : {}) }),
  });
}

/** Web: getPendingHandovers — GET /admin/handovers/pending */
export async function getPendingHandovers(): Promise<any[]> {
  const result = await apiClient<{ data: any[] }>('/admin/handovers/pending');
  return result.data;
}

/** Web: approveHandover — POST /admin/handovers/:auctionId/approve (no body) */
export async function approveHandover(auctionId: string) {
  return apiClient<any>(`/admin/handovers/${auctionId}/approve`, { method: 'POST' });
}

/** Web: denyHandover — POST /admin/handovers/:auctionId/deny { reason } */
export async function denyHandover(auctionId: string, reason: string) {
  return apiClient<any>(`/admin/handovers/${auctionId}/deny`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Web: getAdminUsers — GET /admin/users?page&limit[&search] */
export async function getAdminUsers(page = 1, limit = 20, search?: string): Promise<AdminUsersPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiClient<AdminUsersPage>(`/admin/users?${params.toString()}`);
}

/** Web: getAdminUserDetail — GET /admin/users/:id */
export async function getAdminUserDetail(id: string): Promise<any> {
  const result = await apiClient<{ data: any }>(`/admin/users/${id}`);
  return result.data;
}
