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
  // A failed HTTP read is not an empty watchlist. Propagate it so the store
  // retains its last successfully hydrated items instead of clearing hearts.
  const res = await apiClient<BackendPaginatedResponse<WatchlistItem>>(
    `/watchlist?page=${page}&limit=${limit}`
  );
  if (!res?.success || !Array.isArray(res.data) || !Number.isSafeInteger(res.pagination?.total)) {
    throw new Error('Could not load your saved cars.');
  }
  const items: WatchlistItem[] = res.data.map(item => ({
    ...item,
    mappedListing: item.listing ? mapApiListingToCarListing(item.listing) : undefined,
  }));
  return { items, total: res.pagination.total };
}

/**
 * The regular watchlist deliberately omits dealer-only auction records.
 * Resolve a saved auction through the verified-dealer shortlist endpoint,
 * never by opening its listing as if it were a retail purchase.
 */
export async function getSavedAuctionIdForListing(listingId: string): Promise<string | null> {
  type SavedAuction = { listingId: string; listing?: { auction?: { id: string } | null } };
  for (let page = 1; page <= 40; page++) {
    const response = await apiClient<BackendPaginatedResponse<SavedAuction>>(
      `/watchlist/auctions?page=${page}&limit=50&view=all`,
    );
    if (!response?.success || !Array.isArray(response.data)) {
      throw new Error('Could not load your saved auctions.');
    }
    const match = response.data.find(item => item.listingId === listingId);
    if (match) return match.listing?.auction?.id ?? null;
    const pages = Number(response.pagination?.totalPages);
    if (!Number.isInteger(pages) || pages > 40 || pages < 0) {
      throw new Error('Could not load the complete auction shortlist.');
    }
    if (page >= pages) return null;
  }
  throw new Error('Could not load the complete auction shortlist.');
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
