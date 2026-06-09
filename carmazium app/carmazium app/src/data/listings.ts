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
  location: string;
  dealer: string;
  rating: number;
  images: string[];
  isFeatured: boolean;
  isNew: boolean;
  isPremium?: boolean;
  monthlyPayment?: string;
  description?: string;
  features?: string[];
  seller?: { id: string };
}

export interface AuctionListing extends CarListing {
  auctionId: string;
  currentBid: number;
  startingBid: number;
  totalBids: number;
  endsAt: Date;
  isLive: boolean;
  viewers: number;
  reserve: number;
  reserveMet: boolean;
}

export const formatPrice = (price: number): string =>
  `£${price.toLocaleString('en-GB')}`;

export const formatMileage = (miles: number): string =>
  `${miles.toLocaleString('en-GB')} mi`;
