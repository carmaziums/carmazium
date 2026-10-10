#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const themeSource = read('carmazium app/carmazium app/src/theme/nativeTheme.ts');
const provider = read('carmazium app/carmazium app/src/theme/NativeAppearanceProvider.tsx');
const app = read('carmazium app/carmazium app/App.tsx');
const settings = read('carmazium app/carmazium app/src/screens/main/SettingsScreen.tsx');

function loadPureNativeTheme() {
  // This release-contract CI job deliberately runs BEFORE npm ci. Extract and
  // evaluate the exact simple resolver FUNCTION BODY from the local TypeScript
  // source rather than importing the TypeScript package or mocking a function.
  const resolver = themeSource.match(/export function resolveNativeAppearance\([\s\S]*?\): ResolvedAppearance \{([\s\S]*?)\n\}/);
  assert.ok(resolver, 'missing resolver');
  const resolveNativeAppearance = new Function('preference', 'systemAppearance', resolver[1]);
  const parsePalette = kind => {
    const pattern = new RegExp('export const NATIVE_' + kind + '_THEME: NativeSemanticPalette = Object.freeze\\(\\{([\\s\\S]*?)\\}\\);');
    const m = themeSource.match(pattern);
    assert.ok(m, kind + ' palette');
    return Object.freeze(Object.fromEntries(
      [...m[1].matchAll(/^\s*([a-zA-Z]+):\s*'([^']+)',/gm)].map(([, key, val]) => [key, val]),
    ));
  };
  const NATIVE_LIGHT_THEME = parsePalette('LIGHT');
  const NATIVE_DARK_THEME = parsePalette('DARK');
  assert.match(themeSource, /Object\.freeze\(\{/);
  const getter = themeSource.match(/export function getNativeSemanticPalette\(mode: ResolvedAppearance\): NativeSemanticPalette \{([\s\S]*?)\n\}/);
  assert.ok(getter, 'missing palette selector');
  const getNativeSemanticPalette = new Function('mode', 'NATIVE_LIGHT_THEME', 'NATIVE_DARK_THEME', getter[1]);
  return {
    resolveNativeAppearance,
    NATIVE_LIGHT_THEME,
    NATIVE_DARK_THEME,
    getNativeSemanticPalette: mode => getNativeSemanticPalette(mode, NATIVE_LIGHT_THEME, NATIVE_DARK_THEME),
  };
}

test('actual appearance resolver honours explicit Light and Dark independent of OS', () => {
  const { resolveNativeAppearance } = loadPureNativeTheme();
  assert.equal(resolveNativeAppearance('light', 'dark'), 'light');
  assert.equal(resolveNativeAppearance('dark', 'light'), 'dark');
});

test('System reacts to light, dark and unavailable OS colour schemes', () => {
  const { resolveNativeAppearance } = loadPureNativeTheme();
  assert.equal(resolveNativeAppearance('system', 'light'), 'light');
  assert.equal(resolveNativeAppearance('system', 'dark'), 'dark');
  assert.equal(resolveNativeAppearance('system', null), 'dark');
});

test('unknown, corrupt and legacy preferences fail closed to the existing native dark design', () => {
  const { resolveNativeAppearance } = loadPureNativeTheme();
  for (const raw of [undefined, null, '', 'automatic', 'LIGHT', 'system-dark', false, 1, {}, []]) {
    assert.equal(resolveNativeAppearance(raw, 'light'), 'dark', JSON.stringify(raw));
  }
});

test('pure palettes are immutable, stable website-colour objects', () => {
  const theme = loadPureNativeTheme();
  assert.equal(theme.getNativeSemanticPalette('light'), theme.NATIVE_LIGHT_THEME);
  assert.equal(theme.getNativeSemanticPalette('dark'), theme.NATIVE_DARK_THEME);
  assert.equal(Object.isFrozen(theme.NATIVE_LIGHT_THEME), true);
  assert.equal(Object.isFrozen(theme.NATIVE_DARK_THEME), true);
  assert.equal(theme.NATIVE_LIGHT_THEME.bgBody, '#eef5fb');
  assert.equal(theme.NATIVE_DARK_THEME.bgBody, '#1b2538');
});

test('preference is device-local, persisted and exposes a three-choice API without network calls', () => {
  assert.match(provider, /NATIVE_APPEARANCE_STORAGE_KEY = 'carmazium:native:appearance:v1'/);
  assert.match(provider, /value === 'light' \|\| value === 'dark' \|\| value === 'system'/);
  assert.match(provider, /const systemColorScheme = useColorScheme\(\)/);
  assert.match(provider, /resolveNativeAppearance\(preference, systemColorScheme\)/);
  assert.match(provider, /AsyncStorage\.getItem\(NATIVE_APPEARANCE_STORAGE_KEY\)/);
  assert.match(provider, /AsyncStorage\.setItem\(NATIVE_APPEARANCE_STORAGE_KEY, next\)/);
  assert.doesNotMatch(provider, /supabase|fetch\(|axios|useAuthStore|localStorage/);
});

test('navigation never mounts before preference hydration and read failures fail dark', () => {
  assert.match(app, /function AppContent\(\)/);
  assert.match(app, /<NativeAppearanceProvider>\s*<AppContent \/>\s*<\/NativeAppearanceProvider>/);
  assert.match(provider, /if \(!isHydrated\) \{\s*return <View testID="native-appearance-hydration"/);
  assert.match(provider, /setPreference\(isAppearancePreference\(value\) \? value : 'dark'\)/);
  assert.match(provider, /clearTimeout\(timeout\)/);
  assert.match(provider, /const timeout = setTimeout\(\(\) => settle\('dark'\), NATIVE_APPEARANCE_HYDRATION_TIMEOUT_MS\)/);
  assert.match(provider, /if \(cancelled \|\| settled\) return;/);
  assert.match(provider, /\.then\(settle, \(\) => settle\('dark'\)\)/);
});

test('serialized writes cannot race and failure cannot falsely update the displayed preference', () => {
  assert.match(provider, /const writeQueue = useRef<Promise<void>>\(Promise\.resolve\(\)\)/);
  assert.match(provider, /const write = writeQueue\.current\s*\.catch\(\(\) => undefined\)\s*\.then\(\(\) => AsyncStorage\.setItem/);
  assert.match(provider, /writeQueue\.current = write\.catch\(\(\) => undefined\)/);
  assert.match(provider, /await write;\s*if \(mountedRef\.current\) setPreference\(next\)/);
  assert.match(provider, /catch \{\s*\/\/ No deceptive UI update/);
  assert.match(provider, /if \(!isAppearancePreference\(next\) \|\| !hydratedRef\.current\) return false/);
});

test('Block 2 does not prematurely expose fake theme controls or recolour unconverted screens', () => {
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.match(app, /dark: true/);
  assert.match(app, /<StatusBar style="light" \/>/);
  assert.doesNotMatch(app, /theme=\{getNativeSemanticPalette/);
  assert.doesNotMatch(provider, /Object\.assign\(Colors|Colors\.[a-zA-Z]+\s*=/);
});
