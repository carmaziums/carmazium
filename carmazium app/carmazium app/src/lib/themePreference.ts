// Light / dark / system theme preference.
//
// The palette in constants/colors.ts is captured by ~140 module-level
// StyleSheet.create() calls, so the theme cannot be swapped under a mounted
// tree. Instead:
//   1. index.js calls initThemeFromPreference() BEFORE it requires App, so
//      every screen module evaluates against the chosen palette.
//   2. Changing the preference persists it and reloads the JS bundle
//      (reloadAppAsync from 'expo' — works in release builds, no expo-updates
//      round-trip needed).
// Website parity: next-themes with defaultTheme="light"
// (src/components/providers/ThemeProvider.tsx), so the default here is light.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { reloadAppAsync } from 'expo';
import { applyThemePalette, type ThemeMode } from '../constants/colors';

export const THEME_STORAGE_KEY = 'carmazium.theme';
export type ThemePreference = 'light' | 'dark' | 'system';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'light';

let currentPreference: ThemePreference = DEFAULT_THEME_PREFERENCE;

const isPreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

/** The preference the running bundle was started with. */
export function getThemePreference(): ThemePreference {
  return currentPreference;
}

export function resolveThemeMode(pref: ThemePreference): ThemeMode {
  if (pref === 'system') return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  return pref;
}

/**
 * Reads the saved preference, keeps native chrome (alerts, pickers, keyboard)
 * in step with it, and populates Colors. Never throws — on any storage
 * failure the app starts in the default theme.
 */
export async function initThemeFromPreference(): Promise<ThemeMode> {
  let pref: ThemePreference = DEFAULT_THEME_PREFERENCE;
  try {
    const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (isPreference(saved)) pref = saved;
  } catch {
    // Storage unavailable: fall back to the default.
  }
  currentPreference = pref;
  try {
    // An explicit choice overrides the OS scheme for native UI; 'system'
    // clears any override left by a previous explicit choice before reading.
    Appearance.setColorScheme(pref === 'system' ? null : pref);
  } catch {
    // Older native runtime without setColorScheme: palette still applies.
  }
  const mode = resolveThemeMode(pref);
  applyThemePalette(mode);
  return mode;
}

/** Persist a new preference and restart the JS bundle so it takes effect. */
export async function setThemePreferenceAndReload(pref: ThemePreference): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // If persisting fails the reload would just come back in the old theme.
    return;
  }
  currentPreference = pref;
  await reloadAppAsync('theme-change');
}
