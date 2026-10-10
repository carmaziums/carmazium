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

test('one website command centre and one native matching first fold', () => {
  assert.ok(web.includes('DEALER_ROUTE_CONFIG[0].title'));
  assert.ok(web.includes('title: "Add vehicle"'));
  assert.ok(web.includes('label="Active Stock"'));
  assert.ok(web.includes('label="Vehicle Views"'));
  assert.ok(web.includes('label="Active Leads"'));
  assert.ok(web.includes('label="Vehicles Sold"'));
  for (const label of ['DEALER COMMAND CENTRE','RUN YOUR DEALERSHIP FROM ONE PLACE','Overview',
    'Active Stock','Vehicle Views','Active Leads','Vehicles Sold','Main actions']) {
    assert.ok(overview.includes(label), label);
  }
  assert.ok(native.includes('<DealerWebParityOverview'));
  assert.ok(native.indexOf('<DealerWebParityOverview') < native.indexOf('Additional insights'));
  assert.ok(!overview.includes('PRO</Text>'), 'no fake verification status');
  assert.ok(overview.includes('summary?.isVerified === true'), 'verification comes from API');
});

test('same web report endpoint and flexible range, never 7d analytics as 30d stats', () => {
  assert.ok(web.includes('/dashboard/dealer?${rangeQuery.toString()}'));
  assert.ok(overview.includes('/dashboard/dealer?${query}'));
  for (const preset of ["'7D'","'30D'","'3M'","'1Y'","'All'"]) {
    assert.ok(selector.includes('"' + preset.slice(1,-1) + '"'), 'website ' + preset);
    assert.ok(overview.includes(preset), 'native ' + preset);
  }
  for (const unit of ["'days'","'months'","'years'"]) {
    assert.ok(overview.includes(unit), unit);
  }
  for (const param of ["'rangeValue'","'rangeUnit'","'range'","'compare'"]) {
    assert.ok(overview.includes(param), param);
  }
  assert.ok(overview.includes('Math.min(10000, Math.max(1'));
  assert.ok(overview.includes("accessibilityRole=\"switch\""));
  assert.ok(overview.includes("accessibilityState={{ checked: range.compare }}"));
  assert.ok(overview.includes("No earlier account data available"));
});

test('real data only and coherent stale/error states', () => {
  assert.ok(overview.includes("value.toLocaleString('en-GB')"));
  assert.ok(overview.includes("return '—'"));
  assert.ok(overview.includes('setError(true)'));
  assert.ok(overview.includes('Previously loaded values are shown below.'));
  assert.ok(overview.includes('Values are hidden until data is available.'));
  assert.ok(native.includes('error && !stats && !analytics'));
  assert.ok(native.includes('if (advancedExpanded) void loadData();'));
  assert.ok(!overview.includes("'/dealers/analytics?range=7d'"));
});

test('one set of permission-gated jobs; no altered auction/KYC/buyer routes', () => {
  for (const key of ["'MANAGE_INVENTORY'","'MANAGE_CRM'","'VIEW_TRADE'","'VIEW_ANALYTICS'","'VIEW_INVENTORY'"]) {
    assert.ok(native.includes(key), key);
  }
  for (const dest of ["'add-vehicle'","'customers'","'buy-and-bid'","'partner-services'","'performance'","'stock'"]) {
    assert.ok(native.includes(dest));
    assert.ok(overview.includes(dest));
  }
  for (const route of ["'SellCarFlow'","'DealerLeads'","'PartnerDashboard'","'DealerAnalytics'","'DealerInventory'"]) {
    assert.ok(native.includes(route));
  }
  assert.ok(native.includes("navigation.navigate('Tabs', { screen: 'DealerBuyBid' })"));
  assert.ok(routes.includes('<Tab.Screen name="DealerBuyBid" component={GatedDealerBuyBidTab} />'));
  assert.ok(routes.includes('<Tab.Screen name="DealerMore" component={ProfileTabScreen} />'));
  assert.ok(native.includes('setRole(\'buyer\')')); // legacy buyer preview retained
  assert.ok(native.includes('showPhoneBanner')); // existing KYC/phone affordance retained
});

test('screen capture limitations, safety and revert are documented', () => {
  for (const expected of ['PR #476','PR #478','PR #479','360×800','390×844',
    'VISUAL SIGN-OFF: PENDING','synthetic','Revert','Stop at 30%']) {
    assert.ok(docs.includes(expected), expected);
  }
});
