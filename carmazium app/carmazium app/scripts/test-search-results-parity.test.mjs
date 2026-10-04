import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function apiHarness(impl) {
  const calls = [];
  const exports = {};
  runInNewContext(transpile(read('src/lib/listingsApi.ts')), {
    exports, URLSearchParams, console,
    require: name => {
      if (name === './apiClient') return {
        apiClient: async (url, options) => {
          calls.push({ url, options });
          return impl(url, options);
        },
      };
      throw Error('Unexpected native search API dependency: ' + name);
    },
  });
  return { api: exports, calls };
}

const emptyResponse = (total = 0) => ({ data: [], pagination: { total, page: 1, limit: 20, totalPages: 1 } });

test('strict Search-screen API rejects offline failures rather than fabricating zero cars', async () => {
  const h = apiHarness(async () => { throw Error('OFFLINE'); });
  await assert.rejects(h.api.searchListings({}, { propagateErrors: true }), /OFFLINE/);
  assert.match(h.calls[0].url, /^\/listings/);
});

test('strict API rejects malformed pagination instead of showing an empty inventory', async () => {
  const h = apiHarness(async () => ({ success: true, data: [] }));
  await assert.rejects(h.api.searchListings({}, { propagateErrors: true }), /Could not load vehicle results/);
});

test('other legacy home callers retain best-effort search fallback', async () => {
  const h = apiHarness(async () => { throw Error('OFFLINE'); });
  const response = await h.api.searchListings({});
  assert.equal(response.total, 0);
  assert.equal(response.listings.length, 0);
});

test('valid empty search remains a genuine zero-result page', async () => {
  const h = apiHarness(async () => emptyResponse());
  const value = await h.api.searchListings({ search: 'unfindable' }, { propagateErrors: true });
  assert.equal(value.total, 0);
  assert.equal(value.listings.length, 0);
  assert.match(h.calls[0].url, /search=unfindable/);
});

function nativeBuildParams({ quickFilter, transmissions = [] }) {
  // Execute the ACTUAL nested native buildParams function against deterministic
  // screen state, without mounting Expo/React Native or inventing a copy.
  const source = read('src/screens/main/SearchScreen.tsx');
  const start = source.indexOf('  function buildParams(p = 1) {');
  const stop = source.indexOf('\n  const fetch = useCallback', start);
  assert.ok(start >= 0 && stop > start);
  const exports = {};
  const vars = {
    QUICK_FILTERS: [
      { id: 'manual', params: { transmission: 'MANUAL' } },
      { id: 'all', params: {} },
      { id: 'u15k', params: { maxPrice: 15000 } },
    ],
    FUEL_MAP: {}, query: '', selectedMakes: [], modelFilter: '', vehicleType: 'CAR',
    locationFilter: '', maxPrice: 150000, minPrice: 0, selectedBody: '',
    selectedFuels: [], minYear: 'Any', maxYear: 'Any', minMiles: 'Any',
    maxMiles: 'Any', conditions: [], ulezCompliant: '', minBhp: '',
    maxBhp: '', minEngine: '', maxEngine: '', maxCo2: '',
    deliveryAvailable: false, sellerType: '', colorFilter: '', minDoors: '',
    minSeats: '', euroStandard: '', selectedFeatures: [], isImported: '',
    sortId: 'newest', quickFilter, transmissions,
  };
  runInNewContext(transpile(source.slice(start, stop) + '\nexports.builder = buildParams;'), {
    ...vars, exports,
  });
  return exports.builder(1);
}

test('Manual quick filter actually sends MANUAL backend transmission', () => {
  const params = nativeBuildParams({ quickFilter: 'manual' });
  assert.deepEqual(Array.from(params.transmissions), ['MANUAL']);
  const h = apiHarness(async () => emptyResponse());
  return h.api.searchListings(params, { propagateErrors: true }).then(() => {
    assert.match(h.calls[0].url, /transmissions=MANUAL/);
  });
});

test('explicit multi-transmission choice takes precedence over quick filter', () => {
  const params = nativeBuildParams({
    quickFilter: 'manual', transmissions: ['AUTOMATIC', 'CVT'],
  });
  assert.deepEqual(Array.from(params.transmissions), ['AUTOMATIC', 'CVT']);
});

test('all chip correctly omits transmission and other quick-filter restrictions', () => {
  const params = nativeBuildParams({ quickFilter: 'all' });
  assert.equal(params.transmissions, undefined);
  assert.equal(params.maxPrice, undefined);
});

test('filter and sort options exposed on web also exist in native search', () => {
  const web = read('../../src/app/search/page.tsx');
  const mobile = read('src/screens/main/SearchScreen.tsx');
  for (const sort of ['newest', 'price_asc', 'price_desc', 'mileage_asc',
                      'mileage_desc', 'year_asc', 'year_desc']) {
    assert.ok(web.includes("'" + sort + "'"), 'Website missing sort ' + sort);
    assert.ok(mobile.includes("'" + sort + "'"), 'Native missing sort ' + sort);
  }
  for (const condition of ['CAT_S', 'CAT_N', 'CAT_C', 'CAT_D']) {
    assert.ok(web.includes("'" + condition + "'"));
    assert.ok(mobile.includes("'" + condition + "'"));
  }
});

test('newer filters invalidate stale search/pagination and preserve retryable errors', () => {
  const screen = read('src/screens/main/SearchScreen.tsx');
  assert.match(screen, /const epoch = reset \? \+\+requestEpochRef\.current : requestEpochRef\.current/);
  assert.match(screen, /if \(epoch !== requestEpochRef\.current\) return/);
  assert.match(screen, /pageLoadingRef\.current \|\| !hasMore/);
  assert.match(screen, /searchListings\(\s*buildParams\(p\), \{ propagateErrors: true \}/);
  assert.match(screen, /setHasMore\(p \* 20 < t\)/);
  assert.match(screen, /accessibilityLabel="Retry loading vehicle search results"/);
  assert.match(screen, /Search unavailable/);
  assert.match(screen, /setSearchError\(error\?\.message/);
  assert.match(screen, /setTransmissions\(\[\]\)/);
});

test('resetting all filters also clears quick filters, search text and sorting', () => {
  const screen = read('src/screens/main/SearchScreen.tsx');
  const start = screen.indexOf('  const resetFilters = () => {');
  const end = screen.indexOf('  const handleSavePostcode = async', start);
  assert.ok(start !== -1 && end > start);
  const reset = screen.slice(start, end);
  for (const action of ["setQuickFilter('all')", "setQuery('')",
                       "setSortId('newest')", "setTransmissions([])"]) {
    assert.ok(reset.includes(action), 'Clear filters must execute ' + action);
  }
});
