import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/SiteMenu.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const modules = {
  react: { createElement: () => null, useState: () => [null, () => {}] },
  'react-native': { ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'Touch', View: 'View', StyleSheet: { create: x => x } },
  '../lib/themePreference': { getThemePreference: () => 'light', promptThemeChange() {}, resolveThemeMode: () => 'light' },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  '@/components/BrandIcon': { Ionicons: 'Ionicon', MaterialCommunityIcons: 'MaterialIcon' },
  '../constants/colors': { Colors: {} },
  '../constants/spacing': { Radius: {} },
  '../constants/typography': { FontFamily: {}, FontSize: {} },
};
const exports = {};
runInNewContext(code, {
  exports,
  require: name => {
    if (!(name in modules)) throw Error('Missing SiteMenu dependency: ' + name);
    return modules[name];
  },
});
const { buildSiteGroups } = exports;

function entry(groups, groupId, entryId) {
  const group = groups.find(item => item.id === groupId);
  assert.ok(group, 'Missing group: ' + groupId);
  const result = group.entries.find(item => item.id === entryId);
  assert.ok(result, 'Missing entry: ' + entryId);
  return result;
}

test('TradeXchange Vehicle Auctions opens the same native live auction destination as Buy Cars', () => {
  for (const dealer of [false, true]) {
    const groups = buildSiteGroups(dealer);
    const tradeAuction = entry(groups, 'trade', 'tx-auctions');
    const buyAuction = entry(groups, 'buy', 'auctions');
    const expected = dealer ? 'DealerBuyBid' : 'Live';
    assert.equal(tradeAuction.target.tab, expected);
    assert.equal(buyAuction.target.tab, expected);
    assert.equal(tradeAuction.target.screen, undefined);
    assert.equal(tradeAuction.target.web, undefined);
    assert.equal(tradeAuction.target.tabParams?.initialSection, dealer ? 'live' : undefined);
    assert.equal(tradeAuction.label, 'Vehicle Auctions');
  }
});

test('TradeXchange jobs remain native and retain their distinct posting and provider routes', () => {
  const groups = buildSiteGroups(false);
  for (const [key, service] of [['tx-delivery', 'DELIVERY'], ['tx-inspection', 'INSPECTION']]) {
    const e = entry(groups, 'trade', key);
    assert.equal(e.actions.find(a => a.id === service + '-post').target.screen, 'CreateServiceJob');
    assert.equal(e.actions.find(a => a.id === service + '-post').target.params.serviceType, service);
    assert.equal(e.actions.find(a => a.id === service + '-bid').target.screen, 'ProviderJobs');
  }
});

test('website TradeXchange auction menus agree with native live-auction target', () => {
  const webHeader = readFileSync(new URL('../../../src/components/layout/Header.tsx', import.meta.url), 'utf8');
  const destinations = [...webHeader.matchAll(/name: "Vehicle Auctions", href: "([^"]+)"/g)];
  assert.equal(destinations.length, 2, 'website mobile and desktop menus must both be checked');
  assert.ok(destinations.every(match => match[1] === '/auctions/browse'));
  // The live catalogue is KYC gated; a navigation link cannot bypass that.
  const browse = readFileSync(new URL('../../../src/app/auctions/browse/page.tsx', import.meta.url), 'utf8');
  assert.match(browse, /canAccessTradeStock|RequireAuth/);
});
