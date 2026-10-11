import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AppearancePreference,
  type NativeSemanticPalette,
  type ResolvedAppearance,
  getNativeSemanticPalette,
  NATIVE_DARK_THEME,
  resolveNativeAppearance,
} from './nativeTheme';

/**
 * Device-wide appearance setting, independent of the currently signed-in user.
 * Never store it on a remote profile or send it to a CarMazium API.
 *
 * Block 2 installs this context and loads preferences BEFORE mounting the app.
 * It does NOT recolour existing screens yet. Navigation/StatusBar and screen
 * components still consume their original dark Colors until Blocks 3–9.
 */
export const NATIVE_APPEARANCE_STORAGE_KEY = 'carmazium:native:appearance:v1';
export const NATIVE_APPEARANCE_HYDRATION_TIMEOUT_MS = 4000;

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export type NativeAppearanceState = Readonly<{
  preference: AppearancePreference;
  resolvedAppearance: ResolvedAppearance;
  palette: NativeSemanticPalette;
  isHydrated: boolean;
  /** Resolves true ONLY after native storage successfully saves this choice. */
  setAppearancePreference: (next: AppearancePreference) => Promise<boolean>;
}>;

const NativeAppearanceContext = createContext<NativeAppearanceState | null>(null);

export const NativeAppearanceProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  // Keep dark by default until all native screens support dynamic palettes.
  const [preference, setPreference] = useState<AppearancePreference>('dark');
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const mountedRef = useRef(false);
  // Serialize preference writes so rapid Light/Dark/System taps cannot leave
  // older writes in storage after newer choices.
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    mountedRef.current = true;
    hydratedRef.current = false;
    let cancelled = false;
    let settled = false;
    const settle = (value: unknown) => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timeout);
      // Corrupted/legacy storage falls back to dark, never partially light.
      setPreference(isAppearancePreference(value) ? value : 'dark');
      hydratedRef.current = true;
      setIsHydrated(true);
    };
    // Don't let a hung native storage read keep the app blank forever.
    // Ignore a late resolution after the safe dark fallback.
    const timeout = setTimeout(() => settle('dark'), NATIVE_APPEARANCE_HYDRATION_TIMEOUT_MS);
    void AsyncStorage.getItem(NATIVE_APPEARANCE_STORAGE_KEY)
      .then(settle, () => settle('dark'));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      mountedRef.current = false;
      hydratedRef.current = false;
    };
  }, []);

  const setAppearancePreference = useCallback(async (next: AppearancePreference): Promise<boolean> => {
    if (!isAppearancePreference(next) || !hydratedRef.current) return false;
    const write = writeQueue.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(NATIVE_APPEARANCE_STORAGE_KEY, next));
    // Preserve a non-rejecting tail so a failed write does not poison the queue.
    writeQueue.current = write.catch(() => undefined);
    try {
      await write;
      if (mountedRef.current) setPreference(next);
      return true;
    } catch {
      // No deceptive UI update: the previous saved preference stays active.
      return false;
    }
  }, []);

  const resolvedAppearance = resolveNativeAppearance(preference, systemColorScheme);
  const palette = getNativeSemanticPalette(resolvedAppearance);
  const value = useMemo<NativeAppearanceState>(() => ({
    preference, resolvedAppearance, palette, isHydrated, setAppearancePreference,
  }), [preference, resolvedAppearance, palette, isHydrated, setAppearancePreference]);

  // Hydrate before mounting app navigation so later theme-aware screens do
  // not flash the wrong theme on a cold start. Safe dark placeholder only.
  if (!isHydrated) {
    return <View testID="native-appearance-hydration" style={{ flex: 1, backgroundColor: NATIVE_DARK_THEME.bgBody }} />;
  }
  return (
    <NativeAppearanceContext.Provider value={value}>
      {children}
    </NativeAppearanceContext.Provider>
  );
};

export function useNativeAppearance(): NativeAppearanceState {
  const context = useContext(NativeAppearanceContext);
  if (!context) throw new Error('useNativeAppearance must be used within NativeAppearanceProvider');
  return context;
}
