import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Run actual compiled Zustand store actions against a deterministic test
// store and mocked REST requests. Source-string checks alone cannot reproduce
// slow requests, failed mutations or accidental cross-account resurrection.
const source = readFileSync(new URL('../src/store/watchlistStore.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const item = id => ({ id: 'saved-' + id, listingId: id, mappedListing: { id, make: 'Ford', model: id } });
const page = (items, total = items.length) => ({ items, total });

function harness(overrides = {}) {
  const api = {
    getWatchlist: async () => page([]),
    addToWatchlist: async () => {},
    removeFromWatchlist: async () => {},
    ...overrides,
  };
  const zustand = {
    create: initialize => {
      let value;
      const set = change => {
        const updated = typeof change === 'function' ? change(value) : change;
        value = { ...value, ...updated };
      };
      value = initialize(set, () => value);
      return { getState: () => value };
    },
  };
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require: name => {
      if (name === 'zustand') return zustand;
      if (name === '../lib/watchlistApi') return api;
      throw Error('Unexpected module: ' + name);
    },
  }, { filename: 'compiled-native-watchlist.js' });
  return exports.useWatchlistStore;
}

test('all paginated saved cars hydrate instead of truncating after the first page', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => String(i));
  const calls = [];
  const s = harness({
    getWatchlist: async (p, size) => {
      calls.push([p, size]);
      return page(ids.slice((p - 1) * size, p * size).map(item), 51);
    },
  });
  await s.getState().hydrateFromApi();
  assert.equal(s.getState().savedIds.size, 51);
  assert.deepEqual(calls, [[1, 50], [2, 50]]);
  assert.equal(s.getState().isLoading, false);
});

test('offline or failed refresh preserves previously hydrated watchlist', async () => {
  let offline = false;
  const s = harness({
    getWatchlist: async () => {
      if (offline) throw Error('offline');
      return page([item('A')]);
    },
  });
  await s.getState().hydrateFromApi();
  offline = true;
  await s.getState().hydrateFromApi();
  assert.equal(s.getState().savedIds.has('A'), true);
  assert.equal(s.getState().savedListings.length, 1);
  assert.equal(s.getState().isLoading, false);
});

test('slow hydration cannot overwrite an optimistic save started later', async () => {
  const olderRequest = deferred();
  const s = harness({ getWatchlist: () => olderRequest.promise });
  const loading = s.getState().hydrateFromApi();
  s.getState().save({ id: 'new', make: 'Ford' });
  olderRequest.resolve(page([item('old')]));
  await loading;
  assert.deepEqual([...s.getState().savedIds], ['new']);
  assert.equal(s.getState().isLoading, false);
});

test('slow hydration stops pagination and cannot re-fill a signed-out account', async () => {
  const olderRequest = deferred();
  let pages = 0;
  const s = harness({ getWatchlist: async () => { pages += 1; return olderRequest.promise; } });
  const loading = s.getState().hydrateFromApi();
  await tick(); // Wait until /watchlist is in flight, not merely scheduled.
  assert.equal(pages, 1);
  s.getState().reset();
  olderRequest.resolve(page([item('prior')], 52));
  await loading;
  assert.equal(pages, 1);
  assert.equal(s.getState().savedIds.size, 0);
  assert.equal(s.getState().isLoading, false);
});

test('late failed removal cannot resurrect prior-account car after sign-out', async () => {
  const removing = deferred();
  const s = harness({
    getWatchlist: async () => page([item('prior')]),
    removeFromWatchlist: () => removing.promise,
  });
  await s.getState().hydrateFromApi();
  s.getState().unsave('prior');
  await tick(); // Ensure the first mutation genuinely reached the network.
  s.getState().reset();
  removing.reject(Error('old account network failure'));
  await tick();
  assert.equal(s.getState().savedIds.size, 0);
  assert.equal(s.getState().savedListings.length, 0);
});

test('late failed save cannot remove new-account car with same listing ID', async () => {
  const saving = deferred();
  const s = harness({
    getWatchlist: async () => page([item('shared')]),
    addToWatchlist: () => saving.promise,
  });
  s.getState().save({ id: 'shared', make: 'Ford' });
  await tick(); // Old request starts before the identity changes.
  s.getState().reset();
  await s.getState().hydrateFromApi();
  saving.reject(Error('old account failed save'));
  await tick();
  assert.equal(s.getState().savedIds.has('shared'), true);
});

test('failed removal for current account rolls back optimistic state', async () => {
  const s = harness({
    getWatchlist: async () => page([item('A')]),
    removeFromWatchlist: async () => { throw Error('not connected'); },
  });
  await s.getState().hydrateFromApi();
  s.getState().unsave('A');
  await tick();
  assert.equal(s.getState().savedIds.has('A'), true);
});

function watchlistApiHarness(response) {
  const source = readFileSync(new URL('../src/lib/watchlistApi.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require: name => {
      if (name === './apiClient') return { apiClient: async () => response };
      if (name === './listingsApi') return { mapApiListingToCarListing: l => l };
      throw Error('Unexpected module: ' + name);
    },
  }, { filename: 'compiled-native-watchlist-api.js' });
  return exports;
}

