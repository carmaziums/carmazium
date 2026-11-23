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
  const source = readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
      esModuleInterop: true, target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  runInNewContext(code, {
    exports, URL, Error, setTimeout, clearTimeout,
    require: name => {
      assert.ok(Object.hasOwn(modules, name), 'Unexpected dependency: ' + name);
      return modules[name];
    },
  });
  return exports;
}

const journey = compile('lib/serviceJobJourney.ts');
const dates = compile('lib/ukServiceDateTime.ts');
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const provider = {
  id: 'provider-1', businessName: 'Synthetic Inspection Co', phone: null,
  rating: 4.5, totalReviews: 2, serviceArea: 'Birmingham',
  user: { firstName: 'Synthetic', lastName: 'Provider' },
};
function jobFixture(status = 'RELEASED') {
  return {
    id: 'job-1', customerId: 'customer-a', viewerRole: 'customer',
    serviceType: 'INSPECTION', isRecovery: false, status,
    title: 'Synthetic two-vehicle inspection', description: 'Check both vehicles.',
    servicePostcode: 'B1 1AA', serviceAddress: '1 Synthetic Street',
    pickupPostcode: null, pickupAddress: null, deliveryPostcode: null, deliveryAddress: null,
    requestedFor: '2026-11-24T10:00:00Z', expiresAt: '2099-11-30T10:00:00Z',
    acceptedQuoteId: 'quote-1', contractorId: provider.id, contractor: provider,
    agreedAmountPence: 20000, platformFeeRate: '0.09', platformFeePence: 1800,
    contractorAmountPence: 18200, acceptedAt: '2026-11-22T09:00:00Z',
    startedAt: '2026-11-22T10:00:00Z', completedAt: '2026-11-22T11:00:00Z',
    confirmedAt: status === 'RELEASED' ? '2026-11-22T12:00:00Z' : null,
    inspectionOutcome: status === 'RELEASED' ? 'PASS' : null,
    inspectionSummary: null, sourceAuctionId: null, sourceOfferId: null,
    cancelledAt: null, cancelReason: null, createdAt: '2026-11-21T10:00:00Z',
    updatedAt: '2026-11-22T12:00:00Z',
    vehicles: [
      { id: 'vehicle-1', registration: 'AA11AAA', make: 'Toyota', model: 'Yaris', notes: 'First vehicle note' },
      { id: 'vehicle-2', registration: 'BB22BBB', make: 'Ford', model: 'Fiesta', notes: 'Second vehicle note' },
    ],
    quotes: [{
      id: 'quote-1', jobId: 'job-1', contractorId: provider.id, contractor: provider,
      amountPence: 20000, message: 'Whole-request inspection including both vehicles.',
      status: 'ACCEPTED', validUntil: null,
      createdAt: '2026-11-22T08:00:00Z', updatedAt: '2026-11-22T09:00:00Z',
    }],
    payment: {
      id: 'payment-1', grossPence: 20000, platformFeePence: 1800,
      contractorPence: 18200, platformFeeRate: '0.09', status: 'RELEASED',
      paidAt: '2026-11-22T09:30:00Z', releasedAt: '2026-11-22T12:00:00Z',
      refundedAt: null, refundAmountPence: 0,
    },
    review: null, canReview: status === 'RELEASED', eligibleProviderCount: 2,
  };
}

function textContent(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  return textContent(node.children ?? node.props?.children);
}

