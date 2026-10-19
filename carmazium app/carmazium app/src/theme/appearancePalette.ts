import { Colors } from '../constants/colors';
import type { AppearanceMode } from '../store/appearanceStore';

export type StatusBarTone = 'light-content' | 'dark-content';

export interface AppearancePalette {
  background: string;
  card: string;
  elevated: string;
  input: string;
  text: string;
  secondary: string;
  muted: string;
  border: string;
  header: string;
  tab: string;
  disabled: string;
  icon: string;
  switchTrackOff: string;
  accentSolid: string;
  onAccent: string;
  skeleton: string;
  statusBar: StatusBarTone;
}

/** Matches the public website's src/app/globals.css root and .dark tokens. */
const light: AppearancePalette = {
  background: '#EEF5FB',
  card: '#FFFFFF',
  elevated: '#F7FBFF',
  input: '#E5EEF7',
  text: '#0F172A',
  secondary: '#334155',
  // 5.72:1 on page blue (#EEF5FB), 5.37:1 on input blue (#E5EEF7).
  muted: '#526177',
  border: '#D5E1EC',
  // Shared logo asset uses white lettering; keep navy header until a dark-letter logo variant is verified.
  header: '#1E293B',
  tab: '#FFFFFF',
  // Disabled-but-understandable copy: 5.43:1 on cards, 4.93:1 on the page, distinct from
  // secondary (#334155) so the enabled/disabled difference stays visible.
  disabled: '#5B6B82',
  // Neutral glyphs (back chevrons, menu bars, row icons) on pale surfaces.
  icon: '#334155',
  // Switch "off" track: 3.46:1 against white, meeting the 3:1 UI-boundary rule.
  switchTrackOff: '#7C8BA1',
  // Solid brand fill that carries small white labels at 5.65:1. Colors.accent
  // (#ED1C24) only reaches 4.37:1 with white text, so light mode deepens it.
  accentSolid: Colors.accentDeep,
  onAccent: '#FFFFFF',
  skeleton: '#DCE6F0',
  statusBar: 'dark-content',
};
const dark: AppearancePalette = {
  background: Colors.bgPrimary,
  card: Colors.bgCardSolid,
  elevated: Colors.bgSecondary,
  input: Colors.inputBg,
  text: Colors.textPrimary,
  secondary: Colors.textSecondary,
  muted: Colors.textMuted,
  border: Colors.borderSubtle,
  header: '#1E293B',
  tab: '#243047',
  disabled: Colors.textMuted,
  icon: Colors.white,
  switchTrackOff: Colors.borderMuted,
  accentSolid: Colors.accent,
  onAccent: Colors.white,
  skeleton: Colors.bgTertiary,
  statusBar: 'light-content',
};
/**
 * High-contrast labels on pale/white surfaces. Brand accents remain unchanged
 * for dark mode and large filled buttons. Each text token meets 4.5:1 against
 * #EEF5FB, #F7FBFF and white.
 */
export const lightReadableText = {
  muted: '#526177',
  accent: '#CC1820',
  success: '#047857',
  warning: '#92400E',
  info: '#1D4ED8',
  error: '#B91C1C',
  purple: '#6D28D9',
  pink: '#BE185D',
} as const;

// ─── Foreground colour translation for light mode ──────────────────────────
// Most screens were written against the dark palette and pass colours inline
// (`<Ionicons color={Colors.textMuted} />`, `{ color: Colors.success }`).
// themedColor() keeps the exact dark value in dark mode and returns the
// readable light-mode equivalent of the same role in light mode, so a call
// site changes from `Colors.success` to `tc(Colors.success)` and dark mode is
// byte-for-byte unchanged.
//
// Only use it for colours drawn on the PAGE / CARD surface. Foreground on a
// solid brand or semantic fill (white on a red CTA) must stay as it is.

