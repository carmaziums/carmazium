import { backendRequest } from './apiClient';

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalBids: number;
  totalRevenue: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const result = await backendRequest<AdminStats>('/admin/stats');
  return result.data as AdminStats;
}

export async function getAdminUsers(page = 1, limit = 20) {
  const result = await backendRequest<any>(`/admin/users?page=${page}&limit=${limit}`);
  return result;
}

export async function getAdminListings(page = 1, limit = 20) {
  const result = await backendRequest<any>(`/admin/listings?page=${page}&limit=${limit}`);
  return result;
}

export async function updateUserRole(userId: string, role: string) {
  const result = await backendRequest<any>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return result;
}

export async function deleteListingForce(listingId: string) {
  const result = await backendRequest<any>(`/admin/listings/${listingId}`, {
    method: 'DELETE',
  });
  return result;
}
