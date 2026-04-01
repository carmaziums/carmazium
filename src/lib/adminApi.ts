import { apiClient } from './apiClient';

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalBids: number;
  totalRevenue: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const result = await apiClient<{ data: AdminStats }>('/admin/stats');
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

export async function updateUserRole(userId: string, role: string) {
  const result = await apiClient<any>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return result;
}

export async function deleteListingForce(listingId: string) {
  const result = await apiClient<any>(`/admin/listings/${listingId}`, {
    method: 'DELETE',
  });
  return result;
}