const parseRgb = (c: string): [number, number, number, number] | null => {
  const v = c.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const p = rgb[1].split(',').map(x => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
};

const ACCENT_FAMILY = new Set<string>([Colors.accent, Colors.accentDeep, '#FF0037'].map(c => c.toUpperCase()));

/** Light-mode equivalent of a dark-mode foreground colour. Pure; exported for tests. */
export function toLightForeground(color: string): string {
  if (typeof color !== 'string') return color;
  if (ACCENT_FAMILY.has(color.toUpperCase())) return lightReadableText.accent;
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const [r, g, b, a] = rgb;
  // Composite translucent colours over the dark page they were designed for.
  const base = parseRgb(Colors.bgPrimary) ?? [27, 37, 56, 1];
  const [R, G, B] = [r, g, b].map((v, i) => v * a + base[i] * (1 - a));
  const max = Math.max(R, G, B) / 255;
  const min = Math.min(R, G, B) / 255;
  const chroma = max - min;
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(R) + 0.7152 * lin(G) + 0.0722 * lin(B);
  // Already dark enough to read on a pale surface: leave it alone.
  if (lum < 0.09) return color;
  if (chroma < 0.18) { // slate greys carry a slight blue tint (#A3B1C4 = 0.13)
    // Neutral: white is primary copy, light slate (#E2E8F0) secondary copy,
    // anything dimmer was muted/disabled copy.
    if (lum >= 0.9) return light.text;
    if (lum >= 0.6) return light.secondary;
    return light.muted;
  }
  let hue = 0;
  const d = chroma;
  const rn = R / 255, gn = G / 255, bn = B / 255;
  if (max === rn) hue = ((gn - bn) / d) % 6;
  else if (max === gn) hue = (bn - rn) / d + 2;
  else hue = (rn - gn) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 15 || hue >= 345) return lightReadableText.error;
  if (hue < 65) return lightReadableText.warning;
  if (hue < 175) return lightReadableText.success;
  if (hue < 255) return lightReadableText.info;
  if (hue < 300) return lightReadableText.purple;
  return lightReadableText.pink;
}

/**
 * Deeper text for semantic labels sitting on their own pale tint (a red label
 * in a 15%-red pill reaches only ~4.3:1 with lightReadableText). 7:1+ on the
 * tints and on white.
 */
export const lightStrongText = {
  accent: '#991B1B',
  error: '#991B1B',
  warning: '#78350F',
  success: '#065F46',
  info: '#1E3A8A',
  purple: '#5B21B6',
  pink: '#9D174D',
} as const;

/**
 * Solid semantic fills that carry a WHITE label at 4.5:1+ in light mode.
 * The dark-mode fills (#10B981 green 2.5:1, #F59E0B amber 2.2:1 with white)
 * stay untouched in dark mode — see the audit report for that decision.
 */
export const lightSolidFill = {
  success: '#047857',
  warning: '#B45309',
  info: '#1D4ED8',
  error: '#B91C1C',
  purple: '#6D28D9',
} as const;

const hueFamily = (color: string): keyof typeof lightSolidFill | 'neutral' | null => {
  const out = toLightForeground(color);
  if (out === lightReadableText.success) return 'success';
  if (out === lightReadableText.warning) return 'warning';
  if (out === lightReadableText.info) return 'info';
  if (out === lightReadableText.error || out === lightReadableText.accent) return 'error';
  if (out === lightReadableText.purple || out === lightReadableText.pink) return 'purple';
  if (out === light.text || out === light.secondary || out === light.muted) return 'neutral';
  return null;
};

/** Stronger light-mode text for a semantic label on its own tinted chip. */
export function toLightStrongForeground(color: string): string {
  if (ACCENT_FAMILY.has(color.toUpperCase())) return lightStrongText.accent;
  const fam = hueFamily(color);
  if (fam === 'neutral') return light.text;
  if (fam === 'error') return lightStrongText.error;
  return fam ? lightStrongText[fam] : toLightForeground(color);
}

/** Light-mode solid fill that keeps a white label readable. */
export function toLightFill(color: string): string {
  const fam = hueFamily(color);
  return fam && fam !== 'neutral' ? lightSolidFill[fam] : color;
}

/**
 * Light-mode surface for a dark neutral fill (navy cards, slate inputs,
 * translucent dark panels). Chromatic or already-light fills are returned
 * unchanged.
 */
