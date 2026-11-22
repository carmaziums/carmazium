import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const read = relative => readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const native = 'carmazium app/carmazium app/src/';

test('one TradeXchange document manager serves dealers and legacy contractors on web and app', () => {
 const web=read('src/app/dashboard/partner/page.tsx');
 const app=read(native+'screens/main/PartnerDashboardScreen.tsx');
 assert.equal((web.match(/<ProviderDocumentsSection /g)||[]).length,2);
 assert.equal((app.match(/<ProviderDocumentsSection /g)||[]).length,2);
 for(const code of [web,app])assert.match(code,/legacyCapabilities/);
});

test('delivery, collection and recovery require two insurance certificates; inspection requires liability only',()=>{
 const backend=read('backend/src/services/capability-verification.ts');
 assert.match(backend,/DELIVERY_BUSINESS_INSURANCE/);
 assert.match(backend,/DELIVERY_PUBLIC_LIABILITY/);
 assert.match(backend,/INSPECTION_PUBLIC_LIABILITY/);
 assert.match(backend,/\[ServiceType\.INSPECTION\]: \[\{/);
 assert.doesNotMatch(backend,/\[ServiceType\.INSPECTION\]: \[\]/);
 assert.match(backend,/expiryRequired: true/);
});

test('web and native upload each required certificate against its own capability and preserve history',()=>{
 for(const file of ['src/components/tradexchange/ProviderDocumentsSection.tsx',native+'components/tradexchange/ProviderDocumentsSection.tsx']){
  const code=read(file);
  assert.match(code,/getCapabilityVerification\(/,file);
  assert.match(code,/uploadCapabilityAttachment\(cap.id, file/,file);
  assert.match(code,/deleteCapabilityAttachment\(cap.id, entry.id\)/,file);
  assert.match(code,/requirements\.map\(req =>/,file);
  assert.match(code,/(?:req|r)\.type === uploadType/,file);
  assert.match(code,/req\.title/,file);
  assert.match(code,/entry\.evidenceStatus === ['"]PENDING['"]/,file);
  assert.match(code,/historyOpen &&/,file);
  assert.doesNotMatch(code,/No inspection documents required|Trade insurance only|INSPECTION_BUSINESS_INSURANCE/,file);
 }
 assert.match(read('src/components/tradexchange/ProviderDocumentsSection.tsx'),/10 \* 1024 \* 1024/);
 assert.match(read(native+'components/tradexchange/ProviderDocumentsSection.tsx'),/Linking\.openURL\(entry.url/);
});

test('multi-service selection is independent, without new accounts or losing accepted jobs',()=>{
 const dealerWeb=read('src/app/dashboard/partner/page.tsx');
 const dealerApp=read(native+'screens/main/PartnerDashboardScreen.tsx');
 const contractorWeb=read('src/components/tradexchange/ContractorServicesInline.tsx');
 const contractorApp=read(native+'components/tradexchange/ContractorServicesInline.tsx');
 for(const code of [dealerWeb,dealerApp,contractorWeb,contractorApp]){
  assert.match(code,/DELIVERY/);
  assert.match(code,/INSPECTION/);
 }
 assert.match(dealerWeb,/serviceType === "DELIVERY"/);
 assert.match(dealerApp,/type === 'DELIVERY'/);
 assert.match(contractorWeb,/ORDER\.map\(type =>/);
 assert.match(contractorApp,/ORDER\.map\(type\s*=>/);
 assert.match(contractorWeb,/verificationStatus === "VERIFIED"/);
 assert.match(contractorApp,/verificationStatus==='VERIFIED'/);
 for(const code of [contractorWeb,contractorApp]) assert.match(code,/Verification required/);
 assert.match(dealerWeb,/Preference changes never replace capability approvals or documents/);
 assert.match(dealerApp,/getPartnerTeam\(/);
});

test('backend retains private uploads, admin review and previously accepted jobs',()=>{
 const ops=read('backend/src/services/service-operations.service.ts');
 const jobs=read(native+'screens/main/ProviderJobsScreen.tsx');
 assert.match(ops,/TRADEXCHANGE_DOCUMENT_BUCKET/);
 assert.match(ops,/createSignedUrl\(path, 10 \* 60\)/);
 assert.match(ops,/Reviewed verification evidence is retained for audit and cannot be deleted/);
 assert.match(jobs,/assigned/);
});

test('old verification URLs remain redirects, not duplicate document managers',()=>{
 const web=read('src/app/dashboard/service/capabilities/[id]/verification/page.tsx');
 const app=read(native+'screens/main/LegacyProviderRouteRedirectScreen.tsx');
 assert.match(web,/redirect\(/);
 assert.match(app,/navigation.replace\('PartnerDashboard'/);
 assert.doesNotMatch(web,/uploadCapabilityAttachment/);
});
