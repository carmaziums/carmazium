import { create } from 'zustand';
import { CarListing } from '../data/listings';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../lib/watchlistApi';

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
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  savedIds: new Set(),
  savedListings: [],
  isLoading: false,

  hydrateFromApi: async () => {
    set({ isLoading: true });
    try {
      const { items } = await getWatchlist(1, 50);
      const listings: CarListing[] = items
        .filter((item) => item.mappedListing != null)
        .map((item) => item.mappedListing!);
      const ids = new Set(listings.map((l) => l.id));
      set({ savedListings: listings, savedIds: ids });
    } catch {
      // Keep existing state on network failure
    } finally {
      set({ isLoading: false });
    }
  },

  save: (listing) => {
    set((state) => {
      if (state.savedIds.has(listing.id)) return state;
      const newIds = new Set(state.savedIds);
      newIds.add(listing.id);
      return { savedIds: newIds, savedListings: [listing, ...state.savedListings] };
    });
    // Fire-and-forget sync with API
    addToWatchlist(listing.id).catch(() => {
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
    removeFromWatchlist(id).catch(() => {
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
