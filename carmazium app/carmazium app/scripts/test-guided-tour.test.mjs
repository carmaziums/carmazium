import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(path, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { exports, URLSearchParams, setTimeout: () => 1, clearTimeout() {}, require: name => {
    assert.ok(name in modules, name); return modules[name];
  } });
  return exports;
}
const content = compile('lib/guidedTourContent.ts');
const routes = compile('lib/nativeTourRoutes.ts');
const nativeCompletion = compile('lib/nativeTourCompletion.ts');
test('native tour keeps the exact approved website copy for narration', () => {
  const website = readFileSync(new URL('../../../src/lib/guidedWebsiteTour.ts', import.meta.url), 'utf8');
  const native = readFileSync(new URL('../src/lib/guidedTourContent.ts', import.meta.url), 'utf8');
  assert.equal(native.slice(native.indexOf('export type GuidedStep')), website.slice(website.indexOf('export type GuidedStep')));
});
test('every dealer, personal and contractor tour destination has a native route', () => {
  for (const role of ['BUYER', 'SELLER', 'DEALER', 'CONTRACTOR']) {
    const steps = content.getGuidedWebsiteSteps({ id: 'test', role, dealerProfile: role === 'DEALER' ? {} : undefined });
    for (const step of steps) if (step.href) assert.ok(routes.nativeTourDestination(step.href), role + ': ' + step.href);
    assert.equal(new Set(steps.map(step => step.id)).size, steps.length);
  }
});
test('tour navigation keeps personal offers, retail offers and provider tabs distinct', () => {
  assert.equal(routes.nativeTourDestination('/dashboard/user?tab=bids').screen, 'BuyerOffers');
  assert.equal(routes.nativeTourDestination('/dashboard/dealer/bids?tab=retail').screen, 'DealerMyOffers');
assert.equal(routes.nativeTourDestination('/dashboard/dealer/wishlist').screen, 'DealerSaved');
  assert.equal(routes.nativeTourDestination('/dashboard/service/jobs?tab=mine').params.initialTab, 'assigned');
  assert.equal(routes.nativeTourDestination('/profile?section=appearance').params.section, 'appearance');
  assert.equal(routes.nativeTourDestination('https://example.test'), null);
  assert.equal(routes.nativeTourDestination('/profile?section=delete'), null);
});
async function mount({ acknowledged = true, nativeAcknowledged = false, failSave = false, replay = true } = {}) {
  const calls = [], nav = [], notices = [];
  const auth = { user: { id: 'personal-test' }, accountRole: 'buyer', isAuthenticated: true, hasCompletedOnboarding: true };
  const state = { openFor: replay ? auth.user.id : null, replay(id) { state.openFor = id; }, close() { state.openFor = null; } };
  let onRoute; let actualRoute = { name: 'Profile' };
  const apiClient = async (path, options) => {
    calls.push([path, options]);
    if (options && failSave) throw Error('offline');
    return { data: { id: auth.user.id, preferences: { websiteIntroductionV2: acknowledged ? { version: 2, status: 'skipped' } : undefined } } };
  };
  const modules = {
    react: React, 'react-native': {
      ...Object.fromEntries(['View', 'Text', 'Modal', 'ScrollView', 'TouchableOpacity'].map(name => [name, name])),
      StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 800 }),
      Alert: { alert: (...args) => notices.push(args) },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../constants/colors': { Colors: {} },
    '../constants/typography': { FontSize: { sm: 13, base: 15, md: 16, size22: 22 } },
    '../lib/nativeTourCompletion': nativeCompletion,
    '@react-native-async-storage/async-storage': {
      getItem: async () => nativeAcknowledged ? 'completed' : null,
      setItem: async () => {},
    },
    '../store/authStore': { useAuthStore: Object.assign(() => auth, { getState: () => auth }) },
    '../store/guidedTourStore': { useGuidedTourStore: () => state },
    '../lib/guidedTourContent': content, '../lib/nativeTourRoutes': routes,
    '../lib/navigationRef': { navigationRef: { addListener(event, fn) { onRoute = fn; return () => {}; },
      getCurrentRoute: () => actualRoute, isReady: () => true, navigate: (...args) => nav.push(args) } },
    '../lib/apiClient': { apiClient }, './NativeTourVoice': { NativeTourVoice: 'Voice' },
  };
  const { NativeGuidedTour } = compile('components/NativeGuidedTour.tsx', modules);
  let tree; const rerender = () => act(async () => { tree.update(React.createElement(NativeGuidedTour)); });
  await act(async () => { tree = create(React.createElement(NativeGuidedTour)); });
  const press = label => act(async () => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === label).props.onPress());
  return { tree, calls, nav, notices, auth, state, press, rerender, onRoute: () => act(async () => onRoute()), focus: route => act(async () => { actualRoute = route; onRoute(); }) };
}
test('tour Next, Back and topic navigation do not submit business mutations', async () => {
  const h = await mount();
  await h.press('Start tour'); assert.equal(h.nav.at(-1)[1].screen, 'UnifiedDashboard');
  await h.press('Next'); assert.equal(h.nav.at(-1)[1].screen, 'Tabs'); assert.equal(h.nav.at(-1)[1].params.screen, 'Search');
  await h.press('Back'); assert.equal(h.nav.at(-1)[1].screen, 'UnifiedDashboard');
  await h.press('Jump to a topic');
  const settings = h.tree.root.findAllByType('TouchableOpacity').find(node => /Personal details/.test(node.props.accessibilityLabel ?? ''));
  await act(async () => settings.props.onPress()); assert.equal(h.nav.at(-1)[1].screen, 'Settings');
  assert.equal(h.calls.filter(([, options]) => options).length, 0);
  await act(async () => h.tree.unmount());
});
test('skip only saves the existing introduction preference and replay remains available', async () => {
  const h = await mount(); await h.press('Skip tour'); await h.rerender();
  assert.equal(h.state.openFor, null); assert.equal(h.tree.root.findAllByType('Modal').length, 0);
  const writes = h.calls.filter(([, options]) => options);
  assert.equal(writes.length, 1); assert.equal(writes[0][0], '/users/me/introduction');
  assert.deepEqual(JSON.parse(writes[0][1].body), { action: 'tour_skipped', version: 2 });
  h.state.replay(h.auth.user.id); await h.rerender();
  assert.equal(h.tree.root.findAllByType('Modal').length, 1);
  await act(async () => h.tree.unmount());
});
test('failed preference save offers retry and cannot write for a switched account', async () => {
  const h = await mount({ failSave: true }); await h.press('Skip tour'); await h.rerender();
  const retry = h.tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === 'Retry saving');
  assert.ok(retry); const count = h.calls.length;
  h.auth.user = { id: 'different-user' }; await act(async () => retry.props.onPress());
  assert.equal(h.calls.length, count); await h.rerender();
  assert.equal(h.tree.root.findAllByType('Modal').length, 0);
  await act(async () => h.tree.unmount());
});
test('website acknowledgement does not suppress a first native tour', async () => {
  const h = await mount({ replay: false, acknowledged: true, nativeAcknowledged: false });
  await h.onRoute(); await h.rerender();
  assert.equal(h.state.openFor, h.auth.user.id);
  assert.equal(h.calls.length, 0);
  await act(async () => h.tree.unmount());
});

