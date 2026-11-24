import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function mount(platform, width, fontScale, role = 'dealer', staff = false) {
  const nav = [];
  const data = { user: { id: 'test-provider', isDealerStaff: staff }, accountRole: role };
  const modules = {
    react: React,
    'react-native': { ActivityIndicator: 'Loading', Text: 'Text', View: 'View', ScrollView: 'ScrollView', Platform: { OS: platform, isPad: false }, useWindowDimensions: () => ({ width, fontScale }), StyleSheet: { create: x => x } },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
    '../../components/WebsiteTopBar': { WebsiteTopBar: 'TopBar' },
    '../../components/Button': { Button: 'Button' },
    '../../store/authStore': { useAuthStore: select => select(data) },
    '../../hooks/useTabBarClearance': { useTabBarClearance: () => 90 },
    '../../constants/colors': { Colors: {} },
    '../../constants/typography': { FontFamily: {} },
    '../../lib/servicesApi': { getMyCapabilities: async () => ({ capabilities: [{ status: 'APPROVED', serviceType: 'DELIVERY' }, { status: 'APPROVED', serviceType: 'INSPECTION' }] }), getJobFeedPage: async () => ({}), getAssignedJobsPage: async () => ({}), formatPence: p => '£' + (p / 100).toFixed(2) },
    '../../lib/tradeXchangeProviderJobLoad': { loadAllProviderJobs: async () => ({ items: [] }), loadProviderJobLists: async () => ({ available: { items: [] }, assigned: { items: [] } }) },
  };
  const source = readFileSync(new URL('../src/screens/main/ProviderOverviewScreen.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(output, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.ProviderOverviewScreen, { navigation: { navigate: (...args) => nav.push(args) } })); });
  return { tree, nav, button: label => tree.root.findAllByType('Button').find(x => x.props.label === label) };
}
test('iPhone provider metric rows remain paired across widths, font scales and account types', async () => {
  for (const width of [320, 339, 375, 393, 430, 852]) for (const scale of [1, 1.4, 1.8, 3.1]) for (const [role, staff] of [['dealer', false], ['dealer', true], ['contractor', false]]) {
    const h = await mount('ios', width, scale, role, staff);
    const grid = h.tree.root.findByProps({ testID: 'ios-provider-metrics' });
    assert.equal(grid.children.length, 2);
    for (const row of grid.children) {
      assert.equal(row.props.style.flexDirection, 'row');
      assert.equal(row.props.style.flexWrap, 'nowrap');
      assert.equal(row.children.length, 2);
      for (const tile of row.children) { assert.equal(tile.props.style[1].flex, 1); assert.equal(tile.props.style[1].minWidth, 0); }
    }
    assert.ok(h.tree.root.findByType('ScrollView'));
    await act(async () => h.button('Find jobs').props.onPress());
    assert.equal(h.nav.at(-1)[0], 'ProviderJobs');
    assert.equal(h.nav.at(-1)[1].initialTab, 'open');
    await act(async () => h.button('My work').props.onPress());
    assert.equal(h.nav.at(-1)[1].initialTab, 'assigned');
    assert.equal(!!h.button('Dealer dashboard'), role === 'dealer');
    await act(async () => h.tree.unmount());
  }
});
test('Android provider metrics preserve existing density and accessibility scaling', async () => {
  for (const [scale, expected] of [[1, '48%'], [1.4, '100%']]) {
    const h = await mount('android', 393, scale);
    assert.equal(h.tree.root.findAllByProps({ testID: 'ios-provider-metrics' }).length, 0);
    const metrics = h.tree.root.findAllByType('View').filter(x => Array.isArray(x.props.style) && x.props.style[1]?.width);
    assert.equal(metrics.length, 4);
    assert.ok(metrics.every(x => x.props.style[1].width === expected));
    await act(async () => h.tree.unmount());
  }
});