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
  const exports = {}; runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date }); return exports;
}
const stage = compile('lib/auctionSellerStage.ts');
const dealerRules = compile('lib/dealerAttention.ts', { './auctionSellerStage': stage });
const rules = compile('lib/userAttention.ts', { './auctionSellerStage': stage, './dealerAttention': dealerRules });
const defaultSummary = { success: true, data: { buyer: { counteredOffersPending: 1 }, seller: { incomingOffers: 2 }, unreadMessages: 3 } };
async function harness({ summary = async () => defaultSummary, auctions = async () => [], deliveries = async () => [{ status: 'PENDING' }], buyer = true } = {}) {
  const nav = [], apiCalls = [];
  const modules = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Press', ScrollView: 'Scroll', StatusBar: 'StatusBar', RefreshControl: 'Refresh', ActivityIndicator: 'Loading', StyleSheet: { create: x => x } },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => nav.push(args) }), useFocusEffect: effect => React.useEffect(effect, [effect]) },
    '../../store/authStore': { useAuthStore: select => select({ user: { id: 'buyer-who-also-sells' }, role: 'buyer', accountRole: 'buyer' }) },
    '../../lib/apiClient': { apiClient: async path => { apiCalls.push(path); return summary(); } },
    '../../lib/myAuctionsApi': { fetchAllMyAuctions: auctions },
    '../../lib/deliveryApi': { getReceivedDeliveryRequests: deliveries },
    '../../lib/userAttention': rules,
    '../../constants/colors': { Colors: {}, themeStatusBarStyle: 'dark-content' },
    '../../constants/typography': { FontFamily: {} },
    '../../hooks/useTabBarClearance': { useTabBarClearance: () => 100 },
    '../../components/BrandIcon': { Ionicons: 'Icon' },
    ...Object.fromEntries(['DashboardCards', 'WebsiteTopBar', 'Button'].map(name => ['../../components/' + name, { [name]: name }])),
  };
  const unified = compile('screens/account/UnifiedDashboardScreen.tsx', modules);
  const Screen = buyer ? compile('screens/buyer/BuyerDashboardScreen.tsx', { '../account/UnifiedDashboardScreen': unified }).BuyerDashboardScreen : unified.UnifiedDashboardScreen;
  let tree; await act(async () => { tree = create(React.createElement(Screen)); });
  return { tree, nav, apiCalls, text: () => tree.root.findAllByType('Text').flatMap(n => n.children).filter(x => typeof x === 'string').join(' '), tasks: () => tree.root.findAllByType('Press'), retry: () => tree.root.findAllByType('Button').find(x => x.props.label === 'Retry checks') };
}
test('buyer and seller entry points render the same website tasks, header and complete card controls', async () => {
  for (const buyer of [true, false]) {
    const h = await harness({ buyer });
    assert.equal(h.tree.root.findByType('DashboardCards').props.mode, 'personal');
    assert.equal(h.tree.root.findAllByType('WebsiteTopBar').length, 1);
    assert.match(h.text(), /My Dashboard/);
    assert.match(h.text(), /2 buyer offers are waiting for your reply/);
    assert.match(h.text(), /1 buyer asked you about delivery/);
    assert.doesNotMatch(h.text(), /ACTIVE OFFERS|TOTAL SPENT|RECENT ACTIVITY|7D|30D/);
    for (const task of h.tasks()) await act(async () => task.props.onPress());
    assert.deepEqual(h.nav.map(x => x[0]), ['SellerOffers', 'BuyerOffers', 'BuyerDeliveryRequests', 'Messages']);
    await act(async () => h.tree.unmount());
  }
});
test('auction follow-ups are visible to buyer-role sellers and open the specific auction natively', async () => {
  const h = await harness({ auctions: async () => [{ id: 'auction-a', status: 'ENDED', winnerId: null, provisionalOfferBidId: 'bid-a', provisionalOfferedAt: new Date().toISOString(), listing: { make: 'Toyota', model: 'Yaris' } }] });
  assert.match(h.tasks()[0].props.accessibilityLabel, /Toyota Yaris/);
  await act(async () => h.tasks()[0].props.onPress());
  assert.equal(h.nav[0][0], 'AuctionDeepLink'); assert.equal(h.nav[0][1].auctionId, 'auction-a');
  await act(async () => h.tree.unmount());
});
test('failed checks preserve tasks from successful sources, suppress all-clear, and can be retried', async () => {
  let fail = true;
  const h = await harness({ auctions: async () => { if (fail) throw Error('offline'); return []; } });
  assert.match(h.text(), /Some checks failed/); assert.match(h.text(), /2 buyer offers/);
  assert.doesNotMatch(h.text(), /all caught up/); assert.ok(h.retry());
  fail = false; await act(async () => h.retry().props.onPress());
  assert.doesNotMatch(h.text(), /Some checks failed/);
  await act(async () => h.tree.unmount());
});
test('malformed summary cannot become a successful empty dashboard', async () => {
  const h = await harness({ summary: async () => ({ success: true, data: {} }), deliveries: async () => [] });
  assert.match(h.text(), /Some checks failed/); assert.doesNotMatch(h.text(), /all caught up/);
  await act(async () => h.tree.unmount());
});
test('all-clear appears only after all three sources succeed with no pending tasks', async () => {
  const h = await harness({ summary: async () => ({ success: true, data: { buyer: { counteredOffersPending: 0 }, seller: { incomingOffers: 0 }, unreadMessages: 0 } }), deliveries: async () => [] });
  assert.match(h.text(), /all caught up/); assert.equal(h.tasks().length, 0);
  await act(async () => h.tree.unmount());
});

