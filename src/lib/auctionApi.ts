import { apiClient } from './apiClient';

const API = '';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuctionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export interface AuctionBid {
    id: string;
    amount: string | number;
    bidderId: string;
    bidder?: { id: string; firstName: string | null; lastName: string | null };
    timestamp: string;
    createdAt: string;
}

export interface AuctionSeller {
    id: string;
    firstName: string | null;
    lastName: string | null;
    dealerProfile?: { companyName: string; logo: string | null } | null;
}

export interface AuctionListing {
    id: string;
    title: string;
    slug: string;
    images: string[];
    make: string | null;
    model: string | null;
    year: number | null;
    mileage: number | null;
    price: number | null;
    description: string | null;
    // Specs
    fuelType: string | null;
    transmission: string | null;
    bodyType: string | null;
    color: string | null;
    doors: number | null;
    seats: number | null;
    engineSize: number | null;
    bhp: number | null;
    // Compliance
    condition: string | null;
    ulezCompliant: boolean | null;
    euroStandard: string | null;
    co2Emissions: number | null;
    // Identity
    vrm: string | null;
    vin: string | null;
    writeOffCategory: string | null;
    // History
    motStatus: string | null;
    motExpiryDate: string | null;
    taxStatus: string | null;
    taxDueDate: string | null;
    monthOfFirstRegistration: string | null;
    // Features & location
    features: string[] | null;
    location: string | null;
    type: 'AUCTION' | 'CLASSIFIED';
    status: string;
    sellerId: string | null;
    seller?: AuctionSeller | null;
    bids?: AuctionBid[];
    _count?: { bids: number };
}

export interface Auction {
    id: string;
    listingId: string;
    status: AuctionStatus;
    startTime: string;
    endTime: string;
    reservePrice: string | number;
    startingBid: string | number;
    minIncrement: string | number;
    winnerId: string | null;
    winningBidAmount: string | number | null;
    handoverProofUrl: string | null;
    handoverSubmittedAt: string | null;
    sellerBonusReleased: boolean;
    createdAt: string;
    updatedAt: string;
    listing: AuctionListing;
    winner?: { id: string; firstName: string | null; lastName: string | null } | null;
}

export interface CreateAuctionRequest {
    listingId: string;
    startTime: string;       // ISO datetime — endTime is always startTime + 6h server-side
    reservePrice: number;
    startingBid: number;
    minIncrement?: number;   // default 100
}

export interface UpdateAuctionRequest {
    startTime?: string;
    reservePrice?: number;
    startingBid?: number;
    minIncrement?: number;
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

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getActiveAuctions(): Promise<Auction[]> {
    const res = await apiClient<{ data: Auction[] }>(`${API}/auctions/active`);
    return res.data;
}

export async function getScheduledAuctions(): Promise<Auction[]> {
    const res = await apiClient<{ data: Auction[] }>(`${API}/auctions/scheduled`);
    return res.data;
}

export async function getMyAuctions(): Promise<Auction[]> {
    const res = await apiClient<{ data: Auction[] }>(`${API}/auctions/my/list`);
    return res.data;
}

export async function getAuction(id: string): Promise<Auction> {
    const res = await apiClient<{ data: Auction }>(`${API}/auctions/${id}`);
    return res.data;
}

export async function createAuction(dto: CreateAuctionRequest): Promise<Auction> {
    const res = await apiClient<{ data: Auction }>(`${API}/auctions`, {
        method: 'POST',
        body: JSON.stringify(dto),
    });
    return res.data;
}

export async function updateAuction(id: string, dto: UpdateAuctionRequest): Promise<Auction> {
    const res = await apiClient<{ data: Auction }>(`${API}/auctions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
    });
    return res.data;
}

export async function cancelAuction(id: string): Promise<Auction> {
    const res = await apiClient<{ data: Auction }>(`${API}/auctions/${id}/cancel`, {
        method: 'PATCH',
    });
    return res.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCurrentBid(auction: Auction): number {
    const bids = auction.listing?.bids;
    if (bids && bids.length > 0) {
        return Number(bids[0].amount);
    }
    return Number(auction.startingBid);
}

export function getBidCount(auction: Auction): number {
    return auction.listing?._count?.bids ?? auction.listing?.bids?.length ?? 0;
}

export function isAntiSnipeActive(auction: Auction): boolean {
    if (auction.status !== 'ACTIVE') return false;
    const tenMinutes = 10 * 60 * 1000;
    return new Date(auction.endTime).getTime() - Date.now() <= tenMinutes;
}
