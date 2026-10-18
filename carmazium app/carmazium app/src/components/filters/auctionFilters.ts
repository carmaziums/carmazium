// Auction filter model.
//
// Web rebuilt the /auctions filter panel to match Buy Cars in commit 5a99b5d0;
// mobile's Live screen still had nothing but a text query. This is the mobile
// port of that filter set.
//
// The logic lives here rather than in the screen deliberately. SearchScreen
// implements its ~30 filters as ~30 individual useState hooks inline, which is
// exactly why nothing could be reused when the auctions page needed the same
// capability. Keeping state shape, matching and sorting in one testable module
// means the next surface that needs filtering (upcoming auctions, saved
// searches) can use it without another copy-paste.

/** Filterable subset of a listing. Both the mapped `CarListing` and the raw
 *  backend listing on an upcoming auction structurally satisfy this. */
export interface FilterableListing {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  category?: string | null;
  bodyType?: string | null;
  colour?: string | null;
  color?: string | null;
  location?: string | null;
  deliveryAvailable?: boolean | null;
  doors?: number | null;
  seats?: number | null;
  variant?: string | null;
  engineSize?: number | null;
  co2Emissions?: number | null;
  combinedMpg?: number | null;
  zeroToSixty?: number | null;
  driveType?: string | null;
  exteriorGrade?: number | null;
  condition?: string | null;
  writeOffCategory?: string | null;
  ulezCompliant?: boolean | null;
  euroStandard?: string | null;
  bhp?: number | null;
  features?: string[] | null;
  isImported?: boolean | null;
  vehicleType?: string | null;
  sellerType?: 'DEALER' | 'PRIVATE' | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type AuctionSort = 'ending_soon' | 'newest' | 'bid_low' | 'bid_high' | 'mileage_low' | 'mileage_high' | 'year_new' | 'year_old';

export const AUCTION_SORT_OPTIONS: { value: AuctionSort; label: string }[] = [
  // Same four web offers, with its default. "Ending soonest" is the right
  // default for auctions in a way "newest" never is — urgency is the point.
  { value: 'ending_soon', label: 'Ending soonest' },
  { value: 'newest', label: 'Newest listed' },
  { value: 'bid_low', label: 'Bid: low to high' },
  { value: 'bid_high', label: 'Bid: high to low' },
  { value: 'mileage_low', label: 'Mileage: low to high' },
  { value: 'mileage_high', label: 'Mileage: high to low' },
  { value: 'year_new', label: 'Year: newest first' },
  { value: 'year_old', label: 'Year: oldest first' },
];

export interface AuctionFilterState {
  makes: string[];
  model: string;
  variant: string;
  bodyTypes: string[];
  fuelTypes: string[];
  transmissions: string[];
  minYear: string;
  maxYear: string;
  minMileage: string;
  maxMileage: string;
  colour: string;
  minDoors: string;
  minSeats: string;
  minEngine: string;
  maxEngine: string;
  maxCo2: string;
  minCombinedMpg: string;
  maxZeroToSixty: string;
  driveType: string;
  minBhp: string;
  maxBhp: string;
  conditions: string[];
  exteriorGrades: number[];
  writeOffCategories: string[];
  ulezCompliant: '' | 'yes' | 'no';
  euroStandard: string;
  features: string[];
  sellerType: '' | 'DEALER' | 'PRIVATE';
  vehicleType: string;
  isImported: '' | 'yes' | 'no';
  maxDistanceMi: number | null;
  /** Current bid, not list price — the meaningful money figure on an auction. */
  minBid: string;
  maxBid: string;
  location: string;
  deliveryAvailable: boolean;
  sortBy: AuctionSort;
}

export const INITIAL_AUCTION_FILTERS: AuctionFilterState = {
  makes: [],
  model: '',
  variant: '',
  bodyTypes: [],
  fuelTypes: [],
  transmissions: [],
  minYear: '',
  maxYear: '',
  minMileage: '',
  maxMileage: '',
  colour: '',
  minDoors: '',
  minSeats: '',
  minEngine: '',
  maxEngine: '',
  maxCo2: '',
  minCombinedMpg: '',
  maxZeroToSixty: '',
  driveType: '',
  minBhp: '',
  maxBhp: '',
  conditions: [],
  exteriorGrades: [],
  writeOffCategories: [],
  ulezCompliant: '',
  euroStandard: '',
  features: [],
  sellerType: '',
  vehicleType: '',
  isImported: '',
  maxDistanceMi: null,
  minBid: '',
  maxBid: '',
  location: '',
  deliveryAvailable: false,
  sortBy: 'ending_soon',
};

/**
 * Normalises an enum-ish value for comparison.
 *
 * This matters more than it looks: the listings mapper emits display strings
 * ("Petrol", "Automatic", "SUV") for live auctions, but the upcoming-auctions
 * list renders straight off the raw backend payload, where the same fields are
 * enum members ("PETROL", "SEMI_AUTOMATIC", "ESTATE"). Comparing the two
 * directly silently matches nothing, which would look like a broken filter
 * rather than an empty result.
 */
const norm = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '');