export function toLightSurface(color: string, kind: 'card' | 'elevated' = 'card'): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const [r, g, b] = rgb;
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const isWhiteAlpha = r > 240 && g > 240 && b > 240 && rgb[3] < 0.3;
  if (isWhiteAlpha || (lum < 0.12 && chroma < 0.25)) return kind === 'card' ? light.card : light.elevated;
  return color;
}

export function themedSurface(mode: AppearanceMode, color: string, kind: 'card' | 'elevated' = 'card'): string {
  return mode === 'light' ? toLightSurface(color, kind) : color;
}

export function themedFill(mode: AppearanceMode, color: string): string {
  return mode === 'light' ? toLightFill(color) : color;
}

export function themedColor(mode: AppearanceMode, color: string): string {
  return mode === 'light' ? toLightForeground(color) : color;
}

export const appearancePalette = (mode: AppearanceMode): AppearancePalette =>
  mode === 'light' ? light : dark;

/**
 * Light mode must only override colours, never drop the original dimensions,
 * padding, layout or borders. A shallow map spread replaces the ENTIRE style
 * for a key (e.g. a stock card loses flexDirection and padding). Merge each
 * named style individually instead. Dark mode continues to use the untouched
 * original StyleSheet.
 */
export function mergeAppearanceStyles<T extends Record<string, object>>(
  base: T,
  overrides: Partial<Record<keyof T, object>>,
): T {
  const result = { ...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const patch = overrides[key];
    if (patch) result[key] = { ...base[key], ...patch } as T[typeof key];
  }
  return result;
}

/**
 * Transitional semantic palette for legacy screens that still hold their
 * dark-mode StyleSheet in a single file. Preserves EVERY base layout property.
 * Only neutral text/surface/border tokens are mapped. Never recolour warning,
 * success, error or brand-filled actions (including text on red CTA buttons).
 *
 * This is a safety net, not a substitute for individual page visual QA:
 * gradients, inline styles, images and third-party components need inspection.
 */
