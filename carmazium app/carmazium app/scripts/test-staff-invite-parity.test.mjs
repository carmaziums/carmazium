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
