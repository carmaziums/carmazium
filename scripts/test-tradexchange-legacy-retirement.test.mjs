import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
const read=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const present=relative=>existsSync(new URL('../'+relative,import.meta.url));
const base='carmazium app/carmazium app/src/';
test('obsolete web provider setup pages are small compatibility redirects, not hidden duplicate workflows',()=>{
 const urls={
  'src/app/dashboard/service/capabilities/page.tsx':'#provider-services',
  'src/app/dashboard/service/capabilities/[id]/verification/page.tsx':'#provider-business',
  'src/app/dashboard/service/capabilities/[id]/matching/page.tsx':'#provider-preferences',
  'src/app/dashboard/service/settings/page.tsx':'#provider-business',
 };
 for(const [file,section] of Object.entries(urls)){
  const source=read(file);
  assert.match(source,/redirect\(/,file);
  assert.ok(source.length<800,'old page is still implemented: '+file);
  assert.ok(source.includes(section),file);
  assert.doesNotMatch(source,/uploadCapabilityAttachment|updateJobMatching|submitProviderDeclaration/,file);
 }
 for(const file of ['matching','verification']){
  const code=read('src/app/dashboard/service/capabilities/[id]/'+file+'/page.tsx');
  assert.match(code,/encodeURIComponent\(id\)/,'preserve selected capability id');
 }
});
test('obsolete Android onboarding screens are physically absent, while old route names remain redirects',()=>{
 for(const name of ['ProviderCapabilitiesScreen.tsx','ProviderVerificationScreen.tsx','ProviderMatchingScreen.tsx']){
  assert.equal(present(base+'screens/main/'+name),false,name);
 }
 const nav=read(base+'navigation/MainStackNavigator.tsx');
 const redirect=read(base+'screens/main/LegacyProviderRouteRedirectScreen.tsx');
 assert.equal((nav.match(/component=\{LegacyProviderRouteRedirectScreen\}/g)||[]).length,3);
 assert.match(redirect,/navigation.replace\('PartnerDashboard'/);
 assert.match(redirect,/capabilityId/);
 assert.match(redirect,/openSection: section/);
});
test('new canonical provider home includes actual contractor application and all four settings sections',()=>{
 const web=read('src/app/dashboard/partner/page.tsx');
 const app=read(base+'screens/main/PartnerDashboardScreen.tsx');
 for(const s of [web,app]){
  assert.match(s,/ContractorServicesInline/);
  assert.match(s,/ProviderBusinessPaymentsSection/);
  assert.match(s,/ProviderDocumentsSection/);
  assert.match(s,/ProviderJobPreferencesSection/);
 }
 const webCap=read('src/components/tradexchange/ContractorServicesInline.tsx');
 const mobileCap=read(base+'components/tradexchange/ContractorServicesInline.tsx');
 assert.match(webCap,/applyCapability/);
 assert.match(mobileCap,/\/services\/capabilities/);
 assert.doesNotMatch(webCap,/users\/elevate/);
 assert.doesNotMatch(mobileCap,/users\/elevate/);
});
test('job lifecycle and specialized finance/insurance partner screens are retained for Block 2',()=>{
 for(const file of [
  'src/app/dashboard/service/jobs/page.tsx',
  'src/app/dashboard/service/jobs/[id]/page.tsx',
  'src/app/dashboard/service/page.tsx',
  base+'screens/main/ProviderOverviewScreen.tsx',
  base+'screens/main/ProviderJobsScreen.tsx',
  base+'screens/main/ProviderJobDetailScreen.tsx',
  base+'screens/account/LegacyPartnerDashboardScreen.tsx',
 ]) assert.equal(present(file),true,file);
});
test('parity manifest references the new implementation rather than deleted files',()=>{
 const manifest=JSON.parse(read('product-parity.json'));
 const feature=manifest.features.find(f=>f.id==='service_provider.capabilities');
 assert.ok(feature);
 assert.ok(feature.web.some(f=>f.includes('ProviderSettingsSections')));
 assert.ok(feature.mobile.some(f=>f.includes('ProviderSettingsSections')));
 for(const f of [...feature.web,...feature.mobile])assert.equal(present(f),true,f);
 for(const f of feature.mobile)assert.doesNotMatch(f,/ProviderCapabilitiesScreen|ProviderVerificationScreen|ProviderMatchingScreen/);
});
