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
  assert.match(posted, /const listHeader = \([\s\S]*?styles\.header[\s\S]*?styles\.intro[\s\S]*?requestActions/);
  assert.match(posted, /const emptyContent = loading \?[\s\S]*?No jobs yet/);
  assert.match(posted, /<FlatList[\s\S]*?ListHeaderComponent=\{listHeader\}[\s\S]*?ListEmptyComponent=\{emptyContent\}/);
  assert.match(posted, /const renderJob =[\s\S]*?styles\.jobRow[\s\S]*?CustomerServiceJobDetail/);
  assert.doesNotMatch(posted, /<FlatList[\s\S]*?style=\{\{ padding: 18, gap: 10 \}\}/);
});

test('iPhone cards retain explicit two-column density across text scales and phone widths', () => {
  assert.match(cards, /Platform\.OS === 'ios' && \(width < 600 \|\| !Platform\.isPad\)/);
  assert.match(cards, /shown\.slice\(index \* 2, index \* 2 \+ 2\)/);
  assert.match(cards, /iosRow: \{ flexDirection: 'row', flexWrap: 'nowrap'/);
  assert.match(cards, /iosCard: \{ flex: 1, minWidth: 0 \}/);
  assert.match(cards, /iosSpacer: \{ flex: 1, minWidth: 0 \}/);
  assert.doesNotMatch(cards, /width < 340 \|\| fontScale >= 1\.75/);
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


test('customer Posted Jobs page never promotes provider-only available work', () => {
  const page = read('src/app/services/jobs/page.tsx');
  assert.match(page, /My Service Requests/);
  assert.match(page, /Request transport/); assert.match(page, /Request inspection/);
  assert.match(page, /getMyJobsPage/);
  assert.doesNotMatch(page, /Available Jobs in the provider dashboard/);
  assert.doesNotMatch(page, /href="\/dashboard\/service\/jobs"/);
});


test('native provider Available Jobs keeps website compact navigation and retains real posting workflow', () => {
  const provider = read(native + 'screens/main/ProviderJobsScreen.tsx');
  assert.match(provider, /accessibilityRole="link" style=\{styles\.postJobLink\}/);
  assert.match(provider, /post a job here/);
  assert.match(provider, /navigation\.navigate\('CreateServiceJob', \{ serviceType: 'DELIVERY' \}\)/);
  assert.match(provider, /navigation\.navigate\('CreateServiceJob', \{ serviceType: 'INSPECTION' \}\)/);
  assert.match(provider, /selected\?\.items\.length \? <View style=\{styles\.filters\}>/);
  assert.match(provider, /alignSelf: 'flex-start'/);
  assert.doesNotMatch(provider, /Manage service areas & verification/);
  assert.doesNotMatch(provider, /label="Job messages"/);
});


test('iPhone provider overview uses the existing mobile website two-column density', () => {
  const overview = read(native + 'screens/main/ProviderOverviewScreen.tsx');
  const website = read('src/app/dashboard/service/page.tsx');
  assert.match(website, /grid grid-cols-2 xl:grid-cols-4/);
  assert.match(overview, /Platform\.OS === 'ios' && width < 600/);
  assert.match(overview, /width < 340 \|\| fontScale >= 1\.75/);
  assert.match(overview, /fontScale >= 1\.3/);
  assert.match(overview, /width: singleMetricColumn \? '100%' : '48%'/);
  // No second iOS-only page or forked layout was introduced.
  assert.match(overview, /navigation\.navigate\('PartnerDashboard'\)/);
  assert.match(overview, /navigation\.navigate\('ProviderJobs'/);
});

test('iPhone customer job posting scrolls its full page rather than freezing the top half', () => {
  const jobs = read(native + 'screens/main/CustomerServiceJobsScreen.tsx');
  assert.equal((jobs.match(/<FlatList\b/g) || []).length, 1);
  assert.match(jobs, /ListHeaderComponent=\{listHeader\}/);
  assert.match(jobs, /ListEmptyComponent=\{emptyContent\}/);
  assert.match(jobs, /onEndReachedThreshold=\{0\.35\}/);
  const provider = read(native + 'screens/main/ProviderJobsScreen.tsx');
  assert.equal((provider.match(/<FlatList\b/g) || []).length, 1);
  assert.match(provider, /ListHeaderComponent=\{listHeader\}/);
  assert.match(provider, /navigation\.navigate\('CreateServiceJob'/);
});


test('iPhone job booking date picker remains compact until opened and keeps the chosen time', () => {
  const jobForm = read(native + 'screens/main/CreateServiceJobScreen.tsx');
  assert.match(jobForm, /!asap && pickerVisible && \(/);
  assert.doesNotMatch(jobForm, /Platform\.OS === 'ios' && !asap\) \|\| pickerVisible/);
  assert.match(jobForm, /Platform\.OS === 'android' && pickerMode === 'date' && requestedFor/);
  assert.match(jobForm, /Platform\.OS !== 'ios'\) setPickerVisible\(false\)/);
  assert.match(jobForm, /accessibilityLabel="Done choosing date and time"/);
  assert.match(jobForm, /onPress=\{\(\) => setPickerVisible\(false\)\}/);
  assert.match(jobForm, /minHeight: 48, backgroundColor: Colors\.accent/);
  assert.match(jobForm, /if \(value\) setPickerVisible\(false\)/);
});
