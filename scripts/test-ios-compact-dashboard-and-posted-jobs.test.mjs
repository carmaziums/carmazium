import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const native = 'carmazium app/carmazium app/src/';
const posted = read(native + 'screens/main/CustomerServiceJobsScreen.tsx');
const cards = read(native + 'components/DashboardCards.tsx');

test('customer posted jobs cannot expose the provider-only available jobs shortcut', () => {
  assert.match(posted, /getMyServiceJobsPage/);
  assert.match(posted, /navigation\.navigate\('CustomerServiceJobDetail'/);
  assert.match(posted, /navigation\.navigate\('CreateServiceJob'/);
  assert.doesNotMatch(posted, /Available Jobs in the provider dashboard|navigation\.navigate\('ProviderJobs'/);
});

test('posted jobs scrolls the navigation heading, actions, history and empty states together', () => {
  assert.equal((posted.match(/<FlatList\b/g) ?? []).length, 1);
  assert.match(posted, /const listHeader = \([\s\S]*?styles\.header[\s\S]*?styles\.intro[\s\S]*?Post a Job/);
  assert.match(posted, /const emptyContent = loading \?[\s\S]*?No jobs yet/);
  assert.match(posted, /<FlatList[\s\S]*?ListHeaderComponent=\{listHeader\}[\s\S]*?ListEmptyComponent=\{emptyContent\}/);
  assert.match(posted, /const renderJob =[\s\S]*?styles\.jobRow[\s\S]*?CustomerServiceJobDetail/);
  assert.doesNotMatch(posted, /<FlatList[\s\S]*?style=\{\{ padding: 18, gap: 10 \}\}/);
});

test('iPhone phone cards retain Android-style two-column density while honouring large accessibility text', () => {
  assert.match(cards, /Platform\.OS === 'ios' && width < 600/);
  assert.match(cards, /width < 340 \|\| fontScale >= 1\.75 \? 1 : 2/);
  // Original Android system-font / narrow-device behavior is still retained.
  assert.match(cards, /fontScale >= 1\.3 \|\| width < 360 \? 1 : width >= 1280 \? 3 : 2/);
  assert.match(cards, /compactCardAction: \{ minHeight: 132, padding: 12/);
  assert.match(cards, /compactIcon: \{ width: 37, height: 37/);
  assert.match(cards, /compactLabel: \{ fontSize: 14, lineHeight: 20/);
});

test('iPhone dashboard heading does not squeeze the last letter beside Customise', () => {
  assert.match(cards, /compactHeadingRow: \{ flexDirection: 'row'/);
  assert.match(cards, /accessibilityRole="header" style=\{s\.compactTitle\}/);
  assert.match(cards, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.8\}/);
  assert.match(cards, /<Text style=\{s\.compactHint\}>Everything you need, in your order\./);
});

test('no second app or separate dealer/provider route was introduced', () => {
  const app = JSON.parse(read('carmazium app/carmazium app/app.json')).expo;
  assert.equal(app.android.package, 'uk.carmazium.app');
  assert.equal(app.ios.bundleIdentifier, 'uk.carmazium.app');
  assert.ok(/camera/i.test(app.ios.infoPlist.NSCameraUsageDescription));
  const picker = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
  assert.equal(picker?.[1]?.cameraPermission, app.ios.infoPlist.NSCameraUsageDescription);
  assert.ok(app.android.blockedPermissions.includes('android.permission.CAMERA'));
  assert.equal(picker?.[1]?.microphonePermission, false);
  assert.match(posted, /navigation\.navigate\('Services'\)/);
});


test('dealer CRM mobile actions follow website one-row Add Customer and full-width Offers hierarchy', () => {
  const crm = read(native + 'screens/main/DealerLeadsScreen.tsx');
  assert.match(crm, /width: viewportWidth, fontScale/);
  assert.match(crm, /viewportWidth >= 640 && canManageOffers/);
  assert.match(crm, /viewportWidth >= 640 && <View style=\{styles\.viewModeToggle\}>/);
  assert.match(crm, /viewportWidth < 640 && canManageOffers/);
  assert.match(crm, /crmOffersMobile: \{ width: '100%', justifyContent: 'space-between'/);
  assert.match(crm, /accessibilityLabel="Offers received"/);
  assert.match(crm, /styles\.crmOffersButton, styles\.crmOffersMobile/);
  assert.match(crm, /accessibilityLabel="Add Customer"/);
});