test('malformed saved-car server response is an error, not an empty watchlist', async () => {
  for (const malformed of [
    { success: true, data: null, pagination: { total: 0 } },
    { success: true, data: [], pagination: undefined },
    { success: true, data: [], pagination: { total: -1 } },
  ]) {
    await assert.rejects(watchlistApiHarness(malformed).getWatchlist(), /Invalid saved-car response/);
  }
});

test('valid empty and populated saved-car responses still hydrate correctly', async () => {
  const empty = await watchlistApiHarness({ success: true, data: [], pagination: { total: 0 } }).getWatchlist();
  assert.equal(empty.total, 0);
  assert.equal(empty.items.length, 0);
  const populated = await watchlistApiHarness({
    success: true,
    data: [{ id: 'w1', listingId: 'A', listing: { id: 'A' } }],
    pagination: { total: 1 },
  }).getWatchlist();
  assert.equal(populated.total, 1);
  assert.equal(populated.items[0].mappedListing.id, 'A');
});

test('older failed save does not undo a newer removal on the same account', async () => {
  const saving = deferred();
  const store = harness({ addToWatchlist: () => saving.promise });
  store.getState().save({ id: 'A', make: 'Ford' });
  store.getState().unsave('A');
  await tick();
  saving.reject(Error('earlier save failed'));
  await tick();
  assert.equal(store.getState().savedIds.has('A'), false);
  assert.equal(store.getState().savedListings.length, 0);
});

test('older failed removal does not resurrect a duplicate after newer save', async () => {
  const removing = deferred();
  const store = harness({
    getWatchlist: async () => page([item('A')]),
    removeFromWatchlist: () => removing.promise,
  });
  await store.getState().hydrateFromApi();
  store.getState().unsave('A');
  store.getState().save({ id: 'A', make: 'Ford' });
  await tick();
  removing.reject(Error('earlier remove failed'));
  await tick();
  assert.equal(store.getState().savedIds.has('A'), true);
  assert.equal(store.getState().savedListings.length, 1);
});

test('repeated saves/removes without a state change do not issue duplicate requests', async () => {
  let adds = 0, removes = 0;
  const store = harness({
    addToWatchlist: async () => { adds += 1; },
    removeFromWatchlist: async () => { removes += 1; },
  });
  const listing = { id: 'A', make: 'Ford' };
  store.getState().save(listing);
  store.getState().save(listing);
  store.getState().unsave('A');
  store.getState().unsave('A');
  await tick();
  assert.equal(adds, 1);
  assert.equal(removes, 1);
});

test('rapid heart taps serialize server writes per car instead of racing', async () => {
  const first = deferred();
  const order = [];
  const s = harness({
    addToWatchlist: () => { order.push('add'); return first.promise; },
    removeFromWatchlist: async () => { order.push('remove'); },
  });
  s.getState().save({ id: 'A', make: 'Ford' });
  s.getState().unsave('A');
  await tick();
  assert.deepEqual(order, ['add']);
  first.resolve();
  await tick();
  assert.deepEqual(order, ['add', 'remove']);
  assert.equal(s.getState().savedIds.has('A'), false);
});

test('hydration waits for pending writes before fetching authoritative saved cars', async () => {
  const first = deferred();
  const calls = [];
  const s = harness({
    addToWatchlist: () => { calls.push('add-start'); return first.promise; },
    getWatchlist: async () => { calls.push('get'); return page([item('A')]); },
  });
  s.getState().save({ id: 'A', make: 'Ford' });
  const hydrate = s.getState().hydrateFromApi();
  await tick();
  assert.deepEqual(calls, ['add-start']);
  first.resolve();
  await hydrate;
  assert.deepEqual(calls, ['add-start', 'get']);
  assert.equal(s.getState().savedIds.has('A'), true);
});

test('queued prior-account removals never execute after sign-out', async () => {
  const first = deferred();
  const calls = [];
  const s = harness({
    addToWatchlist: () => { calls.push('old-add'); return first.promise; },
    removeFromWatchlist: async () => { calls.push('old-remove'); },
  });
  s.getState().save({ id: 'A', make: 'Ford' });
  s.getState().unsave('A');
  await tick();
  s.getState().reset();
  first.resolve();
  await tick();
  assert.deepEqual(calls, ['old-add']);
  assert.equal(s.getState().savedIds.size, 0);
});

test('404 on removal is idempotent, other server errors remain failures', async () => {
  // Use compiled API client and inject the DELETE response/error separately.
  const src = readFileSync(new URL('../src/lib/watchlistApi.ts', import.meta.url), 'utf8');
  const compiledApi = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const getApi = (message) => {
    const exports = {};
    runInNewContext(compiledApi.outputText, {
      exports,
      require: name => {
        if (name === './apiClient') return { apiClient: async () => { throw Error(message); } };
        if (name === './listingsApi') return { mapApiListingToCarListing: l => l };
        throw Error('Unexpected import: ' + name);
      },
    });
    return exports;
  };
  await assert.doesNotReject(getApi('404 Not Found').removeFromWatchlist('A'));
  await assert.doesNotReject(getApi('Listing not in watchlist').removeFromWatchlist('A'));
  await assert.rejects(getApi('Network unreachable').removeFromWatchlist('A'), /Network unreachable/);
});
