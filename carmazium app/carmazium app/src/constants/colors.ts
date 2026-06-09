// Carmazium – Brand Color System
// Dark-mode first, Crimson accent

export const Colors = {
  // Backgrounds
  bgPrimary: '#0A0A0C',
  bgSecondary: '#111115',
  bgTertiary: '#18181E',

  // Glass
  glassBg: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.20)',

  // Brand / Accent
  accent: '#DC1F26',
  accentGlow: '#FF2D35',
  accentDark: '#A01219',
  accentSubtle: 'rgba(220, 31, 38, 0.15)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0AB',
  textMuted: '#5C5C6B',
  textDisabled: '#3A3A47',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Overlays
  overlay40: 'rgba(0, 0, 0, 0.40)',
  overlay60: 'rgba(0, 0, 0, 0.60)',
  overlay80: 'rgba(0, 0, 0, 0.80)',

  // Tab bar
  tabBarBg: 'rgba(10, 10, 12, 0.92)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  tabActive: '#DC1F26',
  tabInactive: '#5C5C6B',

  // Input
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.10)',
  inputBorderFocused: '#DC1F26',
  inputPlaceholder: '#5C5C6B',
} as const;

export type ColorKey = keyof typeof Colors;
