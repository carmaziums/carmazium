import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const core = dirname(require.resolve('@react-navigation/core'));
const native = dirname(require.resolve('@react-navigation/native'));
const { getStateFromPath } = require(join(core, 'getStateFromPath.js'));
const { getActionFromState } = require(join(core, 'getActionFromState.js'));
const { extractPathFromURL } = require(join(native, 'extractPathFromURL.js'));
const read = p => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function compile(path, modules) {
  const exports = {};
  const code = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports, URL, Date, setTimeout, clearTimeout, console,
    require: name => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
  });
  return exports;
}
const content = compile('lib/nativeContentLinks.ts', { '../data/dashboardCards.json': JSON.parse(read('data/dashboardCards.json')) });
const { linking } = compile('navigation/linking.ts', {
  '@react-navigation/native': { getStateFromPath },
  'expo-linking': { createURL: () => 'exp://127.0.0.1:8081/--/' },
  '../lib/nativeContentLinks': content,
});
function fromURL(url) {
  if (!linking.filter(url)) return undefined;
  const path = extractPathFromURL(linking.prefixes, url);
  return path === undefined ? undefined : linking.getStateFromPath(path, linking.config);
}
function focused(state) {
  assert.ok(state);
  assert.equal(state.routes[0].name, 'Main');
  const main = state.routes[0].state;
  return main.routes[main.index ?? main.routes.length - 1];
}

test('cold and warm service URLs use the existing native screens and retain validated params', () => {
  for (const [path, name, params] of [
    ['/auctions', 'Services'],
    ['/services', 'Services'],
    ['/services/jobs/new?kind=recovery', 'Services'],
    ['/auctions/how-it-works', 'AuctionGuide'],
    ['/services/delivery/new?kind=recovery&serviceType=INSPECTION&screen=AdminDashboard', 'CreateServiceJob', { serviceType: 'DELIVERY', kind: 'recovery' }],
    ['/services/delivery?kind=collection', 'CreateServiceJob', { serviceType: 'DELIVERY', kind: 'collection' }],
    ['/services/inspection/new?kind=cosmetic', 'CreateServiceJob', { serviceType: 'INSPECTION', kind: 'cosmetic' }],
    ['/services/inspection?kind=recovery', 'CreateServiceJob', { serviceType: 'INSPECTION' }],
    ['/services/delivery/new?listingId=linked-listing&registration=ab12%20cde&make=Example&model=Car&year=2022&vehicleTitle=Selected%20car', 'CreateServiceJob', { serviceType: 'DELIVERY', purchase: { listingId: 'linked-listing', title: 'Selected car', registration: 'AB12CDE', make: 'Example', model: 'Car', year: 2022 } }],
    ['/services/inspection/new?listingId=linked-listing&kind=mechanical&year=not-a-year&paymentStatus=PAID', 'CreateServiceJob', { serviceType: 'INSPECTION', kind: 'mechanical', purchase: { listingId: 'linked-listing', title: 'Selected vehicle' } }],
    ['/services/finance?listingId=fixture', 'Finance', { listingId: 'fixture' }],
    ['/finance?listingId=fixture', 'Finance', { listingId: 'fixture' }],
    ['/services/warranty?listingId=fixture', 'Warranty', { listingId: 'fixture' }],
    ['/services/warranty/terms', 'WarrantyTerms'],
    ['/dashboard/warranties', 'WarrantyOrders'],
    ['/become-a-partner', 'PartnerGuide'],
    ['/contact?topic=insurance-partnership', 'Contact', { topic: 'insurance-partnership' }],
    ['/contact?topic=unsupported', 'Contact'],
    ['/auctions/browse', 'Tabs', { screen: 'DealerBuyBid', params: { initialSection: 'live' } }],
  ]) {
    for (const prefix of ['https://www.carmazium.com', 'https://carmazium.com', 'carmazium:/']) {
      const state = fromURL(prefix + path);
      const route = focused(state);
      assert.equal(route.name, name, prefix + path);
      assert.deepEqual(plain(route.params ?? {}), params ?? {}, prefix + path);
      if (name !== 'Tabs') assert.equal(state.routes[0].state.routes[0].name, 'Tabs', 'cold start retains native back destination');
      const action = getActionFromState(state, linking.config);
      assert.equal(action.type, 'NAVIGATE', 'warm links navigate through the existing stack');
      assert.equal(action.payload.name, 'Main');
      assert.equal(action.payload.params.screen, name);
      assert.deepEqual(plain(action.payload.params.params ?? {}), params ?? {}, 'warm link retains the nested tab and screen params');
    }
  }
});

test('existing service-job and provider URLs still parse without retired-route ambiguity', () => {
  for (const [path, name, params] of [
    ['/services/jobs', 'CustomerServiceJobs', {}],
    ['/services/jobs/fixture-job', 'CustomerServiceJobDetail', { jobId: 'fixture-job' }],
    ['/dashboard/service', 'ProviderOverview', {}],
    ['/dashboard/service/jobs', 'ProviderJobs', {}],
    ['/dashboard/service/jobs/fixture-job', 'ProviderJobDetail', { jobId: 'fixture-job' }],
    ['/dashboard/partner', 'PartnerDashboard', {}],
    ['/auctions/live/fixture-auction', 'AuctionDeepLink', { auctionId: 'fixture-auction' }],
  ]) {
    const route = focused(fromURL('https://www.carmazium.com' + path));
    assert.equal(route.name, name, path);
    assert.deepEqual(plain(route.params ?? {}), params, path);
  }
  assert.equal(focused(fromURL('https://www.carmazium.com/services/jobs/new')).name, 'Services');
});

