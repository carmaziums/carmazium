// Carmazium – Shared listing types & formatting helpers
//
// NOTE: This file used to also export hardcoded mock arrays (LISTINGS,
// AUCTION_LISTINGS, CATEGORIES) seeded with fake demo cars. They were never
// imported anywhere — every screen now sources real data from the backend
// (see lib/listingsApi.ts, lib/auctionApi.ts) — so the dead mock data was
// removed during the pre-launch dummy-data audit. Only the shared types and
// formatting helpers (still used across the app) remain here.

export type FuelType = 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid' | 'Plug-in Hybrid';
export type Transmission = 'Automatic' | 'Manual';
export type Category = 'Sports' | 'SUV' | 'Saloon' | 'Convertible' | 'Supercar' | 'Estate';
export type Condition = 'New' | 'Used' | 'Certified Pre-Owned';

export interface CarListing {
  id: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number;
  mileage: number;
  fuelType: FuelType;
  transmission: Transmission;
  category: Category;
  condition: Condition;
  colour: string;
  bhp: number;
  zeroToSixty: number;
  topSpeed: number;
  // Present on ApiListing/the backend response but previously dropped by the
  // mapper — Search/Compare/VehicleDetail couldn't show or filter on these
  // as a result (mobile-audit.md finding).
  engineSize?: number | null;
  doors?: number | null;
  seats?: number | null;
  co2Emissions?: number | null;
  // Performance fields — real columns on ApiListing/the backend response,
  // same class of "typed but dropped by the mapper" gap as the ones above
  // (mobile-audit.md M2 finding: VehicleDetailScreen's spec grid never had
  // these to show, not because the data doesn't exist).
  torqueNm?: number | null;
  combinedMpg?: number | null;
  extraUrbanMpg?: number | null;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  dealer: string;
  rating?: number;
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  isPremium?: boolean;
  monthlyPayment?: string;
  description?: string;
  features?: string[];
  seller?: { id: string };
  isDepartedSale?: boolean;
  // Auto-computed server-side from DamageRecord count on every damage save —
  // never seller-set, no mobile picker exists or should exist for this.
  exteriorGrade?: number | null;
  /**
   * Registration mark. Web shows this free on the vehicle page; mobile only
   * ever surfaced it after a £9.99 HPI purchase because it was never a typed
   * field — it was reachable only via `as any`.
   */
  vrm?: string | null;
  /**
   * ULEZ compliance and Euro emissions standard. Both are real backend columns
   * and were already declared on `ApiListing`, but the mapper never assigned
   * them because `CarListing` had nowhere to put them — so they were silently
   * dropped on every listing. For a UK marketplace ULEZ status is a buying
   * decision, not a detail.
   */
  ulezCompliant?: boolean | null;
  euroStandard?: string | null;
  /**
   * The raw backend enums, preserved alongside the lossy display buckets.
   * `category` collapses a 13-value bodyType into 6, and `condition` collapses
   * a 6-value enum (which includes CAT_S / CAT_N write-off categories) into 2 —
   * detail a buyer needs and mobile was throwing away.
   */
  bodyTypeRaw?: string | null;
  conditionRaw?: string | null;
  importedFromUrl?: string | null;
  importedSource?: string | null;
  linkedListingId?: string | null;
  linkedListing?: {
    id: string;
    type: string;
    auction?: { id: string; status: string; endTime: string } | null;
  } | null;
  deliveryAvailable?: boolean;
  deliveryMaxMiles?: number | null;
  deliveryPricePerMile?: number | null;
  bannerLabel?: string | null;
  videoUrls?: string[] | null;
  badgeTier?: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | null;
  // Real DVLA / seller-declared history fields (see mobile-audit.md W1) — null/undefined means
  // "not disclosed", never assume a positive value as a fallback.
  motStatus?: string | null;
  motExpiry?: string | null;
  taxStatus?: string | null;
  taxDueDate?: string | null;
  owners?: number | null;
  serviceHistory?: string | null;
  writeOffCategory?: string | null;
  stolenRecovered?: boolean | null;
  hasOutstandingFinance?: boolean | null;
  wheelplan?: string | null;
  typeApproval?: string | null;
  monthOfFirstRegistration?: string | null;
  isSellerVerified?: boolean;
  totalSales?: number | null;
  viewCount?: number;
  status?: string;
}

export interface AuctionListing extends CarListing {
  auctionId: string;
  currentBid: number;
  startingBid: number;
  totalBids: number;
  endsAt: Date;
  isLive: boolean;
  viewers: number;
  // reserve/reserveMet are kept for internal gating only (e.g. hiding the Buy
  // It Now card once reserve is met) — never render their value directly to
  // a buyer. Buyer-facing UI shows buyItNowPrice instead. See Ground Rules:
  // "Reserve Price" is hidden from all buyer-facing UI.
  reserve: number;
  reserveMet: boolean;
  buyItNowPrice?: number | null;
}

export const formatPrice = (price: number): string =>
  `£${price.toLocaleString('en-GB')}`;

export const formatMileage = (miles: number): string =>
  `${miles.toLocaleString('en-GB')} mi`;
