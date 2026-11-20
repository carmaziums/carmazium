import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('admin overview honours website preferences, paths, empty selections and save retries', async () => {
  const web = readFileSync(new URL('../../../src/app/dashboard/admin/page.tsx', import.meta.url), 'utf8');
  const catalog = [...web.matchAll(/id: "(\w+)",\s+label: "([^"]+)",\s+href: "([^"]+)",\s+description:/g)];
  assert.equal(catalog.length, 18);
  const calls = [], paths = [];
  let stored = ['blog', 'invalid', 'blog'];
  let failSave = true;
  const apiClient = async (path, options) => {
    assert.equal(path, '/users/me');
    if (!options) return { data: { preferences: { adminDashboardCardIds: stored } } };
    assert.equal(options.method, 'PATCH');
    const body = JSON.parse(options.body);
    calls.push(body);
    if (failSave) throw new Error('simulated failure');
    stored = body.preferences.adminDashboardCardIds;
  };
  const modules = {
    react: React,
    'react-native': { TouchableOpacity: 'Press', View: 'View', Text: 'Text', StyleSheet: { create: s => s } },
    '@react-navigation/native': { useFocusEffect: cb => React.useEffect(cb, [cb]) },
    '../../components/Button': { Button: 'Button' },
    '../../components/ui/Card': { Card: 'Card' },
    '../../components/ui/ErrorBanner': { ErrorBanner: 'ErrorBanner' },
    '../../constants/colors': { Colors: {} },
    '../../constants/typography': { Type: {}, TextPresets: {} },
    '../../lib/apiClient': { apiClient },
    '../../lib/adminApi': { getPendingHandovers: async () => [{}, {}] },
    './adminShared': { adminStyles: {}, formatPrice: String, openAdminWeb: p => paths.push(p) },
  };
  const source = readFileSync(new URL('../src/screens/admin/AdminOverviewCards.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(compiled.outputText, { exports, require: n => { assert.ok(n in modules, n); return modules[n]; } });
  let tree;
  const mount = () => act(async () => { tree = create(React.createElement(exports.AdminOverviewCards, { stats: null })); });
  await mount();
  const buttons = () => tree.root.findAllByType('Press');
  const choose = label => act(async () => tree.root.findByProps({ label }).props.onPress());
  const toggle = label => act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress());
  assert.deepEqual(buttons().map(b => b.props.accessibilityLabel), ['Open Blog admin page']);
  await choose('Customize cards');
  assert.deepEqual(buttons().map(b => b.props.accessibilityLabel), catalog.map(c => c[2]));
  await toggle('Blog');
  await choose('Save cards');
  assert.deepEqual(calls.pop(), { preferences: { adminDashboardCardIds: [] } });
  assert.equal(tree.root.findAllByType('ErrorBanner').length, 1);
  failSave = false;
  await choose('Save cards');
  assert.deepEqual(buttons(), []);
  await choose('Customize cards');
  await choose('Reset to defaults');
  await choose('Cancel');
  assert.deepEqual(buttons(), []);
  await choose('Customize cards');
  for (const [, , label] of catalog) await toggle(label);
  await choose('Save cards');
  assert.deepEqual(stored, catalog.map(c => c[1]));
  for (const [, , label] of catalog) await toggle('Open ' + label + ' admin page');
  assert.deepEqual(paths, catalog.map(c => c[3]));
  await act(async () => tree.unmount());
  stored = undefined;
  await mount();
  assert.equal(buttons().length, 6);
  await act(async () => tree.unmount());
});
