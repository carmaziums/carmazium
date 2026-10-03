import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SellWizardDraft {
  vrm: string;
  vehicleType: 'CAR' | 'HGV' | 'MOTORCYCLE';
  make: string; model: string; year: string; mileage: string; title: string;
  fuelType: string; transmission: string; bodyType: string; colour: string;
  price: string; priceMin: string; listingType: 'CLASSIFIED' | 'AUCTION' | '';
  // Retain every mandatory Step 1 answer across app restarts.
  location: string; description: string; condition: string; owners: string;
  writeOffCat: string; stolenRecovered: boolean | null;
  outstandingFinance: boolean | null; isLegalKeeper: boolean | null;
  notOwnerRelationship: string; notOwnerRelSelect: string; notOwnerRelOther: string;
  isDepartedSale: boolean; departedRelationship: string;
  departedRelSelect: string; departedRelOther: string; declAcknowledged: boolean;

  // Already-uploaded public URLs only; never temporary local file:// URIs.
  exteriorImages: string[]; interiorImages: string[]; damageImages: string[];
  lastStep: number;
  clearDraft: () => void;
  updateDraft: (partial: Partial<Omit<SellWizardDraft, 'clearDraft' | 'updateDraft'>>) => void;
}

export const EMPTY_SELL_DRAFT = {
  vrm: '', vehicleType: 'CAR' as const,
  make: '', model: '', year: '', mileage: '', title: '',
  fuelType: '', transmission: '', bodyType: '', colour: '',
  price: '', priceMin: '', listingType: '' as '' | 'CLASSIFIED' | 'AUCTION',
  location: '', description: '', condition: '', owners: '',
  writeOffCat: '', stolenRecovered: null as boolean | null,
  outstandingFinance: null as boolean | null, isLegalKeeper: null as boolean | null,
  notOwnerRelationship: '', notOwnerRelSelect: '', notOwnerRelOther: '',
  isDepartedSale: false, departedRelationship: '',
  departedRelSelect: '', departedRelOther: '', declAcknowledged: false,
  exteriorImages: [] as string[], interiorImages: [] as string[], damageImages: [] as string[],
  lastStep: 1,
};

export function nativeSellerDraftKey(userId: string): string | null {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(userId) ? `czm-sell-wizard-v2:${userId}` : null;
}

export const useSellWizardStore = create<SellWizardDraft>()(
  persist(
    (set) => ({
      ...EMPTY_SELL_DRAFT,
      clearDraft: () => set({ ...EMPTY_SELL_DRAFT }),
      updateDraft: (partial) => set((state) => ({ ...state, ...partial })),
    }),
    {
      // No draft is hydrated before authentication has identified its owner.
      name: 'czm-sell-wizard-unbound',
      skipHydration: true,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        vrm: state.vrm, vehicleType: state.vehicleType,
        make: state.make, model: state.model, year: state.year, mileage: state.mileage,
        title: state.title, fuelType: state.fuelType,
        transmission: state.transmission, bodyType: state.bodyType,
        colour: state.colour, price: state.price, priceMin: state.priceMin,
        listingType: state.listingType,
        location: state.location, description: state.description,
        condition: state.condition, owners: state.owners,
        writeOffCat: state.writeOffCat, stolenRecovered: state.stolenRecovered,
        outstandingFinance: state.outstandingFinance, isLegalKeeper: state.isLegalKeeper,
        notOwnerRelationship: state.notOwnerRelationship,
        notOwnerRelSelect: state.notOwnerRelSelect, notOwnerRelOther: state.notOwnerRelOther,
        isDepartedSale: state.isDepartedSale, departedRelationship: state.departedRelationship,
        departedRelSelect: state.departedRelSelect, departedRelOther: state.departedRelOther,
        declAcknowledged: state.declAcknowledged,
        exteriorImages: state.exteriorImages,
        interiorImages: state.interiorImages, damageImages: state.damageImages,
        lastStep: state.lastStep,
      }),
    },
  ),
);

// Serialization avoids overlapping hydration when sign-out/login happens quickly.
let activeDraftOwner: string | null = null;
let transitions: Promise<void> = Promise.resolve();
function queueDraftTransition(work: () => Promise<void>): Promise<void> {
  transitions = transitions.catch(() => {}).then(work);
  return transitions;
}

/** Returns false for an unauthenticated/invalid owner; never imports unowned drafts. */
export async function loadSellWizardDraftForUser(userId: string): Promise<boolean> {
  const storageKey = nativeSellerDraftKey(userId);
  if (!storageKey) return false;
  if (activeDraftOwner === userId && useSellWizardStore.persist.hasHydrated()) return true;
  await queueDraftTransition(async () => {
    if (activeDraftOwner === userId && useSellWizardStore.persist.hasHydrated()) return;
    useSellWizardStore.persist.setOptions({ name: 'czm-sell-wizard-unbound' });
    useSellWizardStore.setState({ ...EMPTY_SELL_DRAFT });
    activeDraftOwner = null;
    useSellWizardStore.persist.setOptions({ name: storageKey });
    await useSellWizardStore.persist.rehydrate();
    activeDraftOwner = userId;
    // Cannot attribute old drafts to their rightful account. Purge legacy key.
    await AsyncStorage.removeItem('czm-sell-wizard-draft');
  });
  return activeDraftOwner === userId;
}

/** Clears RAM on sign-out while retaining each owner's separately keyed draft. */
export async function detachSellWizardDraft(): Promise<void> {
  await queueDraftTransition(async () => {
    useSellWizardStore.persist.setOptions({ name: 'czm-sell-wizard-unbound' });
    useSellWizardStore.setState({ ...EMPTY_SELL_DRAFT });
    activeDraftOwner = null;
    await AsyncStorage.removeItem('czm-sell-wizard-draft');
  });
}
