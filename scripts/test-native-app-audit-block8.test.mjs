#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const file = p => readFileSync(resolve(root, p), 'utf8');
const mobile = p => file('carmazium app/carmazium app/' + p);

test('unified Account Settings shortcut is visible without scrolling through drawer tools', () => {
  const drawer = mobile('src/components/GlobalDrawer.tsx');
  const card = drawer.indexOf('{/* ── User card');
  const shortcut = drawer.indexOf('{/* Settings belongs next to the account identity');
  const scroll = drawer.indexOf('<ScrollView',shortcut);
  assert.ok(card !== -1 && shortcut > card && scroll > shortcut,
    'Settings shortcut must sit between account card and scrollable menu');
  assert.equal(drawer.split("id: 'account-settings'").length - 1, 1,
    'Do not leave another buried Account Settings entry');
  assert.ok(drawer.includes("stackScreen: 'Settings'"));
  assert.ok(drawer.includes('accessibilityLabel="Open all account settings"'));
  const settings = mobile('src/screens/main/SettingsScreen.tsx');
  for (const section of ['personal','verification','notifications','payouts','security']) {
    assert.ok(settings.includes("id: '" + section + "'"), 'Missing settings section: ' + section);
  }
  assert.ok(settings.includes("id: 'business'"));
});

test('QR/QA feedback is explicit opt-in and stays out of the production drawer', () => {
  const drawer = mobile('src/components/GlobalDrawer.tsx');
  assert.ok(drawer.includes("const IS_QA_REVIEW_BUILD = process.env.EXPO_PUBLIC_QA_READ_ONLY === '1';"));
  assert.ok(drawer.includes('{IS_QA_REVIEW_BUILD && ('));
  assert.ok(drawer.includes('onPress={handleShareQaFeedback}'));
  assert.ok(drawer.includes("process.env.EXPO_PUBLIC_QA_COMMIT_SHA || 'unknown'"));
  assert.ok(drawer.includes('Share.share({'));
  assert.ok(drawer.includes("'].join('\\n')") || drawer.includes("].join('\\n')"));
  assert.ok(drawer.includes('Please attach a screenshot or screen recording separately.'));
  assert.ok(drawer.includes('Do not include real customer information, passwords or payment data.'));
  assert.ok(drawer.includes('No information is sent automatically.'));
  assert.ok(!drawer.includes('fetch(\x27https://'), 'Feedback must not send anything to a new endpoint');
});

test('only standalone test APK embeds a source SHA and keeps production untouched', () => {
  const workflow = file('.github/workflows/carmazium-android-offline-qa-apk.yml');
  assert.ok(workflow.includes("EXPO_PUBLIC_QA_READ_ONLY: '1'"));
  assert.ok(workflow.includes('EXPO_PUBLIC_QA_COMMIT_SHA: ${{ github.sha }}'));
  assert.ok(workflow.includes("app.expo.android.package = 'uk.carmazium.qa'"));
  assert.ok(workflow.includes('app.expo.updates.enabled = false'));
  const eas = mobile('eas.json');
  assert.ok(!eas.includes('EXPO_PUBLIC_QA_COMMIT_SHA'));
  assert.ok(!eas.includes('EXPO_PUBLIC_QA_READ_ONLY'));
  const manifest = JSON.parse(mobile('app.json')).expo;
  assert.equal(manifest.android.package,'uk.carmazium.app');
  assert.equal(manifest.updates.enabled,true);
});
