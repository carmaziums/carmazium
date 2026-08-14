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

/**
 * The type scale.
 *
 * -----------------------------------------------------------------------------
 * READ THIS BEFORE ADDING A SIZE
 * -----------------------------------------------------------------------------
 * The `sizeNN` block below was produced by the same 2026-07-11 codemod that
 * bloated `colors.ts`: it lifted every raw `fontSize:` literal into a token
 * without collapsing them, giving the app fourteen arbitrary sizes — including
 * 7px, 8px, 10.5px and 11.5px — alongside the real scale. Usage counts made it
 * worse than it looks: `size12` ×171, `size9` ×142, `size14` ×131, `size10`
 * ×109. The *majority* of text in the app was sized off the junk scale rather
 * than the designed one, which is a large part of why it read as amateur.
 *
 * Those names are now DEPRECATED ALIASES resolving onto the semantic scale
 * (`Type` below). Snapping is deliberately conservative — no alias moves by
 * more than 2px — so this collapses the scale without reflowing every screen.
 * Sub-9px text is gone entirely: 7px and 8px are below the legible floor on a
 * phone and were a big part of the "student project" read.
 *
 * Call sites migrate to `Type.*` names during the Phase 2 sweep; the alias
 * block is deleted once the last one is gone. Do not add to it.
 */
export const Type = {
  /** Smallest legible size. Dense dealer tables only. */
  nano: 9,
  /** Uppercase tracked eyebrow labels — the design system's signature label. */
  eyebrow: 10,
  /** Badges, chips, timestamps. */
  micro: 11,
  /** Secondary and meta text. */
  caption: 12,
  /** Form labels, compact rows. */
  label: 13,
  /** Default body copy. */
  body: 14,
  /** Emphasised body, list titles. */
  bodyLg: 16,
  h5: 18,
  h4: 20,
  h3: 22,
  h2: 26,
  h1: 32,
  display: 44,
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

  // --- DEPRECATED aliases (see the Type doc comment above) -------------------
  // Snapped onto the semantic scale. Max shift is +2px; nothing shrinks.
  size7: Type.nano,      // 7  → 9   (was below the legible floor)
  size8: Type.nano,      // 8  → 9   (same)
  size9: Type.eyebrow,   // 9  → 10
  size10: Type.micro,    // 10 → 11
  size10_5: Type.micro,  // 10.5 → 11
  size11_5: Type.caption,// 11.5 → 12
  size12: Type.caption,  // 12 → 12  (unchanged)
  size14: Type.body,     // 14 → 14  (unchanged)
  size17: Type.h5,       // 17 → 18
  size19: Type.h4,       // 19 → 20
  size22: Type.h3,       // 22 → 22  (unchanged)
  size26: Type.h2,       // 26 → 26  (unchanged)
  size30: Type.h1,       // 30 → 32
  size42: Type.display,  // 42 → 44
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

  // --- Design-system roles the app was missing entirely ----------------------
  // These three are core to the CarMazium look (see the design system's mobile
  // kit) and had no equivalent here, which is why the app read as untyped:
  // labels, prices and tab text were all just "small text".

  /**
   * Uppercase tracked eyebrow — the design system's signature label treatment.
   * Used above section headers, on card meta rows, and for chip text.
   */
  eyebrow: {
    fontFamily: FontFamily.extraBold,
    fontSize: Type.eyebrow,
    letterSpacing: 1.8, // ≈0.18em at 10px; RN letterSpacing is absolute, not em
    textTransform: 'uppercase' as const,
  },

  /**
   * Big mono price. Prices and countdowns are mono at heavy weight throughout
   * the brand. The design also gradient-clips this white→slate; RN can't
   * gradient-fill text directly, so that needs a MaskedView at the call site —
   * this preset is the solid-colour base.
   */
  monoPrice: {
    fontFamily: FontFamily.monoExtraBold,
    fontSize: Type.h2,
    letterSpacing: LetterSpacing.tight,
  },

  /** Smaller mono figure — inline prices, bid increments, timers. */
  monoFigure: {
    fontFamily: FontFamily.mono,
    fontSize: Type.bodyLg,
    letterSpacing: LetterSpacing.tight,
  },

  /** Bottom tab bar label. */
  tabLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: Type.nano,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
} as const;
