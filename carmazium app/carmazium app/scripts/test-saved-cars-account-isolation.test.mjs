import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = path => ts.transpileModule(read(path), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const listing = id => ({ id, images: [], make: 'Honda', model: 'Jazz', year: 2020, mileage: 30000, price: 9000 });
const items = ids => ids.map(id => ({ listingId: id, mappedListing: listing(id) }));
function harness(api = {}) {
  const calls = [];
  let state;
  const create = initialize => {
    const set = update => {
      const result = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...result };
    };
    state = initialize(set, () => state);
    return { getState: () => state };
  };
  const mocks = {
    getWatchlist: async (page, limit) => {
      calls.push({ operation: 'get', page, limit });
      return api.get ? api.get(page, limit) : { items: [], total: 0 };
    },
    addToWatchlist: async id => {
      calls.push({ operation: 'add', id });
      if (api.add) return api.add(id);
    },
    removeFromWatchlist: async id => {
      calls.push({ operation: 'remove', id });
      if (api.remove) return api.remove(id);
    },
  };
  const exports = {};
  runInNewContext(compile('src/store/watchlistStore.ts'), {
    exports, console,
    require: name => {
      if (name === 'zustand') return { create };
      if (name === '../lib/watchlistApi') return mocks;
      throw Error('Unexpected watchlist dependency: ' + name);
    },
  });
  return { state: exports.useWatchlistStore.getState, calls };
}

test('saved cars are private to one user and reset immediately on signout or switch', async () => {
  const h = harness({ get: async () => ({ items: items(['a']), total: 1 }) });
  h.state().bindAccount('alice');
  await h.state().hydrateFromApi();
  assert.deepEqual([...h.state().savedIds], ['a']);
  h.state().bindAccount(null);
  assert.equal(h.state().savedListings.length, 0);
  assert.equal(h.state().isSaved('a'), false);
  h.state().bindAccount('bob');
  assert.equal(h.state().savedListings.length, 0);
  await h.state().hydrateFromApi();
  assert.equal(h.state().accountId, 'bob');
  assert.equal(h.state().isSaved('a'), true); // fetched anew, not inherited
});

test('hydrate loads all pages, removes duplicate ids and uses backend inventory', async () => {
  const all = Array.from({ length: 53 }, (_, i) => 'vehicle-' + i);
  const h = harness({ get: async page => page === 1
    ? { items: items(all.slice(0, 50)), total: 53 }
    : { items: items([...all.slice(50), all[50]]), total: 53 } });
  h.state().bindAccount('alice');
  await h.state().hydrateFromApi();
  assert.equal(h.state().savedListings.length, 53);
  assert.equal(h.state().savedIds.size, 53);
  assert.deepEqual(h.calls.filter(x => x.operation === 'get').map(x => x.page), [1, 2]);
});

test('transient network errors preserve saved items and expose retryable error', async () => {
  let attempts = 0;
  const h = harness({ get: async () => {
    if (++attempts === 1) return { items: items(['a']), total: 1 };
    throw Error('OFFLINE');
  } });
  h.state().bindAccount('alice');
  await h.state().hydrateFromApi();
  await h.state().hydrateFromApi();
  assert.equal(h.state().isSaved('a'), true);
  assert.equal(h.state().isLoading, false);
  assert.equal(h.state().loadError, 'OFFLINE');
});

test('previous account cannot repopulate saved cars after a late fetch response', async () => {
  const old = deferred();
  const h = harness({ get: (page, limit) => h.state().accountId === 'alice'
    ? old.promise : Promise.resolve({ items: items(['bob-car']), total: 1 }) });
  h.state().bindAccount('alice');
  const first = h.state().hydrateFromApi();
  await flush();
  h.state().bindAccount('bob');
  await h.state().hydrateFromApi();
  old.resolve({ items: items(['alice-private']), total: 1 });
  await first;
  assert.deepEqual([...h.state().savedIds], ['bob-car']);
});

test('later refresh wins when two same-account requests finish out of order', async () => {
  const first = deferred();
  let count = 0;
  const h = harness({ get: () => ++count === 1 ? first.promise :
    Promise.resolve({ items: items(['new']), total: 1 }) });
  h.state().bindAccount('alice');
  const older = h.state().hydrateFromApi();
  const newer = h.state().hydrateFromApi();
  await newer;
  first.resolve({ items: items(['old']), total: 1 });
  await older;
  assert.deepEqual([...h.state().savedIds], ['new']);
});

