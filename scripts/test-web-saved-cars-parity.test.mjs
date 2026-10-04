import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const page = read('src/app/dashboard/buyer/watchlist/page.tsx');
const webApi = read('src/lib/listingApi.ts');
const nativeApi = read('carmazium app/carmazium app/src/lib/watchlistApi.ts');
const backend = read('backend/src/watchlist/watchlist.service.ts');
const controller = read('backend/src/watchlist/watchlist.controller.ts');

test('website avoids previous account items even during the pre-effect render', () => {
  assert.match(page, /const accountId = user\?\.id \?\? null/);
  assert.match(page, /const switchingAccounts = activeUserIdRef\.current !== accountId/);
  assert.match(page, /loading \|\| switchingAccounts/);
  assert.match(page, /activeUserIdRef\.current = accountId/);
  assert.match(page, /setItems\(\[\]\)/);
});

test('website latest-request gate invalidates stale responses and errors on account switch', () => {
  assert.match(page, /const epoch = \+\+fetchEpochRef\.current/);
  assert.match(page, /cancelled \|\| epoch !== fetchEpochRef\.current/);
  assert.match(page, /activeUserIdRef\.current !== accountId/);
  assert.match(page, /return \(\) => \{\s*cancelled = true\s*fetchEpochRef\.current\+\+/);
  assert.match(page, /activeUserIdRef\.current !== removingAccount/);
});

test('website picks up saves from the native app when returning to the browser tab', () => {
  assert.match(page, /window\.addEventListener\('focus', refreshOnFocus\)/);
  assert.match(page, /document\.addEventListener\('visibilitychange', refreshOnVisible\)/);
  assert.match(page, /document\.visibilityState === 'visible'/);
  assert.match(page, /window\.removeEventListener\('focus', refreshOnFocus\)/);
  assert.match(page, /setRefreshKey\(prev => prev \+ 1\)/);
});

test('a failed website request is not presented as an empty watchlist', () => {
  assert.match(page, /setLoadError\('Could not refresh saved cars\. Please try again\.'/);
  assert.match(page, /role="alert"/);
  assert.match(page, /loadError \? null : \(/);
  assert.match(page, /onClick=\{\(\) => setRefreshKey\(k => k \+ 1\)\}/);
});

test('removal refreshes backend totals and handles the last item on a page', () => {
  assert.match(page, /items\.length === 1 && page > 1/);
  assert.match(page, /setPage\(prev => prev - 1\)/);
  assert.match(page, /setRefreshKey\(prev => prev \+ 1\)/);
  assert.match(page, /setLoadError\('Could not remove this car\. Please retry\.'/);
});

test('web and native use the same watchlist endpoints and account-bound backend queries', () => {
  for (const field of ['watchlist?page=', '/watchlist/']) {
    assert.ok(webApi.includes(field), 'Website missing watchlist transport ' + field);
    assert.ok(nativeApi.includes(field), 'Native missing watchlist transport ' + field);
  }
  assert.match(backend, /where: \{ userId \}/);
  assert.match(backend, /userId_listingId: \{ userId, listingId \}/);
  assert.match(controller, /@UseGuards\(SessionAuthGuard\)/);
});

test('the Saved Cars response includes native-needed transmission and search coordinates', () => {
  for (const field of ['fuelType', 'transmission', 'bodyType', 'color',
                       'location', 'latitude', 'longitude']) {
    assert.match(backend, new RegExp('\\b' + field + ': true\\b'),
      'Backend Saved Cars projection lacks ' + field);
  }
  assert.match(nativeApi, /mapApiListingToCarListing\(item\.listing\)/);
});
