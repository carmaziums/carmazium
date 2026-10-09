#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const native = file => readFileSync(resolve(root, 'carmazium app/carmazium app', file), 'utf8');

test('account settings uses one role-aware category navigation', () => {
  const settings = native('src/screens/main/SettingsScreen.tsx');
  for (const section of ['personal','business','verification','notifications','security','payouts']) {
    assert.ok(settings.includes(`activeCategory === '${section}'`), 'Missing usable '+section+' section');
  }
  assert.match(settings, /isSettingsCategory\(section\)/);
  assert.match(settings, /section !== 'business' \|\| isDealerAccount/);
  assert.match(settings, /accessibilityRole="tab"/);
  assert.match(settings, /accessibilityState=\{\{ selected \}\}/);
  assert.match(settings, /Account Settings/);
});

test('saving personal details cannot accidentally overwrite unsaved privacy preferences', () => {
  const settings = native('src/screens/main/SettingsScreen.tsx');
  const profile = settings.split('const handleSaveProfile = async () => {')[1]?.split('const handleSavePreferences')[0];
  assert.ok(profile, 'Separate personal save handler must exist');
  assert.doesNotMatch(profile, /notifyOnSale/);
  assert.doesNotMatch(profile, /showPublicProfile/);
  assert.match(settings, /const handleSavePreferences = async \(\) =>/);
  assert.match(settings, /if \(!preferencesLoaded \|\| preferencesSaving\) return/);
  assert.match(settings, /body: JSON\.stringify\(\{ notifyOnSale, showPublicProfile \}\)/);
});

test('existing bank data is populated and payout status is independently checked', () => {
  const settings = native('src/screens/main/SettingsScreen.tsx');
  assert.match(settings, /setBankName\(p\.bankAccountName/);
  assert.match(settings, /setSortCode\(p\.bankSortCode/);
  assert.match(settings, /setAccountNumber\(p\.bankAccountNumber/);
  assert.match(settings, /stripeStatus\?\.payoutsEnabled === true/);
  assert.match(settings, /useFocusEffect\(useCallback\(\(\) =>/);
  assert.match(settings, /AppState\.addEventListener\('change'/);
  assert.match(settings, /carmazium:\/\/settings\?section=payouts/);
});

test('account settings deep links preserve the section type and never imply address-only KYC', () => {
  const nav = native('src/navigation/MainStackNavigator.tsx');
  const settings = native('src/screens/main/SettingsScreen.tsx');
  assert.match(nav, /Settings: \{ section\?:/);
  assert.doesNotMatch(settings, /Verified Trader badge unlocked/);
  assert.doesNotMatch(settings, /Address verified! Your account shows a Verified Trader badge/);
});

test('a missing bundled font does not permanently strand Android or iOS on the splash screen', () => {
  const app = native('App.tsx');
  assert.match(app, /const \[fontsLoaded, fontLoadError\] = useFonts/);
  assert.match(app, /const fontAssetsSettled = fontsLoaded \|\| !!fontLoadError/);
  assert.match(app, /if \(!fontAssetsSettled \|\| !authInitialized\)/);
  assert.match(app, /void SplashScreen\.hideAsync\(\)/);
});

test('the Android APK workflow remains an internal preview and requires configured Expo access', () => {
  const work = readFileSync(resolve(root, '.github/workflows/carmazium-android-preview-apk.yml'), 'utf8');
  assert.match(work, /EXPO_TOKEN:/);
  assert.match(work, /profile preview/);
  assert.match(work, /buildType/);
  assert.doesNotMatch(work, /--channel production --platform android/);
});
