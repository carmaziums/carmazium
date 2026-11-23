import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
function load(p){const exports={};runInNewContext(ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Number,Set,Object,Array,Error});return exports;}
const backend=load('backend/src/services/warranty-retail-tariff.ts'),web=load('src/components/warranties/types.ts'),app=load('carmazium app/carmazium app/src/lib/nativeWarranty.ts');
test('all 256 display estimates equal the unchanged authoritative server tariff',()=>{
 const options=Object.keys(backend.WARRANTY_EXTRAS);
 for(const vehicleCategory of ['CAR','SUV'])for(const repairLimit of [1000,2000])for(const labourRate of [75,100,150,200])for(let mask=0;mask<16;mask++){
 const extras=options.filter((_,i)=>mask&(1<<i)),expected=backend.calculateWarrantyRetailPrice({vehicleCategory,months:12,repairLimit,labourRate,extras}).totalPence;
 const values={vehicleCategory,repairLimit:String(repairLimit),labourRate:String(labourRate)};
 assert.equal(web.warrantyEstimate(values,extras),expected);assert.equal(app.warrantyEstimate(values,extras),expected);
 }
 assert.equal(web.warrantyEstimate({},[]),null);assert.equal(app.warrantyEstimate({},[]),null);
});
test('warranty cover first, no charge until confirmed quote, order noindex and safe checkout',()=>{
 const f=read('src/components/warranties/WarrantyQuoteForm.tsx');
 assert.ok(f.indexOf('1. Choose your cover options')<f.indexOf('2. Your vehicle'));assert.ok(f.indexOf('2. Your vehicle')<f.indexOf('3. Your contact'));
 assert.match(f,/Estimated total, including VAT/);assert.match(f,/server-confirmed quote/);assert.match(f,/quote.totalPence/);assert.match(f,/checkout.stripe.com/);
 assert.match(f,/No payment is taken when you request a quote/);assert.match(f,/prefillBusy/);assert.match(f,/edited.current.has/);assert.match(f,/inFlight.current/);
 assert.match(read('src/app/services/warranty/order/layout.tsx'),/index: false/);
 assert.match(read('src/components/services/VehicleWarrantyCta.tsx'),/Warranty payment does not buy or reserve the vehicle/);
 assert.match(read('carmazium app/carmazium app/src/screens/main/WarrantyScreens.tsx'),/warrantyEstimate\(values,extras\)/);
});
test('finance canonical landing, redirect, provider verification and distinct partner enquiry',()=>{
 assert.ok(!existsSync(new URL('../src/app/finance/page.tsx',import.meta.url)));
 assert.match(read('next.config.ts'),/source: '\/finance', destination: '\/services\/finance', permanent: true/);
 const f=read('src/app/services/finance/page.tsx');assert.match(f,/FinanceReferralForm/);assert.match(f,/financeServiceEnabled/);
 assert.match(f,/\/contact\?topic=finance-partnership/);
 const referral=read('src/components/finance/FinanceReferralForm.tsx');
 assert.match(referral,/providerVersion: provider.version/);assert.match(referral,/redirectUrl !== expected/);assert.match(referral,/inFlight.current/);
 assert.match(referral,/\/finance\/referrals/);assert.match(referral,/consent/);
});
test('partnership routes and spotlight reuse existing pages and dealer settings stay distinct',()=>{
 const home=read('src/app/auctions/page.tsx');assert.match(home,/href="\/business-spotlight"/);
 assert.match(home,/finance.*warranty.*insurance/);
 assert.match(read('src/app/services/warranty/page.tsx'),/\/contact\?topic=warranty-partnership/);
 assert.match(read('src/components/dealer/DealerServicePreferences.tsx'),/do not activate the CarMazium finance calculator or Warrantywise checkout/);
 assert.match(read('src/components/finance/FinancePreference.tsx'),/dealership finance badge is a separate setting/);
 assert.match(read('carmazium app/carmazium app/src/screens/main/FinanceScreen.tsx'),/topic:'finance-partnership'/);
});
