import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = new URL('../../../', import.meta.url);
function compile(path, modules, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals }); return exports;
}
const prefs = compile('src/lib/dashboardPreferences.ts', {});
const catalog = JSON.parse(readFileSync(new URL('src/data/dashboardCards.json', root), 'utf8'));
async function harness(mode = 'personal', permissions = []) {
  const saved = new Map(); let account = 'buyer-a', fail = false;
  const modules = {
    'react/jsx-runtime': await import('react/jsx-runtime'), react: React,
    'next/link': 'a', 'lucide-react': new Proxy({}, { get: () => 'svg' }),
    '@/context/AuthContext': { useAuth: () => ({ user: { id: account } }) },
    '@/context/DealerAccessContext': { useDealerAccess: () => ({ loading: false, hasPermission: p => permissions.includes(p) }) },
    '@/components/ui/Button': { Button: 'button' }, '@/data/dashboardCards.json': catalog,
    '@/lib/dashboardPreferences': prefs,
  };
  const { DashboardCards } = compile('src/components/dashboard/DashboardCards.tsx', modules, { localStorage: { getItem: key => saved.get(key), setItem: (key, value) => { if (fail) throw Error('storage'); saved.set(key, value); } } });
  let tree; await act(async () => { tree = create(React.createElement(DashboardCards, { mode })); });
  const button = label => tree.root.findAllByType('button').find(n => n.props['aria-label'] === label || n.props.children === label);
  const cards = () => tree.root.findAllByType('a').map(n => n.props['aria-label']);
  return { tree, button, cards, saved, fail: v => { fail = v; }, switch: async next => { account = next; await act(async () => tree.update(React.createElement(DashboardCards, { mode }))); } };
}
test('website cards preserve visibility/order per account and restore after a fresh mount', async () => {
  const h = await harness(); assert.equal(h.cards().length, catalog.personal.length);
  await act(async () => h.button('Customise').props.onClick());
  await act(async () => h.button('Show My Cars').props.onClick());
  await act(async () => h.button('Move Messages earlier').props.onClick());
  await act(async () => h.button('Done').props.onClick());
  assert.ok(!h.cards().includes('My Cars')); const order = h.cards();
  await h.switch('buyer-b'); assert.ok(h.cards().includes('My Cars'));
  await h.switch('buyer-a'); assert.deepEqual(h.cards(), order);
  await act(async () => h.tree.unmount());
});
test('website staff permission filtering matches native cards and offers-only fallback', async () => {
  const h = await harness('dealer', ['VIEW_INVENTORY', 'MANAGE_OFFERS']);
  assert.ok(h.cards().includes('Stock')); assert.ok(h.cards().includes('Bids & Offers'));
  for (const name of ['Team', 'Analytics', 'Add Vehicle', 'Guest Enquiries', 'Live Auctions', 'Purchases']) assert.ok(!h.cards().includes(name), name);
  assert.equal(h.tree.root.findAllByType('a').find(n => n.props['aria-label'] === 'Bids & Offers').props.href, '/dashboard/dealer/my-offers');
  await act(async () => h.tree.unmount());
});
test('website failed preference writes remain visible and can be retried', async () => {
  const h = await harness(); h.fail(true);
  await act(async () => h.button('Customise').props.onClick());
  await act(async () => h.button('Show My Cars').props.onClick());
  assert.ok(h.tree.root.findAll(n => n.props.role === 'alert').length);
  h.fail(false); await act(async () => h.button('Retry save').props.onClick());
  assert.ok(JSON.parse(h.saved.get('carmazium:dashboard:v1:buyer-a:personal')).hidden.includes('user-cars'));
  await act(async () => h.tree.unmount());
});