test('pending save cannot resurrect an old account after another user logs in', async () => {
  const write = deferred();
  const h = harness({ add: () => write.promise });
  h.state().bindAccount('alice');
  h.state().save(listing('private'));
  await flush();
  h.state().bindAccount('bob');
  write.reject(Error('OFFLINE'));
  await flush();
  assert.equal(h.state().isSaved('private'), false);
  assert.equal(h.state().loadError, null);
});

test('rapid save-then-remove is serialized in the order of the user actions', async () => {
  const write = deferred();
  const h = harness({ add: () => write.promise });
  h.state().bindAccount('alice');
  h.state().save(listing('a'));
  h.state().unsave('a');
  await flush();
  assert.deepEqual(h.calls.filter(x => x.operation !== 'get').map(x => x.operation), ['add']);
  write.resolve();
  await flush();
  assert.deepEqual(h.calls.filter(x => x.operation !== 'get').map(x => x.operation), ['add', 'remove']);
  assert.equal(h.state().isSaved('a'), false);
});

test('a failed old optimistic save does not undo a later remove', async () => {
  const h = harness({ add: async () => { throw Error('OFFLINE'); } });
  h.state().bindAccount('alice');
  h.state().save(listing('a'));
  h.state().unsave('a');
  await flush();
  assert.equal(h.state().isSaved('a'), false);
  assert.equal(h.state().loadError, null);
});

test('a current failed optimistic remove restores the existing saved item', async () => {
  const h = harness({
    get: async () => ({ items: items(['a']), total: 1 }),
    remove: async () => { throw Error('OFFLINE'); },
  });
  h.state().bindAccount('alice');
  await h.state().hydrateFromApi();
  h.state().unsave('a');
  await flush();
  assert.equal(h.state().isSaved('a'), true);
  assert.match(h.state().loadError, /Could not remove/);
});

test('a stale hydrate never overwrites a newer optimistic save', async () => {
  const old = deferred();
  const h = harness({ get: () => old.promise });
  h.state().bindAccount('alice');
  const pending = h.state().hydrateFromApi();
  h.state().save(listing('just-saved'));
  old.resolve({ items: [], total: 0 });
  await pending;
  assert.equal(h.state().isSaved('just-saved'), true);
});

test('watchlist HTTP failure is not silently replaced with an empty saved-car result', async () => {
  const exports = {};
  runInNewContext(compile('src/lib/watchlistApi.ts'), {
    exports,
    require: name => {
      if (name === './apiClient') return { apiClient: async () => { throw Error('OFFLINE'); } };
      if (name === './listingsApi') return { mapApiListingToCarListing: x => x };
      throw Error('Unexpected API import: ' + name);
    },
  });
  await assert.rejects(exports.getWatchlist(), /OFFLINE/);
});

test('deleting a listing already absent on the server is idempotent', async () => {
  const exports = {};
  runInNewContext(compile('src/lib/watchlistApi.ts'), {
    exports,
    require: name => {
      if (name === './apiClient') return {
        apiClient: async () => { throw Error('Listing not in watchlist'); },
      };
      if (name === './listingsApi') return { mapApiListingToCarListing: x => x };
      throw Error('Unexpected API import: ' + name);
    },
  });
  await assert.doesNotReject(exports.removeFromWatchlist('a'));
});

test('saved tab re-fetches on focus and displays a retryable offline state', () => {
  const saved = read('src/screens/main/SavedScreen.tsx');
  const app = read('App.tsx');
  assert.match(saved, /useFocusEffect\(useCallback\(/);
  assert.match(saved, /Could not refresh saved cars/);
  assert.match(saved, /SORTED BY: RECENTLY SAVED/);
  assert.doesNotMatch(saved, /<Text style=\{styles.listSortChangeText\}>Change<\/Text>/);
  assert.match(saved, /accessibilityLabel="Retry loading saved cars"/);
  assert.match(app, /useAuthStore\.subscribe\(synchronizeWatchlistAccount\)/);
  assert.match(app, /state\.isAuthenticated \? state\.user\?\.id \?\? null : null/);
});
