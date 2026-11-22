import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const src = new URL('../src/', import.meta.url);
const read = path => readFileSync(new URL(path, src), 'utf8');
const exports = {};
runInNewContext(ts.transpileModule(read('lib/dealerOfferIntegrity.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports });

const { decodeReceivedDealerOffers, requireCurrentRespondableOffer, isDealerOfferRespondable } = exports;
const base = { id: 'offer-1', status: 'PENDING', updatedAt: '2026-11-01T10:00:00Z', listing: { status: 'ACTIVE' } };

test('withdrawn offer from backend must remain withdrawn, never become pending', () => {
  const offers = decodeReceivedDealerOffers({ success: true, data: [{ ...base, status: 'WITHDRAWN' }] });
  assert.equal(offers[0].status, 'WITHDRAWN');
  assert.equal(offers.filter(o => o.status === 'PENDING').length, 0);
  assert.equal(isDealerOfferRespondable(offers[0]), false);
});

test('stale pending UI cannot write an offer the buyer already withdrew', () => {
  const fresh = decodeReceivedDealerOffers({ success: true, data: [{ ...base, status: 'WITHDRAWN' }] });
  assert.throws(() => requireCurrentRespondableOffer(base, fresh), /changed to withdrawn/);
  assert.throws(() => requireCurrentRespondableOffer(base, []), /no longer available/);
});

test('a closed listing or rejected, cancelled or accepted offer cannot be responded to', () => {
  for (const status of ['WITHDRAWN', 'CANCELLED', 'REJECTED', 'ACCEPTED']) {
    assert.throws(() => requireCurrentRespondableOffer({ ...base, status }, [{ ...base, status }]), /no action was taken/i);
  }
  assert.throws(() => requireCurrentRespondableOffer(base, [{ ...base, listing: { status: 'SOLD' } }]), /no action was taken/i);
  assert.throws(() => requireCurrentRespondableOffer(base, [{ ...base, updatedAt: '2026-11-02T10:00:00Z' }]), /changed to pending/i);
});

test('only a pending offer or buyer-countered offer is actionable', () => {
  assert.equal(requireCurrentRespondableOffer(base, [base]).id, 'offer-1');
  const buyerCountered = { ...base, status: 'COUNTERED', lastCounteredBy: 'BUYER' };
  assert.equal(requireCurrentRespondableOffer(buyerCountered, [buyerCountered]).status, 'COUNTERED');
  const sellerCountered = { ...buyerCountered, lastCounteredBy: 'SELLER' };
  assert.equal(isDealerOfferRespondable(sellerCountered), false);
});

test('corrupt responses and unknown statuses fail closed instead of showing pending', () => {
  for (const value of [null, {}, { success: false, data: [] },
    { success: true, data: [{ id: 'offer-1' }] },
    { success: true, data: [{ id: 'offer-1', status: 'PENDING' }, { id: 'offer-2', status: 'AWAITING' }] }]) {
    assert.throws(() => decodeReceivedDealerOffers(value));
  }
});

test('dealer Saved card has a registered, explicit native stack destination', () => {
  const nav = read('lib/dashboardNavigation.ts');
  const stack = read('navigation/MainStackNavigator.tsx');
  const tabs = read('navigation/TabNavigator.tsx');
  assert.match(nav, /id: 'dealer-wishlist'[^\n]+stackScreen: 'DealerSaved'/);
  assert.match(stack, /DealerSaved: undefined;/);
  assert.match(stack, /name="DealerSaved"\s+component=\{DealerSavedScreen\}/);
  assert.match(tabs, /name="Saved" component=\{SavedScreen\}/);
  const dealerRow = nav.match(/id: 'dealer-wishlist'[^\n]+/)[0];
  assert.doesNotMatch(dealerRow, /tabName:|https?:|Linking\./);
});

test('received offer screen refreshes from the backend before mutations and on app resume', () => {
  const screen = read('screens/main/DealerOffersScreen.tsx');
  assert.match(screen, /AppState\.addEventListener\('change'/);
  assert.match(screen, /requireCurrentRespondableOffer\(offer, current\)/);
  assert.match(screen, /decodeReceivedDealerOffers<Offer>\(response\)/);
  assert.match(screen, /Cache-Control': 'no-cache'/);
  assert.match(screen, /actionInFlight\.current\.has\(offer\.id\)/);
});

test('dealer offer and saved HTTPS deep links are handled by native screens on both domains', () => {
  const linking = read('navigation/linking.ts');
  assert.match(linking, /DealerSaved: 'dashboard\/dealer\/wishlist'/);
  assert.match(linking, /DealerOffers: 'dashboard\/dealer\/offers'/);
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const data = config.expo.android.intentFilters.flatMap(filter => filter.data || []);
  for (const host of ['carmazium.com', 'www.carmazium.com']) {
    for (const path of ['/dashboard/dealer/wishlist', '/dashboard/dealer/offers']) {
      assert.ok(data.some(row => row.host === host && row.pathPrefix === path),
        `Missing original-package Android intent for ${host}${path}`);
    }
  }
  assert.match(read('lib/nativeTourRoutes.ts'), /if \(path === '\/dashboard\/dealer\/wishlist'\) return page\('DealerSaved'\)/);
});
