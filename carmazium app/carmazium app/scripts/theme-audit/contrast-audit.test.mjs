// Light/dark contrast regression gate for the mobile app.
//
//   node --test scripts/theme-audit/contrast-audit.test.mjs
//
// Runs scripts/theme-audit/contrast-audit.cjs over every screen and shared
// component and fails if a readability defect fixed in the 2026-10 light/dark
// audit comes back. Set THEME_AUDIT_TS=/path/to/typescript to use a specific
// TypeScript install (defaults to the app's own devDependency).
//
// What it can and cannot prove: it evaluates StyleSheets and light maps with
// the real tokens and walks the JSX tree, so it catches colour regressions in
// code. It does not render; photo overlays, API-driven colours and runtime
// layouts still need on-device visual QA (see THEME_AUDIT.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..');
const tsPath = process.env.THEME_AUDIT_TS || createRequire(join(app, 'package.json')).resolve('typescript');
const audit = join(here, 'contrast-audit.cjs');

function run(files = []) {
  const out = join(mkdtempSync(join(tmpdir(), 'theme-audit-')), 'report.json');
  execFileSync(process.execPath, [audit, '--ts', tsPath, '--json', out, ...files], { cwd: app, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(readFileSync(out, 'utf8'));
}

const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// White on the brand red (#ED1C24, 4.4:1) is identical in both modes and is a
// pending design decision (see THEME_AUDIT.md), not a regression.
const isBrandRed = h => { const [r, g, b] = hexToRgb(h); return r > 180 && g < 110 && b < 110; };
const isBrandRedLabel = f => isBrandRed(f.bg) && f.fg === '#FFFFFF';
const isBrandRedText = f => ['#ED1C24', '#CC1820'].includes(f.fg);

const report = run();
const fmt = (r, f) => `${r.file}:${f.line} ${f.mode} ${f.kind} ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.need})`;

test('audit covers every screen and shared component', () => {
  assert.ok(report.length >= 130, `expected 130+ files, got ${report.length}`);
  const errors = report.filter(r => r.error).map(r => `${r.file}: ${r.error}`);
  assert.deepEqual(errors, []);
});

test('light mode: no text, icon or placeholder below WCAG AA (except white on brand red)', () => {
  const bad = report.flatMap(r => r.findings.filter(f => f.mode === 'light' && !isBrandRedLabel(f)).map(f => fmt(r, f)));
  assert.deepEqual(bad, []);
});

test('dark mode: nothing below 3:1 outside the pending brand-red decision', () => {
  const bad = report.flatMap(r => r.findings
    .filter(f => f.mode === 'dark' && f.ratio < 3 && !isBrandRedLabel(f) && !isBrandRedText(f))
    .map(f => fmt(r, f)));
  assert.deepEqual(bad, []);
});

test('no static light-content status bars outside the splash screen', () => {
  const bad = report.flatMap(r => r.patterns.filter(p => p.kind === 'staticStatusBar' && !r.file.endsWith('SplashScreen.tsx')).map(p => `${r.file}:${p.line}`));
  assert.deepEqual(bad, []);
});

test('no label turned dark while its brand/semantic fill stayed saturated', () => {
  const bad = report.flatMap(r => r.patterns.filter(p => p.kind === 'darkLabelOnFill').map(p => `${r.file}:${p.line} ${p.fg} on ${p.bg}`));
  assert.deepEqual(bad, []);
});

test('the audit itself detects the defects from the original Team screenshot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-audit-fixture-'));
  const file = join(dir, 'TeamFixture.tsx');
  writeFileSync(file, `
import React from 'react';
import { View, Text, StatusBar, StyleSheet } from 'react-native';
export const TeamFixture = ({ disabled }) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? mergeAppearanceStyles(styles, light) : styles;
  return (
    <View style={ts.container}>
      <StatusBar barStyle="light-content" />
      <View style={ts.card}>
        <Text style={{ color: disabled ? Colors.textSecondary : Colors.textMuted }}>View jobs</Text>
        <Text style={ts.summary}>MANAGE TEAM</Text>
        <Ionicons name="chevron-back" color={Colors.white} />
      </View>
    </View>
  );
};
const light = StyleSheet.create({ container: { backgroundColor: '#EEF5FB' }, card: { backgroundColor: '#FFFFFF' } });
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  card: { backgroundColor: Colors.bgSecondary },
  summary: { color: Colors.textSecondary, fontSize: 11 },
});
`);
  const [r] = run([file]);
  const light = r.findings.filter(f => f.mode === 'light');
  const textLines = new Set(light.filter(f => f.kind === 'text').map(f => f.line));
  assert.equal(textLines.size, 2, 'both the permission label and MANAGE TEAM are flagged');
  assert.ok(light.every(f => f.kind !== 'text' || f.ratio < 2.5), 'flagged near-white labels are below 2.5:1');
  assert.ok(light.some(f => f.kind === 'icon' && f.fg === '#FFFFFF'), 'white header icon on white');
  assert.ok(r.patterns.some(p => p.kind === 'staticStatusBar'), 'static light-content status bar');
  assert.equal(r.findings.filter(f => f.mode === 'dark').length, 0, 'the same screen is fine in dark mode');
});