async function mount(transport) {
  let auth = { user: { id: 'customer-a' } };
  const subscribers = new Set();
  const requests = [], alerts = [], opened = [], navigations = [];
  const apiClient = async (path, options = {}) => {
    const request = { path, options, accountId: auth.user?.id };
    requests.push(request);
    return transport(request);
  };
  const services = compile('lib/servicesApi.ts', { './apiClient': { apiClient } });
  const unexpectedWrite = async () => { throw new Error('Unexpected auxiliary mutation'); };
  const modules = {
    react: React,
    'react-native': {
      ...Object.fromEntries(['ActivityIndicator', 'ScrollView', 'StatusBar', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name])),
      StyleSheet: { create: styles => styles },
      Alert: { alert: (...args) => alerts.push(args) },
      AppState: { addEventListener: () => ({ remove() {} }) },
      Linking: {
        canOpenURL: async () => true,
        openURL: async url => { opened.push(url); },
      },
    },
    '@react-navigation/native': { useFocusEffect: callback => React.useEffect(callback, [callback]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/BrandIcon': { Ionicons: 'Icon' },
    '../../components/IconButton': { IconButton: 'IconButton' },
    '../../components/ServiceJobChanges': { ServiceJobChanges: 'ServiceJobChanges' },
    '../../constants/colors': { Colors: {}, themeStatusBarStyle: 'dark-content' },
    '../../constants/typography': { FontFamily: {}, FontSize: {} },
    '../../constants/spacing': { Elevation: {}, Radius: {} },
    '../../lib/servicesApi': services,
    '../../lib/serviceJobJourney': journey,
    '../../lib/ukServiceDateTime': dates,
    '../../lib/auctionApi': { refuseAuctionAfterInspection: unexpectedWrite },
    '../../lib/chatApi': { getOrCreateServiceJobRoom: unexpectedWrite },
    '../../store/authStore': {
      useAuthStore: selector => selector(React.useSyncExternalStore(
        listener => { subscribers.add(listener); return () => subscribers.delete(listener); },
        () => auth,
        () => auth,
      )),
    },
  };
  const { CustomerServiceJobDetailScreen } = compile('screens/main/CustomerServiceJobDetailScreen.tsx', modules);
  const navigation = {
    navigate: (...args) => navigations.push(args),
    replace: (...args) => navigations.push(args),
    goBack() {},
  };
  let tree;
  await act(async () => {
    tree = create(React.createElement(CustomerServiceJobDetailScreen, {
      navigation, route: { key: 'customer-job', name: 'CustomerServiceJobDetail', params: { jobId: 'job-1' } },
    }));
  });
  return {
    tree, requests, alerts, opened, navigations,
    text: () => textContent(tree.toJSON()).replace(/\s+/g, ' ').trim(),
    button: label => tree.root.findAllByType('TouchableOpacity').find(node =>
      node.props.accessibilityLabel === label || textContent(node) === label),
    input: label => tree.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label),
    switchAccount: id => {
      auth = { user: id ? { id } : null };
      for (const listener of subscribers) listener();
    },
    close: () => act(async () => { tree.unmount(); }),
  };
}

test('native verified review submits once and replaces the form with saved server evidence', async t => {
  let job = jobFixture();
  const posted = [], pending = deferred();
  const h = await mount(async ({ path, options }) => {
    if (path === '/services/jobs/job-1' && !options.method) return { data: copy(job) };
    assert.equal(path, '/services/jobs/job-1/review');
    assert.equal(options.method, 'POST');
    posted.push(JSON.parse(options.body));
    await pending.promise;
    job = { ...job, canReview: false, review: {
      id: 'review-1', jobId: job.id, customerId: job.customerId,
      contractorId: provider.id, ...posted[0], createdAt: '2026-11-23T10:00:00Z',
      updatedAt: '2026-11-23T10:00:00Z',
    } };
    return { data: copy(job.review) };
  });
  t.after(h.close);
  assert.equal(h.button('SUBMIT VERIFIED REVIEW').props.disabled, true);
  await act(async () => { h.button('Rate 4 stars').props.onPress(); });
  await act(async () => { h.input('Service review comment').props.onChangeText('  Clear report for both vehicles.  '); });
  const submitButton = h.button('SUBMIT VERIFIED REVIEW');
  const submit = submitButton.props.onPress;
  await act(async () => { submit(); submit(); });
  assert.deepEqual(posted, [{ rating: 4, comment: 'Clear report for both vehicles.' }]);
  assert.equal(submitButton.props.disabled, true);
  await act(async () => { pending.resolve(); await pending.promise; });
  assert.match(h.text(), /Your verified service review/);
  assert.match(h.text(), /4 out of 5 stars/);
  assert.match(h.text(), /Clear report for both vehicles/);
  assert.equal(h.button('SUBMIT VERIFIED REVIEW'), undefined);
  assert.equal(h.input('Service review comment'), undefined);
  assert.equal(h.button('Rate 4 stars').props.disabled, true);
  assert.equal(h.requests.filter(request => !request.options.method).length, 2, 'review success reads authoritative saved state');
  assert.equal(posted.length, 1);
});

