import { apiClient } from './apiClient';

/**
 * The dealer and seller dashboards filter and count stock locally. Reading
 * only page 1 made cars beyond the first 50 invisible, and the API excludes
 * sold cars unless includeSold=true. Fetch the complete authoritative result
 * before calculating counts. Fail closed rather than pretending a partial
 * result is the seller's entire inventory.
 */
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

type MyListingsResponse<T> = {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export async function fetchAllMyListings<T extends { id: string }>(): Promise<T[]> {
  const seen = new Map<string, T>();
  let pagesExpected: number | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await apiClient<MyListingsResponse<T>>(
      `/listings/my?page=${page}&limit=${PAGE_SIZE}&includeSold=true`,
    );

    if (!response?.success || !Array.isArray(response.data)) {
      throw new Error('Could not load your complete listings. Please retry.');
    }

    const totalPages = Number(response.pagination?.totalPages);
    if (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > MAX_PAGES) {
      throw new Error('Your inventory exceeds the supported page range. Please use the website.');
    }
    // The result set may change while paging: don't silently show inaccurate
    // tab totals or hide cars by treating a partial snapshot as complete.
    if (pagesExpected != null && totalPages !== pagesExpected) {
      throw new Error('Your inventory changed while loading. Please refresh.');
    }
    pagesExpected = totalPages;

    for (const listing of response.data) {
      if (!listing?.id) throw new Error('Invalid listing received from server.');
      seen.set(listing.id, listing);
    }
    if (page >= totalPages) {
      if (seen.size !== Number(response.pagination.total)) {
        throw new Error('Your inventory changed while loading. Please refresh.');
      }
      return [...seen.values()];
    }
  }

  throw new Error('Could not load the complete inventory. Please use the website.');
}
