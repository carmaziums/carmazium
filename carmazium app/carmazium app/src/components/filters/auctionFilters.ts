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
}

export type AuctionSort = 'ending_soon' | 'newest' | 'bid_low' | 'bid_high';

export const AUCTION_SORT_OPTIONS: { value: AuctionSort; label: string }[] = [
  // Same four web offers, with its default. "Ending soonest" is the right
  // default for auctions in a way "newest" never is — urgency is the point.
  { value: 'ending_soon', label: 'Ending soonest' },
  { value: 'newest', label: 'Newest listed' },
  { value: 'bid_low', label: 'Bid: low to high' },
  { value: 'bid_high', label: 'Bid: high to low' },
];

export interface AuctionFilterState {
  makes: string[];
  model: string;
  bodyTypes: string[];
  fuelTypes: string[];
  transmissions: string[];
  minYear: string;
  maxYear: string;
  maxMileage: string;
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
  bodyTypes: [],
  fuelTypes: [],
  transmissions: [],
  minYear: '',
  maxYear: '',
  maxMileage: '',
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
    f.makes.length > 0,
    !!f.model.trim(),
    f.bodyTypes.length > 0,
    f.fuelTypes.length > 0,
    f.transmissions.length > 0,
    !!f.minYear || !!f.maxYear,
    !!f.maxMileage,
    !!f.minBid || !!f.maxBid,
    !!f.location.trim(),
    f.deliveryAvailable,
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
): boolean => {
  if (filters.makes.length && !filters.makes.some((m) => norm(m) === norm(listing.make))) {
    return false;
  }

  if (filters.model.trim() && !norm(listing.model).includes(norm(filters.model))) {
    return false;
  }

  const body = listing.bodyType ?? listing.category;
  if (filters.bodyTypes.length && !filters.bodyTypes.some((b) => norm(b) === norm(body))) {
    return false;
  }

  if (filters.fuelTypes.length && !filters.fuelTypes.some((x) => norm(x) === norm(listing.fuelType))) {
    return false;
  }

  if (
    filters.transmissions.length &&
    !filters.transmissions.some((x) => norm(x) === norm(listing.transmission))
  ) {
    return false;
  }

  const minYear = numOrNull(filters.minYear);
  const maxYear = numOrNull(filters.maxYear);
  if (minYear != null && (listing.year ?? 0) < minYear) return false;
  if (maxYear != null && (listing.year ?? 0) > maxYear) return false;

  const maxMileage = numOrNull(filters.maxMileage);
  if (maxMileage != null && (listing.mileage ?? 0) > maxMileage) return false;

  const minBid = numOrNull(filters.minBid);
  const maxBid = numOrNull(filters.maxBid);
  if (minBid != null && (currentBid ?? 0) < minBid) return false;
  if (maxBid != null && (currentBid ?? 0) > maxBid) return false;

  if (filters.location.trim() && !norm(listing.location).includes(norm(filters.location))) {
    return false;
  }

  // Only ever narrows. An unset toggle must not exclude listings whose
  // deliveryAvailable is simply absent from the payload.
  if (filters.deliveryAvailable && listing.deliveryAvailable !== true) return false;

  return true;
};

/** Sort comparator for the auction lists. */
export const compareAuctions = <T extends { currentBid?: number | null; endsAt?: Date | string | null; createdAt?: string | null }>(
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
    default:
      return 0;
  }
};
