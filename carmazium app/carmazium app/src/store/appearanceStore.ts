import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppearanceMode = 'dark' | 'light';
const STORAGE_KEY = 'carmazium.appearance.v1';

interface AppearanceState {
  mode: AppearanceMode;
  initialized: boolean;
  initialize: () => Promise<void>;
  setMode: (next: AppearanceMode) => Promise<void>;
}

/**
 * Device-local preference: no backend/account mutation. Dark remains the
 * default for existing installs, and every screen must use semantic colours
 * before light appearance can be treated as release-ready.
 */
export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  mode: 'dark',
  initialized: false,
  initialize: async () => {
    if (get().initialized) return;
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') set({ mode: saved });
    } finally {
      set({ initialized: true });
    }
  },
  setMode: async next => {
    set({ mode: next });
    await AsyncStorage.setItem(STORAGE_KEY, next);
  },
}));
