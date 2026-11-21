import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function compile(path, modules, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, require: name => {
    assert.ok(name in modules, name); return modules[name];
  }, setTimeout, clearTimeout, console, Date, ...globals });
  return exports;
}

function harness() {
  let listener, locked = false, reads = 0, unsubscribed = false;
  const timers = new Map(); let next = 0;
  const auth = {
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    },
    async getSession() { assert.equal(locked, false, 'session read must not run under auth event lock'); reads++; },
  };
  const { subscribeDeferredAuthChanges } = compile('lib/authSubscription.ts', { './supabase': { supabase: { auth } } }, {
    setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout(id) { timers.delete(id); },
    console: { warn() {} },
  });
  return {
    subscribe: subscribeDeferredAuthChanges, auth,
    emit(event, session = null) { locked = true; const result = listener(event, session); locked = false; assert.equal(result, undefined); },
    async flush() { for (const fn of [...timers.values()]) fn(); timers.clear(); await new Promise(setImmediate); },
    get reads() { return reads; }, get unsubscribed() { return unsubscribed; },
  };
}

test('sign-in and refresh release the auth lock before session hydration', async () => {
  const h = harness(); const events = [];
  h.subscribe(async event => { events.push(event); await h.auth.getSession(); });
  h.emit('SIGNED_IN'); h.emit('TOKEN_REFRESHED');
  assert.equal(h.reads, 0);
  await h.flush(); assert.equal(h.reads, 2);
  assert.deepEqual(events, ['SIGNED_IN', 'TOKEN_REFRESHED']);
});

test('unsubscribing cancels queued auth work', async () => {
  const h = harness(); const stop = h.subscribe(() => h.auth.getSession());
  h.emit('SIGNED_IN'); stop(); await h.flush();
  assert.equal(h.reads, 0); assert.equal(h.unsubscribed, true);
});

test('a failed handler does not prevent later auth events', async () => {
  const h = harness(); let count = 0;
  h.subscribe(() => { count++; if (count === 1) throw Error('unavailable'); });
  h.emit('SIGNED_IN'); await h.flush(); h.emit('TOKEN_REFRESHED'); await h.flush();
  assert.equal(count, 2);
});

function storeHarness() {
  let state, handler, hydrations = 0, logouts = 0;
  const { useAuthStore } = compile('store/authStore.ts', {
    zustand: { create(factory) { state = factory(update => Object.assign(state, typeof update === 'function' ? update(state) : update), () => state); return { getState: () => state }; } },
    '../lib/supabase': { supabase: {}, hybridStorageAdapter: {} },
    '../lib/authSubscription': { subscribeDeferredAuthChanges(fn) { handler = fn; return () => {}; } },
    '../lib/apiClient': { apiClient() { throw Error('unexpected API call'); } },
    'expo-secure-store': {}, '../lib/authEvents': { setAuthRedirectHandler() {}, resetAuthRedirectLatch() {} },
    '../lib/navigationRef': { navigationRef: {} }, '../lib/sellWizardStore': { detachSellWizardDraft() {} },
  });
  state.initializeAuth = async () => { hydrations++; };
  state.forceLogout = async () => { logouts++; };
  useAuthStore.getState().subscribeToAuthChanges();
  return { state, emit: (event, session = null) => handler(event, session), get hydrations() { return hydrations; }, get logouts() { return logouts; } };
}

test('explicit login or startup owns hydration while loading', async () => {
  const h = storeHarness(); h.state.isLoading = true;
  await h.emit('SIGNED_IN'); await h.emit('TOKEN_REFRESHED', { access_token: 'test' });
  assert.equal(h.hydrations, 0);
  h.state.isLoading = false; await h.emit('TOKEN_REFRESHED', { access_token: 'test' });
  assert.equal(h.hydrations, 1);
});

test('authenticated and pending-verification sessions are not rehydrated on sign-in', async () => {
  const h = storeHarness(); h.state.isAuthenticated = true;
  await h.emit('SIGNED_IN'); assert.equal(h.hydrations, 0);
  await h.emit('SIGNED_OUT'); assert.equal(h.logouts, 1);
  h.state.isAuthenticated = false; h.state.pendingEmailVerification = true;
  await h.emit('SIGNED_IN'); await h.emit('PASSWORD_RECOVERY');
  assert.equal(h.hydrations, 0);
});