const numOrNull = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** How many filter groups are active — drives the badge on the Filters button. */
export const countActiveAuctionFilters = (f: AuctionFilterState): number =>
  [
    f.makes.length > 0, !!f.model.trim(), !!f.variant.trim(),
    f.bodyTypes.length > 0, f.fuelTypes.length > 0, f.transmissions.length > 0,
    !!f.minYear || !!f.maxYear, !!f.minMileage || !!f.maxMileage,
    !!f.minBid || !!f.maxBid, !!f.colour.trim(), !!f.minDoors,
    !!f.minSeats, !!f.minEngine || !!f.maxEngine, !!f.maxCo2,
    !!f.minCombinedMpg, !!f.maxZeroToSixty, !!f.driveType,
    !!f.minBhp || !!f.maxBhp, f.conditions.length > 0,
    f.exteriorGrades.length > 0, f.writeOffCategories.length > 0,
    !!f.ulezCompliant, !!f.euroStandard, f.features.length > 0,
    !!f.sellerType, !!f.vehicleType, !!f.isImported,
    !!f.location.trim(), f.maxDistanceMi != null, f.deliveryAvailable,
  ].filter(Boolean).length;

/**
 * Does this listing pass the filters?
 *
 * `currentBid` is passed separately because it lives on the auction, not the
 * listing, and differs in shape between the live and upcoming lists.
 */
