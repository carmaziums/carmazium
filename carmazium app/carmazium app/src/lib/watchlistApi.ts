import { apiClient } from './apiClient';
import { ApiListing, ApiResponse, mapApiListingToCarListing } from './listingsApi';
import { CarListing } from '../data/listings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  listingId: string;
  listing: ApiListing;
  /** Mapped frontend representation for convenience */
  mappedListing?: CarListing;
}

interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getWatchlist(
  page = 1,
  limit = 20
): Promise<{ items: WatchlistItem[]; total: number }> {
  try {
    const res = await apiClient<BackendPaginatedResponse<WatchlistItem>>(
      `/watchlist?page=${page}&limit=${limit}`
    );
    const items: WatchlistItem[] = Array.isArray(res?.data)
      ? res.data.map((item) => ({
          ...item,
          mappedListing: item.listing ? mapApiListingToCarListing(item.listing) : undefined,
        }))
      : [];
    return { items, total: res?.pagination?.total ?? 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

export async function addToWatchlist(listingId: string): Promise<void> {
  try {
    await apiClient<unknown>(`/watchlist/${listingId}`, { method: 'POST' });
  } catch (err: any) {
    // Silently ignore "already in watchlist" conflicts
    if (!err?.message?.includes('409') && err?.message !== 'Conflict') {
      throw err;
    }
  }
}

export async function removeFromWatchlist(listingId: string): Promise<void> {
  await apiClient<unknown>(`/watchlist/${listingId}`, { method: 'DELETE' });
}

export async function checkWatchlistStatus(listingId: string): Promise<boolean> {
  try {
    const res = await apiClient<ApiResponse<{ inWatchlist: boolean }>>(
      `/watchlist/check/${listingId}`
    );
    return res?.data?.inWatchlist ?? false;
  } catch {
    return false;
  }
}

export async function getWatchlistCount(): Promise<number> {
  try {
    const res = await apiClient<ApiResponse<{ count: number }>>('/watchlist/count');
    return res?.data?.count ?? 0;
  } catch {
    return 0;
  }
}
