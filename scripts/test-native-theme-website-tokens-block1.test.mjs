#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const website = read('src/app/globals.css');
const native = read('carmazium app/carmazium app/src/theme/nativeTheme.ts');
const legacy = read('carmazium app/carmazium app/src/constants/colors.ts');

const pairs = {
  bgBody: '--bg-body',
  bgCard: '--bg-card',
  bgCardHover: '--bg-card-hover',
  bgHeader: '--bg-header',
  bgInput: '--bg-input',
  bgDropdown: '--bg-dropdown',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  borderDefault: '--border-default',
  borderHover: '--border-hover',
};
function webValues(section) {
  const start = section === 'light' ? website.indexOf(':root {') : website.indexOf('.dark {');
  assert.ok(start >= 0, 'website theme section: ' + section);
  const end = website.indexOf('\n}', start);
  assert.ok(end > start);
  const block = website.slice(start, end);
  return Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)]
    .map(([, key, value]) => [key, value.trim().toLowerCase()]));
}
function nativeValues(section) {
  const match = native.match(new RegExp('export const NATIVE_' + section.toUpperCase() +
    '_THEME: NativeSemanticPalette = Object.freeze\\(\\{([\\s\\S]*?)\\}\\);'));
  assert.ok(match, 'native theme section: ' + section);
  return Object.fromEntries([...match[1].matchAll(/^\s*([a-zA-Z]+):\s*'([^']+)',/gm)]
    .map(([, key, value]) => [key, value.toLowerCase()]));
}
const rgb = h => [1, 3, 5].map(n => parseInt(h.slice(n, n + 2), 16) / 255);
const luminance = hex => rgb(hex).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

test('website light/dark palette semantic values match native, key for key', () => {
  for (const section of ['light', 'dark']) {
    const web = webValues(section), app = nativeValues(section);
    for (const [appKey, cssKey] of Object.entries(pairs)) {
      assert.equal(app[appKey], web[cssKey], section + ' ' + appKey + ' must reflect website: ' + cssKey);
    }
    assert.equal(app.accent, '#ed1c24');
    assert.equal(app.accentForeground, '#ffffff');
    assert.equal(Object.keys(app).length, Object.keys(pairs).length + 2);
  }
});

test('light/dark primary, secondary and muted text remain readable against their actual body ground', () => {
  for (const section of ['light', 'dark']) {
    const p = nativeValues(section);
    for (const key of ['textPrimary', 'textSecondary']) {
      assert.ok(contrast(p[key], p.bgBody) >= 4.5, section + ' ' + key);
    }
    // Website's light muted token is 4.33:1 on its Cool Sky background;
    // keep it for labels and meta, not low-contrast primary body paragraphs.
    assert.ok(contrast(p.textMuted, p.bgBody) >= 3, section + ' textMuted');
  }
});

test('legacy dark-only palette is not mutated or silently switched while screens remain static', () => {
  assert.match(legacy, /const bgBody = '#1B2538'/);
  assert.match(native, /Object\.freeze\(\{/);
  assert.match(native, /if \(preference === 'system'\) return systemAppearance === 'light' \? 'light' : 'dark'/);
  assert.match(native, /return 'dark';/);
  assert.doesNotMatch(native, /Object\.assign\(Colors|Colors\.[a-zA-Z]+\s*=/);
});
