import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const backend = read('backend/src/listings/listings.service.ts');
const dto = read('backend/src/listings/dto/listing-filter.dto.ts');
const controller = read('backend/src/listings/listings.controller.ts');
const webApi = read('src/lib/listingApi.ts');
const webSearch = read('src/app/search/page.tsx');
const nativeApi = read('carmazium app/carmazium app/src/lib/listingsApi.ts');
const nativeSearch = read('carmazium app/carmazium app/src/screens/main/SearchScreen.tsx');

test('all three layers use the same explicit coordinate/radius parameter names', () => {
  for (const field of ['latitude', 'longitude', 'maxDistanceMi']) {
    for (const [name, source] of Object.entries({ dto, webApi, nativeApi })) {
      assert.match(source, new RegExp('\\b' + field + '\\b'), name + ' lacks ' + field);
    }
    assert.match(webApi, new RegExp("params.append\\('" + field + "'"));
    assert.match(nativeApi, new RegExp("query.set\\('" + field + "'"));
  }
  assert.match(webSearch, /f\.maxDistanceMi = state\.maxDistanceMi/);
  assert.match(nativeSearch, /maxDistanceMi: maxDistanceMi \?\? undefined/);
});

test('backend filters exact eligible vehicle coordinates BEFORE count and pagination', () => {
  assert.match(backend, /requireRadiusCoordinates\(\{ latitude, longitude, maxDistanceMi \}\)/);
  assert.match(backend, /candidateWhere = \{ AND: \[where, locationWhere\] \}/);
  assert.match(backend, /distanceMiles\(/);
  assert.match(backend, /where\.id = \{ in: matching\.map\(m => m\.id\) \}/);
  assert.match(backend, /matching\.sort\(\(a, b\) => a\.miles - b\.miles/);
  assert.match(backend, /count\(\{ where \}\)/);
  assert.match(backend, /candidateSafetyLimit = 20000/);
  assert.match(controller, /filterDto\.listingType === 'AUCTION'/);
});

test('website and native screens never filter the already paginated result page by radius', () => {
  assert.doesNotMatch(webSearch, /filtered = filtered\.filter\(l =>[\s\S]*haversineDistanceMiles/);
  assert.doesNotMatch(nativeSearch, /rawItems[\s\S]{0,120}\.filter\(l => l\.latitude/);
  assert.match(webSearch, /setListings\(response\.data\)/);
  assert.match(nativeSearch, /const items = rawItems/);
  assert.match(webSearch, /setTotalCount\(response\.pagination\.total\)/);
  assert.match(nativeSearch, /setTotal\(t\)/);
});

test('radius selection and nearest sort reflect the SAME back-end result ordering', () => {
  assert.match(webSearch, /value: 'distance_asc'/);
  assert.match(nativeSearch, /id: 'distance_asc'/);
  assert.match(webSearch, /sortBy: miles != null && prev\.sortBy === 'newest'/);
  assert.match(nativeSearch, /if \(sortId === 'newest'\) setSortId\('distance_asc'\)/);
  assert.match(webSearch, /userLocation\.lat == null \|\| userLocation\.lng == null/);
  assert.match(nativeSearch, /userLat == null \|\| userLng == null/);
});
