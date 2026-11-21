import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../src/navigation/MainStackNavigator.tsx', import.meta.url)),
  'utf8',
);
const gate = readFileSync(
  fileURLToPath(new URL('../src/components/SignInRequired.tsx', import.meta.url)),
  'utf8',
);
const tabs = readFileSync(
  fileURLToPath(new URL('../src/navigation/TabNavigator.tsx', import.meta.url)),
  'utf8',
);

test('Main stack uses the stable guest-only layout when pushing public detail routes', () => {
  assert.match(source, /screenLayout=\{GuestAwareLayout\}/);
  const match = source.match(/const GuestAwareLayout = [\s\S]*?(?=\nconst GuestGate:)/);
  assert.ok(match);
  assert.match(match[0], /<GuestGate routeName=\{route\.name\} routeParams=\{route\.params\}>\{children\}<\/GuestGate>/);
  assert.doesNotMatch(match[0], /useAuthStore|<AdminBottomNav|<PersonalDashboardBottomNav|showAdminNav|showPersonalNav/);
});

test('public vehicle detail, pricing, and valuation routes remain accessible to guests', () => {
  for (const route of ['VehicleDetail', 'Pricing', 'SellLanding']) {
    assert.match(gate, new RegExp('\\b' + route + '\\b'));
    assert.match(source, new RegExp('name="' + route + '"'));
  }
});

test('account-only routes retain the authentication gate', () => {
  assert.match(source, /if \(isAuthenticated \|\| GUEST_ROUTES\.has\(routeName\)\) return <>{children}<\/>/);
  assert.match(source, /<SignInRequired routeName=\{routeName\} routeParams=\{routeParams\} \/>/);
});

test('role-aware tabs remain available at dashboard level', () => {
  assert.match(tabs, /<PersonalDashboardBottomNav/);
  assert.match(tabs, /DealerHome/);
  assert.match(tabs, /DealerStock/);
  assert.match(tabs, /DealerCustomers/);
});
