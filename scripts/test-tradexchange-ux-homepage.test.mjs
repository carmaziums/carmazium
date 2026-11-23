import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const require=createRequire(import.meta.url);
const page=read('src/app/auctions/page.tsx');
const source=read('src/components/tradexchange/TradeXchangeAccountActions.tsx');
let auth;
const exp={};
runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:exp,require:(name)=>{
 if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
 if(name==='@/context/AuthContext')return {useAuth:()=>auth};
 return require(name);
}});
const render=(name,props={})=>renderToStaticMarkup(React.createElement(exp[name],props));
const profile=role=>({id:'u1',role});
const set=role=>{auth={loading:false,user:{id:'u1'},profile:profile(role)}};
test('public service directory is server-rendered, canonical and customer first',()=>{
 assert.doesNotMatch(page,/^"use client"/);
 for(const path of ['/auctions/how-it-works','/services/delivery','/services/inspection','/services/finance','/services/warranty'])assert.ok(page.includes('href: "'+path+'"'),path);
 assert.ok(page.indexOf('id="tradexchange-areas"')<page.indexOf('id="business-partnerships"'));
 assert.match(page,/services\.filter\(service => service.enabled\)/);
 assert.match(page,/grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-3/);
 assert.match(page,/Temporarily unavailable/);
 assert.doesNotMatch(page,/\/dashboard\/service\/jobs|motion\.|PillarCard/);
});
test('guest, loading and stale identity do not expose account actions',()=>{
 for(const state of [{loading:false,user:null,profile:null},{loading:true,user:{id:'u1'},profile:profile('DEALER')},{loading:false,user:{id:'u2'},profile:profile('DEALER')}]){
   auth=state;assert.equal(render('TradeXchangeAccountActions',{paidJobsEnabled:true}),'');
   const html=render('TradeXchangePartnerAction');assert.doesNotMatch(html,/dashboard\/partner|dashboard\/service/); if(!state.user) assert.match(html,/href="\/become-a-partner"/);
 }
});
test('customer and dealer account actions retain their own jobs, never provider feed',()=>{
 for(const role of ['BUYER','SELLER','DEALER','CONTRACTOR']){
   set(role);const html=render('TradeXchangeAccountActions',{paidJobsEnabled:true});
   assert.match(html,/href="\/services\/jobs"/);assert.match(html,/href="\/dashboard\/warranties"/);
   assert.doesNotMatch(html,/\/dashboard\/service\/jobs/);
   assert.doesNotMatch(render('TradeXchangeAccountActions',{paidJobsEnabled:false}),/\/services\/jobs\/new/);
 }
});
test('business owners reuse their account; staff never start another business setup',()=>{
 for(const role of ['DEALER','CONTRACTOR']){
   set(role);assert.match(render('TradeXchangePartnerAction'),/href="\/dashboard\/partner"/);assert.match(render('TradeXchangePartnerAction'),/Manage Partner Account/);
 }
 set('BUYER');assert.match(render('TradeXchangePartnerAction'),/Explore Partner Account setup/);
 auth.profile.dealerStaffMemberships=[{id:'m1'}];assert.match(render('TradeXchangePartnerAction'),/href="\/dashboard\/dealer"/);
});
test('public web and native navigation have no provider-only nested actions',()=>{
 const header=read('src/components/layout/Header.tsx');
 assert.doesNotMatch(header,/tradeJobActions|expandedTradeService|Find Jobs &amp; Bid/);
 for(const path of ['delivery','inspection'])assert.equal([...header.matchAll(new RegExp('href: "/services/'+path+'"','g'))].length,2);
 const menu=read('carmazium app/carmazium app/src/components/SiteMenu.tsx');
 const native=read('carmazium app/carmazium app/src/screens/main/ServicesScreen.tsx');
 assert.doesNotMatch(menu,/jobActions|Find Jobs & Bid|screen: 'ProviderJobs'/);
 assert.doesNotMatch(native,/expandedService|Find Jobs & Bid|navigate\('ProviderJobs'/);
});
test('linked business guide matches both insurance requirements',()=>{
 const guide=read('src/app/become-a-partner/page.tsx');
 assert.match(guide,/Motor Trade Insurance and Public Liability Insurance/);
 assert.match(guide,/Public Liability Insurance covering inspection work/);
 assert.doesNotMatch(guide,/inspection service setup does not require document uploads/);
});
