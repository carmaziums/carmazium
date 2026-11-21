#!/usr/bin/env node
// Issue #477 Block 3: deterministic SOURCE-level assertions.
// Real authenticated Android/iOS screenshot + interaction tests are still needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = resolve(fileURLToPath(new URL('..', import.meta.url)));
const get = file => readFileSync(resolve(base, file), 'utf8');
const web = get('src/app/dashboard/dealer/page.tsx');
const selector = get('src/components/dashboard/FlexiblePeriodControl.tsx');
const overview = get('carmazium app/carmazium app/src/screens/main/DealerWebParityOverview.tsx');
const native = get('carmazium app/carmazium app/src/screens/main/DealerProfileScreen.tsx');
const routes = get('carmazium app/carmazium app/src/navigation/TabNavigator.tsx');
const docs = get('docs/native/website-native-visual-parity-block3-20261010.md');

test('dealer homes show the same card navigation without duplicated reporting panels', () => {
  assert.ok(web.includes("getDealerRoute('/dashboard/dealer')?.title"));
  assert.ok(web.includes('<DashboardCards mode="dealer"'));
  assert.ok(overview.includes('<DashboardCards mode="dealer"'));
  assert.ok(native.includes('<DealerWebParityOverview'));
  for (const source of [web, overview, native]) {
    assert.ok(!source.includes('<MetricCard'));
    assert.ok(!source.includes('<FlexiblePeriodControl'));
    assert.ok(!source.includes('Compare previous'));
    assert.ok(!source.includes('Additional insights'));
  }
  assert.ok(overview.includes('DEALER COMMAND CENTRE'));
  assert.ok(overview.includes('Needs your attention'));
});

test('dashboard identity stays server-backed while reporting screens remain available', () => {
  assert.ok(web.includes("'/dashboard/dealer'"));
  assert.ok(overview.includes("'/dashboard/dealer'"));
  assert.ok(overview.includes('summary?.isVerified === true'));
  assert.ok(overview.includes('setSummary(null)'));
  assert.ok(!overview.includes('PRO</Text>'));
  assert.ok(!overview.includes('/dealers/analytics?range=7d'));
  const cards = JSON.parse(get('src/data/dashboardCards.json')).dealer;
  for (const label of ['Stock', 'Analytics', 'Earnings', 'Purchases']) {
    assert.ok(cards.some(card => card.label === label), label);
  }
});

test('one set of permission-gated jobs; no altered auction/KYC/buyer routes', () => {
  for (const key of ["'MANAGE_INVENTORY'","'MANAGE_CRM'","'VIEW_TRADE'","'VIEW_ANALYTICS'","'VIEW_INVENTORY'"]) {
    assert.ok(native.includes(key), key);
  }
  for (const dest of ["'add-vehicle'","'customers'","'buy-and-bid'","'partner-services'","'performance'","'stock'"]) {
    assert.ok(native.includes(dest));
    assert.ok(overview.includes(dest));
  }
  // New listings must open the Auction/Retail choice, while existing-listing
  // edits still use SellCarFlow through the inventory editing action.
  for (const route of ["'DealerListingMethod'","'DealerLeads'","'PartnerDashboard'","'DealerAnalytics'","'DealerInventory'"]) {
    assert.ok(native.includes(route));
  }
  assert.ok(native.includes("navigation.navigate('Tabs', { screen: 'DealerBuyBid' })"));
  assert.ok(routes.includes('<Tab.Screen name="DealerBuyBid" component={GatedDealerBuyBidTab} />'));
  assert.ok(!routes.includes('<Tab.Screen name="DealerMore"'));
  assert.ok(get('carmazium app/carmazium app/src/components/WebsiteTopBar.tsx').includes('Switch to personal view')); // existing preview is now in the account menu
  assert.ok(native.includes('showPhoneBanner')); // existing KYC/phone affordance retained
});

test('screen capture limitations, safety and revert are documented', () => {
  for (const expected of ['PR #476','PR #478','PR #479','360×800','390×844',
    'VISUAL SIGN-OFF: PENDING','synthetic','Revert','Stop at 30%']) {
    assert.ok(docs.includes(expected), expected);
  }
});
