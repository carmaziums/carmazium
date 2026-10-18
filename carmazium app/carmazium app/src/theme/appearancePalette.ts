import { Colors } from '../constants/colors';
import type { AppearanceMode } from '../store/appearanceStore';

/** Matches the public website's src/app/globals.css root and .dark tokens. */
const light = {
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
};
const dark = {
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
} as const;

export type AppearancePalette = typeof light;
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
