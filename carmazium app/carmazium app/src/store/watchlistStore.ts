import { create } from 'zustand';
import { CarListing } from '../data/listings';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../lib/watchlistApi';

interface WatchlistState {
  /** Backend user identity: a watchlist must never outlive this session. */
  accountId: string | null;
  savedIds: Set<string>;
  savedListings: CarListing[];
  isLoading: boolean;
  loadError: string | null;
  bindAccount: (accountId: string | null) => void;
  hydrateFromApi: () => Promise<void>;
  save: (listing: CarListing) => void;
  unsave: (id: string) => void;
  toggle: (listing: CarListing) => void;
  isSaved: (id: string) => boolean;
}

// The sequence is module-local, not persisted; every account switch revokes
// permission for any in-flight request to update the next account's state.
let accountGeneration = 0;
let mutationSequence = 0;
const lastMutationById = new Map<string, number>();

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  accountId: null,
  savedIds: new Set(),
  savedListings: [],
  isLoading: false,
  loadError: null,

  bindAccount: (accountId) => {
    const next = accountId?.trim() || null;
    if (next === get().accountId) return;
    accountGeneration++;
    mutationSequence++;
    lastMutationById.clear();
    set({
      accountId: next,
      savedIds: new Set(),
      savedListings: [],
      isLoading: false,
      loadError: null,
    });
  },

  hydrateFromApi: async () => {
    const account = get().accountId;
    // Signed-out visitors may browse listings, but their saved-car heart
    // state cannot be hydrated from the previous authenticated account.
    if (!account) return;
    const generation = accountGeneration;
    const firstMutation = mutationSequence;
    set({ isLoading: true, loadError: null });
    try {
      const pageSize = 50;
      const allListings: CarListing[] = [];
      const seen = new Set<string>();
      let page = 1;
      let total = 0;
      do {
        const result = await getWatchlist(page, pageSize);
        if (generation !== accountGeneration || account !== get().accountId) return;
        total = result.total;
        for (const item of result.items) {
          if (item.mappedListing && !seen.has(item.mappedListing.id)) {
            seen.add(item.mappedListing.id);
            allListings.push(item.mappedListing);
          }
        }
        if (result.items.length === 0) break;
        page++;
      } while ((page - 1) * pageSize < total);

      // A save/remove that arrived during an in-flight hydrate wins over
      // the stale snapshot. On the next focus/refresh it will sync again.
      if (generation !== accountGeneration || account !== get().accountId ||
          firstMutation !== mutationSequence) return;
      set({
        savedListings: allListings,
        savedIds: new Set(allListings.map(l => l.id)),
      });
    } catch (error: any) {
      if (generation === accountGeneration && account === get().accountId) {
        set({ loadError: error?.message || 'Could not refresh saved cars. Please try again.' });
      }
      // Keep existing saved items on transient failure.
    } finally {
      if (generation === accountGeneration && account === get().accountId) {
        set({ isLoading: false });
      }
    }
  },

  save: (listing) => {
    const account = get().accountId;
    if (!account || get().savedIds.has(listing.id)) return;
    const generation = accountGeneration;
    const mutation = ++mutationSequence;
    lastMutationById.set(listing.id, mutation);
    set(state => {
      const savedIds = new Set(state.savedIds);
      savedIds.add(listing.id);
      return { savedIds, savedListings: [listing, ...state.savedListings], loadError: null };
    });
    void addToWatchlist(listing.id).catch(() => {
      // A failed earlier save cannot undo a newer remove/save, and an old
      // account's response may never change the next account's watchlist.
      if (generation !== accountGeneration || account !== get().accountId ||
          lastMutationById.get(listing.id) !== mutation) return;
      set(state => {
        const savedIds = new Set(state.savedIds);
        savedIds.delete(listing.id);
        return {
          savedIds,
          savedListings: state.savedListings.filter(l => l.id !== listing.id),
          loadError: 'Could not save this car. Please retry.',
        };
      });
    });
  },

  unsave: (id) => {
    const account = get().accountId;
    if (!account || !get().savedIds.has(id)) return;
    const generation = accountGeneration;
    const mutation = ++mutationSequence;
    lastMutationById.set(id, mutation);
    const removedListing = get().savedListings.find(l => l.id === id);
    set(state => {
      const savedIds = new Set(state.savedIds);
      savedIds.delete(id);
      return {
        savedIds,
        savedListings: state.savedListings.filter(l => l.id !== id),
        loadError: null,
      };
    });
    void removeFromWatchlist(id).catch(() => {
      if (generation !== accountGeneration || account !== get().accountId ||
          lastMutationById.get(id) !== mutation) return;
      set(state => {
        const savedIds = new Set(state.savedIds);
        savedIds.add(id);
        return {
          savedIds,
          savedListings: removedListing &&
            !state.savedListings.some(l => l.id === id)
            ? [removedListing, ...state.savedListings] : state.savedListings,
          loadError: 'Could not remove this saved car. Please retry.',
        };
      });
    });
  },

  toggle: (listing) => {
    const { savedIds, save, unsave } = get();
    savedIds.has(listing.id) ? unsave(listing.id) : save(listing);
  },

  isSaved: (id) => get().savedIds.has(id),
}));
