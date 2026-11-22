import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const read = relative => readFileSync(new URL('../'+relative,import.meta.url),'utf8');

test('single TradeXchange document section is available to dealer and existing contractor on both clients',()=>{
 const web=read('src/app/dashboard/partner/page.tsx');
 const native=read('carmazium app/carmazium app/src/screens/main/PartnerDashboardScreen.tsx');
 assert.match(web,/import \{ ProviderDocumentsSection \}/);
 assert.equal((web.match(/<ProviderDocumentsSection /g)||[]).length,2);
 assert.equal((native.match(/<ProviderDocumentsSection /g)||[]).length,2);
 assert.match(web,/legacyCapabilities/);
 assert.match(native,/legacyCapabilities/);
});
test('web document manager requires only current trade insurance, not past inspection paperwork',()=>{
 const code=read('src/components/tradexchange/ProviderDocumentsSection.tsx');
 assert.match(code,/getCapabilityVerification\(id\)/);
 assert.match(code,/uploadCapabilityAttachment\(cap.id, file/);
 assert.match(code,/deleteCapabilityAttachment\(cap.id, entry.id\)/);
 assert.match(code,/r\.type === "DELIVERY_BUSINESS_INSURANCE"/);
 assert.match(code,/No inspection documents required/);
 assert.match(code,/No current insurance requirement was returned/);
 assert.match(code,/historyOpen &&/);
 assert.match(code,/entry.evidenceStatus === "PENDING"/);
 assert.match(code,/10 \* 1024 \* 1024/);
 assert.doesNotMatch(code,/INSPECTION_BUSINESS_INSURANCE/);
});
test('native manager keeps the same policy, signs historical links through existing API and never deletes reviewed files',()=>{
 const code=read('carmazium app/carmazium app/src/components/tradexchange/ProviderDocumentsSection.tsx');
 assert.match(code,/getCapabilityVerification\(capabilityId\)/);
 assert.match(code,/uploadCapabilityAttachment\(cap.id, file/);
 assert.match(code,/deleteCapabilityAttachment\(cap.id, entry.id\)/);
 assert.match(code,/req\.type === 'DELIVERY_BUSINESS_INSURANCE'/);
 assert.match(code,/No inspection documents required/);
 assert.match(code,/evidenceStatus === 'PENDING'/);
 assert.match(code,/historyOpen &&/);
 assert.match(code,/Linking.openURL\(entry.url/);
 assert.doesNotMatch(code,/INSPECTION_BUSINESS_INSURANCE/);
});
test('old verification pages redirect to inline business settings and have no upload forms',()=>{
 const web=read('src/app/dashboard/service/capabilities/[id]/verification/page.tsx');
 const native=read('carmazium app/carmazium app/src/screens/main/LegacyProviderRouteRedirectScreen.tsx');
 const webSettings=read('src/components/tradexchange/ProviderSettingsSections.tsx');
 const nativeSettings=read('carmazium app/carmazium app/src/components/tradexchange/ProviderSettingsSections.tsx');
 assert.match(web,/redirect\(/);
 assert.match(web,/provider-business/);
 assert.match(native,/navigation.replace\('PartnerDashboard'/);
 for (const source of [webSettings,nativeSettings]) assert.match(source,/submitProviderDeclaration/);
 assert.doesNotMatch(web,/uploadCapabilityAttachment|deleteCapabilityAttachment/);
});
test('existing backend preserves private evidence and service-specific requirements',()=>{
 const rules=read('backend/src/services/capability-verification.ts');
 const service=read('backend/src/services/service-operations.service.ts');
 assert.match(rules,/\[ServiceType\.INSPECTION\]: \[\]/);
 assert.match(rules,/DELIVERY_BUSINESS_INSURANCE/);
 assert.match(service,/TRADEXCHANGE_DOCUMENT_BUCKET/);
 assert.match(service,/createSignedUrl\(path, 10 \* 60\)/);
 assert.match(service,/Reviewed verification evidence is retained for audit and cannot be deleted/);
});
