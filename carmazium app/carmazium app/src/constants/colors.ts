// Carmazium – Brand Color System
// Dark-mode first, Crimson accent

export const Colors = {
  // Backgrounds — these three MUST stay literal copies of the web app's
  // dark-theme tokens (src/app/globals.css .dark block): --bg-body (#0f172a,
  // Tailwind slate-900), --color-secondary (#1e293b, slate-800), and one step
  // further down the same slate ramp (#334155, slate-700) for a third tier
  // web doesn't need (translucent bg-card layering) but RN does (opaque
  // surfaces only). Previously a flat, colder near-black (#0A0A0C/#111115/
  // #18181E) that drifted from web's actual blue-slate dark theme —
  // corrected 2026-08-10, do not reintroduce a separate near-black scale.
  bgPrimary: '#0f172a',
  bgSecondary: '#1e293b',
  bgTertiary: '#334155',

  // Glass
  glassBg: 'rgba(255, 255, 255, 0.06)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.20)',
  whiteAlpha07: 'rgba(255, 255, 255, 0.07)',
  whiteAlpha08: 'rgba(255, 255, 255, 0.08)',
  whiteAlpha09: 'rgba(255, 255, 255, 0.09)',
  // Stripe's native Payment Sheet `appearance.colors.*` requires hex
  // (#RRGGBB/#RRGGBBAA), not rgba() strings — passing whiteAlpha06/08 there
  // throws "Expected hex string of length 6 or 8" at runtime (TS's `string`
  // typing on those fields doesn't catch it). Same visual value as
  // whiteAlpha08/06, hex-encoded for that one consumer.
  whiteAlpha08Hex: '#FFFFFF14',
  whiteAlpha06Hex: '#FFFFFF0F',
  accentAlpha10: 'rgba(220, 31, 38, 0.10)',
  accentAlpha14: 'rgba(220, 31, 38, 0.14)',

  // Brand / Accent — matches the web app's --color-primary gradient
  // (#ED1C24 → #D9161D, brightening to #FF4D4D on hover/glow states).
  accent: '#ED1C24',
  accentGlow: '#FF4D4D',
  accentDark: '#D9161D',
  accentSubtle: 'rgba(237, 28, 36, 0.15)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0AB',
  // Bumped from #5C5C6B — that shade read under WCAG AA (~3.9:1 on bgSecondary,
  // worse than the 4.5:1 floor for normal text) per mobile-ui-ux-audit.md's
  // contrast finding. #787888 clears AA against both bgSecondary and bgPrimary.
  textMuted: '#787888',
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
  tabBarBg: 'rgba(15, 23, 42, 0.92)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  tabActive: '#DC1F26',
  tabInactive: '#5C5C6B',

  // Input
  inputBg: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.10)',
  inputBorderFocused: '#DC1F26',
  inputPlaceholder: '#5C5C6B',
  // --- Auto-added by UI/UX Stage 2 token codemod (2026-07-11) ---
  // Each token below maps to exactly one hex value found in src/screens|components|context —
  // no color values were changed, only moved from inline literals into named tokens.
  accentGreen: '#10B981',
  bgSecondaryAlt: '#111116',
  // Web's --border-default / --border-hover (dark theme) are rgba(255,255,255,0.1)
  // / rgba(255,255,255,0.2) — corrected 2026-08-10 from flat near-black hex
  // (#404050/#2A2A32) that didn't match web's actual glass-border system.
  borderMuted: 'rgba(255, 255, 255, 0.20)',
  borderSubtle: 'rgba(255, 255, 255, 0.10)',
  darkBlue_1a2238: '#1A2238',
  darkBlue_1c2033: '#1C2033',
  darkBlue_1d2030: '#1D2030',
  darkBlue_1e293b: '#1E293B',
  darkBlue_222636: '#222636',
  darkBlue_26262e: '#26262E',
  darkBlue_2a2a35: '#2A2A35',
  darkBlue_2a2a36: '#2A2A36',
  darkBlue_2a2e3d: '#2A2E3D',
  darkBlue_2a3047: '#2A3047',
  darkBlue_2b3252: '#2B3252',
  darkBlue_2d3c63: '#2D3C63',
  darkGreen: '#1A3B2F',
  darkGrey: '#3A3A42',
  darkPink_3b1e2b: '#3B1E2B',
  darkPink_521626: '#521626',
  darkPurple: '#302038',
  darkRed_3b2424: '#3B2424',
  darkRed_5c1d24: '#5C1D24',
  darkTeal: '#1A3330',
  darkYellow: '#806000',
  deepBlue_050507: '#050507',
  deepBlue_0d0d11: '#0D0D11',
  deepBlue_0d0d12: '#0D0D12',
  deepBlue_0f0f14: '#0F0F14',
  deepBlue_11131e: '#11131E',
  deepBlue_13131a: '#13131A',
  deepBlue_15151b: '#15151B',
  deepBlue_15192a: '#15192A',
  deepBlue_16161c: '#16161C',
  deepBlue_18181f: '#18181F',
  deepBlue_1a1a22: '#1A1A22',
  deepBlue_1a1a24: '#1A1A24',
  deepBlue_1b1d26: '#1B1D26',
  deepBlue_1c1c22: '#1C1C22',
  deepBlue_1c1c24: '#1C1C24',
  deepBlue_1c1d26: '#1C1D26',
  deepBlue_1e1e24: '#1E1E24',
  deepBlue_1e1e26: '#1E1E26',
  deepBlue_1e1e28: '#1E1E28',
  deepGreen: '#0B1713',
  deepNearBlack: '#111113',
  deepPink_221217: '#221217',
  deepPink_33111c: '#33111C',
  deepPurple: '#161118',
  deepYellow: '#16140A',
  iconMuted: '#606070',
  infoBlue: '#3B82F6',
  infoBlueLight: '#60A5FA',
  lightBlue_0084ff: '#0084FF',
  lightBlue_4285f4: '#4285F4',
  lightBlue_4fa8ff: '#4FA8FF',
  lightBlue_6366f1: '#6366F1',
  lightBlue_9ca3af: '#9CA3AF',
  lightBlue_a0a0b0: '#A0A0B0',
  lightGreen_34d399: '#34D399',
  lightGreen_4ade80: '#4ADE80',
  lightGreen_6ee7b7: '#6EE7B7',
  lightGrey: '#A8A8B3',
  lightOrange_f97316: '#F97316',
  lightOrange_fb923c: '#FB923C',
  lightOrange_fbbc05: '#FBBC05',
  lightOrange_fbbf24: '#FBBF24',
  lightPink: '#EC4899',
  lightPurple: '#A855F7',
  lightRed_ea4335: '#EA4335',
  lightRed_ff4444: '#FF4444',
  lightTeal_22d3ee: '#22D3EE',
  lightTeal_38bdf8: '#38BDF8',
  lightYellow: '#FCD34D',
  midBlue_1d4ed8: '#1D4ED8',
  midBlue_1e40af: '#1E40AF',
  midBlue_505060: '#505060',
  midBlue_6b7280: '#6B7280',
  midGreen_00d28e: '#00D28E',
  midGreen_34a853: '#34A853',
  midOrange_706050: '#706050',
  midOrange_a0783a: '#A0783A',
  midOrange_a0803a: '#A0803A',
  midOrange_b8860b: '#B8860B',
  midOrange_d4a017: '#D4A017',
  midPink: '#A21CAF',
  midTeal_06b6d4: '#06B6D4',
  midTeal_14b8a6: '#14B8A6',
  paleBlue_818cf8: '#818CF8',
  paleBlue_93c5fd: '#93C5FD',
  paleBlue_c0c0cb: '#C0C0CB',
  paleBlue_d0d0da: '#D0D0DA',
  paleBlue_e2e2ea: '#E2E2EA',
  paleGrey_c0c0c8: '#C0C0C8',
  paleGrey_cccccc: '#CCCCCC',
  paleNearWhite_e0e0e0: '#E0E0E0',
  paleNearWhite_e4e4e7: '#E4E4E7',
  palePurple_a78bfa: '#A78BFA',
  palePurple_c084fc: '#C084FC',
  paleRed_f87171: '#F87171',
  paleRed_fca5a5: '#FCA5A5',
  textFaint: '#8A8A93',

  // --- Alpha scale, added for the rgba() half of the UI/UX Stage 2 design-
  // token codemod (2026-07-11). Each token is white/accent/warning/infoBlue/
  // success/accentGreen/error/black/textSecondary at a fixed opacity that
  // appeared 3+ times verbatim in src/ before this pass — the long tail of
  // one-off opacities was left as inline rgba() rather than forcing every
  // value into a token. rgba(...,0) gradient stops were left alone too since
  // an alpha-0 token would lose the RGB channels gradients interpolate through.
  whiteAlpha02: 'rgba(255, 255, 255, 0.02)',
  whiteAlpha03: 'rgba(255, 255, 255, 0.03)',
  whiteAlpha04: 'rgba(255, 255, 255, 0.04)',
  whiteAlpha05: 'rgba(255, 255, 255, 0.05)',
  whiteAlpha06: 'rgba(255, 255, 255, 0.06)',
  whiteAlpha10: 'rgba(255, 255, 255, 0.10)',
  whiteAlpha12: 'rgba(255, 255, 255, 0.12)',
  whiteAlpha15: 'rgba(255, 255, 255, 0.15)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.20)',
  whiteAlpha50: 'rgba(255, 255, 255, 0.50)',

  accentAlpha03: 'rgba(220, 31, 38, 0.03)',
  accentAlpha04: 'rgba(220, 31, 38, 0.04)',
  accentAlpha05: 'rgba(220, 31, 38, 0.05)',
  accentAlpha06: 'rgba(220, 31, 38, 0.06)',
  accentAlpha08: 'rgba(220, 31, 38, 0.08)',
  accentAlpha12: 'rgba(220, 31, 38, 0.12)',
  accentAlpha15: 'rgba(220, 31, 38, 0.15)',
  accentAlpha20: 'rgba(220, 31, 38, 0.20)',
  accentAlpha22: 'rgba(220, 31, 38, 0.22)',
  accentAlpha25: 'rgba(220, 31, 38, 0.25)',
  accentAlpha30: 'rgba(220, 31, 38, 0.30)',
  accentAlpha40: 'rgba(220, 31, 38, 0.40)',

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

  successAlpha06: 'rgba(34, 197, 94, 0.06)',
  successAlpha08: 'rgba(34, 197, 94, 0.08)',
  successAlpha10: 'rgba(34, 197, 94, 0.10)',
  successAlpha12: 'rgba(34, 197, 94, 0.12)',
  successAlpha14: 'rgba(34, 197, 94, 0.14)',
  successAlpha15: 'rgba(34, 197, 94, 0.15)',
  successAlpha20: 'rgba(34, 197, 94, 0.20)',
  successAlpha25: 'rgba(34, 197, 94, 0.25)',

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

  textSecondaryAlpha20: 'rgba(160, 160, 171, 0.20)',
} as const;

export type ColorKey = keyof typeof Colors;
