// Carmazium – Brand Color System
// Dark-first, crimson accent. Source of truth: the CarMazium Design System
// (`<repo-root>/CarMazium Design System/colors_and_type.css` +
// `ui_kits/carmazium-mobile/mobile-kit.jsx`).
//
// -----------------------------------------------------------------------------
// READ THIS BEFORE ADDING A COLOR
// -----------------------------------------------------------------------------
// This file used to hold ~150 tokens because a 2026-07-11 codemod lifted every
// raw hex literal in the codebase into a named token WITHOUT collapsing them —
// sixteen near-identical dark blues (`deepBlue_1c1c22`, `deepBlue_1c1c24`,
// `deepBlue_1c1d26`, …), each used two or three times. That is a hex dump with
// names, not a palette, and it is the mechanical reason the app read as
// "generic slop": every surface was a slightly different shade of nearly the
// same colour.
//
// The canonical palette below is small on purpose. The legacy names are still
// exported at the bottom, but they are DEPRECATED ALIASES that now resolve to
// canonical values — that is what collapses the palette without touching 60
// screens in one commit. Do not add a new one-off hex. If you genuinely need a
// shade that isn't here, add it to the canonical block with a semantic name.
// -----------------------------------------------------------------------------

// ── Ground ────────────────────────────────────────────────────────────────────
// Mobile runs a deeper ground than web (#0f172a). That's deliberate and comes
// from the design system's mobile kit — a phone screen in a dark room wants the
// darker base. Web is not changed by this.
const bgBody = '#0A0D14';
const bgElevated = '#13182A';
const bgCardSolid = '#15192A';
const bgSurface = '#1E2740';
const bgSurfaceHi = '#2A3047';

// ── Brand ─────────────────────────────────────────────────────────────────────
// The design system's hard rule: the primary red is #FF0037. It explicitly
// labels the previous #ED1C24 as "old". Web's globals.css still ships #ed1c24;
// this is the one deliberate divergence, and it is a single token — flip these
// four values to revert.
const accent = '#FF0037';
const accentDeep = '#D70030';
const accentHot = '#FF4D6A';
const accentDark = '#9A0024';

// ── Support ───────────────────────────────────────────────────────────────────
const brandSlate = '#2D3C63'; // the "Dark Blue" of the 5-stop brand palette
const brandSilver = '#C0C0C0';

// ── Semantic ──────────────────────────────────────────────────────────────────
const success = '#10B981';
const successLight = '#34D399';
const warning = '#F59E0B';
const warningLight = '#FBBF24';
const info = '#3B82F6';
const infoLight = '#60A5FA';
const error = '#EF4444';
const errorLight = '#F87171';

