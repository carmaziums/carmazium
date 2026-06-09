import { apiClient } from './apiClient';
import { CarListing } from '../data/listings';

// ─── Backend Types ────────────────────────────────────────────────────────────

export interface ApiListing {
  id: string;
  title: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  price: number;
  mileage?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  condition?: string | null;
  color?: string | null;
  bhp?: number | null;
  zeroTo60Mph?: number | null;
  topSpeedMph?: number | null;
  location?: string | null;
  images: string[];
  description?: string | null;
  features?: string[] | null;
  isFeatured?: boolean;
  variant?: string | null;
  slug?: string;
  viewCount?: number;
  seller?: {
    id: string;
    firstName?: string;
    lastName?: string;
    dealerProfile?: { companyName?: string; logo?: string } | null;
  } | null;
}

export interface PaginatedApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface CreateListingPayload {
  title: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  condition?: string;
  color?: string;
  bhp?: number;
  zeroTo60Mph?: number;
  topSpeedMph?: number;
  location?: string;
  images?: string[];
  description?: string;
  features?: string[];
  variant?: string;
}

export interface SellerStats {
  activeListings: number;
  totalViews: number;
  offersReceived: number;
  totalEarnings: number;
}

// Re-export so callers can use this alias
export type CarListingFromApi = CarListing;

// ─── Mapping Helpers ──────────────────────────────────────────────────────────

function mapFuelType(raw?: string | null): CarListing['fuelType'] {
  switch (raw) {
    case 'PETROL':        return 'Petrol';
    case 'DIESEL':        return 'Diesel';
    case 'ELECTRIC':      return 'Electric';
    case 'HYBRID':        return 'Hybrid';
    case 'PLUGIN_HYBRID': return 'Plug-in Hybrid';
    default:              return (raw as CarListing['fuelType']) ?? 'Petrol';
  }
}

function mapTransmission(raw?: string | null): CarListing['transmission'] {
  if (raw === 'MANUAL') return 'Manual';
  return 'Automatic';
}

function mapCategory(raw?: string | null): CarListing['category'] {
  switch (raw) {
    case 'SUV':         return 'SUV';
    case 'HATCHBACK':   return 'Hatchback' as any;
    case 'SEDAN':       return 'Saloon';
    case 'ESTATE':      return 'Estate';
    case 'COUPE':
    case 'SPORTS_CAR':  return 'Sports';
    case 'CONVERTIBLE': return 'Convertible';
    default:            return 'Saloon';
  }
}

function mapCondition(raw?: string | null): CarListing['condition'] {
  switch (raw) {
    case 'EXCELLENT':
    case 'GOOD':  return 'Certified Pre-Owned';
    case 'FAIR':
    case 'POOR':  return 'Used';
    default:      return 'Used';
  }
}

export function mapApiListingToCarListing(l: ApiListing): CarListing {
  const firstName = l.seller?.firstName ?? '';
  const lastName  = l.seller?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  const dealer    = l.seller?.dealerProfile?.companyName || fullName || 'Private Seller';

  return {
    id:           l.id,
    make:         l.make         ?? 'Unknown',
    model:        l.model        ?? 'Unknown',
    variant:      l.variant      ?? '',
    year:         l.year         ?? new Date().getFullYear(),
    price:        l.price,
    mileage:      l.mileage      ?? 0,
    fuelType:     mapFuelType(l.fuelType),
    transmission: mapTransmission(l.transmission),
    category:     mapCategory(l.bodyType),
    condition:    mapCondition(l.condition),
    colour:       l.color        ?? 'Unknown',
    bhp:          l.bhp          ?? 0,
    zeroToSixty:  l.zeroTo60Mph  ?? 0,
    topSpeed:     l.topSpeedMph  ?? 0,
    location:     l.location     ?? '',
    dealer,
    rating:       4.5,
    images:       l.images?.length ? l.images : [],
    isFeatured:   l.isFeatured   ?? false,
    isNew:        false,
    description:  l.description  ?? undefined,
    features:     l.features     ?? undefined,
    seller:       l.seller?.id ? { id: l.seller.id } : undefined,
  };
}

