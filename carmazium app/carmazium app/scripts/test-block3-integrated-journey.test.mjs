import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/**
 * Integrated source/transport contract: run the actual native query builder,
 * the actual listingsApi.ts HTTP adapter and the real Zustand watchlist store
 * against a deterministic, account-keyed fake backend. This complements, but
 * does NOT replace, signed iOS/Android and actual server/browser acceptance.
 */
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const listings = [
  { id: 'honda-manual-london', title: 'Honda Jazz', make: 'Honda', model: 'Jazz',
    year: 2022, price: 8500, mileage: 20000, type: 'CLASSIFIED',
    transmission: 'MANUAL', latitude: 51.5074, longitude: -0.1278, images: [] },
  { id: 'toyota-auto-london', title: 'Toyota Yaris', make: 'Toyota', model: 'Yaris',
    year: 2021, price: 9000, mileage: 30000, type: 'CLASSIFIED',
    transmission: 'AUTOMATIC', latitude: 51.5076, longitude: -0.1277, images: [] },
  { id: 'honda-manual-bristol', title: 'Honda Jazz', make: 'Honda', model: 'Jazz',
    year: 2020, price: 7000, mileage: 34000, type: 'CLASSIFIED',
    transmission: 'MANUAL', latitude: 51.45, longitude: -2.58, images: [] },
];
const watchlists = new Map();
let currentAccount = 'alice';
let latestParams;

function buildActualSearchParams(quickFilter, maxDistanceMi) {
  const source = read('src/screens/main/SearchScreen.tsx');
  const start = source.indexOf('  function buildParams(p = 1) {');
  const end = source.indexOf('\n  const fetch = useCallback', start);
  assert.ok(start >= 0 && end > start, 'actual native query builder must exist');
  const globals = {
    QUICK_FILTERS: [
      { id: 'manual', params: { transmission: 'MANUAL' } },
      { id: 'all', params: {} },
    ],
    FUEL_MAP: {}, query: '', selectedMakes: [], modelFilter: '',
    vehicleType: 'CAR', locationFilter: '', maxPrice: 150000,
    minPrice: 0, selectedBody: '', selectedFuels: [], minYear: 'Any',
    maxYear: 'Any', minMiles: 'Any', maxMiles: 'Any', conditions: [],
    ulezCompliant: '', minBhp: '', maxBhp: '', minEngine: '',
    maxEngine: '', maxCo2: '', deliveryAvailable: false,
    sellerType: '', colorFilter: '', minDoors: '', minSeats: '',
    euroStandard: '', selectedFeatures: [], isImported: '',
    sortId: maxDistanceMi ? 'distance_asc' : 'newest', quickFilter,
    transmissions: [], maxDistanceMi, userLat: 51.5074, userLng: -0.1278,
  };
  const exports = {};
  runInNewContext(compile(source.slice(start, end) + '\nexports.build = buildParams;'), {
    ...globals, exports,
  });
  return exports.build(1);
}

function createSearchHarness() {
  const exports = {};
  runInNewContext(compile(read('src/lib/listingsApi.ts')), {
    exports, console, URLSearchParams, Date,
    require: name => {
      if (name !== './apiClient') throw Error('Unexpected search API dependency: ' + name);
      return { apiClient: async url => {
        const p = new URL('https://local.invalid' + url).searchParams;
        latestParams = p;
        const lat = Number(p.get('latitude'));
        const lng = Number(p.get('longitude'));
        const transmissions = p.get('transmissions')?.split(',') || [];
        const distance = Number(p.get('maxDistanceMi'));
        const allowed = listings.filter(l =>
          (!transmissions.length || transmissions.includes(l.transmission)) &&
          (!p.has('maxDistanceMi') ||
            Math.hypot((l.latitude - lat) * 69,
                       (l.longitude - lng) * 43) <= distance),
        );
        return {
          success: true, data: allowed,
          pagination: { total: allowed.length, page: 1, limit: 20, totalPages: 1 },
        };
      } };
    },
  });
  return exports.searchListings;
}

function createWatchlistHarness() {
  let state;
  const create = initialize => {
    const set = next => {
      state = { ...state, ...(typeof next === 'function' ? next(state) : next) };
    };
    state = initialize(set, () => state);
    return { getState: () => state };
  };
  const exports = {};
  const fakeApi = {
    getWatchlist: async () => {
      const ids = watchlists.get(currentAccount) ?? [];
      return {
        items: ids.map(id => ({
          listingId: id,
          mappedListing: listings.find(l => l.id === id),
        })), total: ids.length,
      };
    },
    addToWatchlist: async id => {
      const ids = watchlists.get(currentAccount) ?? [];
      if (!ids.includes(id)) watchlists.set(currentAccount, [...ids, id]);
    },
    removeFromWatchlist: async id => {
      watchlists.set(currentAccount, (watchlists.get(currentAccount) ?? []).filter(x => x !== id));
    },
  };
  runInNewContext(compile(read('src/store/watchlistStore.ts')), {
    exports, console,
    require: name => {
      if (name === 'zustand') return { create };
      if (name === '../lib/watchlistApi') return fakeApi;
      throw Error('Unexpected watchlist store dependency: ' + name);
    },
  });
  return exports.useWatchlistStore.getState;
}
const drain = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)); };

test('manual+25mi retail search result is saveable and refreshes under the same account', async () => {
  currentAccount = 'alice';
  watchlists.clear();
  const params = buildActualSearchParams('manual', 25);
  const search = createSearchHarness();
  const result = await search(params, { propagateErrors: true });
  assert.deepEqual(result.listings.map(x => x.id), ['honda-manual-london']);
  assert.equal(result.total, 1);
  assert.equal(latestParams.get('transmissions'), 'MANUAL');
  assert.equal(latestParams.get('maxDistanceMi'), '25');
  assert.equal(latestParams.get('sortBy'), 'distance_asc');

  const state = createWatchlistHarness();
  state().bindAccount(currentAccount);
  state().save(result.listings[0]);
  await drain();
  assert.deepEqual(watchlists.get('alice'), ['honda-manual-london']);
  await state().hydrateFromApi(); // Mimics return to native Saved tab.
  assert.equal(state().isSaved('honda-manual-london'), true);

  state().bindAccount(null); // Logout clears private on-device data.
  assert.equal(state().savedListings.length, 0);
  currentAccount = 'bob';
  state().bindAccount('bob');
  await state().hydrateFromApi();
  assert.equal(state().isSaved('honda-manual-london'), false);
  assert.equal(state().savedListings.length, 0);
});

test('the same backend inventory returns other nearby cars when Manual quick chip is cleared', async () => {
  const params = buildActualSearchParams('all', 25);
  const search = createSearchHarness();
  const result = await search(params, { propagateErrors: true });
  assert.deepEqual(result.listings.map(x => x.id),
    ['honda-manual-london', 'toyota-auto-london']);
  assert.equal(latestParams.get('transmissions'), null);
  assert.equal(result.listings.every(x => x.listingType === 'CLASSIFIED'), true);
});