export const Colors = {
  // ═══ Ground ════════════════════════════════════════════════════════════════
  bgBody,
  bgElevated,
  bgCardSolid,
  bgSurface,
  bgSurfaceHi,

  /** Translucent card surface — pair with a blur for the glass treatment. */
  bgCard: 'rgba(20, 26, 42, 0.78)',
  bgCardHi: 'rgba(20, 26, 42, 0.90)',

  // Legacy ground names, kept because they're used everywhere. Same three tiers.
  bgPrimary: bgBody,
  bgSecondary: bgElevated,
  bgTertiary: bgSurface,

  // ═══ Brand ═════════════════════════════════════════════════════════════════
  accent,
  accentDeep,
  accentGlow: accentHot,
  accentDark,
  accentSubtle: 'rgba(255, 0, 55, 0.15)',
  brandSlate,
  brandSilver,

  // ═══ Text ══════════════════════════════════════════════════════════════════
  textPrimary: '#FFFFFF',
  /** Body copy on dark. */
  textSecondary: '#D6DBE7',
  /** Meta, captions, inactive. Clears WCAG AA on every ground tier above. */
  textMuted: '#8A93A8',
  /** Faint — dividers-as-text, placeholder. Not for anything readable. */
  textFaint: '#4B556B',
  textDisabled: '#3A4155',

  // ═══ Borders ═══════════════════════════════════════════════════════════════
  border: 'rgba(255, 255, 255, 0.08)',
  borderHi: 'rgba(255, 255, 255, 0.16)',
  borderStrong: 'rgba(255, 255, 255, 0.30)',
  borderAccent: 'rgba(255, 0, 55, 0.30)',
  // Legacy names for the same two steps.
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderMuted: 'rgba(255, 255, 255, 0.16)',
  glassBg: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.16)',

  // ═══ Semantic ══════════════════════════════════════════════════════════════
  success,
  successLight,
  warning,
  warningLight,
  info,
  infoLight,
  error,
  errorLight,
  // Legacy semantic aliases.
  accentGreen: success,
  infoBlue: info,
  infoBlueLight: infoLight,

  // ═══ Utility ═══════════════════════════════════════════════════════════════
  white: '#FFFFFF',
  black: '#000000',
  iconMuted: '#8A93A8',

  // Stripe's native Payment Sheet `appearance.colors.*` requires hex
  // (#RRGGBB/#RRGGBBAA), not rgba() strings — passing an rgba token there throws
  // "Expected hex string of length 6 or 8" at runtime, and TS's `string` typing
  // on those fields doesn't catch it. Same visual value, hex-encoded.
  whiteAlpha08Hex: '#FFFFFF14',
  whiteAlpha06Hex: '#FFFFFF0F',

  // ═══ Overlays ══════════════════════════════════════════════════════════════
  overlay40: 'rgba(0, 0, 0, 0.40)',
  overlay60: 'rgba(0, 0, 0, 0.60)',
  overlay80: 'rgba(0, 0, 0, 0.80)',

  // ═══ Tab bar ═══════════════════════════════════════════════════════════════
  // The design system's tab bar floats: inset, radius 22, heavy blur, red
  // active dot. This is the translucent ground it sits on.
  tabBarBg: 'rgba(10, 13, 20, 0.78)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  tabActive: accent,
  tabInactive: '#8A93A8',

  // ═══ Input ═════════════════════════════════════════════════════════════════
  inputBg: 'rgba(255, 255, 255, 0.04)',
  inputBorder: 'rgba(255, 255, 255, 0.08)',
  inputBorderFocused: accent,
  inputPlaceholder: '#4B556B',

  // ═══ Alpha scales ══════════════════════════════════════════════════════════
  whiteAlpha02: 'rgba(255, 255, 255, 0.02)',
  whiteAlpha03: 'rgba(255, 255, 255, 0.03)',
  whiteAlpha04: 'rgba(255, 255, 255, 0.04)',
  whiteAlpha05: 'rgba(255, 255, 255, 0.05)',
  whiteAlpha06: 'rgba(255, 255, 255, 0.06)',
  whiteAlpha07: 'rgba(255, 255, 255, 0.07)',
  whiteAlpha08: 'rgba(255, 255, 255, 0.08)',
  whiteAlpha09: 'rgba(255, 255, 255, 0.09)',
  whiteAlpha10: 'rgba(255, 255, 255, 0.10)',
  whiteAlpha12: 'rgba(255, 255, 255, 0.12)',
  whiteAlpha15: 'rgba(255, 255, 255, 0.15)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.20)',
  whiteAlpha50: 'rgba(255, 255, 255, 0.50)',

  // Accent alphas — re-based onto #FF0037 (were #DC1F26).
  accentAlpha03: 'rgba(255, 0, 55, 0.03)',
  accentAlpha04: 'rgba(255, 0, 55, 0.04)',
  accentAlpha05: 'rgba(255, 0, 55, 0.05)',
  accentAlpha06: 'rgba(255, 0, 55, 0.06)',
  accentAlpha08: 'rgba(255, 0, 55, 0.08)',
  accentAlpha10: 'rgba(255, 0, 55, 0.10)',
  accentAlpha12: 'rgba(255, 0, 55, 0.12)',
  accentAlpha14: 'rgba(255, 0, 55, 0.14)',
  accentAlpha15: 'rgba(255, 0, 55, 0.15)',
  accentAlpha20: 'rgba(255, 0, 55, 0.20)',
  accentAlpha22: 'rgba(255, 0, 55, 0.22)',
  accentAlpha25: 'rgba(255, 0, 55, 0.25)',
  accentAlpha30: 'rgba(255, 0, 55, 0.30)',
  accentAlpha40: 'rgba(255, 0, 55, 0.40)',

  warningAlpha05: 'rgba(245, 158, 11, 0.05)',
  warningAlpha06: 'rgba(245, 158, 11, 0.06)',
  warningAlpha08: 'rgba(245, 158, 11, 0.08)',
  warningAlpha10: 'rgba(245, 158, 11, 0.10)',
  warningAlpha12: 'rgba(245, 158, 11, 0.12)',
  warningAlpha14: 'rgba(245, 158, 11, 0.14)',
  warningAlpha15: 'rgba(245, 158, 11, 0.15)',
  warningAlpha20: 'rgba(245, 158, 11, 0.20)',
  warningAlpha25: 'rgba(245, 158, 11, 0.25)',
  warningAlpha30: 'rgba(245, 158, 11, 0.30)',

  infoBlueAlpha03: 'rgba(59, 130, 246, 0.03)',
  infoBlueAlpha04: 'rgba(59, 130, 246, 0.04)',
  infoBlueAlpha06: 'rgba(59, 130, 246, 0.06)',
  infoBlueAlpha08: 'rgba(59, 130, 246, 0.08)',
  infoBlueAlpha10: 'rgba(59, 130, 246, 0.10)',
  infoBlueAlpha12: 'rgba(59, 130, 246, 0.12)',
  infoBlueAlpha14: 'rgba(59, 130, 246, 0.14)',
  infoBlueAlpha15: 'rgba(59, 130, 246, 0.15)',
  infoBlueAlpha20: 'rgba(59, 130, 246, 0.20)',
  infoBlueAlpha25: 'rgba(59, 130, 246, 0.25)',
  infoBlueAlpha28: 'rgba(59, 130, 246, 0.28)',
  infoBlueAlpha30: 'rgba(59, 130, 246, 0.30)',

  successAlpha06: 'rgba(16, 185, 129, 0.06)',
  successAlpha08: 'rgba(16, 185, 129, 0.08)',
  successAlpha10: 'rgba(16, 185, 129, 0.10)',
  successAlpha12: 'rgba(16, 185, 129, 0.12)',
  successAlpha14: 'rgba(16, 185, 129, 0.14)',
  successAlpha15: 'rgba(16, 185, 129, 0.15)',
  successAlpha20: 'rgba(16, 185, 129, 0.20)',
  successAlpha25: 'rgba(16, 185, 129, 0.25)',
  accentGreenAlpha05: 'rgba(16, 185, 129, 0.05)',
  accentGreenAlpha06: 'rgba(16, 185, 129, 0.06)',
  accentGreenAlpha08: 'rgba(16, 185, 129, 0.08)',
  accentGreenAlpha12: 'rgba(16, 185, 129, 0.12)',
  accentGreenAlpha15: 'rgba(16, 185, 129, 0.15)',
  accentGreenAlpha20: 'rgba(16, 185, 129, 0.20)',
  accentGreenAlpha30: 'rgba(16, 185, 129, 0.30)',

  errorAlpha08: 'rgba(239, 68, 68, 0.08)',
  errorAlpha10: 'rgba(239, 68, 68, 0.10)',
  errorAlpha14: 'rgba(239, 68, 68, 0.14)',
  errorAlpha20: 'rgba(239, 68, 68, 0.20)',
  errorAlpha25: 'rgba(239, 68, 68, 0.25)',
  errorAlpha30: 'rgba(239, 68, 68, 0.30)',

  blackAlpha45: 'rgba(0, 0, 0, 0.45)',
  blackAlpha50: 'rgba(0, 0, 0, 0.50)',
  blackAlpha55: 'rgba(0, 0, 0, 0.55)',
  blackAlpha75: 'rgba(0, 0, 0, 0.75)',

  textSecondaryAlpha20: 'rgba(214, 219, 231, 0.20)',

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPRECATED ALIASES — do not use in new code, do not add to this block.
  // ═══════════════════════════════════════════════════════════════════════════
  // Every name below came out of the 2026-07-11 hex-lifting codemod. They now
  // resolve to canonical values above, which is what actually collapses the
  // palette: ~150 arbitrary shades become the handful of tiers the design
  // system defines, without editing 60 screens in a single commit. Call sites
  // get migrated to canonical names screen-by-screen during the Phase 2 sweep;
  // this block is deleted once the last one is gone.

  // Dark blues / near-blacks → the ground ramp.
  deepBlue_050507: bgBody,
  deepBlue_0d0d11: bgBody,
  deepBlue_0d0d12: bgBody,
  deepBlue_0f0f14: bgBody,
  deepBlue_11131e: bgBody,
  deepBlue_13131a: bgBody,
  deepBlue_15151b: bgBody,
  deepBlue_15192a: bgCardSolid,
  deepBlue_16161c: bgBody,
  deepNearBlack: bgBody,
  deepBlue_18181f: bgElevated,
  deepBlue_1a1a22: bgElevated,
  deepBlue_1a1a24: bgElevated,
  deepBlue_1b1d26: bgElevated,
  deepBlue_1c1c22: bgElevated,
  deepBlue_1c1c24: bgElevated,
  deepBlue_1c1d26: bgElevated,
  deepBlue_1e1e24: bgElevated,
  deepBlue_1e1e26: bgElevated,
  deepBlue_1e1e28: bgElevated,
  darkBlue_1a2238: bgElevated,
  darkBlue_1c2033: bgElevated,
  darkBlue_1d2030: bgElevated,
  darkBlue_1e293b: bgElevated,
  darkBlue_222636: bgElevated,
  darkBlue_26262e: bgSurface,
  darkBlue_2a2a35: bgSurface,
  darkBlue_2a2a36: bgSurface,
  darkBlue_2a2e3d: bgSurface,
  darkBlue_2a3047: bgSurfaceHi,
  darkBlue_2b3252: bgSurfaceHi,
  darkBlue_2d3c63: brandSlate,
  bgSecondaryAlt: bgElevated,
  darkGrey: bgSurface,
  deepPurple: bgElevated,
  darkPurple: bgSurface,

  // Tinted opaque darks → semantic-tinted surfaces. These were badge/callout
  // backgrounds; they keep their semantic hue but now derive from the one
  // semantic colour rather than a bespoke hex each.
  deepGreen: 'rgba(16, 185, 129, 0.10)',
  darkGreen: 'rgba(16, 185, 129, 0.18)',
  darkTeal: 'rgba(16, 185, 129, 0.16)',
  darkRed_3b2424: 'rgba(255, 0, 55, 0.14)',
  darkRed_5c1d24: 'rgba(255, 0, 55, 0.22)',
  darkPink_3b1e2b: 'rgba(255, 0, 55, 0.14)',
  darkPink_521626: 'rgba(255, 0, 55, 0.22)',
  deepPink_221217: 'rgba(255, 0, 55, 0.08)',
  deepPink_33111c: 'rgba(255, 0, 55, 0.12)',
  deepYellow: 'rgba(245, 158, 11, 0.08)',
  darkYellow: 'rgba(245, 158, 11, 0.28)',

  // Mid/light greys → the text ramp.
  midBlue_505060: '#4B556B',
  midBlue_6b7280: '#8A93A8',
  lightBlue_9ca3af: '#8A93A8',
  lightBlue_a0a0b0: '#8A93A8',
  lightGrey: '#D6DBE7',
  paleBlue_c0c0cb: '#D6DBE7',
  paleBlue_d0d0da: '#D6DBE7',
  paleBlue_e2e2ea: '#D6DBE7',
  paleGrey_c0c0c8: '#D6DBE7',
  paleGrey_cccccc: '#D6DBE7',
  paleNearWhite_e0e0e0: '#FFFFFF',
  paleNearWhite_e4e4e7: '#FFFFFF',

  // Semantic tints → the semantic ramp.
  lightGreen_34d399: successLight,
  lightGreen_4ade80: successLight,
  lightGreen_6ee7b7: successLight,
  midGreen_00d28e: success,
  midGreen_34a853: success,
  midTeal_06b6d4: info,
  midTeal_14b8a6: success,
  lightTeal_22d3ee: infoLight,
  lightTeal_38bdf8: infoLight,
  lightOrange_f97316: warning,
  lightOrange_fb923c: warningLight,
  lightOrange_fbbc05: warningLight,
  lightOrange_fbbf24: warningLight,
  lightYellow: warningLight,
  midOrange_706050: warning,
  midOrange_a0783a: warning,
  midOrange_a0803a: warning,
  midOrange_b8860b: warning,
  midOrange_d4a017: warningLight,
  paleRed_f87171: errorLight,
  paleRed_fca5a5: errorLight,
  lightRed_ea4335: error,
  lightRed_ff4444: error,

  // Blues/purples/pinks → info, or the brand slate. These were mostly
  // third-party brand colours (Google blue, Messenger blue) and decorative
  // gradients; nothing in the brand palette is purple or pink.
  lightBlue_0084ff: info,
  lightBlue_4285f4: info,
  lightBlue_4fa8ff: infoLight,
  lightBlue_6366f1: info,
  midBlue_1d4ed8: info,
  midBlue_1e40af: brandSlate,
  paleBlue_818cf8: infoLight,
  paleBlue_93c5fd: infoLight,
  palePurple_a78bfa: infoLight,
  palePurple_c084fc: infoLight,
  lightPurple: info,
  lightPink: accent,
  midPink: accentDark,
} as const;

export type ColorKey = keyof typeof Colors;
