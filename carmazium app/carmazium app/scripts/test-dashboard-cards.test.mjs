import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(path, modules = {}) {
  const source = readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, URL, setTimeout, clearTimeout }); return exports;
}
const preferences = compile('lib/dashboardPreferences.ts');
const menu = compile('lib/dashboardNavigation.ts');
test('saved layout tolerates corruption, adds new tools and cannot restore revoked permissions', () => {
  const invalid = preferences.parseDashboardPreferences('{broken');
  assert.equal(invalid.order.length, 0);
  const saved = preferences.parseDashboardPreferences(JSON.stringify({ order: ['removed', 'messages', 'messages', 42], hidden: ['stock'] }));
  const permitted = [{ id: 'stock' }, { id: 'messages' }, { id: 'new-tool' }];
  assert.deepEqual(Array.from(preferences.orderDashboardItems(permitted, saved), x => x.id), ['messages', 'stock', 'new-tool']);
  const revoked = preferences.orderDashboardItems(permitted.filter(x => x.id !== 'stock'), saved);
  assert.ok(!revoked.some(x => x.id === 'stock'));
});
async function harness(mode = 'personal', permissions = [], dimensions = { width: 360, fontScale: 1 }, platform = 'android') {
  const saved = new Map(), nav = [], writes = [];
  let userId = 'account-a', failSave = false;
  const modules = {
    react: React, 'react-native': { ActivityIndicator: 'Loading', Text: 'Text', View: 'View', TouchableOpacity: 'Press', Platform: { OS: platform }, StyleSheet: { create: x => x }, useWindowDimensions: () => dimensions },
    '@react-native-async-storage/async-storage': { getItem: async key => saved.get(key) || null, setItem: async (key, value) => { writes.push(key); if (failSave) throw Error('disk'); saved.set(key, value); } },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => nav.push(args) }) },
    './BrandIcon': { Ionicons: 'Icon', MaterialCommunityIcons: 'Icon' }, './Button': { Button: 'Button' },
    '../constants/colors': { Colors: {} }, '../constants/typography': { FontFamily: {}, FontSize: { '2xl': 24, lg: 18, base: 15, sm: 13, xs: 11 } },
    '../store/authStore': { useAuthStore: select => select({ user: { id: userId } }) },
    '../hooks/useDealerAccess': { useDealerAccess: () => ({ loading: false, hasPermission: key => permissions.includes(key) }) },
    '../lib/dashboardNavigation': menu, '../lib/dashboardPreferences': preferences,
  };
  const { DashboardCards } = compile('components/DashboardCards.tsx', modules);
  let tree; await act(async () => { tree = create(React.createElement(DashboardCards, { mode })); });
  const button = label => tree.root.findAllByType('Button').find(x => x.props.label === label);
  const press = label => tree.root.findAllByType('Press').find(x => x.props.accessibilityLabel === label);
  const cards = () => tree.root.findAllByType('Press').filter(x => x.props.accessibilityRole === 'button' && !x.props.accessibilityLabel.startsWith('Move ')).map(x => x.props.accessibilityLabel);
  return { tree, button, press, cards, saved, writes, nav, fail: value => { failSave = value; }, account: async id => { userId = id; await act(async () => tree.update(React.createElement(DashboardCards, { mode }))); } };
}
test('customisation persists hide/order, restores after account switch, and navigation stays native', async () => {
  const h = await harness();
  await act(async () => h.press('Purchases').props.onPress());
  assert.equal(h.nav[0][0], 'BuyerPurchaseHistory');
  await act(async () => h.press('Buy Cars').props.onPress());
  assert.equal(h.nav[1][0], 'Tabs');
  assert.equal(h.nav[1][1].screen, 'Search');
  await act(async () => h.button('Customise').props.onPress());
  await act(async () => h.press('Show My Cars').props.onPress());
  await act(async () => h.press('Move Messages earlier').props.onPress());
  await act(async () => h.button('Done').props.onPress());
  assert.ok(!h.cards().includes('My Cars'));
  const order = h.cards();
  await h.account('account-b');
  assert.ok(h.cards().includes('My Cars'), 'another account must not inherit hidden cards');
  await h.account('account-a');
  assert.deepEqual(h.cards(), order);
  await act(async () => h.button('Customise').props.onPress());
  await act(async () => h.button('Reset layout').props.onPress());
  await act(async () => h.button('Done').props.onPress());
  assert.ok(h.cards().includes('My Cars'));
  await act(async () => h.tree.unmount());
});
test('dealer staff do not receive forbidden cards, including via persisted ordering', async () => {
  const h = await harness('dealer', ['VIEW_INVENTORY', 'MANAGE_OFFERS']);
  assert.ok(h.cards().includes('Stock')); assert.ok(h.cards().includes('Bids & Offers'));
  for (const forbidden of ['Team', 'Add Vehicle', 'Analytics', 'Purchases', 'Live Auctions']) assert.ok(!h.cards().includes(forbidden), forbidden);
  await act(async () => h.press('Stock').props.onPress());
  assert.equal(h.nav[0][0], 'Tabs'); assert.equal(h.nav[0][1].screen, 'DealerStock');
  await act(async () => h.tree.unmount());
});
test('failed storage is visible and retry saves the current layout', async () => {
  const h = await harness(); h.fail(true);
  await act(async () => h.button('Customise').props.onPress());
  await act(async () => h.press('Show My Cars').props.onPress());
  assert.ok(h.button('Retry save')); h.fail(false);
  await act(async () => h.button('Retry save').props.onPress());
  const persisted = JSON.parse(h.saved.get('carmazium:dashboard:v1:account-a:personal'));
  assert.ok(persisted.hidden.includes('user-cars'));
  await act(async () => h.tree.unmount());
});

