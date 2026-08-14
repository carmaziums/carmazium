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
  latitude?: number | null;
  longitude?: number | null;
  images: string[];
  description?: string | null;
  features?: string[] | null;
  isFeatured?: boolean;
  variant?: string | null;
  slug?: string;
  viewCount?: number;
  status?: string;
  seller?: {
    id: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string | null;
    /** Account creation date — backs the "member since" line. */
    createdAt?: string | null;
    // The backend returns the FULL dealerProfile on GET /listings/{id}
    // (listings.service.ts:603 `dealerProfile: true`). Mobile previously
    // declared only three of its fields, so the dealer's description, website
    // and business address were discarded before they reached any screen.
    dealerProfile?: {
      companyName?: string;
      logo?: string | null;
      isVerified?: boolean;
      description?: string | null;
      website?: string | null;
      businessAddress?: string | null;
    } | null;
    sellerProfile?: { totalSales?: number; reliabilityScore?: number } | null;
    /** Active listing count — computed server-side (listings.service.ts:604-610). */
    _count?: { listings?: number } | null;
  } | null;
  isDepartedSale?: boolean | null;
  exteriorGrade?: number | null;
  importedFromUrl?: string | null;
  importedSource?: string | null;
  linkedListingId?: string | null;
  linkedListing?: {
    id: string;
    type: string;
    auction?: { id: string; status: string; endTime: string } | null;
  } | null;
  deliveryAvailable?: boolean | null;
  deliveryMaxMiles?: number | null;
  deliveryPricePerMile?: number | null;
  bannerLabel?: string | null;
  videoUrls?: string[] | null;
  badgeTier?: 'FREE' | 'BASIC' | 'STANDARD' | 'PREMIUM' | null;
  // Real DVLA / seller-declared history fields — confirmed present on GET /listings/{id}
  // response (2026-07-11 live check). See mobile-audit.md W1.
  motStatus?: string | null;
  motExpiryDate?: string | null;
  taxStatus?: string | null;
  taxDueDate?: string | null;
  owners?: string | number | null;
  serviceHistory?: string | null;
  writeOffCategory?: string | null;
  stolenRecovered?: boolean | null;
  hasOutstandingFinance?: boolean | null;
  wheelplan?: string | null;
  typeApproval?: string | null;
  monthOfFirstRegistration?: string | null;
  // Fields the create payload (SellCarFlowScreen.tsx) sends but this type never
  // declared — needed for the edit-mode prefill fetch, not just display. Field
  // names confirmed against that same payload (proven-correct, already accepted
  // by the backend), not guessed. See mobile-audit.md: editing a listing used to
  // load a blank form and silently overwrite the real listing on save.
  vin?: string | null;
  vehicleType?: 'CAR' | 'HGV' | 'MOTORCYCLE' | null;
  doors?: number | null;
  seats?: number | null;
  engineSize?: number | null;
  driveType?: string | null;
  numberOfKeys?: number | null;
  torqueNm?: number | null;
  combinedMpg?: number | null;
  extraUrbanMpg?: number | null;
  ulezCompliant?: boolean | null;
  euroStandard?: string | null;
  co2Emissions?: number | null;
  isImported?: boolean | null;
  markedForExport?: boolean | null;
  departedRelationship?: string | null;
  isLegalRegisteredKeeper?: boolean | null;
  notOwnerRelationship?: string | null;
  priceMin?: number | null;
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
  deliveryAvailable?: boolean;
  deliveryMaxMiles?: number;
  deliveryPricePerMile?: number;
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
    // Raw enums kept alongside the display buckets above — mapCategory and
    // mapCondition are lossy and the detail screen wants the real value.
    bodyTypeRaw:  l.bodyType     ?? null,
    conditionRaw: l.condition    ?? null,
    vrm:          (l as any).vrm ?? null,
    ulezCompliant: l.ulezCompliant ?? null,
    euroStandard:  l.euroStandard  ?? null,
    colour:       l.color        ?? 'Unknown',
    bhp:          l.bhp          ?? 0,
    zeroToSixty:  l.zeroTo60Mph  ?? 0,
    topSpeed:     l.topSpeedMph  ?? 0,
    engineSize:   l.engineSize   ?? null,
    doors:        l.doors        ?? null,
    seats:        l.seats        ?? null,
    co2Emissions: l.co2Emissions ?? null,
    torqueNm:       l.torqueNm       ?? null,
    combinedMpg:    l.combinedMpg    ?? null,
    extraUrbanMpg:  l.extraUrbanMpg  ?? null,
    location:     l.location     ?? '',
    latitude:     l.latitude     ?? null,
    longitude:    l.longitude    ?? null,
    dealer,
    images:       l.images?.length ? l.images : [],
    isFeatured:   l.isFeatured   ?? false,
    isNew:        false,
    description:  l.description  ?? undefined,
    features:     l.features     ?? undefined,
    // Was `{ id }` only — every other field the backend sends about the seller
    // was discarded here, which is why the vehicle page could show a name and
    // a location and nothing else.
    seller: l.seller?.id
      ? {
          id: l.seller.id,
          profileImage: l.seller.profileImage ?? null,
          memberSince: l.seller.createdAt ?? null,
          isVerifiedDealer: l.seller.dealerProfile?.isVerified === true,
          companyName: l.seller.dealerProfile?.companyName ?? null,
          description: l.seller.dealerProfile?.description ?? null,
          website: l.seller.dealerProfile?.website ?? null,
          businessAddress: l.seller.dealerProfile?.businessAddress ?? null,
          activeListings: l.seller._count?.listings ?? null,
          reliabilityScore: l.seller.sellerProfile?.reliabilityScore ?? null,
        }
      : undefined,
    isDepartedSale: l.isDepartedSale  ?? false,
    exteriorGrade:  l.exteriorGrade   ?? null,
    importedFromUrl:  l.importedFromUrl  ?? null,
    importedSource:   l.importedSource   ?? null,
    linkedListingId:  l.linkedListingId  ?? null,
    linkedListing:    l.linkedListing    ?? null,
    deliveryAvailable:    l.deliveryAvailable    ?? false,
    deliveryMaxMiles:     l.deliveryMaxMiles     ?? null,
    deliveryPricePerMile: l.deliveryPricePerMile ?? null,
    bannerLabel:          l.bannerLabel          ?? null,
    videoUrls:            l.videoUrls            ?? null,
    badgeTier:            l.badgeTier            ?? null,
    motStatus:                l.motStatus                ?? null,
    motExpiry:                l.motExpiryDate            ?? null,
    taxStatus:                l.taxStatus                ?? null,
    taxDueDate:               l.taxDueDate               ?? null,
    owners:                   l.owners != null ? Number(l.owners) : null,
    serviceHistory:           l.serviceHistory           ?? null,
    writeOffCategory:         l.writeOffCategory         ?? null,
    stolenRecovered:          l.stolenRecovered          ?? null,
    hasOutstandingFinance:    l.hasOutstandingFinance    ?? null,
    wheelplan:                l.wheelplan                ?? null,
    typeApproval:             l.typeApproval             ?? null,
    monthOfFirstRegistration: l.monthOfFirstRegistration ?? null,
    isSellerVerified:         l.seller?.dealerProfile?.isVerified === true,
    totalSales:               l.seller?.sellerProfile?.totalSales ?? null,
    viewCount:                l.viewCount ?? 0,
    status:                   l.status ?? undefined,
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
  model?: string;
  vehicleType?: 'CAR' | 'HGV' | 'MOTORCYCLE';
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  fuelType?: string;
  /** Multi-select fuel types — serialized as `fuelTypes=PETROL,ELECTRIC` to match web; backend's ListingFilterDto already supports this (fuelTypes takes precedence over fuelType). */
  fuelTypes?: string[];
  bodyType?: string;
  conditions?: string[];
  ulezCompliant?: boolean;
  minBhp?: number;
  maxBhp?: number;
  minEngine?: number;
  maxEngine?: number;
  maxCo2?: number;
  deliveryAvailable?: boolean;
  sellerType?: string;
  listingType?: string;
  /** Multi-select transmissions — serialized as `transmissions=MANUAL,AUTOMATIC` to match web. */
  transmissions?: string[];
  color?: string;
  minDoors?: number;
  minSeats?: number;
  euroStandard?: string;
  /** Listings must have ALL of these features (comma-separated, AND-match on backend). */
  features?: string[];
  isImported?: boolean;
  markedForExport?: boolean;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<{ listings: CarListing[]; total: number }> {
  try {
    const query = new URLSearchParams();

    if (params.search)    query.set('search',    params.search);
    if (params.make)      query.set('make',      params.make);
    if (params.model)     query.set('model',     params.model);
    if (params.vehicleType) query.set('vehicleType', params.vehicleType);
    if (params.location) query.set('location', params.location);
    if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
    if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
    if (params.minYear  != null) query.set('minYear',  String(params.minYear));
    if (params.maxYear  != null) query.set('maxYear',  String(params.maxYear));
    if (params.minMileage != null) query.set('minMileage', String(params.minMileage));
    if (params.maxMileage != null) query.set('maxMileage', String(params.maxMileage));
    if (params.conditions?.length) query.set('conditions', params.conditions.join(','));
    if (params.transmissions?.length) query.set('transmissions', params.transmissions.join(','));
    if (params.ulezCompliant) query.set('ulezCompliant', 'true');
    if (params.minBhp != null) query.set('minBhp', String(params.minBhp));
    if (params.maxBhp != null) query.set('maxBhp', String(params.maxBhp));
    if (params.minEngine != null) query.set('minEngine', String(params.minEngine));
    if (params.maxEngine != null) query.set('maxEngine', String(params.maxEngine));
    if (params.maxCo2 != null) query.set('maxCo2', String(params.maxCo2));
    if (params.deliveryAvailable) query.set('deliveryAvailable', 'true');
    if (params.sellerType) query.set('sellerType', params.sellerType);
    if (params.listingType) query.set('listingType', params.listingType);
    if (params.color) query.set('color', params.color);
    if (params.minDoors != null) query.set('minDoors', String(params.minDoors));
    if (params.minSeats != null) query.set('minSeats', String(params.minSeats));
    if (params.euroStandard) query.set('euroStandard', params.euroStandard);
    if (params.features?.length) query.set('features', params.features.join(','));
    // Was `if (params.isImported)` — only ever sent 'true', so there was no
    // way to explicitly request isImported=false (exclude imports) even
    // though the backend supports it. undefined still omits the param.
    if (params.isImported === true) query.set('isImported', 'true');
    else if (params.isImported === false) query.set('isImported', 'false');
    if (params.markedForExport) query.set('markedForExport', 'true');
    if (params.sortBy)    query.set('sortBy', params.sortBy);
    if (params.page  != null) query.set('page',  String(params.page));
    if (params.limit != null) query.set('limit', String(params.limit));

    if (params.fuelTypes?.length) {
      // Was silently dropped — SearchScreen let users select multiple fuel
      // chips but only ever sent the first one. fuelTypes is a real,
      // already-supported backend param (listing-filter.dto.ts), same
      // comma-separated pattern as transmissions above.
      query.set('fuelTypes', params.fuelTypes.map(f => toBackendFuelType(f)).filter(Boolean).join(','));
    } else {
      const backendFuel = toBackendFuelType(params.fuelType);
      if (backendFuel) query.set('fuelType', backendFuel);
    }

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

// Raw (unmapped) fetch for the sell-flow edit prefill — CarListing is a
// display-oriented projection and drops several fields (vin, doors, seats,
// engineSize, driveType, etc.) that the edit form needs to round-trip.
export async function getRawListingById(id: string): Promise<ApiListing | null> {
  try {
    const res = await apiClient<ApiResponse<ApiListing>>(`/listings/${id}`);
    return res?.data ?? null;
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

// ─── Import from external platform ───────────────────────────────────────────

export interface ScrapedListingPreview {
  platform: 'AUTOTRADER' | 'CARGURUS' | 'CARWOW';
  originalUrl: string;
  title: string;
  price?: number;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  color?: string;
  bodyType?: string;
  doors?: number;
  engineSize?: number;
  bhp?: number;
  description?: string;
  images: string[];
  location?: string;
  vrm?: string;
  vin?: string;
}

export async function previewImport(url: string): Promise<ScrapedListingPreview> {
  const res = await apiClient<ApiResponse<ScrapedListingPreview>>('/listings/preview-import', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return res.data;
}

export async function importFromUrl(params: {
  url: string;
  price: number;
  vrm: string;
  title?: string;
}): Promise<{ id: string; slug: string }> {
  const res = await apiClient<ApiResponse<{ id: string; slug: string }>>('/listings/import-from-url', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return res.data;
}

// ─── Dual-channel ─────────────────────────────────────────────────────────────

/** Creates a linked CLASSIFIED listing from an AUCTION listing */
export async function alsoListRetail(
  listingId: string,
  price: number,
  badgeTier: 'BASIC' | 'STANDARD' | 'PREMIUM',
): Promise<{ linkedListingId: string }> {
  const res = await apiClient<ApiResponse<{ linkedListingId: string }>>(
    `/listings/${listingId}/also-list-retail`,
    {
      method: 'POST',
      body: JSON.stringify({ price, badgeTier }),
    },
  );
  return res.data;
}

/** Creates a linked AUCTION from a CLASSIFIED listing */
export async function alsoAuction(
  listingId: string,
  dto: {
    startTime: string;
    reservePrice: number;
    startingBid: number;
    minIncrement?: number;
    buyItNowPrice?: number;
  },
): Promise<{ linkedListingId: string; auctionId: string }> {
  const res = await apiClient<ApiResponse<{ linkedListingId: string; auctionId: string }>>(
    `/listings/${listingId}/also-auction`,
    {
      method: 'POST',
      body: JSON.stringify(dto),
    },
  );
  return res.data;
}