async function dealerHarness({ permitted = true, failUnread = false, accessLoading = false } = {}) {
  const nav = [], endpoints = [], collections = [];
  const modules = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Press', ActivityIndicator: 'Loading', StyleSheet: { create: x => x } },
    '@react-navigation/native': { useNavigation: () => ({ navigate: (...args) => nav.push(args) }), useFocusEffect: effect => React.useEffect(effect, [effect]) },
    '../../components/DashboardCards': { DashboardCards: 'DashboardCards' },
    '../../components/Button': { Button: 'Button' },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../../constants/colors': { Colors: {} }, '../../constants/typography': { FontFamily: {} },
    '../../lib/dealerAttention': dealerRules,
    '../../lib/apiClient': { apiClient: async path => {
      endpoints.push(path);
      if (path === '/dashboard/dealer') return { data: { isVerified: true } };
      if (path === '/chat/unread' && failUnread) throw Error('offline');
      return { data: { count: path === '/offers/pending-count' ? 2 : 0 } };
    } },
    '../../lib/myAuctionsApi': { fetchAllMyAuctions: async kind => {
      collections.push(kind);
      return kind === 'won'
        ? [{ id: 'won-a', status: 'ENDED', buyerFeePaid: false, buyerFeeDeadlineAt: new Date().toISOString(), listing: { make: 'Ford', model: 'Focus' } }]
        : [
          { id: 'own-a', status: 'ENDED', provisionalOfferBidId: 'bid-a', provisionalOfferedAt: new Date().toISOString(), listing: { make: 'Toyota', model: 'Yaris' } },
          { id: 'waiting-a', status: 'ENDED', winnerId: 'winner', buyerFeePaid: false },
        ];
    } },
  };
  const { DealerWebParityOverview } = compile('screens/main/DealerWebParityOverview.tsx', modules);
  let tree; await act(async () => { tree = create(React.createElement(DealerWebParityOverview, {
    userName: 'Dealer', canManageInventory: permitted, canManageCrm: permitted,
    canManageOffers: permitted, canViewPurchases: permitted, canViewTrade: permitted,
    canViewAnalytics: permitted, accessLoading, onNavigate: target => nav.push([target]),
  })); });
  return { tree, nav, endpoints, collections, tasks: () => tree.root.findAllByType('Press'), text: () => tree.root.findAllByType('Text').flatMap(n => n.children).filter(x => typeof x === 'string').join(' ') };
}
test('dealer uses website priority, specific vehicle/deadline and correct handover eligibility', async () => {
  const h = await dealerHarness();
  assert.deepEqual(h.collections, ['won', 'list']);
  const labels = h.tasks().map(t => t.props.accessibilityLabel);
  assert.match(labels[0], /Toyota Yaris/); assert.match(labels[1], /Ford Focus/); assert.match(labels[2], /2 buyer offers/);
  assert.equal(labels.length, 3, 'unpaid buyer fee must not prematurely require seller handover');
  for (const task of h.tasks()) await act(async () => task.props.onPress());
  assert.equal(h.nav[0][0], 'AuctionDeepLink'); assert.equal(h.nav[0][1].auctionId, 'own-a');
  assert.equal(h.nav[1][0], 'won-auctions'); assert.equal(h.nav[2][0], 'offers');
  await act(async () => h.tree.unmount());
});
test('dealer staff cannot fetch forbidden collections and unread failure never renders an all-clear', async () => {
  const h = await dealerHarness({ permitted: false, failUnread: true });
  assert.deepEqual(h.collections, []); assert.ok(!h.endpoints.includes('/offers/pending-count'));
  assert.match(h.text(), /Some checks failed/); assert.doesNotMatch(h.text(), /all caught up/);
  await act(async () => h.tree.unmount());
});
test('dealer waits for permission loading instead of showing a false all-clear', async () => {
  const h = await dealerHarness({ permitted: false, accessLoading: true });
  assert.deepEqual(h.endpoints, []); assert.equal(h.tree.root.findAllByType('Loading').length, 1);
  assert.doesNotMatch(h.text(), /all caught up/); await act(async () => h.tree.unmount());
});
