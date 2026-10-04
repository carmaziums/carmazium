import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const compile = file => ts.transpileModule(read(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
runInNewContext(compile('src/lib/dealerInviteLink.ts'), { exports, URLSearchParams });
const { isDealerInviteUrl, extractDealerInviteToken } = exports;
const TOKEN = 'a1'.repeat(32);

test('CarMazium custom scheme and both authorized HTTPS hosts preserve valid dealer invites', () => {
  for (const url of [
    'carmazium://auth/accept-invite?token=' + TOKEN,
    'carmazium:///auth/accept-invite?token=' + TOKEN,
    'https://carmazium.com/auth/accept-invite?token=' + TOKEN,
    'https://www.carmazium.com/auth/accept-invite?source=email&token=' + TOKEN,
    'https://www.carmazium.com/auth/accept-invite?token=' + TOKEN.toUpperCase(),
  ]) {
    assert.ok(isDealerInviteUrl(url), url);
    assert.equal(extractDealerInviteToken(url), TOKEN, url);
  }
});

test('lookalike hosts, untrusted schemes, and unrelated paths can never inject an invitation', () => {
  for (const url of [
    'https://carmazium.com.evil.test/auth/accept-invite?token=' + TOKEN,
    'https://evil.test/auth/accept-invite?token=' + TOKEN,
    'http://carmazium.com/auth/accept-invite?token=' + TOKEN,
    'carmazium://auth/accept-invitation?token=' + TOKEN,
    'javascript:auth/accept-invite?token=' + TOKEN,
  ]) {
    assert.equal(isDealerInviteUrl(url), false, url);
    assert.equal(extractDealerInviteToken(url), null, url);
  }
});

test('incomplete or malformed links are recognized but never queued as credentials', () => {
  for (const url of [
    'https://carmazium.com/auth/accept-invite',
    'https://carmazium.com/auth/accept-invite?token=short',
    'carmazium://auth/accept-invite?token=' + 'x'.repeat(64),
    'https://www.carmazium.com/auth/accept-invite?token=' + TOKEN + 'extra',
  ]) {
    assert.equal(isDealerInviteUrl(url), true);
    assert.equal(extractDealerInviteToken(url), null);
  }
});

function storeHarness(options = {}) {
  const callbacks = [];
  const supabase = {
    auth: {
      onAuthStateChange: callback => {
        callbacks.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession: async () => ({ data: { session: options.session ?? null } }),
      signOut: async () => {},
      ...options.auth,
    },
  };
  let state;
  const zustand = {
    create: initializer => {
      const set = update => {
        const next = typeof update === 'function' ? update(state) : update;
        state = { ...state, ...next };
      };
      state = initializer(set, () => state);
      return { getState: () => state };
    },
  };
  const moduleExports = {};
  runInNewContext(compile('src/store/authStore.ts'), {
    exports: moduleExports, console,
    require: name => {
      if (name === 'zustand') return zustand;
      if (name === '../lib/supabase') return { supabase };
      if (name === '../lib/apiClient') return {
        apiClient: async url => url === '/users/me'
          ? { success: true, data: {
              id: 'invited-user', email: 'invited@example.invalid', role: 'DEALER',
              firstName: 'Invited', lastName: 'User',
              phone: options.completed ? '01234567890' : null,
              location: options.completed ? 'London' : null,
              postcode: options.completed ? 'SW1A 1AA' : null,
            } }
          : { success: true, data: {} },
      };
      if (name === 'expo-secure-store') return {
        getItemAsync: async () => '1', setItemAsync: async () => {},
      };
      if (name === '../lib/authEvents') return {
        setAuthRedirectHandler() {}, resetAuthRedirectLatch() {},
      };
      if (name === '../lib/navigationRef') return {
        navigationRef: { isReady: () => false },
      };
      if (name === '../lib/sellWizardStore') return {
        detachSellWizardDraft: async () => {},
      };
      throw Error('Unexpected native auth import: ' + name);
    },
  });
  return moduleExports.useAuthStore.getState;
}

test('signed-out invite persists through session initialization until correct account is available', async () => {
  const get = storeHarness();
  get().captureDealerInviteToken(TOKEN);
  await get().initializeAuth();
  assert.equal(get().pendingDealerInviteToken, TOKEN);
  assert.equal(get().isAuthenticated, false);
});

test('valid invite remains pending for newly signed-in accounts until onboarding finishes', async () => {
  const get = storeHarness({
    completed: false,
    session: { user: { id: 'invited-user', email_confirmed_at: 'now' }, access_token: 'test-token' },
  });
  get().captureDealerInviteToken(TOKEN);
  await get().initializeAuth();
  assert.equal(get().pendingDealerInviteToken, TOKEN);
  assert.equal(get().isAuthenticated, true);
  assert.equal(get().hasCompletedOnboarding, false);
  assert.equal(get().accountRole, 'dealer');
  get().updateUser({ phone: '01234567890', location: 'London', postcode: 'SW1A 1AA' });
  await get().completeOnboarding();
  assert.equal(get().hasCompletedOnboarding, true);
  assert.equal(get().pendingDealerInviteToken, TOKEN);
  get().clearDealerInviteToken();
  assert.equal(get().pendingDealerInviteToken, null);
});

test('auth store ignores untrusted invite tokens and never logs/persists bearer token', () => {
  const get = storeHarness();
  get().captureDealerInviteToken('malformed');
  assert.equal(get().pendingDealerInviteToken, null);
  get().captureDealerInviteToken(TOKEN.toUpperCase());
  assert.equal(get().pendingDealerInviteToken, TOKEN);
  const source = read('src/store/authStore.ts');
  const section = source.slice(source.indexOf('captureDealerInviteToken: (token) =>'), source.indexOf('clearDealerInviteToken: () =>'));
  assert.doesNotMatch(section, /SecureStore|console|AsyncStorage/);
});

test('authenticated main route waits for onboarding, prioritizes recovery and consumes stale redirect', () => {
  const root = read('src/navigation/RootNavigator.tsx');
  const app = read('App.tsx');
  const linking = read('src/navigation/linking.ts');
  assert.match(root, /const canOpenInvite = isAuthenticated && hasCompletedOnboarding &&/);
  assert.match(root, /passwordRecoveryStatus === 'idle' && !!pendingDealerInviteToken/);
  assert.match(root, /screen: 'AcceptInvite', params: \{ token: pendingDealerInviteToken \}/);
  assert.ok(root.indexOf('consumePostLoginRedirect();') < root.indexOf('clearDealerInviteToken();'));
  assert.match(app, /if \(isDealerInviteUrl\(url\)\)/);
  assert.match(app, /captureDealerInviteToken\(token\)/);
  assert.match(linking, /!isAuthCallbackUrl\(url\) && !isDealerInviteUrl\(url\)/);
});
