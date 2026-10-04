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
    // A malformed response is not evidence that the user has zero saved cars.
    // Reject it so hydration leaves the current saved state untouched.
    if (!Array.isArray(res?.data) ||
        !res.pagination ||
        !Number.isSafeInteger(res.pagination.total) ||
        res.pagination.total < 0) {
      throw new Error('Invalid saved-car response. Please refresh and try again.');
    }
    const items: WatchlistItem[] = res.data.map((item) => ({
      ...item,
      mappedListing: item.listing ? mapApiListingToCarListing(item.listing) : undefined,
    }));
    return { items, total: res.pagination.total };
  } catch (error) {
    // Never turn a network/server failure into an apparently empty saved list.
    // The store preserves the previously hydrated user's items on errors.
    throw error;
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
  try {
    await apiClient<unknown>(`/watchlist/${listingId}`, { method: 'DELETE' });
  } catch (error: any) {
    // A previous optimistic add may have failed, or another device may have
    // removed the item already. "Not in watchlist" means the requested final
    // state (unsaved) is already true, so avoid reverting the last user tap.
    if (error?.status === 404 ||
        /(?:\\b404\\b|not in watchlist)/i.test(String(error?.message ?? ''))) return;
    throw error;
  }
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
