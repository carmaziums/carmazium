// Carmazium – Spacing System
// Standardised spacing tokens to keep the app feeling open and breathable.

export const Spacing = {
  /** Horizontal padding for full-width screen containers */
  screenH: 24,
  /** Gap between major page sections */
  sectionGap: 36,
  /** Bottom margin under section headers */
  sectionHeaderMb: 18,
  /** Standard card inner padding */
  cardPad: 18,
  /** Smaller card inner padding (list rows, compact cards) */
  cardPadSm: 14,
  /** Gap between sibling list items */
  itemGap: 14,
  /** Horizontal scroll container padding (matches screenH) */
  hScrollPad: 24,
  /** Standard icon button size */
  iconBtn: 40,
  /** Section label (all-caps category) top margin */
  sectionLabelMt: 28,
} as const;

/**
 * Corner radii. From the design system's mobile kit (`M_TOKENS`) — the app
 * previously used 20px cards against the kit's 18, and picked radii ad hoc.
 */
export const Radius = {
  chip: 8,
  inline: 12,
  card: 18,
  sheet: 22,
  pill: 9999,
} as const;

/**
 * Elevation. React Native has no `box-shadow`, so each level ships the iOS
 * `shadow*` set and the Android `elevation` number together — using only one
 * gives you a shadow on a single platform, which is how the app ended up with
 * effectively no card elevation at all (only buttons had any). Web's card
 * identity is its shadow; mobile's cards were flat.
 *
 * Spread these into a style: `...Elevation.card`.
 */
export const Elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  cardHi: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 12,
  },
  /** Floating surfaces — the tab bar, sheets. */
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55,
    shadowRadius: 50,
    elevation: 20,
  },
  /** Red glow under a primary CTA. Android can't tint elevation, so the glow is
   *  iOS-only and Android falls back to a plain raise. */
  neon: {
    shadowColor: '#FF0037',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;

/** Blur intensities for `expo-blur`, matching the design system's glass scale. */
export const Blur = {
  glass: 18,
  strong: 24,
} as const;

/** Motion. Durations in ms; easings are bezier control points for Reanimated. */
export const Motion = {
  durFast: 150,
  durBase: 300,
  durSlow: 500,
  easeOut: [0.22, 1, 0.36, 1] as const,
  easeSpring: [0.34, 1.56, 0.64, 1] as const,
} as const;

// Row density presets — buyer surfaces stay spacious, but dealer/power-user
// surfaces (managing 30+ listings) reuse buyer-card padding today, which reads
// amateurish at scale (mobile-ui-ux-audit.md §C9).
export const RowDensity = {
  comfortable: { padding: 16, gap: 12, borderRadius: 18, rowHeight: 76 }, // buyer
  compact:     { padding: 10, gap: 8,  borderRadius: 10, rowHeight: 56 }, // dealer / power-user
} as const;
