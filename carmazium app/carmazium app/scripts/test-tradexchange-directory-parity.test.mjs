import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const read = p => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
function compile(path, modules) {
  const exports = {};
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, URL, Date, require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; } });
  return exports;
}
async function mount({ role = 'buyer', staff = false, hasDealerProfile = false, guest = false, width = 390, fontScale = 1, settings = { availability: { DELIVERY: true, INSPECTION: true, FINANCE: true, WARRANTY: true } }, fail = false } = {}) {
  const destinations = [];
  let calls = 0;
  const auth = { user: guest ? null : { id: 'test-user', isDealerStaff: staff, hasDealerProfile }, accountRole: role, isAuthenticated: !guest };
  const navigation = { navigate: (...args) => destinations.push(args), goBack() {} };
  const native = Object.fromEntries(['ScrollView', 'StatusBar', 'Text', 'TouchableOpacity', 'View'].map(name => [name, name]));
  const { ServicesScreen } = compile('screens/main/ServicesScreen.tsx', {
    react: React,
    'react-native': { ...native, StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width, fontScale }) },
    'expo-image': { Image: 'Image' },
    '../../../assets/images/live-auction-hero.webp': 'hero-asset',
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@react-navigation/native': { useNavigation: () => navigation, useFocusEffect: cb => React.useEffect(cb, [cb]) },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../../constants/colors': { Colors: {}, themeStatusBarStyle: 'dark-content' },
    '../../constants/typography': { FontFamily: {} },
    '../../components/IconButton': { IconButton: 'IconButton' },
    '../../components/HamburgerButton': { HamburgerButton: 'HamburgerButton' },
    '../../components/Button': { Button: 'Button' },
    '../../lib/servicesApi': { getServiceSettings: async () => { calls++; if (fail) throw Error('Network unavailable'); return settings; } },
    '../../store/authStore': { useAuthStore: selector => selector(auth) },
  });
  let renderer;
  await act(async () => { renderer = create(React.createElement(ServicesScreen)); });
  const cards = () => renderer.root.findAllByType('TouchableOpacity');
  const buttons = () => renderer.root.findAllByType('Button');
  const button = label => buttons().find(b => b.props.label === label);
  const card = label => cards().find(b => b.props.accessibilityLabel === label);
  const tap = async item => { assert.ok(item); await act(async () => item.props.onPress()); };
  return { renderer, cards, buttons, button, card, tap, destinations, calls: () => calls, close: () => act(async () => renderer.unmount()) };
}
test('all six native service cards are present, native routes work and the 320px layout uses one column', async () => {
  const m = await mount({ width: 320 });
  try {
    assert.equal(m.cards().length, 6);
    for (const card of m.cards()) assert.equal(card.props.style[1].width, '100%');
    await m.tap(m.card('Explore auctions'));
    await m.tap(m.card('Get transport quotes'));
    await m.tap(m.card('Request an inspection'));
    await m.tap(m.card('Explore finance'));
    await m.tap(m.card('Get a warranty quote'));
    assert.deepEqual(JSON.parse(JSON.stringify(m.destinations)), [['AuctionGuide'], ['CreateServiceJob', { serviceType: 'DELIVERY' }], ['CreateServiceJob', { serviceType: 'INSPECTION' }], ['Finance'], ['Warranty']]);
    assert.ok(m.button('My service requests'));
    assert.ok(m.button('My warranties'));
    assert.equal(m.button('Provider Dashboard'), undefined);
  } finally { await m.close(); }
});
test('business-owner access is direct, staff use dealer dashboard and specialist roles do not enter self-service setup', async () => {
  for (const [role, staff, label, target, provider, hasDealerProfile = false] of [
    ['dealer', false, 'Manage Partner Account', 'PartnerDashboard', true],
    ['contractor', false, 'Manage Partner Account', 'PartnerDashboard', true],
    ['dealer', true, 'Open dealer dashboard', 'Tabs', false],
    ['dealer', true, 'Manage Partner Account', 'PartnerDashboard', true, true],
    ['contractor', true, 'Manage Partner Account', 'PartnerDashboard', true],
    ['finance_partner', false, 'Explore Partner Accounts', 'PartnerGuide', false],
    ['insurance_partner', false, 'Explore Partner Accounts', 'PartnerGuide', false],
    ['admin', false, 'Explore Partner Accounts', 'PartnerGuide', false],
  ]) {
    const m = await mount({ role, staff, hasDealerProfile });
    try {
      assert.equal(Boolean(m.button('Provider Dashboard')), provider);
      if (provider) { await m.tap(m.button('Provider Dashboard')); assert.equal(m.destinations.at(-1)[0], 'ProviderOverview'); }
      await m.tap(m.button(label)); assert.equal(m.destinations.at(-1)[0], target);
      await m.tap(m.button('Insurance partnership')); assert.equal(m.destinations.at(-1)[1].topic, 'insurance-partnership');
    } finally { await m.close(); }
  }
});
test('guest sees services, no private account actions and does not request authenticated settings', async () => {
  const m = await mount({ guest: true });
  try {
    assert.equal(m.calls(), 0);
    assert.equal(m.button('My service requests'), undefined);
    assert.equal(m.button('Provider Dashboard'), undefined);
    assert.equal(m.card('Get transport quotes').props.disabled, false);
    await m.tap(m.card('Get transport quotes')); // GuestGate handles sign-in, not a new form.
    assert.equal(m.destinations.at(-1)[0], 'CreateServiceJob');
    await m.tap(m.button('Explore Partner Accounts'));
    assert.equal(m.destinations.at(-1)[0], 'PartnerGuide');
  } finally { await m.close(); }
});
test('unavailable services and failed settings are non-actionable without hiding existing requests', async () => {
  for (const fixture of [{ settings: { availability: { DELIVERY: false, INSPECTION: false, FINANCE: false, WARRANTY: false } } }, { fail: true }]) {
    const m = await mount(fixture);
    try {
      for (const label of ['Get transport quotes', 'Request an inspection', 'Explore finance', 'Get a warranty quote']) assert.equal(m.card(label).props.disabled, true);
      assert.ok(m.button('My service requests'));
      assert.ok(m.button('My warranties'));
      assert.equal(m.button('Request transport'), undefined);
      if (fixture.fail) { await m.tap(m.button('Retry availability')); assert.equal(m.calls(), 2); }
    } finally { await m.close(); }
  }
});
test('wide tablet and large text use adaptive service card columns', async () => {
  for (const [width, fontScale, expected] of [[768, 1, '49%'], [1100, 1, '32%'], [1100, 1.5, '100%']]) {
    const m = await mount({ width, fontScale });
    try { assert.ok(m.cards().every(card => card.props.style[1].width === expected)); } finally { await m.close(); }
  }
});
test('native content links retain validated service scope, warranty listing and contact topic', () => {
  const catalog = JSON.parse(read('data/dashboardCards.json'));
  const { nativeContentTarget: target } = compile('lib/nativeContentLinks.ts', { '../data/dashboardCards.json': catalog });
  const normalise = value => JSON.parse(JSON.stringify(value));
  for (const [path, expected] of [
    ['/services/delivery/new?kind=recovery', { name: 'CreateServiceJob', params: { serviceType: 'DELIVERY', kind: 'recovery' } }],
    ['/services/inspection/new?kind=cosmetic', { name: 'CreateServiceJob', params: { serviceType: 'INSPECTION', kind: 'cosmetic' } }],
    ['/services/inspection/new?kind=recovery', { name: 'CreateServiceJob', params: { serviceType: 'INSPECTION' } }],
    ['/services/warranty?listingId=example', { name: 'Warranty', params: { listingId: 'example' } }],
    ['/contact?topic=finance-partnership', { name: 'Contact', params: { topic: 'finance-partnership' } }],
    ['/contact?topic=invalid', { name: 'Contact' }],
    ['/services/jobs/new', { name: 'Services' }],
    ['/services', { name: 'Services' }],
    ['/auctions', { name: 'Services' }],
  ]) assert.deepEqual(normalise(target(path)), expected, path);
  for (const href of ['https://other.example/services/delivery/new', 'javascript://www.carmazium.com/services/delivery/new', 'https://name:password@www.carmazium.com/services/delivery/new', 'http://www.carmazium.com/services/delivery/new']) assert.equal(target(href), null, href);
});
