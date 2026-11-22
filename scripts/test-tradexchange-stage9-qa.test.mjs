import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8');
const native = 'carmazium app/carmazium app/src/';
test('both guided tours use the canonical TradeXchange hub, not retired setup screens',()=>{
  for(const rel of ['src/lib/guidedWebsiteTour.ts',native+'lib/guidedTourContent.ts']){
    const source=read(rel);
    assert.match(source,/id: "partner", title: "TradeXchange services and approvals", href: "\/dashboard\/partner"/,rel);
    assert.equal((source.match(/id: "partner", title: "TradeXchange services and approvals"/g)||[]).length,1,rel);
    assert.doesNotMatch(source,/href: "\/dashboard\/service\/capabilities"/,rel);
    assert.doesNotMatch(source,/href: "\/dashboard\/service", target: heading/,rel);
    assert.doesNotMatch(source,/id: "capabilities", title:/,rel);
    assert.match(source,/href: "\/dashboard\/service\/jobs"/,rel);
  }
});
test('creating a service validates the capability then opens its inline section',()=>{
  const web=read('src/app/dashboard/partner/page.tsx');
  const app=read(native+'screens/main/PartnerDashboardScreen.tsx');
  assert.match(web,/validatedServiceCapability\(response, serviceType\)/);
  assert.match(web,/window\.location\.hash = "provider-business"/);
  assert.match(app,/applyPartnerCapability\(serviceType\)/);
  assert.match(app,/openBusiness\(capability\.id\)/);
  assert.doesNotMatch(read('src/lib/serviceSetupRouting.ts'),/serviceVerificationPath|\/dashboard\/service\/capabilities\//);
});
test('all retired setup paths are redirects, but active job and message workflows remain distinct',()=>{
  const retired=[
    'src/app/dashboard/service/capabilities/page.tsx',
    'src/app/dashboard/service/capabilities/[id]/matching/page.tsx',
    'src/app/dashboard/service/capabilities/[id]/verification/page.tsx',
    'src/app/dashboard/service/settings/page.tsx'
  ];
  for(const rel of retired) {
    const src=read(rel);
    assert.ok(src.length<800,rel+' is not a redirect-only route');
    assert.match(src,/redirect\(/,rel);
  }
  for(const rel of [
    'src/app/dashboard/service/jobs/page.tsx',
    'src/app/dashboard/service/jobs/[id]/page.tsx',
    'src/app/dashboard/service/messages/page.tsx',
    native+'screens/main/ProviderJobsScreen.tsx',
    native+'screens/main/ProviderJobDetailScreen.tsx'
  ])assert.ok(existsSync(new URL('../'+rel,import.meta.url)),rel);
});
test('the application contains no duplicate provider verification or matching screens',()=>{
 for(const component of ['ProviderCapabilitiesScreen','ProviderVerificationScreen','ProviderMatchingScreen'])
   assert.equal(existsSync(new URL('../'+native+'screens/main/'+component+'.tsx',import.meta.url)),false,component);
 const nav=read(native+'navigation/MainStackNavigator.tsx');
 assert.equal((nav.match(/component=\{LegacyProviderRouteRedirectScreen\}/g)||[]).length,3);
});
