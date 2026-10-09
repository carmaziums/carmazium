#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = p => readFileSync(resolve(root, p), 'utf8');
const mobile = p => source('carmazium app/carmazium app/' + p);

test('all four audit blocks remain enabled in one release certification', () => {
  const workflow = source('.github/workflows/release-certification.yml');
  for (const file of [
    'test-native-vehicle-card-audit-block2.test.mjs',
    'test-native-app-audit-block3.test.mjs',
    'test-native-app-audit-block4.test.mjs',
    'test-native-app-audit-block5.test.mjs',
  ]) assert.ok(workflow.includes(file), 'Dropped regression: ' + file);
});

test('auction listing identity and truthful gearbox survive API merge', () => {
  const api = mobile('src/lib/auctionApi.ts');
  assert.ok(api.includes("import { mapTransmission } from './listingsApi'"));
  assert.ok(api.includes('transmission: mapTransmission(l?.transmission)'));
  assert.ok(api.includes("listingType: 'AUCTION'"));
  assert.ok(api.includes('auction: { id: a.id, status: a.status, endTime: a.endTime }'));
  assert.ok(api.includes('export async function getAllScheduledAuctions()'));
  assert.ok(api.includes("throw new Error('Could not load live auctions.')"));
  const saved = mobile('src/screens/main/SavedScreen.tsx');
  assert.ok(saved.includes('getSavedAuctionIdForListing(listing.id)'));
  assert.ok(saved.includes("navigation.navigate('AuctionDeepLink', { auctionId })"));
  assert.ok(saved.includes("Gearbox: {listing.transmission || 'Not specified'}"));
  assert.ok(saved.includes("`Gearbox: ${listing.transmission || 'Not specified'}`"));
});

test('live auction browse combines credible cards with complete loading', () => {
  const live = mobile('src/screens/main/LiveScreen.tsx');
  assert.ok(live.includes('getAllScheduledAuctions()'));
  assert.ok(live.includes('useFocusEffect(useCallback(() => {'));
  assert.ok(live.includes('setAuctionLoadError('));
  assert.ok(live.includes('transmission: mapTransmission(a.listing.transmission)'));
  assert.ok(live.includes('transmission: mapTransmission(auc.listing.transmission)'));
  assert.ok(live.includes('isFeatured: a.listing.isFeatured === true'));
  assert.ok(live.includes('isFeatured: auc.listing.isFeatured === true'));
  assert.ok(live.includes("listingType: 'AUCTION'"));
  assert.ok(!live.includes('images.unsplash.com'), 'Stock photos must not be used for real listings');
  assert.ok(!live.includes('isFeatured: true,'), 'Real seller flags must decide featured status');
});

test('seller VRM resets, listing submit mutex, and UK-local auction dates coexist', () => {
  const sell = mobile('src/screens/sell/SellCarFlowScreen.tsx');
  assert.ok(sell.includes('setMotHistory([])'));
  assert.ok(sell.includes("setModel('')"));
  assert.ok(sell.includes('valuationRequestId.current += 1'));
  assert.ok(sell.includes('LOW-CONFIDENCE PRICE GUIDE'));
  assert.ok(sell.includes('if (publishingInFlightRef.current) return'));
  assert.ok(sell.includes('publishingInFlightRef.current = false'));
  assert.ok(sell.includes('auctionPayload.startTime = parsedStart.toISOString()'));
  assert.ok(!mobile('src/lib/valuationApi.ts').includes('localFallbackValuation'));
});

test('internal preview remains separate from the production OTA channel', () => {
  const eas = JSON.parse(mobile('eas.json'));
  const app = JSON.parse(mobile('app.json')).expo;
  assert.equal(eas.build.preview.channel, 'preview');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(app.updates.enabled, true);
});
