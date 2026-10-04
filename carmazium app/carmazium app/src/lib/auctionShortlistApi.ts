import { apiClient } from './apiClient';

interface ShortlistedAuctionRow {
  id: string;
  listingId: string;
  createdAt: string;
}
interface ShortlistResponse {
  success: boolean;
  data: ShortlistedAuctionRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

/**
 * Independent trade API. Never reuse /watchlist retail GET/POST/DELETE:
 * verified dealer KYC and VIEW_TRADE permissions are checked server-side.
 */
export async function getAuctionShortlist(page = 1, limit = 50) {
  const res = await apiClient<ShortlistResponse>(
    `/watchlist/auctions?page=${page}&limit=${limit}&view=all`,
  );
  if (!Array.isArray(res?.data) || !res?.pagination ||
      !Number.isFinite(res.pagination.total)) {
    throw new Error('Could not load your auction shortlist. Please retry.');
  }
  return { listingIds: res.data.map(item => item.listingId), total: res.pagination.total };
}

export async function addAuctionToShortlist(listingId: string): Promise<void> {
  await apiClient(`/watchlist/auctions/${encodeURIComponent(listingId)}`, {
    method: 'POST',
  });
}

export async function removeAuctionFromShortlist(listingId: string): Promise<void> {
  await apiClient(`/watchlist/auctions/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
  });
}
