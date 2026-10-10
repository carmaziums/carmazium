#!/usr/bin/env node
// Issue #477 Block 1: source-inventory safety checks, not pixel-diff tests.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const doc = read('docs/native/website-native-visual-parity-block1-20261010.md');
const webSidebar = read('src/components/dashboard/DashboardSidebar.tsx');
const routes = read('src/config/dealerRouteConfig.ts');
const nativeTabs = read('carmazium app/carmazium app/src/navigation/TabNavigator.tsx');
const webTokens = read('src/app/globals.css');
const nativeTokens = read('carmazium app/carmazium app/src/constants/colors.ts');
const nativeHeader = read('carmazium app/carmazium app/src/components/WebsiteTopBar.tsx');

test('Block 1 identifies its evidence limits rather than certifying screenshots', () => {
  for (const text of ['BLOCK 1 = 10%', 'UNKNOWN', 'PENDING', 'BLOCKED', 'E01', 'E02', 'E03', 'E04', 'C01', 'C02', 'C03']) {
    assert.ok(doc.includes(text), 'missing evidence qualifier: ' + text);
  }
  assert.ok(doc.includes('38057186815'), 'QA run is an immutable evidence reference');
  assert.ok(doc.includes('28dcd9e6831a400e437436713d372abb89116186'), 'records merged PR #476');
  assert.ok(doc.includes('No application UI'), 'must explicitly record scoped no-app-change baseline');
});

test('website dealer tab URLs and merged native tab mappings remain inventoried', () => {
  const pairs = [
    ['/dashboard/dealer', 'DealerHome', 'DealerProfileScreen'],
    ['/dashboard/dealer/inventory', 'DealerStock', 'DealerInventoryScreen'],
    ['/dashboard/dealer/crm', 'DealerCustomers', 'DealerLeadsScreen'],
    ['/dashboard/dealer/auctions', 'DealerBuyBid', 'LiveScreen'],
  ];
  for (const [href, route, screen] of pairs) {
    assert.ok(webSidebar.includes('"' + href + '"'), 'website bottom tab route ' + href);
    assert.ok(routes.includes('href: "' + href + '"'), 'canonical dealer link ' + href);
    assert.ok(nativeTabs.includes('name="' + route + '" component={' + screen + '}'), 'native route ' + route);
    assert.ok(doc.includes(href) && doc.includes(route), 'documented paired route ' + route);
  }
  assert.ok(nativeTabs.includes('DealerMore'), 'preserve More tab from merged PR #476');
  for (const link of ["hasPermission('VIEW_INVENTORY')", "hasPermission('MANAGE_CRM')", "hasPermission('VIEW_TRADE')"]) {
    assert.ok(nativeTabs.includes(link), 'preserve dealer permission gate ' + link);
  }
  for (const route of ['Home', 'Search', 'Live', 'Saved', 'Profile']) {
    assert.ok(nativeTabs.includes('<Tab.Screen name="' + route + '"'), 'preserve consumer route ' + route);
  }
});

test('rank source-level Buy & Bid semantic discrepancy instead of claiming false equivalence', () => {
  const nativeLive = read('carmazium app/carmazium app/src/screens/main/LiveScreen.tsx');
  const webDealerAuctions = read('src/app/dashboard/dealer/auctions/page.tsx');
  assert.ok(nativeLive.includes('getActiveAuctions()') && nativeLive.includes('getAllScheduledAuctions()'));
  assert.ok(webDealerAuctions.includes('createAuction(') && webDealerAuctions.includes('fetchAuctions()'));
  assert.ok(doc.includes('C01 — P1'));
  assert.ok(doc.includes('own auctions'));
});

test('record the real site tokens and flag geometry that needs screenshots', () => {
  assert.ok(webTokens.includes('--bg-body: #1b2538'));
  assert.ok(webTokens.includes('--bg-dropdown: #243047'));
  assert.ok(webTokens.includes('--bg-header: rgba(30, 41, 59, 0.84)'));
  assert.ok(webTokens.includes('--color-primary: #ed1c24'));
  assert.ok(nativeTokens.includes("const bgBody = '#1B2538';"));
  assert.ok(nativeTokens.includes("const accent = '#ED1C24';"));
  assert.ok(nativeHeader.includes("backgroundColor: '#1E293B'"));
  assert.ok(doc.includes('360 × 800') && doc.includes('390 × 844'));
});

test('include dealer, buyer and seller routes without making live mutations', () => {
  for (const id of ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'B01', 'B02', 'B03', 'S01', 'S02', 'X03']) {
    assert.ok(doc.includes('| ' + id + ' |'), 'missing screen pair ' + id);
  }
  assert.ok(doc.includes('synthetic'));
  assert.ok(doc.includes('No permission to screenshot private customer details'));
});
