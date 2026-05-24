import { apiClient } from './apiClient';

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

export interface AnalyticsMonth {
  month: string;
  newUsers: number;
  newListings: number;
  revenue: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const result = await apiClient<{ data: AdminStats }>('/admin/stats');
  return result.data;
}

export async function getAdminAnalytics(): Promise<AnalyticsMonth[]> {
  const result = await apiClient<{ data: AnalyticsMonth[] }>('/admin/analytics');
  return result.data;
}

export async function getAdminUsers(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/users?page=${page}&limit=${limit}`);
  return result;
}

export async function getAdminListings(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/listings?page=${page}&limit=${limit}`);
  return result;
}

export async function getAdminAuctions(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/auctions?page=${page}&limit=${limit}`);
  return result;
}

export async function getAdminTransactions(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/transactions?page=${page}&limit=${limit}`);
  return result;
}

export async function getPendingHandovers() {
  const result = await apiClient<{ data: any[] }>('/admin/handovers/pending');
  return result.data;
}

export async function approveHandover(auctionId: string) {
  const result = await apiClient<any>(`/admin/handovers/${auctionId}/approve`, { method: 'POST' });
  return result;
}

export async function denyHandover(auctionId: string) {
  const result = await apiClient<any>(`/admin/handovers/${auctionId}/deny`, { method: 'POST' });
  return result;
}

export async function updateUserRole(userId: string, role: string) {
  const result = await apiClient<any>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return result;
}

export async function banUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/ban`, { method: 'PATCH' });
}

export async function unbanUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/unban`, { method: 'PATCH' });
}

export async function lockUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/lock`, { method: 'PATCH' });
}

export async function unlockUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/unlock`, { method: 'PATCH' });
}

export async function deleteListingForce(listingId: string) {
  const result = await apiClient<any>(`/admin/listings/${listingId}`, {
    method: 'DELETE',
  });
  return result;
}

export async function getPendingKycList() {
  const result = await apiClient<{ data: any[] }>('/admin/dealers/kyc-pending');
  return result.data;
}

export async function reviewKyc(id: string, fields: { field: string; status: 'APPROVED' | 'REJECTED'; note?: string }[]) {
  const result = await apiClient<any>(`/admin/dealers/kyc/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return result;
}

