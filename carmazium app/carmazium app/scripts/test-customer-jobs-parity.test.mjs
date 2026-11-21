import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(items) {
  const navigation = [], choices = [], reads = [];
  const modules = {
    react: React,
    'react-native': { ActivityIndicator: 'Loading', Alert: { alert: (...args) => choices.push(args) }, FlatList: 'FlatList', RefreshControl: 'Refresh', StatusBar: 'Status', StyleSheet: { create: x => x }, Text: 'Text', TouchableOpacity: 'Touch', View: 'View' },
    '@react-navigation/native': { useFocusEffect: React.useEffect },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../../constants/colors': { Colors: {}, themeStatusBarStyle: 'dark-content' },
    '../../constants/typography': { FontFamily: {}, FontSize: {} },
    '../../constants/spacing': { Elevation: {}, Radius: {} },
    '../../lib/servicesApi': { SERVICE_LABELS: { INSPECTION: 'Vehicle inspections' }, formatPence: x => String(x), getMyServiceJobsPage: async cursor => { reads.push(cursor); return { items, nextCursor: null }; } },
    '../../components/IconButton': { IconButton: 'IconButton' },
    '../../components/HamburgerButton': { HamburgerButton: 'Menu' },
    '../../components/Button': { Button: 'Button' },
  };
  // Match the focus hook's stable callback semantics rather than running it on every render.
  modules['@react-navigation/native'].useFocusEffect = callback => React.useEffect(callback, [callback]);
  const exports = {};
  const source = readFileSync(new URL('../src/screens/main/CustomerServiceJobsScreen.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; } });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.CustomerServiceJobsScreen, { navigation: { navigate: (...args) => navigation.push(args) } })); });
  return { tree, navigation, choices, reads };
}

for (const items of [[], [{ id: 'past', status: 'CANCELLED' }, { id: 'active', status: 'OPEN' }]]) {
  test(`job posting remains available with ${items.length} existing jobs and only navigates`, async () => {
    const h = await mount(items);
    const buttons = h.tree.root.findAllByType('Button');
    await act(async () => buttons.find(x => x.props.label === 'Post a Job').props.onPress());
    assert.equal(h.choices.length, 1);
    const options = h.choices[0][2];
    options.find(x => x.text === 'Delivery or recovery').onPress();
    options.find(x => x.text === 'Vehicle inspection').onPress();
    assert.deepEqual(JSON.parse(JSON.stringify(h.navigation)), [['CreateServiceJob', { serviceType: 'DELIVERY' }], ['CreateServiceJob', { serviceType: 'INSPECTION' }]]);
    assert.equal(h.reads.length, 1);
    if (items.length) assert.deepEqual(Array.from(h.tree.root.findByType('FlatList').props.data, x => x.id), ['active', 'past']);
    await act(async () => h.tree.unmount());
  });
}
