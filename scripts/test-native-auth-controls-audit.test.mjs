#!/usr/bin/env node
/** Source-level regression checks for native login/signup/reset controls.
 * This complements, but does not replace, installed Android/iOS QA.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const native = (name) => readFileSync(resolve(root, 'carmazium app/carmazium app/src/' + name), 'utf8');

test('sign-in does not offer a fake remember-me preference when sessions always persist', () => {
  const login = native('screens/auth/LoginScreen.tsx');
  const supabase = native('lib/supabase.ts');
  assert.match(supabase, /persistSession: true/);
  assert.match(supabase, /SecureStore/);
  assert.match(supabase, /AsyncStorage/);
  assert.doesNotMatch(login, /rememberMe|setRememberMe|Remember me/i);
  assert.match(login, /stay signed in on this device until you sign out/i);
  assert.match(login, /login\(email\.trim\(\), password\)/);
  assert.match(login, /navigation\.navigate\('ForgotPassword'\)/);
});

test('login, signup and password reset offer properly-labelled show/hide actions', () => {
  for (const [screen, variables] of [
    ['LoginScreen', ['showPassword']],
    ['SignupScreen', ['showPassword','showConfirmPassword']],
    ['ResetPasswordScreen', ['showNew','showConfirm']],
  ]) {
    const source = native('screens/auth/' + screen + '.tsx');
    for (const variable of variables) {
      assert.ok(source.includes('secureTextEntry={!'+variable+'}'), screen+': password field must remain obscured by default');
      assert.ok(source.includes("accessibilityLabel={"+variable+" ? 'Hide password' : 'Show password'}"), screen+': correctly describe current action to screen readers');
      assert.ok(source.includes("name={"+variable+" ? 'eye-off-outline' : 'eye-outline'}"), screen+': display the corresponding visibility icon');
    }
  }
});

test('login and sign-up still use their existing authentication store actions', () => {
  const login = native('screens/auth/LoginScreen.tsx');
  const signup = native('screens/auth/SignupScreen.tsx');
  assert.match(login, /await login\(email\.trim\(\), password\)/);
  assert.match(signup, /await signup\(email\.trim\(\), password, name, role\)/);
  assert.match(signup, /password !== confirmPassword/);
});