test('Android rounded 140 percent text uses a full-width dashboard card', async () => {
  const h = await harness('personal', [], { width: 600, fontScale: 1.399999976 });
  const card = h.press('Buy Cars').parent;
  assert.equal(card.props.style[1].width, 560);
  await act(async () => h.tree.unmount());
});

test('dealer Saved card opens an explicit native screen, not a hidden tab or website', async () => {
  const h = await harness('dealer', ['VIEW_TRADE', 'VIEW_INVENTORY', 'MANAGE_OFFERS']);
  assert.ok(h.cards().includes('Saved'));
  await act(async () => h.press('Saved').props.onPress());
  assert.deepEqual(h.nav.at(-1), ['DealerSaved', undefined]);
  await act(async () => h.tree.unmount());
});

test('iPhone personal and dealer layouts use measured grid width and preserve two columns', async () => {
  for (const width of [375, 390, 393, 430]) {
    for (const fontScale of [1, 1.4, 1.6]) {
      for (const [mode, permissions, label] of [['personal', [], 'Sell a Car'], ['dealer', ['MANAGE_INVENTORY', 'VIEW_INVENTORY', 'VIEW_TRADE'], 'Add Vehicle']]) {
        const h = await harness(mode, permissions, { width, fontScale }, 'ios');
        const press = h.press(label);
        assert.ok(press, mode);
        assert.equal(press.parent.props.style[1].width, Math.floor((width - 56) / 2));
        assert.equal(press.props.style[1].minHeight, 132);
        assert.equal(press.props.style[1].padding, 12);
        const grid = h.tree.root.findAllByType('View').find(x => typeof x.props.onLayout === 'function');
        const measured = width - 68.5;
        await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: measured } } }));
        const cardWidth = h.press(label).parent.props.style[1].width;
        assert.equal(cardWidth, Math.floor((measured - 16) / 2));
        assert.ok(cardWidth * 2 + 16 <= measured);
        await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 0 } } }));
        assert.equal(h.press(label).parent.props.style[1].width, cardWidth);
        await act(async () => h.tree.unmount());
      }
    }
  }
});
test('iPhone narrow screens and large accessibility text retain a single column', async () => {
  for (const [width, fontScale] of [[320, 1], [393, 1.8]]) {
    const h = await harness('personal', [], { width, fontScale }, 'ios');
    assert.equal(h.press('Sell a Car').parent.props.style[1].width, width - 40);
    const grid = h.tree.root.findAllByType('View').find(x => typeof x.props.onLayout === 'function');
    await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: width - 60.5 } } }));
    assert.equal(h.press('Sell a Car').parent.props.style[1].width, Math.floor(width - 60.5));
    await act(async () => h.tree.unmount());
  }
});
test('Android ordinary dashboard dimensions remain unchanged and do not measure the iOS grid', async () => {
  const h = await harness('personal', [], { width: 393, fontScale: 1 }, 'android');
  assert.equal(h.press('Sell a Car').parent.props.style[1].width, (393 - 56) / 2);
  assert.equal(h.tree.root.findAllByType('View').some(x => typeof x.props.onLayout === 'function'), false);
  await act(async () => h.tree.unmount());
});