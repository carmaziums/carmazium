import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual native TypeScript API module with an isolated HTTP stub.
// These tests do not require an Expo simulator or a real user account.
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = path => ts.transpileModule(read(path), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function clientHarness(response) {
  const requests = [];
  const exports = {};
  runInNewContext(compile('src/lib/listingsApi.ts'), {
    exports, URLSearchParams, console,
    require: name => {
      if (name === './apiClient') return {
        apiClient: async (url, options) => {
          requests.push({ url, options });
          return response(url);
        },
      };
      throw Error('Unexpected native listing API dependency: ' + name);
    },
  });
  return { searchListings: exports.searchListings, requests };
}
const emptyResponse = total => ({
  data: [], pagination: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) },
});
const radius = {
  latitude: 0, longitude: -0.1278, maxDistanceMi: 25,
  sortBy: 'distance_asc', page: 2, limit: 20,
};

test('real native API serializes centre/radius, zero latitude, sort and page', async () => {
  const h = clientHarness(() => emptyResponse(25));
  const result = await h.searchListings(radius, { propagateErrors: true });
  assert.equal(result.total, 25);
  const params = new URL('https://example.invalid' + h.requests[0].url).searchParams;
  for (const [name, value] of Object.entries(radius)) {
    assert.equal(params.get(name), String(value), name);
  }
});

test('real native strict radius API preserves backend capacity errors', async () => {
  const h = clientHarness(() => { throw Error('503 Too many nearby candidates'); });
  await assert.rejects(
    h.searchListings(radius, { propagateErrors: true }),
    /503 Too many nearby candidates/,
  );
});

test('real native strict radius API refuses malformed 200 responses', async () => {
  const h = clientHarness(() => ({ success: true, data: [], pagination: null }));
  await assert.rejects(
    h.searchListings(radius, { propagateErrors: true }),
    /Could not load nearby vehicle results/,
  );
});

test('a genuine empty radius page remains distinguishable from a fetch error', async () => {
  const h = clientHarness(() => emptyResponse(0));
  const data = await h.searchListings(radius, { propagateErrors: true });
  assert.equal(data.total, 0);
  assert.equal(data.listings.length, 0);
});

test('old non-radius callers keep their existing best-effort fallback', async () => {
  const h = clientHarness(() => { throw Error('OFFLINE'); });
  const data = await h.searchListings({ search: 'example' });
  assert.equal(data.total, 0);
  assert.equal(data.listings.length, 0);
});

test('native Search passes radius strict mode and ignores previous postcode and page responses', () => {
  const screen = read('src/screens/main/SearchScreen.tsx');
  assert.match(screen, /searchListings\(\s*params, \{ propagateErrors: maxDistanceMi != null \}/);
  assert.match(screen, /const epoch = reset \? \+\+radiusSearchEpochRef\.current/);
  assert.match(screen, /if \(epoch !== radiusSearchEpochRef\.current\) return/);
  assert.match(screen, /if \(!reset && radiusPageBusyRef\.current\) return/);
  assert.match(screen, /radiusSearchEpochRef\.current\+\+/);
  assert.match(screen, /setRadiusError\(error\?\.message/);
  assert.match(screen, /setHasMore\(p \* 20 < t\)/);
  assert.match(screen, /hasMore && !loading && !loadingMore/);
  assert.match(screen, /if \(!textSearchBootstrappedRef\.current\)/);
  assert.doesNotMatch(screen, /useEffect\(\(\) => \{ fetch\(true\); \}, \[\]\)/);
});

test('website rejects previous postcode results and never restores radius caches', () => {
  const web = read('../../src/app/search/page.tsx');
  assert.match(web, /const epoch = \+\+radiusSearchEpochRef\.current/);
  assert.match(web, /if \(epoch !== radiusSearchEpochRef\.current\) return/);
  assert.match(web, /cache\.filters\?\.maxDistanceMi == null/);
  assert.match(web, /searchCacheRef\.current\.filters\.maxDistanceMi != null/);
});