test('the full native tour advances across every topic without submitting business actions', async () => {
  const h = await mount();
  const steps = content.getGuidedWebsiteSteps({ id: 'personal-test', role: 'BUYER' });
  for (let index = 1; index < steps.length; index++) {
    await h.press(index === 1 ? 'Start tour' : 'Next');
  }
  assert.equal(h.calls.filter(([, options]) => options).length, 0);
  await h.press('Finish tour');
  assert.equal(h.calls.filter(([path]) => path === '/users/me/introduction').length, 1);
  await act(async () => h.tree.unmount());
});

test('completed native tour does not repeat automatically, but manual replay still works', async () => {
  const h = await mount({ replay: false, nativeAcknowledged: true });
  await h.onRoute(); await h.rerender();
  assert.equal(h.state.openFor, null);
  h.state.replay(h.auth.user.id);
  await h.rerender();
  assert.equal(h.tree.root.findAllByType('Modal').length, 1);
  await act(async () => h.tree.unmount());
});

test('tour pauses voice and hides incorrect background until actual leaf route and section match', async () => {
  const h = await mount();
  await h.press('Start tour');
  assert.equal(h.tree.root.findByType('Voice').props.ready, false);
  await h.focus({ name: 'UnifiedDashboard' });
  assert.equal(h.tree.root.findByType('Voice').props.ready, true);
  await h.press('Next');
  assert.equal(h.tree.root.findByType('Voice').props.ready, false);
  await h.focus({ name: 'Search' });
  assert.equal(h.tree.root.findByType('Voice').props.ready, true);
  assert.equal(routes.nativeTourRouteMatches(routes.nativeTourDestination('/dashboard/service/jobs?tab=mine'), { name: 'ProviderJobs', params: { initialTab: 'open' } }), false);
  assert.equal(routes.nativeTourRouteMatches(routes.nativeTourDestination('/dashboard/service/jobs?tab=mine'), { name: 'ProviderJobs', params: { initialTab: 'assigned' } }), true);
  await act(async () => h.tree.unmount());
});
test('dealer auctions open the real dealer tab and contractor business opens its native setup', () => {
  const dealer = routes.nativeTourDestination('/auctions/browse', 'dealer');
  assert.equal(dealer.screen, 'Tabs');
  assert.equal(dealer.params.screen, 'DealerBuyBid');
  assert.equal(dealer.params.params.initialSection, 'live');
  assert.equal(routes.nativeTourRouteMatches(dealer, { name: 'DealerBuyBid', params: { initialSection: 'bids' } }), false);
  assert.equal(routes.nativeTourRouteMatches(dealer, { name: 'DealerBuyBid', params: { initialSection: 'live' } }), true);
  const contractor = routes.nativeTourDestination('/profile?section=business', 'contractor');
  assert.equal(contractor.screen, 'PartnerDashboard');
  assert.equal(contractor.params.openSection, 'business');
});