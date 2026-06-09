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
