import { apiClient } from './apiClient';

/** Shared with web's dealer auction shortlist: GET /watchlist/auctions. */
export interface ShortlistedAuction {
  id: string;
  listingId: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    images: string[];
    make: string | null;
    model: string | null;
    year: number | null;
    mileage: number | null;
    status: string;
    bids: Array<{ amount: number | string }>;
    _count: { bids: number };
    auction: {
      id: string;
      status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
      startTime: string;
      endTime: string;
      startingBid: number | string;
      minIncrement: number | string;
    } | null;
  };
}

export interface AuctionShortlistResponse {
  success: boolean;
  data: ShortlistedAuction[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

/** Backend restricts this endpoint to verified trade accounts. */
export async function getAuctionShortlist(
  page = 1,
  limit = 12,
  view: 'live' | 'all' = 'live',
): Promise<AuctionShortlistResponse> {
  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit) || 12));
  return apiClient<AuctionShortlistResponse>(
    '/watchlist/auctions?page=' + safePage + '&limit=' + safeLimit + '&view=' + view,
  );
}
