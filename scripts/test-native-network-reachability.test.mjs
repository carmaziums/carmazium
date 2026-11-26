import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const mobile = new URL('../carmazium app/carmazium app/src/lib/', import.meta.url);
function load(name, dependencies, fetchImpl = globalThis.fetch) {
  const code = ts.transpileModule(readFileSync(new URL(name + '.ts', mobile), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'fetch', code)(id => {
    assert.ok(id in dependencies, 'Unexpected dependency: ' + id);
    return dependencies[id];
  }, module, module.exports, fetchImpl);
  return module.exports;
}
function monitor() {
  let config;
  const listeners = new Set();
  const netInfo = {
    configure(value) { assert.equal(listeners.size, 0); config = value; },
    addEventListener(cb) { assert.ok(config); listeners.add(cb); return () => listeners.delete(cb); },
  };
  const api = load('network', { '@react-native-community/netinfo': netInfo });
  return { api, config, listeners, emit: state => [...listeners].forEach(cb => cb(state)) };
}
test('reachability probes the configured CarMazium service instead of native validation', () => {
  const { config } = monitor();
  assert.equal(config.useNativeReachability, false);
  assert.equal(config.reachabilityUrl, (process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev').replace(/\/$/, '') + '/health');
  assert.equal(config.reachabilityMethod, 'GET');
  assert.ok(config.reachabilityRequestTimeout <= 10_000);
  assert.ok(config.reachabilityShortTimeout <= 10_000);
});
test('HTTP server errors prove reachability; captive redirects and no response do not', async () => {
  const { config } = monitor();
  for (const status of [200, 204, 401, 429, 500, 503]) {
    assert.equal(await config.reachabilityTest({ status, redirected: false }), true);
  }
  assert.equal(await config.reachabilityTest({ status: 200, redirected: true }), false);
  assert.equal(await config.reachabilityTest({ status: 0, redirected: false }), false);
});
test('monitor and banner recover after a failed probe without leaking listeners', () => {
  const { api, emit, listeners } = monitor();
  const stop = api.startNetworkMonitor();
  const changes = [];
  const unsubscribe = api.subscribeToConnectivity(value => changes.push(value));
  emit({ isConnected: true, isInternetReachable: null });
  assert.equal(api.isOnline(), true);
  emit({ isConnected: true, isInternetReachable: false });
  assert.equal(api.isOnline(), false);
  emit({ isConnected: true, isInternetReachable: true });
  assert.equal(api.isOnline(), true);
  emit({ isConnected: false, isInternetReachable: null });
  assert.equal(api.isOnline(), false);
  assert.deepEqual(changes, [true, true, false, true, false]);
  stop(); unsubscribe();
  assert.equal(listeners.size, 0);
});
function client(fetchImpl) {
  return load('apiClient', {
    './supabase': { getAccessToken: async () => 'unit-test-token' },
    './authEvents': { emitAuthRedirect() { throw new Error('Unexpected auth redirect'); } },
    './network': { isOnline: () => false },
  }, fetchImpl).apiClient;
}
test('a stale offline flag never blocks a successful API request', async () => {
  let calls = 0;
  const apiClient = client(async () => { calls++; return new Response('{"status":"ok"}'); });
  assert.deepEqual(await apiClient('/health'), { status: 'ok' });
  assert.equal(calls, 1);
});
test('a failed connection reports offline only after the real request fails', async () => {
  let calls = 0;
  const apiClient = client(async () => { calls++; throw new TypeError('Network request failed'); });
  await assert.rejects(apiClient('/health'), /^Error: OFFLINE$/);
  assert.equal(calls, 1);
});
test('server failures keep their explanation even when the previous probe failed', async () => {
  const apiClient = client(async () => new Response('{"message":"Service temporarily unavailable"}', { status: 503 }));
  await assert.rejects(apiClient('/health'), /^Error: Service temporarily unavailable$/);
});
