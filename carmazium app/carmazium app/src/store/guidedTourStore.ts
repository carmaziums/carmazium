import { create } from 'zustand';

export const useGuidedTourStore = create<{
  openFor: string | null;
  replay: (userId: string) => void;
  close: () => void;
}>(set => ({
  openFor: null,
  replay: userId => set({ openFor: userId }),
  close: () => set({ openFor: null }),
}));
