import { create } from 'zustand';
import {
  getAuctionShortlist,
  addAuctionToShortlist,
  removeAuctionFromShortlist,
} from '../lib/auctionShortlistApi';

/** Separate from retail Saved Cars. Account switches revoke old pending results. */
interface AuctionShortlistState {
  accountId: string | null;
  savedIds: Set<string>;
  busyIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  bindAccount: (id: string | null) => void;
  hydrateFromApi: () => Promise<void>;
  toggle: (listingId: string) => Promise<void>;
}

let accountGeneration = 0;

export const useAuctionShortlistStore = create<AuctionShortlistState>((set, get) => ({
  accountId: null,
  savedIds: new Set<string>(),
  busyIds: new Set<string>(),
  isLoading: false,
  error: null,

  bindAccount: (accountId) => {
    if (get().accountId === accountId) return;
    accountGeneration++;
    set({
      accountId, savedIds: new Set(), busyIds: new Set(),
      isLoading: false, error: null,
    });
  },

  hydrateFromApi: async () => {
    const accountId = get().accountId;
    if (!accountId || get().isLoading) return;
    const generation = accountGeneration;
    set({ isLoading: true, error: null });
    try {
      const ids: string[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await getAuctionShortlist(page, 50);
        if (generation !== accountGeneration || get().accountId !== accountId) return;
        total = result.total;
        ids.push(...result.listingIds);
        if (!result.listingIds.length) break;
        page += 1;
      } while (ids.length < total);
      if (generation === accountGeneration && get().accountId === accountId) {
        // A hydration response must not overwrite a newer local heart click.
        // Foreground refresh can retry once pending writes settle.
        if (get().busyIds.size === 0) set({ savedIds: new Set(ids), error: null });
      }
    } catch (err: any) {
      if (generation === accountGeneration && get().accountId === accountId) {
        set({ error: err?.message ?? 'Could not refresh auction shortlist.' });
      }
    } finally {
      if (generation === accountGeneration && get().accountId === accountId) {
        set({ isLoading: false });
      }
    }
  },

  toggle: async (listingId) => {
    const accountId = get().accountId;
    if (!accountId || get().busyIds.has(listingId)) return;
    const generation = accountGeneration;
    const wasSaved = get().savedIds.has(listingId);
    set(state => {
      const busyIds = new Set(state.busyIds);
      const savedIds = new Set(state.savedIds);
      busyIds.add(listingId);
      if (wasSaved) savedIds.delete(listingId);
      else savedIds.add(listingId);
      return { busyIds, savedIds, error: null };
    });
    try {
      if (wasSaved) await removeAuctionFromShortlist(listingId);
      else await addAuctionToShortlist(listingId);
    } catch (err: any) {
      if (generation === accountGeneration && get().accountId === accountId) {
        set(state => {
          const savedIds = new Set(state.savedIds);
          if (wasSaved) savedIds.add(listingId);
          else savedIds.delete(listingId);
          return { savedIds, error: err?.message ?? 'Could not update auction shortlist.' };
        });
      }
    } finally {
      if (generation === accountGeneration && get().accountId === accountId) {
        set(state => {
          const busyIds = new Set(state.busyIds);
          busyIds.delete(listingId);
          return { busyIds };
        });
      }
    }
  },
}));
