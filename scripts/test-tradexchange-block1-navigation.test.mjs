import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const native = 'carmazium app/carmazium app/src/';
test('provider sidebar has one TradeXchange destination and keeps messages and general settings', () => {
  const sidebar = read('src/components/dashboard/DashboardSidebar.tsx');
  const provider = sidebar.match(/        provider: \[([\s\S]*?)\n        \],/);
  assert.ok(provider, 'provider navigation must exist');
  assert.match(provider[1], /href: "\/dashboard\/partner", label: "TradeXchange"/);
  assert.equal((provider[1].match(/label:/g) ?? []).length, 3, 'one hub plus messages and settings');
  assert.doesNotMatch(provider[1], /Service Overview|Available Jobs|My Work|My services|Partner Home/);
  assert.match(provider[1], /href: "\/dashboard\/service\/messages"/);
  assert.match(provider[1], /href: "\/profile"/);
});
test('native menu contains one entry and dealer dashboard cards have no legacy duplicates', () => {
  const nav = read(native + 'lib/dashboardNavigation.ts');
  const providers = nav.match(/export const PROVIDER_ITEMS: MenuItem\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(providers);
  assert.equal((providers[1].match(/label: 'TradeXchange'/g) ?? []).length, 1);
  assert.doesNotMatch(providers[1], /Service Overview|Available Jobs|Partner Home/);
  const dealer = nav.match(/export const DEALER_ITEMS: MenuItem\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(dealer);
  assert.equal((dealer[1].match(/label: 'TradeXchange'/g) ?? []).length, 1);
  assert.doesNotMatch(dealer[1], /dealer-service-addons|dealer-service-jobs/);
  const webCards = JSON.parse(read('src/data/dashboardCards.json'));
  const appCards = JSON.parse(read(native + 'data/dashboardCards.json'));
  assert.deepEqual(webCards, appCards);
  const txCards = webCards.dealer.filter(x => x.id === 'dealer-partner');
  assert.equal(txCards.length, 1);
  assert.equal(txCards[0].label, 'TradeXchange');
  assert.equal(txCards[0].href, '/dashboard/partner');
  assert.equal(txCards[0].stackScreen, 'PartnerDashboard');
  assert.ok(!webCards.dealer.some(x => ['dealer-service-addons', 'dealer-service-jobs'].includes(x.id)));
});
test('old provider settings pages are deleted while work screens and compatibility redirects remain', () => {
  assert.equal(existsSync(new URL('../' + native + 'components/ProviderPageTabs.tsx', import.meta.url)), false);
  assert.doesNotMatch(read(native + 'screens/main/ProviderJobsScreen.tsx'), /ProviderPageTabs/);
  assert.doesNotMatch(read(native + 'screens/main/ProviderOverviewScreen.tsx'), /ProviderPageTabs/);
  for (const file of [
    'src/app/dashboard/service/capabilities/page.tsx',
    'src/app/dashboard/service/capabilities/[id]/verification/page.tsx',
    'src/app/dashboard/service/capabilities/[id]/matching/page.tsx',
    'src/app/dashboard/service/jobs/page.tsx',
    native + 'screens/main/LegacyProviderRouteRedirectScreen.tsx',
    native + 'components/tradexchange/ContractorServicesInline.tsx',
    native + 'components/tradexchange/ProviderDocumentsSection.tsx',
    native + 'screens/main/ProviderJobsScreen.tsx'
  ]) assert.equal(existsSync(new URL('../'+file,import.meta.url)),true,file);
  for (const file of ['ProviderCapabilitiesScreen.tsx', 'ProviderVerificationScreen.tsx', 'ProviderMatchingScreen.tsx']) {
    assert.equal(existsSync(new URL('../'+native+'screens/main/'+file, import.meta.url)),false,file);
  }
  const navigator=read(native+'navigation/MainStackNavigator.tsx');
  assert.equal((navigator.match(/component=\{LegacyProviderRouteRedirectScreen\}/g)??[]).length,3);
});
test('existing contractor role is not forced to create a dealer account from the TradeXchange hub', () => {
  const web = read('src/app/dashboard/partner/page.tsx');
  assert.match(web, /if \(isLegacyProvider && !isPartnerRole\)/);
  assert.match(web, /Continue using your existing service-provider account/);
  assert.match(web, /href="#provider-services"/);
  assert.match(web, /href="\/dashboard\/service\/jobs\?tab=mine"/);
  const mobile=read(native+'screens/main/PartnerDashboardScreen.tsx');
  assert.match(mobile, /!isPartnerRole && profile\?\.role === 'CONTRACTOR'/);
  assert.match(mobile, /Your services, approvals and documents are retained/);
  assert.match(mobile, /ContractorServicesInline/);
  assert.doesNotMatch(mobile, /navigation.navigate\('ProviderCapabilities'\)/);
});
