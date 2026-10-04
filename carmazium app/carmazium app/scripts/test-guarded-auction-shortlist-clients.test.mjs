import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function apiHarness(source, errors = {}) {
  const calls = [];
  const exports = {};
  runInNewContext(transpile(source), {
    exports, encodeURIComponent, console,
    require: name => {
      if (name === './apiClient') return {
        apiClient: async (url, opts) => {
          calls.push({ url, method: opts?.method || 'GET' });
          if (errors[opts?.method || 'GET']) {
            throw Error(errors[opts?.method || 'GET']);
          }
          return url.includes('/check/')
            ? { data: { inWatchlist: true } }
            : { data: [], pagination: { total: 0, page: 1, limit: 50 } };
        },
      };
      throw Error('Unexpected client adapter: ' + name);
    },
  });
  return { api: exports, calls };
}

test('website verified auction API never falls back to generic Saved Cars routes', async () => {
  const h = apiHarness(read('../../src/lib/auctionShortlistApi.ts'));
  await h.api.addAuctionToShortlist('auction-id');
  await h.api.removeAuctionFromShortlist('auction-id');
  assert.equal(await h.api.isAuctionShortlisted('auction-id'), true);
  assert.deepEqual(Array.from(h.calls, x => [x.method, x.url]), [
    ['POST', '/watchlist/auctions/auction-id'],
    ['DELETE', '/watchlist/auctions/auction-id'],
    ['GET', '/watchlist/auctions/check/auction-id'],
  ]);
});

test('native verified auction API uses the exact same guarded trade writes', async () => {
  const h = apiHarness(read('src/lib/auctionShortlistApi.ts'));
  await h.api.addAuctionToShortlist('auction-id');
  await h.api.removeAuctionFromShortlist('auction-id');
  const response = await h.api.getAuctionShortlist(1, 50);
  assert.equal(response.total, 0);
  assert.deepEqual(Array.from(h.calls, x => [x.method, x.url]), [
    ['POST', '/watchlist/auctions/auction-id'],
    ['DELETE', '/watchlist/auctions/auction-id'],
    ['GET', '/watchlist/auctions?page=1&limit=50&view=all'],
  ]);
});

test('web auction hearts and dealer dashboard distinguish auction from retail endpoints', () => {
  const web = read('../../src/components/features/WishlistButton.tsx');
  const dealer = read('../../src/app/dashboard/dealer/auctions/shortlisted/page.tsx');
  assert.match(web, /variant === "shortlist"/);
  assert.match(web, /await isAuctionShortlisted\(listingId\)/);
  assert.match(web, /await addAuctionToShortlist\(listingId\)/);
  assert.match(web, /await removeAuctionFromShortlist\(listingId\)/);
  assert.match(web, /identityRef\.current === identity/);
  assert.match(web, /changedAccountOrListing/);
  assert.match(web, /disabled=\{loading \|\| \(!!user && \(!hydrated \|\| !validIdentity\)\)\}/);
  assert.match(dealer, /await removeAuctionFromShortlist\(listingId\)/);
  assert.doesNotMatch(dealer, /import \{ removeFromWatchlist \}/);
});

test('native auction hearts cannot corrupt generic retail Saved Cars state', () => {
  const heart = read('src/components/WishlistHeart.tsx');
  const app = read('App.tsx');
  const live = read('src/screens/main/LiveScreen.tsx');
  assert.match(heart, /useAuctionShortlistStore/);
  assert.doesNotMatch(heart, /useWatchlistStore/);
  assert.match(heart, /disabled=\{pending\}/);
  assert.match(app, /useAuctionShortlistStore\.getState\(\)\.bindAccount/);
  assert.match(app, /useAuthStore\.subscribe\(bindShortlistIdentity\)/);
  assert.match(live, /useFocusEffect\(React\.useCallback/);
  assert.match(live, /void store\.hydrateFromApi\(\)/);
  // Upcoming/scheduled auction cards cannot display an active-only
  // shortlist button that would inevitably return HTTP 404.
  const upcoming = live.slice(live.indexOf('style={styles.upcomingImage}'));
  assert.doesNotMatch(upcoming.slice(0, upcoming.indexOf('style={styles.upcomingInfo}')),
    /<WishlistHeart/);
});

function createStoreHarness() {
  let state;
  const server = new Map([['alice', ['trade-1']], ['bob', ['trade-2']]]);
  let actor = 'alice';
  const getAuctionShortlist = async () => ({
    listingIds: server.get(actor) ?? [], total: (server.get(actor) ?? []).length,
  });
  const exports = {};
  runInNewContext(transpile(read('src/store/auctionShortlistStore.ts')), {
    exports, console, Set, Error,
    require: name => {
      if (name === 'zustand') return { create: init => {
        const set = next => { state = { ...state, ...(typeof next === 'function' ? next(state) : next) }; };
        const get = () => state;
        state = init(set, get);
        return { getState: get };
      } };
      if (name === '../lib/auctionShortlistApi') return {
        getAuctionShortlist,
        addAuctionToShortlist: async id => {
          const ids = server.get(actor) ?? [];
          if (!ids.includes(id)) server.set(actor, [...ids, id]);
        },
        removeAuctionFromShortlist: async id => {
          server.set(actor, (server.get(actor) ?? []).filter(x => x !== id));
        },
      };
      throw Error('Unexpected store import ' + name);
    },
  });
  return { get: exports.useAuctionShortlistStore.getState, setActor: id => { actor = id; }, server };
}

test('trade store preserves same-account saves, clears on logout and isolates next dealer', async () => {
  const h = createStoreHarness();
  h.get().bindAccount('alice');
  await h.get().hydrateFromApi();
  assert.equal(h.get().savedIds.has('trade-1'), true);
  await h.get().toggle('trade-3');
  assert.equal(h.get().savedIds.has('trade-3'), true);
  assert.deepEqual(h.server.get('alice'), ['trade-1', 'trade-3']);
  h.get().bindAccount(null);
  assert.equal(h.get().savedIds.size, 0);
  h.setActor('bob');
  h.get().bindAccount('bob');
  await h.get().hydrateFromApi();
  assert.deepEqual(Array.from(h.get().savedIds), ['trade-2']);
  assert.equal(h.get().savedIds.has('trade-3'), false);
});

test('web/native cross-device duplicate save and already-removed delete are idempotent but 403 is not', async () => {
  for (const source of [
    read('../../src/lib/auctionShortlistApi.ts'),
    read('src/lib/auctionShortlistApi.ts'),
  ]) {
    const duplicate = apiHarness(source, { POST: '409 Conflict' });
    await duplicate.api.addAuctionToShortlist('already-saved');
    const removed = apiHarness(source, { DELETE: '404 Auction not shortlisted' });
    await removed.api.removeAuctionFromShortlist('already-removed');
    const forbidden = apiHarness(source, { POST: '403 Verification required' });
    await assert.rejects(forbidden.api.addAuctionToShortlist('trade-id'), /403/);
  }
});