test('native quote selection preserves checkout failure after accepted-state refresh and shows both vehicles', async t => {
  let job = jobFixture('OPEN');
  job = { ...job, acceptedQuoteId: null, contractorId: null, contractor: null,
    agreedAmountPence: null, acceptedAt: null, startedAt: null, completedAt: null,
    confirmedAt: null, payment: null, canReview: false,
    quotes: [{ ...job.quotes[0], status: 'ACTIVE' }],
  };
  const h = await mount(async ({ path, options }) => {
    if (path === '/services/jobs/job-1' && !options.method) return { data: copy(job) };
    assert.equal(path, '/services/jobs/job-1/quotes/quote-1/accept');
    assert.equal(options.method, 'POST');
    job = { ...job, status: 'ACCEPTED', acceptedQuoteId: 'quote-1',
      contractorId: provider.id, contractor: provider, agreedAmountPence: 20000,
      quotes: [{ ...job.quotes[0], status: 'ACCEPTED' }],
      payment: { ...jobFixture().payment, status: 'PENDING', paidAt: null, releasedAt: null },
    };
    throw new Error('Synthetic checkout unavailable; refresh to continue.');
  });
  t.after(h.close);
  const before = h.text();
  assert.ok(before.indexOf('Compare quotes') < before.indexOf('Request details'));
  assert.ok(before.indexOf('CHOOSE & CONTINUE TO PAYMENT') < before.indexOf('Request details'));
  for (const content of ['Vehicle 1 of 2', 'Vehicle 2 of 2', 'AA11AAA', 'BB22BBB', 'First vehicle note', 'Second vehicle note']) {
    assert.ok(before.includes(content), content);
  }
  await act(async () => { h.button('CHOOSE & CONTINUE TO PAYMENT').props.onPress(); });
  assert.equal(h.alerts.length, 1);
  assert.equal(h.alerts[0][0], 'Choose this provider?');
  const confirm = h.alerts[0][2].find(choice => choice.text === 'Continue to payment').onPress;
  await act(async () => { confirm(); confirm(); });
  assert.equal(h.requests.filter(request => request.options.method === 'POST').length, 1);
  assert.equal(h.requests.filter(request => !request.options.method).length, 2);
  assert.match(h.text(), /Synthetic checkout unavailable; refresh to continue/);
  assert.match(h.text(), /ACCEPTED/);
  assert.ok(h.button('CONTINUE TO PAYMENT'));
  assert.equal(h.button('CHOOSE & CONTINUE TO PAYMENT'), undefined);
  assert.equal(h.opened.length, 0, 'an API failure must never open a payment URL');
  assert.ok(h.text().indexOf('CONTINUE TO PAYMENT') < h.text().indexOf('Request details'));
});

test('native account remount clears old request and review draft and ignores a late prior-account refresh', async t => {
  const original = jobFixture(), oldRefresh = deferred();
  let accountAReads = 0;
  const h = await mount(async ({ path, options, accountId }) => {
    assert.equal(path, '/services/jobs/job-1');
    assert.equal(options.method, undefined, 'this isolation scenario is read-only');
    if (accountId === 'customer-b') throw new Error('Not your job');
    accountAReads++;
    if (accountAReads === 2) return oldRefresh.promise;
    return { data: copy(original) };
  });
  t.after(h.close);
  await act(async () => {
    h.input('Service review comment').props.onChangeText('Unsaved private review draft');
    h.button('Rate 5 stars').props.onPress();
  });
  await act(async () => { h.button('Refresh request').props.onPress(); });
  assert.equal(accountAReads, 2);
  await act(async () => { h.switchAccount('customer-b'); });
  assert.match(h.text(), /Not your job/);
  assert.ok(!h.text().includes(original.title));
  assert.equal(h.input('Service review comment'), undefined);
  await act(async () => {
    oldRefresh.resolve({ data: { ...copy(original), title: 'Late prior-account result' } });
    await oldRefresh.promise;
  });
  assert.match(h.text(), /Not your job/);
  assert.ok(!h.text().includes('Late prior-account result'));
  await act(async () => { h.switchAccount('customer-a'); });
  assert.match(h.text(), /Synthetic two-vehicle inspection/);
  assert.equal(h.input('Service review comment').props.value, '');
  assert.equal(h.button('SUBMIT VERIFIED REVIEW').props.disabled, true, 'previous account session rating must not be retained');
  assert.equal(h.requests.filter(request => request.options.method).length, 0);
});
