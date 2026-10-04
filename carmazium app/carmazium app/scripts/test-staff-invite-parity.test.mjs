import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('accepted dealer staff invite refreshes the role before exposing dealer dashboard', () => {
  const screen = read('src/screens/main/AcceptInviteScreen.tsx');
  const source = ts.createSourceFile('AcceptInviteScreen.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0);
  assert.match(screen, /await initializeAuth\(\);\s*setSuccessMessage\(/);
  assert.match(screen, /navigation\.navigate\('Tabs', \{ screen: 'Profile' \}\)/);
  assert.doesNotMatch(screen, /navigation\.navigate\('SellerDashboard'\)/);
});

test('Profile tab maps dealer identity to actual dealer workspace, not generic seller area', () => {
  const tabs = read('src/navigation/TabNavigator.tsx');
  const stack = read('src/navigation/MainStackNavigator.tsx');
  const auth = read('src/store/authStore.ts');
  assert.match(tabs, /if \(role === 'dealer'\) return <DealerProfileScreen/);
  assert.match(tabs, /<Tab\.Screen name="Profile" component=\{ProfileTabScreen\}/);
  assert.match(stack, /Tabs: NavigatorScreenParams<TabParamList>/);
  assert.match(auth, /case 'DEALER': return 'dealer'/);
});

test('backend verifies invite email and only elevates authenticated accepted staff', () => {
  const backend = read('../../backend/src/dealers/dealers.service.ts');
  const start = backend.indexOf('async acceptInvite(token: string, userId: string)');
  const end = backend.indexOf('async removeStaff(', start);
  assert.ok(start > 0 && end > start, 'Locate authoritative invitation acceptance flow');
  const accept = backend.slice(start, end);
  assert.match(accept, /user\.email\.toLowerCase\(\) !== invite\.email\.toLowerCase\(\)/);
  assert.match(accept, /dealerStaff\.create\(/);
  assert.match(accept, /data: \{ role: 'DEALER' \}/);
});

test('web accepted invitation opens the same dealer workspace', () => {
  const website = read('../../src/app/auth/accept-invite/page.tsx');
  assert.match(website, /router\.push\("\/dashboard\/dealer"\)/);
});

test('native and website offer the same Personal versus Dealer/Sole Trader signup choices', () => {
  const mobile = read('src/screens/auth/SignupScreen.tsx');
  const website = read('../../src/app/auth/signup/page.tsx');
  for (const label of ['Personal Account', 'Dealer / Sole Trader / Partner Account']) {
    assert.ok(mobile.includes(label), 'Native missing signup label: ' + label);
    assert.ok(website.includes(label), 'Website missing signup label: ' + label);
  }
  assert.match(mobile, /value: 'BUYER' as const/);
  assert.match(mobile, /value: 'DEALER' as const/);
  assert.match(website, /id: "BUYER" as SignupRole/);
  assert.match(website, /id: "DEALER" as SignupRole/);
});

test('login entry points support password, Google and Apple on both clients', () => {
  const web = read('../../src/app/auth/login/page.tsx');
  const mobile = read('src/screens/auth/LoginScreen.tsx');
  assert.match(web, /signInWithPassword\(/);
  assert.match(web, /provider: "google"/);
  assert.match(web, /provider: "apple"/);
  assert.match(mobile, /'google' \| 'apple'/);
  assert.match(mobile, /signInWithOAuth\(/);
});

test('both clients offer password-recovery email requests, without claiming reset-callback QA', () => {
  const web = read('../../src/app/auth/forgot-password/page.tsx');
  const mobile = read('src/screens/auth/ForgotPasswordScreen.tsx');
  assert.match(web, /resetPasswordForEmail\(/);
  assert.match(web, /auth\/callback\?redirect_to=\/auth\/reset-password/);
  assert.match(mobile, /resetPasswordForEmail\(/);
  assert.match(mobile, /carmazium:\/\/reset-password/);
});

test('both clients require typed DELETE and submit to the authenticated account endpoint', () => {
  const web = read('../../src/components/dashboard/DeleteAccountSection.tsx');
  const mobile = read('src/screens/main/SettingsScreen.tsx');
  assert.match(web, /confirmText\.trim\(\)\.toUpperCase\(\) !== "DELETE"/);
  assert.match(mobile, /deleteConfirmText\.trim\(\)\.toUpperCase\(\) === 'DELETE'/);
  assert.match(mobile, /method: 'DELETE'/);
  assert.match(mobile, /confirmation: 'DELETE'/);
});

test('legacy SELLER query on web signup selects Personal without creating a hidden third role', () => {
  const web = read('../../src/app/auth/signup/page.tsx');
  assert.match(web, /const VALID_SIGNUP_ROLES = \["BUYER", "DEALER"\] as const/);
  assert.match(web, /rawRoleParam === "SELLER" \? "BUYER" : rawRoleParam/);
  assert.doesNotMatch(web, /\["BUYER", "SELLER", "DEALER"\]/);
});
