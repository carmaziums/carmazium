/**
 * Contrast regression tests for the semantic appearance tokens.
 *
 * Every screen fix in the light-mode audit routes colours through
 * appearancePalette(); if someone later lightens a token, these fail before
 * the regression reaches a phone. Thresholds are WCAG 2.2 AA:
 * 4.5:1 body text, 3:1 large text / UI component boundaries and icons.
 */
import { Colors } from '../../constants/colors';
import { appearancePalette, lightReadableText } from '../appearancePalette';

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const light = appearancePalette('light');
const dark = appearancePalette('dark');
const lightSurfaces = [light.background, light.card, light.elevated];
const darkSurfaces = [dark.background, dark.card, dark.elevated];

describe('light appearance tokens', () => {
  it.each(['text', 'secondary', 'muted', 'disabled'] as const)('%s meets 4.5:1 on every light surface', token => {
    for (const surface of lightSurfaces) {
      expect(contrast(light[token], surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('icons meet 3:1 on every light surface', () => {
    for (const surface of lightSurfaces) expect(contrast(light.icon, surface)).toBeGreaterThanOrEqual(3);
  });

  it('switch off-track meets the 3:1 component boundary on cards', () => {
    expect(contrast(light.switchTrackOff, light.card)).toBeGreaterThanOrEqual(3);
  });

  it('white label on the solid brand fill meets 4.5:1', () => {
    expect(contrast(light.onAccent, light.accentSolid)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.keys(lightReadableText) as (keyof typeof lightReadableText)[])(
    'readable %s text meets 4.5:1 on every light surface',
    token => {
      for (const surface of lightSurfaces) {
        expect(contrast(lightReadableText[token], surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('disabled copy stays visibly distinct from enabled copy', () => {
    expect(contrast(light.secondary, light.disabled)).toBeGreaterThanOrEqual(1.5);
  });

  it('uses dark status-bar glyphs', () => {
    expect(light.statusBar).toBe('dark-content');
  });

  // The defects in the original Team screenshot, pinned so they cannot return.
  it('the dark-only text tokens really are unreadable on white (why screens must not use them in light mode)', () => {
    expect(contrast(Colors.textSecondary, light.card)).toBeLessThan(1.5);
    expect(contrast(Colors.textMuted, light.card)).toBeLessThan(3);
    expect(contrast(Colors.white, light.card)).toBeLessThan(1.1);
  });
});

describe('dark appearance tokens are unchanged and readable', () => {
  it.each(['text', 'secondary', 'muted'] as const)('%s meets 4.5:1 on dark surfaces', token => {
    for (const surface of [dark.background, dark.elevated]) {
      expect(contrast(dark[token], surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the original dark tokens', () => {
    expect(dark.text).toBe(Colors.textPrimary);
    expect(dark.secondary).toBe(Colors.textSecondary);
    expect(dark.muted).toBe(Colors.textMuted);
    expect(dark.icon).toBe(Colors.white);
    expect(dark.accentSolid).toBe(Colors.accent);
    expect(dark.statusBar).toBe('light-content');
  });

  it('dark card surface is solid hex (contrast is measurable)', () => {
    expect(darkSurfaces.every(s => /^#[0-9A-F]{6}$/i.test(s))).toBe(true);
  });
});

describe('themedColor / toLightForeground', () => {
  // Imported lazily so the helper above stays the first thing in the file.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { themedColor, toLightForeground } = require('../appearancePalette');

  it('is the identity in dark mode for every Colors token', () => {
    for (const value of Object.values(Colors)) {
      if (typeof value === 'string') expect(themedColor('dark', value)).toBe(value);
    }
  });

  it('returns a colour readable on every light surface for every foreground-like token', () => {
    for (const [name, value] of Object.entries(Colors)) {
      if (typeof value !== 'string' || !/^#[0-9A-F]{6}$/i.test(value)) continue;
      const out = toLightForeground(value);
      if (out === value && contrast(value, light.card) < 4.5) {
        throw new Error(`${name} (${value}) left unchanged but unreadable on white`);
      }
      if (out !== value) {
        for (const surface of lightSurfaces) {
          if (contrast(out, surface) < 4.5) throw new Error(`${name} → ${out} only ${contrast(out, surface).toFixed(2)}:1 on ${surface}`);
        }
      }
    }
  });

  it('maps the roles the Team screenshot exposed', () => {
    expect(toLightForeground(Colors.white)).toBe(light.text);
    expect(toLightForeground(Colors.textPrimary)).toBe(light.text);
    expect(toLightForeground(Colors.textSecondary)).toBe(light.secondary);
    expect(toLightForeground(Colors.textMuted)).toBe(light.muted);
    expect(toLightForeground(Colors.accent)).toBe(lightReadableText.accent);
    expect(toLightForeground(Colors.success)).toBe(lightReadableText.success);
    expect(toLightForeground(Colors.warning)).toBe(lightReadableText.warning);
    expect(toLightForeground(Colors.error)).toBe(lightReadableText.error);
    expect(toLightForeground(Colors.info)).toBe(lightReadableText.info);
    expect(toLightForeground('rgba(255, 255, 255, 0.24)')).toBe(light.muted);
  });

  it('leaves already-dark colours alone', () => {
    expect(toLightForeground(light.text)).toBe(light.text);
    expect(toLightForeground(lightReadableText.accent)).toBe(lightReadableText.accent);
  });
});

describe('strong text, solid fills and surfaces', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pal = require('../appearancePalette');
  const tints = ['#FCDDDE', '#EED4DB', '#E7F8F2', '#FEF5E7', '#E6EEFB'];

  it('strong text meets 4.5:1 on pale semantic tints and white', () => {
    for (const v of Object.values(pal.lightStrongText) as string[]) {
      for (const bg of [...tints, light.card]) expect(contrast(v, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('solid fills carry white labels at 4.5:1', () => {
    for (const v of Object.values(pal.lightSolidFill) as string[]) expect(contrast('#FFFFFF', v)).toBeGreaterThanOrEqual(4.5);
  });

  it('fills, surfaces and strong text are identity in dark mode', () => {
    for (const value of Object.values(Colors)) {
      if (typeof value !== 'string') continue;
      expect(pal.themedFill('dark', value)).toBe(value);
      expect(pal.themedSurface('dark', value)).toBe(value);
    }
  });

  it('converts dark neutral surfaces to light cards but leaves brand fills alone', () => {
    expect(pal.toLightSurface(Colors.bgSecondary)).toBe(light.card);
    expect(pal.toLightSurface(Colors.bgPrimary, 'elevated')).toBe(light.elevated);
    expect(pal.toLightSurface(Colors.whiteAlpha06)).toBe(light.card);
    expect(pal.toLightSurface(Colors.accent)).toBe(Colors.accent);
    expect(pal.toLightFill(Colors.success)).toBe(pal.lightSolidFill.success);
    expect(pal.toLightFill(Colors.accent)).toBe(pal.lightSolidFill.error);
  });
});