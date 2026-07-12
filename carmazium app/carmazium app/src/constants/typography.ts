// Carmazium – Typography System

import { PixelRatio } from 'react-native';

/**
 * Scales a design-time font size by the user's system font-scale setting
 * (Settings → Display → Font size on Android, Dynamic Type on iOS), so text
 * doesn't clip when a user has cranked accessibility text scaling up
 * (mobile-ui-ux-audit.md §A-series Dynamic Type finding).
 */
export const scaledFontSize = (base: number): number => base * PixelRatio.getFontScale();

export const FontFamily = {
  // Body & UI Tones (Montserrat)
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  
  // Headings (Poppins)
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
  black: 'Poppins_800ExtraBold',

  // Mono Tones (JetBrains Mono)
  mono: 'JetBrainsMono_700Bold',
  monoExtraBold: 'JetBrainsMono_800ExtraBold',
  monoRegular: 'JetBrainsMono_400Regular',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 38,
  hero: 44,
  /** Dealer/power-user compact-row label (mobile-ui-ux-audit.md §C9) */
  rowLabel: 13,
  /** Dealer/power-user compact-row meta text */
  rowMeta: 11,
  // --- Auto-added by UI/UX Stage 2 font-size codemod (2026-07-11) ---
  size7: 7,
  size8: 8,
  size9: 9,
  size10: 10,
  size10_5: 10.5,
  size11_5: 11.5,
  size12: 12,
  size14: 14,
  size17: 17,
  size19: 19,
  size22: 22,
  size26: 26,
  size30: 30,
  size42: 42,
} as const;

export const LineHeight = {
  tight: 1.1,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,
} as const;

// Predefined text style presets
export const TextPresets = {
  heroDisplay: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.hero,
    lineHeight: FontSize.hero * LineHeight.tight,
    letterSpacing: LetterSpacing.tight,
  },
  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    lineHeight: FontSize['4xl'] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h2: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h3: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.normal,
  },
  bodyLarge: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * LineHeight.relaxed,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.relaxed,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    letterSpacing: LetterSpacing.wide,
  },
  caption: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.normal,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    letterSpacing: LetterSpacing.wide,
  },
} as const;
