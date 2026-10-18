import { Colors } from '../constants/colors';
import type { AppearanceMode } from '../store/appearanceStore';

/** Matches the public website's src/app/globals.css root and .dark tokens. */
const light = {
  background: '#EEF5FB',
  card: '#FFFFFF',
  elevated: '#F7FBFF',
  input: '#E5EEF7',
  text: '#0F172A',
  secondary: '#334155',
  // 5.72:1 on page blue (#EEF5FB), 5.37:1 on input blue (#E5EEF7).
  muted: '#526177',
  border: '#D5E1EC',
  // Shared logo asset uses white lettering; keep navy header until a dark-letter logo variant is verified.
  header: '#1E293B',
  tab: '#FFFFFF',
};
const dark = {
  background: Colors.bgPrimary,
  card: Colors.bgCardSolid,
  elevated: Colors.bgSecondary,
  input: Colors.inputBg,
  text: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  border: Colors.borderSubtle,
  header: '#1E293B',
  tab: '#243047',
};
/**
 * High-contrast labels on pale/white surfaces. Brand accents remain unchanged
 * for dark mode and large filled buttons. Each text token meets 4.5:1 against
 * #EEF5FB, #F7FBFF and white.
 */
export const lightReadableText = {
  muted: '#526177',
  accent: '#CC1820',
  success: '#047857',
  warning: '#92400E',
  info: '#1D4ED8',
  error: '#B91C1C',
} as const;

export type AppearancePalette = typeof light;
export const appearancePalette = (mode: AppearanceMode): AppearancePalette =>
  mode === 'light' ? light : dark;

/**
 * Light mode must only override colours, never drop the original dimensions,
 * padding, layout or borders. A shallow map spread replaces the ENTIRE style
 * for a key (e.g. a stock card loses flexDirection and padding). Merge each
 * named style individually instead. Dark mode continues to use the untouched
 * original StyleSheet.
 */
export function mergeAppearanceStyles<T extends Record<string, object>>(
  base: T,
  overrides: Partial<Record<keyof T, object>>,
): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const patch = overrides[key];
    if (patch) result[key] = { ...base[key], ...patch } as T[typeof key];
  }
  return result;
}