export function adaptLegacyLightStyles<T extends Record<string, object>>(base: T): T {
  const patch: Partial<Record<keyof T, object>> = {};
  const rootBackgrounds = new Set<string>([Colors.bgPrimary, Colors.bgBody]);
  const lightCards = new Set<string>([
    Colors.bgSecondary, Colors.bgTertiary, Colors.bgCardSolid, Colors.bgSurface, Colors.bgSurfaceHi,
    Colors.bgCard, Colors.bgCardHi, Colors.bgElevated, Colors.inputBg,
    // Legacy "glass" cards rely on a near-white alpha over navy; on light pages
    // that alpha is virtually invisible. Convert neutral glass surfaces into cards.
    Colors.glassBg, Colors.whiteAlpha02, Colors.whiteAlpha03, Colors.whiteAlpha04,
    Colors.whiteAlpha05, Colors.whiteAlpha06, Colors.whiteAlpha07,
    Colors.whiteAlpha08, Colors.whiteAlpha09, Colors.whiteAlpha10,
    Colors.whiteAlpha12,
  ]);
  const neutralBorders = new Set<string>([Colors.border, Colors.borderHi, Colors.borderStrong,
    Colors.borderSubtle, Colors.borderMuted, Colors.glassBorder, Colors.glassBorderStrong,
    Colors.inputBorder]);
  const legacyPaleText = new Set<string>([
    Colors.lightGrey, Colors.paleBlue_c0c0cb, Colors.paleBlue_d0d0da,
    Colors.paleBlue_e2e2ea, Colors.paleGrey_c0c0c8, Colors.paleGrey_cccccc,
    Colors.lightBlue_9ca3af, Colors.lightBlue_a0a0b0,
  ]);
  const legacyPlaceholder = new Set<string>([
    Colors.textDisabled, Colors.inputPlaceholder, Colors.borderMuted,
  ]);
  for (const [name, raw] of Object.entries(base)) {
    if (!raw || typeof raw !== 'object') continue;
    const value = raw as Record<string, unknown>;
    const changes: Record<string, string> = {};
    const id = name.toLowerCase();
    const bg = value.backgroundColor;
    const action = /(?:primary|danger|success|error|warning|active|selected|brand|accent|submit|publish|confirm|cancel|red|green|blue|badge|status|trophy|avatar|photo|overlay|image|btn|button|cta|fab)/.test(id);
    if (!action && typeof bg === 'string' && rootBackgrounds.has(bg)) {
      changes.backgroundColor = light.background;
    } else if (!action && typeof bg === 'string' && lightCards.has(bg)) {
      changes.backgroundColor = /input|field|search|picker/.test(id) ? light.elevated : light.card;
    }
    // Back/icon buttons frequently contain an inline WHITE icon rather than a
    // Text style. Keep their neutral glass surface dark so the icon stays legible
    // even when a page switches to a pale background. Custom light-screen icon
    // overrides remain authoritative where supplied by the owning screen.
    if (/^(?:back|close|icon|bell|menu)(?:btn|button)/.test(id)
        && typeof bg === 'string'
        && (lightCards.has(bg) || bg === Colors.whiteAlpha05)) {
      changes.backgroundColor = light.header;
    }
    if (!action && typeof value.borderColor === 'string' && neutralBorders.has(value.borderColor)) {
      changes.borderColor = light.border;
    }
    if (!action && typeof value.borderBottomColor === 'string' && neutralBorders.has(value.borderBottomColor)) {
      changes.borderBottomColor = light.border;
    }
    if (!action && typeof value.borderTopColor === 'string' && neutralBorders.has(value.borderTopColor)) {
      changes.borderTopColor = light.border;
    }
    const textLike = /(?:title|label|text|heading|subtitle|subtext|body|desc|hint|value|amount|meta|date|name|copy|price|caption|placeholder|eyebrow|detail|paragraph|message)/.test(id);
    // Do not convert foreground white on brand/CTA/selected chip fills:
    // only plain typography and muted secondary text are safe to remap.
    if (textLike && !action) {
      if (value.color === Colors.textPrimary || value.color === Colors.white ||
          value.color === Colors.paleNearWhite_e0e0e0 || value.color === Colors.paleNearWhite_e4e4e7) {
        changes.color = light.text;
      } else if (value.color === Colors.textSecondary) {
        changes.color = light.secondary;
      } else if (value.color === Colors.textMuted || value.color === Colors.textFaint ||
                 value.color === Colors.iconMuted ||
                 (typeof value.color === 'string' &&
                  (legacyPaleText.has(value.color) || legacyPlaceholder.has(value.color)))) {
        changes.color = light.muted;
      } else if (value.color === Colors.paleBlue_93c5fd || value.color === Colors.infoBlueLight) {
        changes.color = lightReadableText.info;
      } else if (value.color === Colors.accent || value.color === Colors.accentDeep) {
        changes.color = lightReadableText.accent;
      } else if (value.color === Colors.warning || value.color === Colors.warningLight) {
        changes.color = lightReadableText.warning;
      } else if (value.color === Colors.success || value.color === Colors.successLight) {
        changes.color = lightReadableText.success;
      } else if (value.color === Colors.error || value.color === Colors.errorLight) {
        changes.color = lightReadableText.error;
      }
    }
    // Text on warning/info callout cards also needs a readable foreground.
    // Do not include filled buttons, selected chips or brand CTA labels.
    const semanticCopy = /(?:warning|error|success|info)(?:text|label|hint|desc)$/.test(id);
    if (semanticCopy && !/(?:btn|button|cta|badge|chip|pill|active|selected)/.test(id)) {
      if (value.color === Colors.warning || value.color === Colors.warningLight) changes.color = lightReadableText.warning;
      if (value.color === Colors.error || value.color === Colors.errorLight) changes.color = lightReadableText.error;
      if (value.color === Colors.success || value.color === Colors.successLight) changes.color = lightReadableText.success;
      if (value.color === Colors.info || value.color === Colors.infoLight) changes.color = lightReadableText.info;
    }
    if (Object.keys(changes).length) patch[name as keyof T] = changes;
  }
  return mergeAppearanceStyles(base, patch);
}