test('external hosts and auth callbacks are not consumed as service navigation', () => {
  for (const url of [
    'https://other.example/auctions', 'https://www.carmazium.com.evil.example/services/delivery/new',
    'javascript://www.carmazium.com/services/delivery/new', 'https://name:password@www.carmazium.com/services/inspection',
    'carmazium://auth/callback?code=fixture', 'https://www.carmazium.com/auctions?access_token=fixture',
  ]) assert.equal(fromURL(url), undefined, url);
  assert.equal(fromURL('https://www.carmazium.com/services/unrecognised/new'), undefined);
});

test('Android and iOS keep the original identity and advertise the service entry paths', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.equal(app.version, '1.0.2');
  assert.deepEqual(app.runtimeVersion, { policy: 'appVersion' });
  assert.equal(app.updates.requestHeaders, undefined, 'the signed build workflow owns the update channel');
  const entries = app.android.intentFilters.flatMap(filter => filter.data);
  for (const host of ['carmazium.com', 'www.carmazium.com']) {
    assert.ok(app.ios.associatedDomains.includes('applinks:' + host));
    for (const path of ['/auctions', '/services', '/services/jobs/new', '/services/delivery/new', '/services/inspection/new', '/services/finance', '/services/warranty', '/dashboard/service', '/dashboard/service/jobs/fixture', '/dashboard/partner']) {
      assert.ok(entries.some(data => data.scheme === 'https' && data.host === host && (data.path === path || data.pathPrefix && path.startsWith(data.pathPrefix))), host + path);
    }
  }
  const stack = read('navigation/MainStackNavigator.tsx');
  assert.match(stack, /screenLayout=\{GuestAwareLayout\}/);
  assert.match(stack, /if \(isAuthenticated \|\| GUEST_ROUTES\.has\(routeName\)\) return/);
});

test('profile hydration keeps staff membership and own pending dealer profile independent', async () => {
  for (const profileOwnsBusiness of [true, false]) {
    let state;
    const profile = {
      id: 'fixture-user', email: 'fixture@example.invalid', role: 'DEALER',
      firstName: 'Fixture', lastName: 'Account', phone: '000', postcode: 'AB1 2CD', location: 'Fixture',
      dealerStaffMemberships: [{}],
      ...(profileOwnsBusiness ? { dealerProfile: { isVerified: false } } : {}),
    };
    const { useAuthStore } = compile('store/authStore.ts', {
      zustand: { create(factory) { state = factory(update => Object.assign(state, typeof update === 'function' ? update(state) : update), () => state); return { getState: () => state }; } },
      '../lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture-session', user: { id: profile.id, email_confirmed_at: '2026-01-01' } } } }), signInWithPassword: async () => ({ data: { user: { id: profile.id, email_confirmed_at: '2026-01-01' }, session: { access_token: 'fixture-session' } } }) } }, hybridStorageAdapter: {} },
      '../lib/authSubscription': { subscribeDeferredAuthChanges() {} },
      '../lib/apiClient': { apiClient: async path => path === '/users/me' ? { success: true, data: profile } : { success: true } },
      'expo-secure-store': { getItemAsync: async () => '1' }, '../lib/authEvents': { setAuthRedirectHandler() {}, resetAuthRedirectLatch() {} },
      '../lib/navigationRef': { navigationRef: {} }, '../lib/sellWizardStore': { detachSellWizardDraft() {} },
    });
    await useAuthStore.getState().login('fixture@example.invalid', 'fixture-password');
    assert.equal(state.user.isDealerStaff, true);
    assert.equal(state.user.hasDealerProfile, profileOwnsBusiness);
    assert.equal(state.user.isVerified, false, 'own profile presence must not imply approval');
    await useAuthStore.getState().initializeAuth();
    assert.equal(state.user.isDealerStaff, true, 'cold session hydration retains staff membership');
    assert.equal(state.user.hasDealerProfile, profileOwnsBusiness, 'cold session hydration retains ownership');
  }
});


test('every advertised exact app-link entry resolves natively while unsupported checkout URLs remain browser links', async () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
  const entries = app.android.intentFilters.flatMap(filter => filter.data).filter(item => item.scheme === 'https');
  const exports = {};
  const source = readFileSync(new URL('../../../src/app/api/app-links/apple/route.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, Response, process: { env: { APPLE_APP_TEAM_ID: 'ABC1234567' } } });
  const apple = await (await exports.GET()).json();
  const paths = apple.applinks.details[0].paths;
  const exact = new Set([...entries.map(item => item.path).filter(Boolean), ...paths.filter(path => !path.includes('*'))]);
  for (const host of ['carmazium.com', 'www.carmazium.com']) {
    for (const path of exact) assert.ok(fromURL('https://' + host + path), 'advertised exact path must resolve: ' + host + path);
    for (const path of [
      '/services/warranty/order?id=fixture',
      '/services/warranty/order?id=fixture&cancelled=1',
      '/services/warranty/orders/fixture',
      '/services/delivery/new/unsupported',
      '/services/inspection/unsupported',
      '/services/finance/unsupported',
      '/auctions/unrecognised',
    ]) {
      const href = 'https://' + host + path;
      const pathname = new URL(href).pathname;
      assert.equal(entries.some(item => item.host === host && (item.path === pathname || item.pathPrefix && pathname.startsWith(item.pathPrefix))), false, 'Android leaves unsupported URL in browser: ' + href);
      assert.equal(paths.some(pattern => pattern.endsWith('*') ? pathname.startsWith(pattern.slice(0, -1)) : pathname === pattern), false, 'iOS leaves unsupported URL in browser: ' + href);
      assert.equal(fromURL(href), undefined, 'unknown URL is not a valid native route');
    }
  }
});