// ─── Frontend-to-backend enum converters (for search params) ─────────────────

function toBackendFuelType(value?: string): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    Petrol:          'PETROL',
    Diesel:          'DIESEL',
    Electric:        'ELECTRIC',
    Hybrid:          'HYBRID',
    'Plug-in Hybrid':'PLUGIN_HYBRID',
  };
  return map[value] ?? value.toUpperCase();
}

function toBackendBodyType(value?: string): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    SUV:        'SUV',
    Saloon:     'SEDAN',
    Hatchback:  'HATCHBACK',
    'Coupé':    'COUPE',
    Coupe:      'COUPE',
    Sports:     'SPORTS_CAR',
    Estate:     'ESTATE',
    Convertible:'CONVERTIBLE',
  };
  return map[value] ?? value.toUpperCase();
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getFeaturedListings(): Promise<CarListing[]> {
  try {
    const res = await apiClient<ApiResponse<ApiListing[]>>('/listings/featured');
    const items = Array.isArray(res?.data) ? res.data : [];
    return items.map(mapApiListingToCarListing);
  } catch {
    return [];
  }
}

export async function searchListings(params: {
  search?: string;
  make?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxMileage?: number;
  fuelType?: string;
  bodyType?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<{ listings: CarListing[]; total: number }> {
  try {
    const query = new URLSearchParams();

    if (params.search)    query.set('search',    params.search);
    if (params.make)      query.set('make',      params.make);
    if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
    if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
    if (params.minYear  != null) query.set('minYear',  String(params.minYear));
    if (params.maxMileage != null) query.set('maxMileage', String(params.maxMileage));
    if (params.sortBy)    query.set('sortBy', params.sortBy);
    if (params.page  != null) query.set('page',  String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));

    const backendFuel = toBackendFuelType(params.fuelType);
    if (backendFuel) query.set('fuelType', backendFuel);

    const backendBody = toBackendBodyType(params.bodyType);
    if (backendBody) query.set('bodyType', backendBody);

    const qs = query.toString();
    const res = await apiClient<BackendPaginatedResponse<ApiListing>>(
      `/listings${qs ? `?${qs}` : ''}`
    );

    const items = Array.isArray(res?.data) ? res.data : [];
    return {
      listings: items.map(mapApiListingToCarListing),
      total: res?.pagination?.total ?? 0,
    };
  } catch {
    return { listings: [], total: 0 };
  }
}

export async function getListingById(id: string): Promise<CarListing | null> {
  try {
    const res = await apiClient<ApiResponse<ApiListing>>(`/listings/${id}`);
    return res?.data ? mapApiListingToCarListing(res.data) : null;
  } catch {
    return null;
  }
}

export async function getMyListings(
  page = 1,
  limit = 20
): Promise<{ listings: CarListing[]; total: number }> {
  try {
    const res = await apiClient<BackendPaginatedResponse<ApiListing>>(
      `/listings/my?page=${page}&limit=${limit}`
    );
    const items = Array.isArray(res?.data) ? res.data : [];
    return {
      listings: items.map(mapApiListingToCarListing),
      total: res?.pagination?.total ?? 0,
    };
  } catch {
    return { listings: [], total: 0 };
  }
}

export async function createListing(
  data: CreateListingPayload
): Promise<{ id: string; slug: string }> {
  const res = await apiClient<ApiResponse<{ id: string; slug: string }>>('/listings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function getSellerStats(): Promise<SellerStats> {
  try {
    const res = await apiClient<ApiResponse<SellerStats>>('/listings/stats');
    return res?.data ?? { activeListings: 0, totalViews: 0, offersReceived: 0, totalEarnings: 0 };
  } catch {
    return { activeListings: 0, totalViews: 0, offersReceived: 0, totalEarnings: 0 };
  }
}