export const matchesAuctionFilters = (
  listing: FilterableListing,
  filters: AuctionFilterState,
  currentBid?: number | null,
  origin?: { latitude: number; longitude: number } | null,
): boolean => {
  const hasNumber = (value: number | null | undefined): value is number =>
    value != null && Number.isFinite(value);
  const matchesMinMax = (
    value: number | null | undefined,
    min: string,
    max: string,
  ): boolean => {
    const lower = numOrNull(min);
    const upper = numOrNull(max);
    if (lower == null && upper == null) return true;
    if (!hasNumber(value)) return false; // Not supplied ≠ zero.
    return (lower == null || value >= lower) && (upper == null || value <= upper);
  };
  if (filters.makes.length && !filters.makes.some(m => norm(m) === norm(listing.make))) return false;
  if (filters.model.trim() && !norm(listing.model).includes(norm(filters.model))) return false;
  if (filters.variant.trim() && !norm(listing.variant).includes(norm(filters.variant))) return false;
  if (filters.bodyTypes.length && !filters.bodyTypes.some(b => norm(b) === norm(listing.bodyType ?? listing.category))) return false;
  if (filters.fuelTypes.length && !filters.fuelTypes.some(x => norm(x) === norm(listing.fuelType))) return false;
  if (filters.transmissions.length && !filters.transmissions.some(x => norm(x) === norm(listing.transmission))) return false;
  if (!matchesMinMax(listing.year, filters.minYear, filters.maxYear)) return false;
  if (!matchesMinMax(listing.mileage, filters.minMileage, filters.maxMileage)) return false;
  if (!matchesMinMax(currentBid, filters.minBid, filters.maxBid)) return false;
  if (filters.colour.trim() && !norm(listing.colour ?? listing.color).includes(norm(filters.colour))) return false;
  if (!matchesMinMax(listing.doors, filters.minDoors, '')) return false;
  if (!matchesMinMax(listing.seats, filters.minSeats, '')) return false;
  if (!matchesMinMax(listing.engineSize, filters.minEngine, filters.maxEngine)) return false;
  if (!matchesMinMax(listing.co2Emissions, '', filters.maxCo2)) return false;
  if (!matchesMinMax(listing.combinedMpg, filters.minCombinedMpg, '')) return false;
  if (!matchesMinMax(listing.zeroToSixty && listing.zeroToSixty > 0 ? listing.zeroToSixty : null, '', filters.maxZeroToSixty)) return false;
  if (!matchesMinMax(listing.bhp, filters.minBhp, filters.maxBhp)) return false;
  if (filters.driveType && norm(listing.driveType) !== norm(filters.driveType)) return false;
  if (filters.conditions.length && !filters.conditions.some(x => norm(x) === norm(listing.condition))) return false;
  if (filters.exteriorGrades.length && (listing.exteriorGrade == null || !filters.exteriorGrades.includes(listing.exteriorGrade))) return false;
  if (filters.writeOffCategories.length && !filters.writeOffCategories.some(x => norm(x) === norm(listing.writeOffCategory))) return false;
  if (filters.ulezCompliant && listing.ulezCompliant !== (filters.ulezCompliant === 'yes')) return false;
  if (filters.euroStandard && norm(listing.euroStandard) !== norm(filters.euroStandard)) return false;
  if (filters.features.length && !filters.features.every(feature => (listing.features || []).some(x => norm(x) === norm(feature)))) return false;
  if (filters.sellerType && listing.sellerType !== filters.sellerType) return false;
  if (filters.vehicleType && norm(listing.vehicleType) !== norm(filters.vehicleType)) return false;
  if (filters.isImported && listing.isImported !== (filters.isImported === 'yes')) return false;
  if (filters.location.trim() && !norm(listing.location).includes(norm(filters.location))) return false;
  if (filters.deliveryAvailable && listing.deliveryAvailable !== true) return false;

  if (filters.maxDistanceMi != null) {
    const lat = listing.latitude;
    const lon = listing.longitude;
    if (!origin || !hasNumber(lat) || !hasNumber(lon)) return false;
    const rad = Math.PI / 180;
    const dLat = (lat - origin.latitude) * rad;
    const dLon = (lon - origin.longitude) * rad;
    const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(origin.latitude * rad) * Math.sin(dLon / 2) ** 2;
    const miles = 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(arc)));
    if (miles > filters.maxDistanceMi) return false;
  }
  return true;
};

/** Sort comparator for the auction lists. */
export const compareAuctions = <T extends { currentBid?: number | null; endsAt?: Date | string | null; createdAt?: string | null; mileage?: number | null; year?: number | null }>(
  sortBy: AuctionSort,
) => (a: T, b: T): number => {
  const time = (v: Date | string | null | undefined): number => {
    if (!v) return 0;
    const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  switch (sortBy) {
    case 'ending_soon': {
      // Auctions with no end time sort last rather than first — a missing date
      // reading as "ends at the epoch" would pin it to the top of the list.
      const ea = time(a.endsAt) || Number.MAX_SAFE_INTEGER;
      const eb = time(b.endsAt) || Number.MAX_SAFE_INTEGER;
      return ea - eb;
    }
    case 'newest':
      return time(b.createdAt) - time(a.createdAt);
    case 'bid_low':
      return (a.currentBid ?? 0) - (b.currentBid ?? 0);
    case 'bid_high':
      return (b.currentBid ?? 0) - (a.currentBid ?? 0);
    case 'mileage_low':
    case 'mileage_high': {
      const aMileage = a.mileage;
      const bMileage = b.mileage;
      if (aMileage == null) return bMileage == null ? 0 : 1;
      if (bMileage == null) return -1;
      return sortBy === 'mileage_low' ? aMileage - bMileage : bMileage - aMileage;
    }
    case 'year_new':
    case 'year_old': {
      if (a.year == null) return b.year == null ? 0 : 1;
      if (b.year == null) return -1;
      return sortBy === 'year_new' ? b.year - a.year : a.year - b.year;
    }
    default:
      return 0;
  }
};
