// Carmazium – Typography System

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
