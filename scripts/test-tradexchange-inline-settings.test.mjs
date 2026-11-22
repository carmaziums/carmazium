import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
const read = rel => readFileSync(new URL('../'+rel,import.meta.url),'utf8');

test('TradeXchange shows four inline sections without duplicated payout or business cards',()=>{
 const web=read('src/app/dashboard/partner/page.tsx');
 const app=read('carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx');
 for(const source of [web,app]){
   assert.match(source,/ProviderBusinessPaymentsSection/);
   assert.match(source,/ProviderDocumentsSection/);
   assert.match(source,/ProviderJobPreferencesSection/);
   assert.match(source,/My Services/);
   assert.doesNotMatch(source,/One team, service permissions/);
   assert.doesNotMatch(source,/Manage Partner team/);
   assert.doesNotMatch(source,/Edit business details/);
 }
 assert.doesNotMatch(web,/href="\/profile\?section=business"/);
 assert.doesNotMatch(web,/href=\{'\/dashboard\/service\/capabilities\/' \+ cap.id \+ '\/matching'\}/);
 assert.doesNotMatch(web,/href=\{'\/dashboard\/service\/capabilities\/' \+ cap.id \+ '\/verification'\}/);
});
test('business declarations are handled on the hub using the current verification API',()=>{
 const web=read('src/components/tradexchange/ProviderSettingsSections.tsx');
 const app=read('carmazium app/carmazium app/src/components/tradexchange/ProviderSettingsSections.tsx');
 for(const source of [web,app]){
   assert.match(source,/getCapabilityVerification/);
   assert.match(source,/submitProviderDeclaration/);
   assert.match(source,/Business & Payments/);
   assert.match(source,/Stripe/);
   assert.match(source,/Save declaration/);
   assert.match(source,/getMyCapabilities/);
   assert.match(source,/updateJobMatching/);
   assert.match(source,/Job Preferences/);
   assert.match(source,/Registered business address/);
 }
});
test('new inline job preferences save only validated UK area prefixes and preserve existing jobs',()=>{
 const web=read('src/components/tradexchange/ProviderSettingsSections.tsx');
 const app=read('carmazium app/carmazium app/src/components/tradexchange/ProviderSettingsSections.tsx');
 assert.match(web,/updateJobMatching\(cap.id,/);
 assert.match(app,/updateJobMatching\(cap.id,/);
 assert.match(web,/jobPostcodeAreas:parsed/);
 assert.match(app,/jobPostcodeAreas:next/);
 assert.match(web,/Existing accepted jobs are not removed/);
 assert.match(app,/Existing accepted jobs are not removed/);
 assert.doesNotMatch(web,/updateLeadMatching/);
 assert.doesNotMatch(app,/updateLeadMatching/);
});
test('legacy provider is preserved, and dealer KYC remains in its own secure verification process',()=>{
 const web=read('src/app/dashboard/partner/page.tsx');
 const app=read('carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx');
 assert.match(web,/isLegacyProvider/);
 assert.match(web,/capabilities=\{legacyCapabilities\}/);
 assert.match(app,/legacyCapabilities/);
 assert.match(app,/onVerifyDealer=\{\(\) => navigation.navigate\("DealerKYC"\)\}/);
 assert.equal(existsSync(new URL('../src/app/dashboard/dealer/team/page.tsx',import.meta.url)),true);
 assert.match(read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx'),/DealerTeam/);
});
test('obsolete verification and matching UIs are deleted; historical routes only redirect',()=>{
 for(const rel of [
  'src/app/dashboard/service/capabilities/[id]/verification/page.tsx',
  'src/app/dashboard/service/capabilities/[id]/matching/page.tsx',
  'carmazium app/carmazium app/src/screens/main/LegacyProviderRouteRedirectScreen.tsx',
 ])assert.equal(existsSync(new URL('../'+rel,import.meta.url)),true,rel);
 for(const file of ['ProviderCapabilitiesScreen.tsx','ProviderVerificationScreen.tsx','ProviderMatchingScreen.tsx']){
  assert.equal(existsSync(new URL('../carmazium app/carmazium app/src/screens/main/'+file,import.meta.url)),false,file);
 }
 const web=read('src/app/dashboard/service/capabilities/[id]/matching/page.tsx');
 assert.match(web,/redirect\(/);
 assert.match(web,/provider-preferences/);
});
