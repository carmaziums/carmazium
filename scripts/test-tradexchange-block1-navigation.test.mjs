import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const native = 'carmazium app/carmazium app/src/';
test('provider sidebar exposes the operational dashboard, jobs and setup directly', () => {
  const sidebar = read('src/components/dashboard/DashboardSidebar.tsx');
  const provider = sidebar.match(/        provider: \[([\s\S]*?)\n        \],/);
  assert.ok(provider, 'provider navigation must exist');
  const hrefs = [...provider[1].matchAll(/href: "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(hrefs, ['/dashboard/service', '/dashboard/service/jobs', '/dashboard/service/jobs?tab=mine', '/dashboard/service/messages', '/dashboard/partner', '/profile']);
  assert.equal(new Set(hrefs).size, hrefs.length, 'one entry per destination');
  assert.match(provider[1], /href: "\/dashboard\/service", label: "Provider Dashboard"/);
  assert.match(provider[1], /href: "\/dashboard\/partner", label: "Service Setup"/);
});
test('native provider destinations and dealer cards match the website without legacy duplicates', () => {
  const nav = read(native + 'lib/dashboardNavigation.ts');
  const exports = {};
  runInNewContext(ts.transpileModule(nav, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
  const providers = JSON.parse(JSON.stringify(exports.PROVIDER_ITEMS));
  assert.deepEqual(providers.map(item => [item.label, item.stackScreen]), [
    ['Provider Dashboard', 'ProviderOverview'], ['Find Jobs', 'ProviderJobs'], ['My Work', 'ProviderJobs'],
    ['Messages', 'ProviderMessages'], ['Service Setup', 'PartnerDashboard'], ['Account Settings', 'Settings'],
  ]);
  assert.equal(providers[1].stackParams.initialTab, 'open');
  assert.equal(providers[2].stackParams.initialTab, 'assigned');
  const webCards = JSON.parse(read('src/data/dashboardCards.json'));
  const appCards = JSON.parse(read(native + 'data/dashboardCards.json'));
  assert.deepEqual(webCards, appCards);
  const dashboard = webCards.dealer.filter(item => item.href === '/dashboard/service');
  assert.equal(dashboard.length, 1);
  assert.equal(dashboard[0].label, 'Provider Dashboard');
  assert.equal(dashboard[0].stackScreen, 'ProviderOverview');
  const setup = webCards.dealer.filter(item => item.id === 'dealer-partner');
  assert.equal(setup.length, 1, 'preserve the saved setup card identity');
  assert.equal(setup[0].label, 'Service Setup');
  assert.equal(setup[0].href, '/dashboard/partner');
  assert.equal(setup[0].stackScreen, 'PartnerDashboard');
  assert.ok(!webCards.dealer.some(item => ['dealer-service-addons', 'dealer-service-jobs'].includes(item.id)));
});
test('provider entry is available outside customisable cards and contractor home opens work', () => {
  const header = read('src/components/layout/Header.tsx');
  assert.match(header, /profile\?\.role === 'DEALER' \|\| profile\?\.role === 'CONTRACTOR'/);
  assert.match(header, /href="\/dashboard\/service" onClick=\{\(\) => setIsUserMenuOpen\(false\)\}/);
  assert.match(header, /href="\/dashboard\/service" onClick=\{\(\) => setIsMobileMenuOpen\(false\)\}/);
  assert.match(read('src/app/dashboard/dealer/page.tsx'), /href="\/dashboard\/service"/);
  assert.match(read('src/app/dashboard/page.tsx'), /role === 'CONTRACTOR'[\s\S]*?router.push\('\/dashboard\/service'\)/);
  assert.match(read(native+'navigation/TabNavigator.tsx'), /accountRole === 'contractor'[\s\S]*?<ProviderOverviewScreen/);
  assert.match(read(native+'screens/main/DealerWebParityOverview.tsx'), /onNavigate\('provider-dashboard'\)/);
  assert.match(read(native+'screens/main/DealerProfileScreen.tsx'), /case 'provider-dashboard': navigation.navigate\('ProviderOverview'\)/);
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
