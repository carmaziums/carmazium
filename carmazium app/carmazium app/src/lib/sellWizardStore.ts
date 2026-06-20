import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SellWizardDraft {
  // Vehicle details
  make: string;
  model: string;
  year: string;
  mileage: string;
  title: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  colour: string;
  price: string;
  listingType: 'CLASSIFIED' | 'AUCTION' | '';

  // Images — only Supabase public URLs (never local file:// URIs)
  exteriorImages: string[];
  interiorImages: string[];
  damageImages: string[];

  // Wizard position
  lastStep: number;

  // Actions (excluded from persistence via partialize)
  clearDraft: () => void;
  updateDraft: (partial: Partial<Omit<SellWizardDraft, 'clearDraft' | 'updateDraft'>>) => void;
}

const INITIAL_STATE = {
  make: '',
  model: '',
  year: '',
  mileage: '',
  title: '',
  fuelType: '',
  transmission: '',
  bodyType: '',
  colour: '',
  price: '',
  listingType: '' as '' | 'CLASSIFIED' | 'AUCTION',
  exteriorImages: [] as string[],
  interiorImages: [] as string[],
  damageImages: [] as string[],
  lastStep: 1,
};

export const useSellWizardStore = create<SellWizardDraft>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      clearDraft: () => set({ ...INITIAL_STATE }),

      updateDraft: (partial) =>
        set((state) => ({ ...state, ...partial })),
    }),
    {
      name: 'czm-sell-wizard-draft',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist serializable fields — exclude function refs
      partialize: (state) => ({
        make: state.make,
        model: state.model,
        year: state.year,
        mileage: state.mileage,
        title: state.title,
        fuelType: state.fuelType,
        transmission: state.transmission,
        bodyType: state.bodyType,
        colour: state.colour,
        price: state.price,
        listingType: state.listingType,
        exteriorImages: state.exteriorImages,
        interiorImages: state.interiorImages,
        damageImages: state.damageImages,
        lastStep: state.lastStep,
      }),
    },
  ),
);
