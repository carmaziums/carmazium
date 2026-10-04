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
let hydrationSequence = 0;
const lastMutationById = new Map<string, number>();
// Network writes for the same saved car must be ordered. A slow POST followed
// by a fast DELETE must not leave the car saved on the server while its native
// heart icon says it was removed.
const pendingWrites = new Map<string, Promise<void>>();

function enqueueWrite(
  listingId: string,
  generation: number,
  account: string,
  operation: () => Promise<void>,
  rollback: () => void,
) {
  const previous = pendingWrites.get(listingId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    if (generation !== accountGeneration || account !== useWatchlistStore.getState().accountId) return;
    await operation();
  }).catch(rollback).finally(() => {
    if (pendingWrites.get(listingId) === next) pendingWrites.delete(listingId);
  });
  pendingWrites.set(listingId, next);
}

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
    hydrationSequence++;
    lastMutationById.clear();
    pendingWrites.clear();
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
    // A later focus/refresh response must win if several requests overlap.
    const hydration = ++hydrationSequence;
    set({ isLoading: true, loadError: null });
    try {
      const pageSize = 50;
      const allListings: CarListing[] = [];
      const seen = new Set<string>();
      let page = 1;
      let total = 0;
      do {
        const result = await getWatchlist(page, pageSize);
        if (generation !== accountGeneration || account !== get().accountId ||
            hydration !== hydrationSequence) return;
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
          hydration !== hydrationSequence || firstMutation !== mutationSequence) return;
      set({
        savedListings: allListings,
        savedIds: new Set(allListings.map(l => l.id)),
      });
    } catch (error: any) {
      if (generation === accountGeneration && account === get().accountId &&
          hydration === hydrationSequence) {
        set({ loadError: error?.message || 'Could not refresh saved cars. Please try again.' });
      }
      // Keep existing saved items on transient failure.
    } finally {
      if (generation === accountGeneration && account === get().accountId &&
          hydration === hydrationSequence) {
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
    enqueueWrite(listing.id, generation, account, () => addToWatchlist(listing.id), () => {
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
    enqueueWrite(id, generation, account, () => removeFromWatchlist(id), () => {
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
