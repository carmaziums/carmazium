import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('dealer with stock and no sales can view inventory and open the website report', async () => {
  const links = [];
  const response = { kpis: { totalUnitsSold: 0, totalRevenue: 0 }, inventoryHealth: { ACTIVE: 48, staleCount: 0 }, revenueTrend: [], topVehicles: [] };
  const modules = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Press', ScrollView: 'Scroll', StatusBar: 'Status', RefreshControl: 'Refresh',
      Dimensions: { get: () => ({ width: 400 }) }, Animated: { Value: class {}, View: 'View' }, StyleSheet: { create: x => x } },
    'expo-image': { Image: 'Image' }, 'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-web-browser': { openBrowserAsync: async url => links.push(url) },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    'react-native-gifted-charts': { BarChart: 'Bar', LineChart: 'Line' },
    '../../constants/colors': { Colors: {} }, '../../constants/spacing': { Radius: {}, RowDensity: { compact: {} } },
    '../../constants/typography': { FontFamily: {}, FontSize: {} },
    '../../lib/apiClient': { apiClient: async path => { assert.equal(path, '/dealers/analytics?range=30d'); return { data: response }; } },
    '../../components/ui/ErrorBanner': { ErrorBanner: 'Error' }, '../../components/ui/Skeleton': { Skeleton: 'Skeleton' },
    '../../components/Button': { Button: 'Button' }, '../../components/IconButton': { IconButton: 'IconButton' },
    '../../components/HamburgerButton': { HamburgerButton: 'Hamburger' },
  };
  const source = readFileSync(new URL('../src/screens/main/DealerAnalyticsScreen.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(compiled.outputText, { exports, URLSearchParams, require: n => { assert.ok(n in modules, n); return modules[n]; } });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.DealerAnalyticsScreen, { navigation: {} })); });
  const labels = tree.root.findAllByType('Text').flatMap(node => node.children);
  assert.ok(labels.includes('LISTINGS LIVE'));
  assert.ok(labels.includes('48'));
  assert.ok(labels.includes('Not enough sales yet to chart a trend'));
  await act(async () => tree.root.findByProps({ label: 'Full website report and CSV export' }).props.onPress());
  assert.deepEqual(links, ['https://www.carmazium.com/dashboard/dealer/analytics']);
  await act(async () => tree.unmount());
});
