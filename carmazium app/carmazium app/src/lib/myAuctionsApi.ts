import { apiClient } from './apiClient';

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

type AuctionCollection<T> = {
  success: boolean;
  data: { data: T[]; total: number };
};

/**
 * Seller/winner auction records are returned as a StandardResponse wrapping
 * {data,total}, not a PaginatedResponse. Fetch all pages before presenting
 * status counts, and never silently replace inventory with partial results.
 */
export async function fetchAllMyAuctions<T extends { id: string }>(
  kind: 'list' | 'won',
): Promise<T[]> {
  const found = new Map<string, T>();
  let expectedTotal: number | null = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await apiClient<AuctionCollection<T>>(
      `/auctions/my/${kind}?page=${page}&limit=${PAGE_SIZE}`,
    );
    if (!response?.success || !Array.isArray(response.data?.data)) {
      throw new Error('Could not load auctions. Please retry.');
    }
    const total = Number(response.data.total);
    if (!Number.isSafeInteger(total) || total < 0 || total > PAGE_SIZE * MAX_PAGES) {
      throw new Error('Auction history is too large to load on this device. Please use the website.');
    }
    if (expectedTotal != null && expectedTotal !== total) {
      throw new Error('Auctions changed while loading. Refresh to see the latest status.');
    }
    expectedTotal = total;
    for (const auction of response.data.data) {
      if (!auction?.id) throw new Error('Invalid auction data.');
      found.set(auction.id, auction);
    }
    if (found.size === total) return [...found.values()];
    if (response.data.data.length === 0) {
      throw new Error('Incomplete auction history. Please refresh.');
    }
  }
  throw new Error('Could not load the complete auction history. Please use the website.');
}
