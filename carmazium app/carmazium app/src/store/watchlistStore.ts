import { create } from 'zustand';
import { CarListing } from '../data/listings';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../lib/watchlistApi';

// Hydration epoch changes for every refresh and local mutation. Account epoch
// additionally prevents late optimistic API failures from altering another
// user's saved cars after a logout/account switch.
let hydrateEpoch = 0;
let accountEpoch = 0;
// Each listing gets its own revision so a failed older request can never
// revert a more recent tap on that same saved-car heart.
const listingRevisions = new Map<string, number>();
// Serialize writes per vehicle. Without this, rapid save -> remove taps can
// reach the server out of order even if the heart shows the last action.
const pendingListingWrites = new Map<string, Promise<void>>();
function orderedWrite(id: string, operationAccount: number, write: () => Promise<void>): Promise<void> {
  const previous = pendingListingWrites.get(id) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(() => {
    // Never send an old account's still-queued write after an account switch.
    if (accountEpoch !== operationAccount) return;
    return write();
  });
  const settled = current.then(() => {}, () => {});
  pendingListingWrites.set(id, settled);
  void settled.then(() => {
    if (pendingListingWrites.get(id) === settled) pendingListingWrites.delete(id);
  });
  return current;
}

const nextListingRevision = (id: string): number => {
  const revision = (listingRevisions.get(id) ?? 0) + 1;
  listingRevisions.set(id, revision);
  return revision;
};

interface WatchlistState {
  savedIds: Set<string>;
  savedListings: CarListing[];
  isLoading: boolean;

  // Actions
  hydrateFromApi: () => Promise<void>;
  save: (listing: CarListing) => void;
  unsave: (id: string) => void;
  toggle: (listing: CarListing) => void;
  isSaved: (id: string) => boolean;
  reset: () => void;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  savedIds: new Set(),
  savedListings: [],
  isLoading: false,

  reset: () => {
    hydrateEpoch += 1;
    accountEpoch += 1;
    listingRevisions.clear();
    pendingListingWrites.clear();
    set({ savedIds: new Set(), savedListings: [], isLoading: false });
  },

  hydrateFromApi: async () => {
    const thisHydration = ++hydrateEpoch;
    // This store drives every heart icon across Search, Home and VehicleDetail,
    // so it must hydrate the complete watchlist rather than silently stopping
    // at an arbitrary first-page limit.
    set({ isLoading: true });
    try {
      // If a heart write is in flight, read AFTER it commits. Otherwise a
      // focus refresh can overwrite the newest optimistic state with an old
      // server snapshot from before the POST/DELETE finished.
      await Promise.all([...pendingListingWrites.values()]);
      if (thisHydration !== hydrateEpoch) return;
      const pageSize = 50;
      let page = 1;
      let total = 0;
      const allItems: Awaited<ReturnType<typeof getWatchlist>>['items'] = [];

      do {
        const result = await getWatchlist(page, pageSize);
        // Never continue pagination under a different account/session.
        if (thisHydration !== hydrateEpoch) return;
        total = result.total;
        allItems.push(...result.items);

        if (result.items.length === 0) break;
        page += 1;
      } while (allItems.length < total);

      const listings: CarListing[] = allItems
        .filter((item) => item.mappedListing != null)
        .map((item) => item.mappedListing!);
      const ids = new Set(listings.map((l) => l.id));
      if (thisHydration === hydrateEpoch) set({ savedListings: listings, savedIds: ids });
    } catch {
      // Keep existing state on network failure, including previous hearts.
    } finally {
      if (thisHydration === hydrateEpoch) set({ isLoading: false });
    }
  },

  save: (listing) => {
    if (get().savedIds.has(listing.id)) return;
    const operationRevision = nextListingRevision(listing.id);
    // A pre-save hydration must not overwrite a newer local user action.
    hydrateEpoch += 1;
    const operationAccount = accountEpoch;
    set({ isLoading: false });
    set((state) => {
      if (state.savedIds.has(listing.id)) return state;
      const newIds = new Set(state.savedIds);
      newIds.add(listing.id);
      return { savedIds: newIds, savedListings: [listing, ...state.savedListings] };
    });
    // Fire-and-forget sync with API
    orderedWrite(listing.id, operationAccount, () => addToWatchlist(listing.id)).catch(() => {
      // Ignore a response from an account that has since signed out.
      if (operationAccount !== accountEpoch ||
          listingRevisions.get(listing.id) !== operationRevision) return;
      // Revert optimistic update on failure
      set((state) => {
        const newIds = new Set(state.savedIds);
        newIds.delete(listing.id);
        return {
          savedIds: newIds,
          savedListings: state.savedListings.filter((l) => l.id !== listing.id),
        };
      });
    });
  },

  unsave: (id) => {
    if (!get().savedIds.has(id)) return;
    const operationRevision = nextListingRevision(id);
    hydrateEpoch += 1;
    const operationAccount = accountEpoch;
    set({ isLoading: false });
    // Capture the removed listing for potential rollback
    const removedListing = get().savedListings.find((l) => l.id === id);
    set((state) => {
      const newIds = new Set(state.savedIds);
      newIds.delete(id);
      return {
        savedIds: newIds,
        savedListings: state.savedListings.filter((l) => l.id !== id),
      };
    });
    // Fire-and-forget sync with API
    orderedWrite(id, operationAccount, () => removeFromWatchlist(id)).catch(() => {
      if (operationAccount !== accountEpoch ||
          listingRevisions.get(id) !== operationRevision) return;
      // Revert optimistic update on failure
      if (removedListing) {
        set((state) => {
          const newIds = new Set(state.savedIds);
          newIds.add(id);
          return {
            savedIds: newIds,
            savedListings: [removedListing, ...state.savedListings],
          };
        });
      }
    });
  },

  toggle: (listing) => {
    const { savedIds, save, unsave } = get();
    savedIds.has(listing.id) ? unsave(listing.id) : save(listing);
  },

  isSaved: (id) => get().savedIds.has(id),
}));
