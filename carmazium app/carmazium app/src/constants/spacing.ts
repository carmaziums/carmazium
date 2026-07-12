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

// Row density presets — buyer surfaces stay spacious, but dealer/power-user
// surfaces (managing 30+ listings) reuse buyer-card padding today, which reads
// amateurish at scale (mobile-ui-ux-audit.md §C9).
export const RowDensity = {
  comfortable: { padding: 16, gap: 12, borderRadius: 18, rowHeight: 76 }, // buyer
  compact:     { padding: 10, gap: 8,  borderRadius: 10, rowHeight: 56 }, // dealer / power-user
} as const;
