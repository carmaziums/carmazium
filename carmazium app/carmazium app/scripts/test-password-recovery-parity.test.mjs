import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

function authHarness(overrides = {}) {
  const callbacks = [];
  const calls = { api: [], signOut: 0, getSession: 0 };
  const supabase = {
    auth: {
      getSession: async () => {
        calls.getSession += 1;
        return { data: { session: null } };
      },
      signOut: async () => { calls.signOut++; },
      onAuthStateChange: fn => {
        callbacks.push(fn);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      ...overrides.auth,
    },
  };
  const store = {
    create: initialize => {
      let state;
      const set = update => {
        const value = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...value };
      };
      state = initialize(set, () => state);
      return { getState: () => state };
    },
  };
  const transpiled = ts.transpileModule(read('src/store/authStore.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(transpiled.outputText, {
    exports, console,
    require: name => {
      if (name === 'zustand') return store;
      if (name === '../lib/supabase') return { supabase };
      if (name === '../lib/apiClient') return { apiClient: async (url, opts) => {
        calls.api.push({ url, opts });
        return overrides.api ? overrides.api(url, opts) : { success: true, data: null };
      } };
      if (name === 'expo-secure-store') return { getItemAsync: async () => '1', setItemAsync: async () => {} };
      if (name === '../lib/authEvents') return { setAuthRedirectHandler: () => {}, resetAuthRedirectLatch: () => {} };
      if (name === '../lib/navigationRef') return { navigationRef: { isReady: () => false } };
      if (name === '../lib/sellWizardStore') return { detachSellWizardDraft: async () => {} };
      throw new Error('Unexpected auth import: ' + name);
    },
  }, { filename: 'compiled-auth-store.js' });
  return {
    auth: exports.useAuthStore.getState,
    emit: async (event, session) => {
      for (const fn of callbacks) await fn(event, session);
    },
    calls,
  };
}

test('recovery uses an isolated opening -> ready lifecycle with a clean escape', () => {
  const h = authHarness();
  h.auth().startPasswordRecovery();
  assert.equal(h.auth().passwordRecoveryStatus, 'opening');
  assert.equal(h.auth().authInitialized, true);
  h.auth().finishPasswordRecovery();
  assert.equal(h.auth().passwordRecoveryStatus, 'ready');
  h.auth().clearPasswordRecovery();
  assert.equal(h.auth().passwordRecoveryStatus, 'idle');
});

test('Supabase SIGNED_IN/TOKEN_REFRESHED events never bridge a recovery token', async () => {
  const h = authHarness();
  h.auth().subscribeToAuthChanges();
  h.auth().startPasswordRecovery();
  await h.emit('SIGNED_IN', { access_token: 'restricted-recovery-token' });
  await h.emit('PASSWORD_RECOVERY', { access_token: 'restricted-recovery-token' });
  await h.emit('TOKEN_REFRESHED', { access_token: 'restricted-recovery-token' });
  assert.equal(h.calls.getSession, 0);
  assert.equal(h.calls.api.length, 0);
  assert.equal(h.auth().isAuthenticated, false);
  assert.equal(h.auth().passwordRecoveryStatus, 'opening');
});

test('cold-start initialization cannot bridge when a recovery URL arrives mid-request', async () => {
  const request = deferred();
  const h = authHarness({
    auth: { getSession: () => request.promise },
  });
  const initial = h.auth().initializeAuth();
  await tick(); // SecureStore resolves, then getSession remains pending.
  h.auth().startPasswordRecovery();
  request.resolve({
    data: { session: { user: { id: 'id', email_confirmed_at: 'now' }, access_token: 'recovery' } },
  });
  await initial;
  assert.equal(h.auth().passwordRecoveryStatus, 'opening');
  assert.equal(h.auth().isAuthenticated, false);
  assert.equal(h.calls.api.length, 0);
});

test('force-logout clears a recovery session even before normal login', async () => {
  const h = authHarness();
  h.auth().startPasswordRecovery();
  await h.auth().forceLogout();
  assert.equal(h.calls.signOut, 1);
  assert.equal(h.auth().passwordRecoveryStatus, 'idle');
  assert.equal(h.auth().isAuthenticated, false);
});

test('root recovery screen takes precedence over pending verification, auth and dashboard', () => {
  const root = read('src/navigation/RootNavigator.tsx');
  const app = read('App.tsx');
  const reset = read('src/screens/auth/ResetPasswordScreen.tsx');
  assert.ok(root.indexOf("{passwordRecoveryStatus !== 'idle' ? (") <
            root.indexOf(") : pendingEmailVerification ? ("), 'Recovery route must win over all other root states');
  assert.match(root, /<Stack.Screen name="PasswordRecovery" component=\{PasswordRecoveryRoute\}/);
  assert.match(root, /<ResetPasswordScreen isRootRecovery/);
  assert.match(reset, /if \(!isRootRecovery\) \{/);
  assert.match(reset, /await logout\(\);/);
  assert.doesNotMatch(app, /navigate\('Auth', \{ screen: 'ResetPassword' \}\)/);
});

test('implicit and PKCE recovery are selected before opening Supabase sessions', () => {
  const app = read('App.tsx');
  assert.match(app, /type === 'recovery'/);
  assert.match(app, /reset-password/);
  assert.match(app, /if \(recoveryFlow\) auth\.startPasswordRecovery\(\)/);
  assert.ok(app.indexOf("auth.startPasswordRecovery()") < app.indexOf('supabase.auth.setSession('));
  assert.ok(app.indexOf("auth.startPasswordRecovery()") < app.indexOf('supabase.auth.exchangeCodeForSession('));
  assert.match(app, /finishPasswordRecovery\(\)/);
  assert.match(app, /clearPasswordRecovery\(\)/);
  assert.match(app, /session\.access_token === priorAccessToken/);
});
