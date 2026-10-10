#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const base = 'carmazium app/carmazium app/';
const theme = read(base + 'src/theme/nativeNavigationTheme.ts');
const app = read(base + 'App.tsx');
const root = read(base + 'src/navigation/RootNavigator.tsx');
const main = read(base + 'src/navigation/MainStackNavigator.tsx');
const tabs = read(base + 'src/navigation/TabNavigator.tsx');
const header = read(base + 'src/components/WebsiteTopBar.tsx');
const hamburger = read(base + 'src/components/HamburgerButton.tsx');
const drawer = read(base + 'src/components/GlobalDrawer.tsx');
const settings = read(base + 'src/screens/main/SettingsScreen.tsx');

function evaluateRealChromeMapping() {
  const match = theme.match(/export function getNativeChromeColors\([\s\S]*?\): NativeChromeColors \{([\s\S]*?)\n\}/);
  assert.ok(match, 'actual chrome mapping function exists');
  return new Function('mode', 'palette', match[1]);
}
const light = {
  bgBody: '#eef5fb', bgHeader: 'rgba(255, 255, 255, 0.88)', bgCard: '#ffffff',
  bgDropdown: '#ffffff', textPrimary: '#0f172a', textSecondary: '#334155',
  textMuted: '#64748b', borderDefault: '#d5e1ec', accent: '#ed1c24',
};
const dark = {
  bgBody: '#1b2538', bgHeader: 'rgba(30, 41, 59, 0.84)', bgCard: 'rgba(51, 65, 85, 0.58)',
  bgDropdown: '#243047', textPrimary: '#ffffff', textSecondary: '#e2e8f0',
  textMuted: '#a3b1c4', borderDefault: 'rgba(255, 255, 255, 0.14)', accent: '#ed1c24',
};

test('navigation chrome actually selects matching light and dark website surfaces', () => {
  const map = evaluateRealChromeMapping();
  assert.deepEqual(map('light', light), {
    background: '#eef5fb',
    headerBackground: light.bgHeader,
    foreground: '#0f172a',
    secondaryForeground: '#334155',
    border: '#d5e1ec',
    tabBackground: '#ffffff',
    tabInactive: '#64748b',
    accent: '#ed1c24',
  });
  assert.deepEqual(map('dark', dark), {
    background: '#1b2538',
    headerBackground: dark.bgHeader,
    foreground: '#ffffff',
    secondaryForeground: '#e2e8f0',
    border: dark.borderDefault,
    tabBackground: '#243047',
    tabInactive: '#a3b1c4',
    accent: '#ed1c24',
  });
});

test('React Navigation theme retains platform defaults and changes without navigator remount', () => {
  assert.match(theme, /DarkTheme, DefaultTheme, type Theme/);
  assert.match(theme, /mode === 'dark' \? DarkTheme : DefaultTheme/);
  assert.match(theme, /\.\.\.base,\s*dark: mode === 'dark',\s*colors: \{/);
  assert.match(theme, /\.\.\.base\.colors/);
  for (const key of ['primary', 'background', 'card', 'text', 'border', 'notification']) {
    assert.match(theme, new RegExp(key + ': colors\\.'));
  }
  assert.match(app, /const \{ resolvedAppearance, palette \} = useNativeAppearance\(\)/);
  assert.match(app, /React\.useMemo\([\s\S]*?createNativeNavigationTheme\(resolvedAppearance, palette\)/);
  assert.match(app, /theme=\{navigationTheme\}/);
  assert.doesNotMatch(app, /key=\{resolvedAppearance\}|key=\{navigationTheme/);
});

test('status bar and stack transition backgrounds follow the active mode safely', () => {
  assert.match(app, /style=\{resolvedAppearance === 'dark' \? 'light' : 'dark'\}/);
  assert.match(app, /backgroundColor=\{palette\.bgBody\}/);
  assert.match(app, /backgroundColor: palette\.bgBody/);
  for (const navigator of [root, main]) {
    assert.match(navigator, /useNativeAppearance\(\)/);
    assert.match(navigator, /contentStyle: \{ backgroundColor: palette\.bgBody \}/);
    assert.match(navigator, /headerShown: false/);
  }
});

test('website-style top header keeps notifications and account navigation legible in both modes', () => {
  assert.match(header, /useNativeAppearance\(\)/);
  assert.match(header, /backgroundColor: palette\.bgHeader/);
  assert.match(header, /borderBottomColor: palette\.borderDefault/);
  assert.match(header, /backgroundColor: palette\.bgCard/);
  assert.match(header, /<Ionicons name="notifications-outline" size=\{20\} color=\{palette\.textSecondary\}/);
  assert.match(header, /<Ionicons name="chevron-down" size=\{15\} color=\{palette\.textMuted\}/);
  assert.match(header, /navigation\.navigate\('Notifications'\)/);
  assert.match(header, /navigation\.navigate\('Settings'\)/);
  assert.match(hamburger, /const iconColor = color \?\? \(websiteStyle \? palette\.textPrimary : Colors\.white\)/);
  assert.match(hamburger, /name=\{isOpen \? 'close' : 'menu'\}/);
});

test('buyer/dealer tabs react to palette while preserving permissions and the working More menu', () => {
  assert.match(tabs, /getNativeChromeColors\(resolvedAppearance, palette\)/);
  assert.match(tabs, /borderTopColor: chrome\.border, backgroundColor: chrome\.tabBackground/);
  assert.match(tabs, /backgroundColor: chrome\.tabBackground/);
  assert.match(tabs, /color=\{isFocused \? chrome\.accent : chrome\.tabInactive\}/);
  assert.match(tabs, /color: isFocused \? chrome\.accent : chrome\.tabInactive/);
  assert.match(tabs, /hasPermission\('VIEW_INVENTORY'\)/);
  assert.match(tabs, /hasPermission\('MANAGE_CRM'\)/);
  assert.match(tabs, /hasPermission\('VIEW_TRADE'\)/);
  assert.match(tabs, /if \(isDrawerOpen\) closeDrawer\(\)/);
});

test('modal drawer surfaces, navigation labels and accessible close affordances adapt', () => {
  assert.match(drawer, /useNativeAppearance\(\)/);
  assert.match(drawer, /backgroundColor: palette\.bgDropdown/);
  assert.match(drawer, /borderColor: palette\.borderDefault/);
  assert.match(drawer, /color: drawerForeground/);
  assert.match(drawer, /color: drawerSecondary/);
  assert.match(drawer, /color: drawerMuted/);
  assert.match(drawer, /lightMode \? '#946200' : Colors\.warning/);
  assert.match(drawer, /backgroundColor: lightMode \? Colors\.overlay40 : Colors\.blackAlpha75/);
  assert.match(drawer, /onRequestClose=\{closeDrawer\}/);
  assert.match(drawer, /accessibilityRole="header">Navigation menu/);
  assert.match(drawer, /accessibilityLabel="Close"/);
  assert.doesNotMatch(drawer, /sheetHandle/);
});

test('Block 3 does not pretend all screens are themed or enable unfinished Appearance switch', () => {
  assert.match(settings, /A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings, /setAppearancePreference\(/);
  assert.match(app, /<NativeAppearanceProvider>\s*<AppContent \/>/);
});
