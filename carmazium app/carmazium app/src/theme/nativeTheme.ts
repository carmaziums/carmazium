/**
 * CarMazium website ↔ native semantic colour contract.
 *
 * Values mirror src/app/globals.css, both :root and .dark.
 * Pure immutable palette: do not mutate the legacy static Colors singleton.
 * A later migration will move screens to useNativeTheme().
 *
 * The current native app must remain dark until navigation, forms, modals,
 * Mazium and every other user-facing screen can consume dynamic tokens.
 */
export type AppearancePreference = 'light' | 'dark' | 'system';
export type ResolvedAppearance = 'light' | 'dark';

export type NativeSemanticPalette = Readonly<{
  bgBody: string;
  bgCard: string;
  bgCardHover: string;
  bgHeader: string;
  bgInput: string;
  bgDropdown: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  borderDefault: string;
  borderHover: string;
  accent: string;
  accentForeground: string;
}>;

/** Website default :root palette (Cool Sky). */
export const NATIVE_LIGHT_THEME: NativeSemanticPalette = Object.freeze({
  bgBody: '#eef5fb',
  bgCard: '#ffffff',
  bgCardHover: '#f7fbff',
  bgHeader: 'rgba(255, 255, 255, 0.88)',
  bgInput: '#e5eef7',
  bgDropdown: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  borderDefault: '#d5e1ec',
  borderHover: '#b8cadd',
  accent: '#ed1c24',
  accentForeground: '#ffffff',
});

/** Website .dark palette. */
export const NATIVE_DARK_THEME: NativeSemanticPalette = Object.freeze({
  bgBody: '#1b2538',
  bgCard: 'rgba(51, 65, 85, 0.58)',
  bgCardHover: 'rgba(51, 65, 85, 0.72)',
  bgHeader: 'rgba(30, 41, 59, 0.84)',
  bgInput: 'rgba(51, 65, 85, 0.38)',
  bgDropdown: '#243047',
  textPrimary: '#ffffff',
  textSecondary: '#e2e8f0',
  textMuted: '#a3b1c4',
  textFaint: '#64748b',
  borderDefault: 'rgba(255, 255, 255, 0.14)',
  borderHover: 'rgba(255, 255, 255, 0.24)',
  accent: '#ed1c24',
  accentForeground: '#ffffff',
});

/**
 * Fail-safe resolver for persisted/platform preferences.
 * Invalid values stay DARK to preserve existing unconverted native screens.
 */
export function resolveNativeAppearance(
  preference: unknown,
  systemAppearance: 'light' | 'dark' | null | undefined,
): ResolvedAppearance {
  if (preference === 'light' || preference === 'dark') return preference;
  if (preference === 'system') return systemAppearance === 'light' ? 'light' : 'dark';
  return 'dark';
}

export function getNativeSemanticPalette(mode: ResolvedAppearance): NativeSemanticPalette {
  return mode === 'light' ? NATIVE_LIGHT_THEME : NATIVE_DARK_THEME;
}
