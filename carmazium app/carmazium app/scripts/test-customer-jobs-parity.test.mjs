import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const requestViews = {};
runInNewContext(compile('../src/lib/serviceRequestViews.ts'), { exports: requestViews });

async function mount(items, availability = { DELIVERY: true, INSPECTION: true }) {
  const navigation = [], reads = [], settingsReads = [];
  const modules = {
    react: React,
    'react-native': { ActivityIndicator: 'Loading', FlatList: 'FlatList', RefreshControl: 'Refresh', StatusBar: 'Status', StyleSheet: { create: x => x }, Text: 'Text', TouchableOpacity: 'Touch', View: 'View' },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../../constants/colors': { Colors: {}, themeStatusBarStyle: 'dark-content' },
    '../../constants/typography': { FontFamily: {}, FontSize: {} },
    '../../constants/spacing': { Elevation: {}, Radius: {} },
    '../../lib/servicesApi': { SERVICE_LABELS: { INSPECTION: 'Vehicle inspections' }, formatPence: x => String(x), getMyServiceJobsPage: async cursor => { reads.push(cursor); return { items, nextCursor: null }; }, getServiceSettings: async () => { settingsReads.push(true); if (availability === null) throw Error('Unavailable'); return { availability }; } },
    '../../lib/serviceRequestViews': requestViews,
    '../../store/authStore': { useAuthStore: select => select({ user: { id: 'customer-fixture' } }) },
    '../../components/IconButton': { IconButton: 'IconButton' },
    '../../components/HamburgerButton': { HamburgerButton: 'Menu' },
    '../../components/Button': { Button: 'Button' },
  };
  const exports = {};
  runInNewContext(compile('../src/screens/main/CustomerServiceJobsScreen.tsx'), { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; } });
  let tree, headerTree;
  await act(async () => { tree = create(React.createElement(exports.CustomerServiceJobsScreen, { navigation: { navigate: (...args) => navigation.push(args) } })); });
  await act(async () => { headerTree = create(tree.root.findByType('FlatList').props.ListHeaderComponent); });
  return { tree, headerTree, navigation, reads, settingsReads, async dispose() { await act(async () => { headerTree.unmount(); tree.unmount(); }); } };
}

for (const items of [[], [{ id: 'past', status: 'CANCELLED' }, { id: 'active', status: 'OPEN' }]]) {
  test(`direct service requests remain available with ${items.length} existing jobs and only navigate`, async () => {
    const h = await mount(items);
    const buttons = h.headerTree.root.findAllByType('Button');
    for (const label of ['Request transport', 'Request inspection']) await act(async () => buttons.find(x => x.props.label === label).props.onPress());
    assert.deepEqual(JSON.parse(JSON.stringify(h.navigation)), [['CreateServiceJob', { serviceType: 'DELIVERY' }], ['CreateServiceJob', { serviceType: 'INSPECTION' }]]);
    assert.equal(h.reads.length, 1); assert.equal(h.settingsReads.length, 1);
    assert.deepEqual(Array.from(h.tree.root.findByType('FlatList').props.data, x => x.id), items.map(x => x.id));
    await act(async () => buttons.find(x => x.props.label === 'Quotes').props.onPress());
    assert.deepEqual(Array.from(h.tree.root.findByType('FlatList').props.data, x => x.id), items.filter(x => x.status === 'OPEN').map(x => x.id));
    await h.dispose();
  });
}

for (const availability of [{ DELIVERY: false, INSPECTION: false }, null]) {
  test(`service entry is unavailable while existing history remains accessible: ${availability === null ? 'settings failure' : 'disabled services'}`, async () => {
    const h = await mount([{ id: 'past', status: 'CANCELLED' }], availability);
    const labels = h.headerTree.root.findAllByType('Button').map(x => x.props.label);
    assert.ok(!labels.includes('Request transport')); assert.ok(!labels.includes('Request inspection'));
    assert.ok(labels.includes('TradeXchange Services')); assert.ok(labels.includes('Warranty orders'));
    assert.deepEqual(Array.from(h.tree.root.findByType('FlatList').props.data, x => x.id), ['past']);
    assert.equal(h.navigation.length, 0);
    await h.dispose();
  });
}
