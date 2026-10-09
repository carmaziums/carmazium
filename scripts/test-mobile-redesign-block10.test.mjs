#!/usr/bin/env node
/**
 * Block 10 native redesign regression gate.
 *
 * Source-level contracts only: these tests do not certify installed Android/iOS
 * builds, real-payment flows, screenshots, accessibility or store readiness.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const NATIVE = 'carmazium app/carmazium app/';
const read = (name) => readFileSync(resolve(ROOT, name), 'utf8');
const native = (name) => read(NATIVE + name);

test('every hardcoded drawer and bottom-tab destination resolves to a registered screen', () => {
  const main = native('src/navigation/MainStackNavigator.tsx');
  const tabs = native('src/navigation/TabNavigator.tsx');
  const drawer = native('src/components/GlobalDrawer.tsx');
  const definedRoutes = new Set(
    [...main.matchAll(/^  ([A-Za-z][A-Za-z0-9_]+):/gm)].map((match) => match[1]),
  );
  const mountedRoutes = new Set(
    [...main.matchAll(/<Stack\.Screen\b[\s\S]*?\bname="([A-Za-z][A-Za-z0-9_]+)"/g)]
      .map((match) => match[1]),
  );
  const mountedTabs = new Set(
    [...tabs.matchAll(/<Tab\.Screen\s+name="([A-Za-z][A-Za-z0-9_]+)"/g)]
      .map((match) => match[1]),
  );

  assert.ok(mountedRoutes.size >= 50, 'Stack unexpectedly lost screens');
  assert.deepEqual([...mountedTabs].sort(), ['Home', 'Live', 'Profile', 'Saved', 'Search'].sort());
  for (const match of drawer.matchAll(/stackScreen:\s*'([^']+)'/g)) {
    assert.ok(definedRoutes.has(match[1]), `Drawer destination ${match[1]} has no route type`);
    assert.ok(mountedRoutes.has(match[1]), `Drawer destination ${match[1]} is not registered`);
  }
  for (const match of drawer.matchAll(/tabName:\s*'([^']+)'/g)) {
    assert.ok(mountedTabs.has(match[1]), `Drawer tab ${match[1]} is not registered`);
  }
});

test('website service forms open in the browser, not via interceptable Android App Links', () => {
  const services = native('src/screens/main/ServicesScreen.tsx');
  const app = JSON.parse(native('app.json')).expo;
  const linking = native('src/navigation/linking.ts');
  assert.match(services, /WebBrowser\.openBrowserAsync\(/);
  assert.doesNotMatch(services, /Linking\.openURL\(/);
  for (const path of [
    '/services/jobs/new',
    '/services/delivery/new',
    '/services/inspection/new',
    '/services/finance',
    '/services/warranty',
  ]) assert.ok(services.includes(path), `Missing website service route: ${path}`);
  assert.match(linking, /services\/jobs\/:jobId/);
  assert.ok(
    app.android.intentFilters.some((filter) =>
      filter.data?.some((item) => item.pathPrefix === '/services/jobs')),
    'Expected to preserve the installed-app job-detail link, not disable it',
  );
});

test('preview and production native updates use EAS-selected channels, never fixed production headers', () => {
  const app = JSON.parse(native('app.json')).expo;
  const eas = JSON.parse(native('eas.json'));
  const colors = native('src/constants/colors.ts');
  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
  assert.equal(app.updates?.requestHeaders?.['expo-channel-name'], undefined);
  assert.equal(app.runtimeVersion?.policy, 'appVersion');
  assert.equal(app.backgroundColor, '#1B2538');
  assert.equal(app.splash.backgroundColor, '#1B2538');
  assert.equal(app.android.adaptiveIcon.backgroundColor, '#1B2538');
  assert.equal(app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications')?.[1]?.color, '#ED1C24');
  assert.match(colors, /const bgBody = '#1B2538'/);
});

test('buyer/seller/contractor screens keep auction and service safety requirements', () => {
  const buyerBids = native('src/screens/buyer/BuyerBidsScreen.tsx');
  const seller = native('src/screens/seller/SellerAuctionsScreen.tsx');
  const buyerService = native('src/screens/main/CustomerServiceJobDetailScreen.tsx');
  const provider = native('src/screens/main/ProviderJobDetailScreen.tsx');
  const mazium = native('src/components/GlobalAIChatBot.tsx');
  assert.match(buyerBids, /auctionId: bid\.auctionId \?\? undefined/);
  assert.match(seller, /sellerFundsConfirmedAt/);
  assert.match(seller, /submitHandoverProof/);
  assert.match(seller, /handoverRejectedAt/);
  assert.match(buyerService, /confirmCustomerServiceJob/);
  assert.match(buyerService, /Confirm and release payout/);
  assert.match(buyerService, /refuseAuctionAfterInspection/);
  assert.match(buyerService, /AuctionDeepLink/);
  assert.match(provider, /completeProviderJob/);
  assert.match(provider, /FAULTS_FOUND/);
  assert.match(mazium, /mazium_ai_consent_v1/);
  assert.match(mazium, /Report AI response/);
});

test('store release remains evidence-gated rather than declared ready by TypeScript alone', () => {
  const yml = read('.github/workflows/release-certification.yml');
  const gate = read('scripts/check-release-candidate-evidence.mjs');
  assert.match(yml, /strict-external-release-gate:/);
  assert.match(yml, /Live production smoke/);
  assert.match(gate, /CARMAZIUM_DEVICE_QA_CONFIRMED/);
  assert.match(gate, /CARMAZIUM_PAYMENT_QA_CONFIRMED/);
  assert.match(gate, /CARMAZIUM_TESTFLIGHT_UPLOAD_CONFIRMED/);
  assert.match(gate, /CARMAZIUM_PLAY_INTERNAL_UPLOAD_CONFIRMED/);
});
