import { create } from 'zustand';
import { CarListing } from '../data/listings';
import { useAuthStore } from './authStore';
import { navigationRef } from '../lib/navigationRef';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../lib/watchlistApi';

interface WatchlistState {
  savedIds: Set<string>;
  savedListings: CarListing[];
  isLoading: boolean;
  loadError: string | null;

  // Actions
  hydrateFromApi: () => Promise<void>;
  save: (listing: CarListing) => void;
  unsave: (id: string) => void;
  toggle: (listing: CarListing) => void;
  isSaved: (id: string) => boolean;
}

let hydration = 0;

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  savedIds: new Set(),
  savedListings: [],
  isLoading: false,
  loadError: null,

  hydrateFromApi: async () => {
    // This store drives every heart icon across Search, Home and VehicleDetail,
    // so it must hydrate the complete watchlist rather than silently stopping
    // at an arbitrary first-page limit.
    const request = ++hydration;
    const userId = useAuthStore.getState().user?.id;
    set({ isLoading: true, loadError: null });
    try {
      const pageSize = 50;
      let page = 1;
      let total = 0;
      const allItems: Awaited<ReturnType<typeof getWatchlist>>['items'] = [];

      do {
        const result = await getWatchlist(page, pageSize);
        total = result.total;
        if (page > 100 || result.items.some(item => allItems.some(previous => previous.id === item.id))) throw Error('Incomplete watchlist');
        allItems.push(...result.items);

        if (result.items.length === 0) {
          if (allItems.length < total) throw Error('Incomplete watchlist');
          break;
        }
        page += 1;
      } while (allItems.length < total);

      if (request !== hydration || userId !== useAuthStore.getState().user?.id) return;
      const listings: CarListing[] = allItems
        .filter((item) => item.mappedListing != null)
        .map((item) => item.mappedListing!);
      const ids = new Set(listings.map((l) => l.id));
      set({ savedListings: listings, savedIds: ids });
    } catch {
      // Retain existing hearts, but do not claim a failed read is an empty collection.
      if (request === hydration && userId === useAuthStore.getState().user?.id) set({ loadError: 'Your saved cars could not be loaded. Please retry.' });
    } finally {
      if (request === hydration) set({ isLoading: false });
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
    // Saving needs an account. A guest tapping a heart (Home, Search,
    // VehicleDetail, auction cards) is offered Sign In instead of a silent
    // NO_SESSION revert; they return to the screen they were on afterwards.
    if (!useAuthStore.getState().isAuthenticated) {
      try {
        if (navigationRef.isReady()) {
          const route = navigationRef.getCurrentRoute();
          useAuthStore.getState().setPostLoginRedirect(
            route?.name ? { name: route.name, params: route.params as object | undefined } : null,
          );
          (navigationRef.navigate as (name: string, params?: object) => void)('Auth', { screen: 'Login' });
        }
      } catch {
        // Navigation not ready — nothing to save without an account anyway.
      }
      return;
    }
    const { savedIds, save, unsave } = get();
    savedIds.has(listing.id) ? unsave(listing.id) : save(listing);
  },

  isSaved: (id) => get().savedIds.has(id),
}));
