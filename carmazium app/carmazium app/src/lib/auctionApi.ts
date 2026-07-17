import { apiClient } from './apiClient';
import { CarListing } from '../data/listings';

export interface AuctionBid {
  id: string;
  listingId: string;
  bidderId: string;
  amount: number;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  bidder: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface AuctionListingDetail {
  id: string;
  vehicleId?: string | null;
  sellerId?: string | null;
  type: 'AUCTION' | 'CLASSIFIED';
  status: 'DRAFT' | 'ACTIVE' | 'OFFER_ACCEPTED' | 'SOLD' | 'WITHDRAWN';
  title: string;
  description?: string | null;
  price: number;
  images: string[];
  slug: string;
  viewCount: number;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuelType: string;
  transmission: string;
  category?: string | null;
  condition?: string | null;
  colour?: string | null;
  bhp?: number | null;
  zeroToSixty?: number | null;
  topSpeed?: number | null;
  location?: string | null;
  variant?: string | null;
  owners?: string | null;
  features?: string[] | any;
  seller?: {
    id: string;
    firstName: string;
    lastName: string;
    dealerProfile?: {
      companyName: string;
      logo?: string | null;
    } | null;
    sellerProfile?: {
      reliabilityScore: number;
    } | null;
  } | null;
  bids?: AuctionBid[];
  _count?: {
    bids: number;
  };
  linkedListingId?: string | null;
  linkedListing?: {
    id: string;
    type: string;
    auction?: { id: string; status: string; endTime: string } | null;
  } | null;
}

export interface AuctionDetail {
  id: string;
  listingId: string;
  startTime: string;
  endTime: string;
  reservePrice: number;
  startingBid: number;
  minIncrement: number;
  status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  winnerId?: string | null;
  winningBidAmount?: number | null;
  buyItNowPrice?: number | null;
  buyItNowPendingBuyerId?: string | null;
  buyerFeePaid?: boolean;
  handoverProofUrl?: string | null;
  handoverSubmittedAt?: string | null;
  sellerBonusReleased?: boolean;
  stripePayoutError?: string | null;
  createdAt: string;
  updatedAt: string;
  listing: AuctionListingDetail;
  winner?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  customTags?: string[] | null;
  sellerSelfRating?: number | null;
}

// Shared AuctionDetail → CarListing adapter, needed anywhere an auction is
// navigated to via LiveAuctionDetailed (route requires a full CarListing,
// not just an id) — was previously duplicated as a HomeScreen-local
// function; extracted here so NotificationsScreen's tap-through (F35) can
// reuse it too.
export function auctionToListingParam(a: AuctionDetail): CarListing & { auctionId: string } {
  const l = a.listing as any;
  return {
    id: l?.id ?? a.id,
    auctionId: a.id,
    make: l?.make ?? '',
    model: l?.model ?? '',
    variant: l?.variant ?? '',
    year: l?.year ?? new Date().getFullYear(),
    price: Number(l?.price ?? 0),
    mileage: l?.mileage ?? 0,
    fuelType: l?.fuelType ?? 'Petrol',
    transmission: l?.transmission === 'MANUAL' ? 'Manual' : 'Automatic',
    category: 'Saloon',
    condition: 'Used',
    colour: l?.colour ?? l?.color ?? '',
    bhp: l?.bhp ?? 0,
    zeroToSixty: l?.zeroToSixty ?? l?.zeroTo60Mph ?? 0,
    topSpeed: l?.topSpeed ?? l?.topSpeedMph ?? 0,
    location: l?.location ?? '',
    dealer: l?.seller?.dealerProfile?.companyName
      || `${l?.seller?.firstName || ''} ${l?.seller?.lastName || ''}`.trim()
      || 'Private Seller',
    images: l?.images ?? [],
    isFeatured: false,
    isNew: false,
    description: l?.description ?? '',
    features: Array.isArray(l?.features) ? l.features : [],
  } as any;
}

export interface BidBroadcastPayload {
  bidId: string;
  auctionId: string;
  listingId: string;
  amount: number;
  bidderInitials: string;
  bidderId: string;
  timestamp: string;
  newEndTime?: string;
}

export interface AuctionEndPayload {
  auctionId: string;
  winnerId: string | null;
  winningBidAmount: number | null;
  reserveMet: boolean;
}

export async function getActiveAuctions(): Promise<AuctionDetail[]> {
  const res = await apiClient<{ success: boolean; data: AuctionDetail[] }>('/auctions/active');
  return res.data;
}

export async function getScheduledAuctions(
  page = 1,
  limit = 20
): Promise<{ data: AuctionDetail[]; total: number }> {
  const res = await apiClient<{
    success: boolean;
    data: { data: AuctionDetail[]; total: number };
  }>(`/auctions/scheduled?page=${page}&limit=${limit}`);
  return res.data;
}

export async function getAuction(id: string): Promise<AuctionDetail> {
  const res = await apiClient<{ success: boolean; data: AuctionDetail }>(`/auctions/${id}`);
  return res.data;
}

export async function placeBid(listingId: string, amount: number): Promise<any> {
  const res = await apiClient<{ success: boolean; data: any }>('/bids', {
    method: 'POST',
    body: JSON.stringify({ listingId, amount }),
  });
  return res.data;
}

// ─── Buy It Now ───────────────────────────────────────────────────────────────

export async function triggerBuyItNow(auctionId: string): Promise<void> {
  await apiClient(`/auctions/${auctionId}/bin-trigger`, { method: 'POST' });
}

export async function confirmBuyItNow(auctionId: string): Promise<void> {
  await apiClient(`/auctions/${auctionId}/bin-confirm`, { method: 'POST' });
}

export async function declineBuyItNow(auctionId: string): Promise<void> {
  await apiClient(`/auctions/${auctionId}/bin-decline`, { method: 'POST' });
}

// ─── Handover proof ──────────────────────────────────────────────────────────

export async function submitHandoverProof(
  auctionId: string,
  proofUrl: string,
): Promise<void> {
  await apiClient(`/auctions/${auctionId}/handover-proof`, {
    method: 'POST',
    body: JSON.stringify({ proofUrl }),
  });
}
