import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const source=readFileSync(new URL('../src/components/tradexchange/ProviderSettingsSections.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const cap=(serviceType)=>({id:'cap-'+serviceType,serviceType,status:'APPROVED',jobNationwide:false,jobPostcodeAreas:['B']});
const capabilities=[cap('DELIVERY'),cap('INSPECTION')];
const verification=(type)=>({
 capabilityId:'cap-'+type,serviceType:type,
 verification:{declarationRequired:true,declarationCurrent:true,declaration:{
  businessName:'Saved provider',businessAddress:'Registered Business Address',phone:'07700000000',
  registeredBusiness:true,acceptedAt:'2026-11-20'
 }}
});
const txt=tree=>tree.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
async function mount(which,{dealer=null,stripeComplete=false,caps=capabilities,fail=false}={}){
 const calls=[],open=[];
 const modules={
  react:React,
  'react-native':{
   View:'View',Text:'Text',TextInput:'Input',TouchableOpacity:'Press',Switch:'Switch',ActivityIndicator:'Spinner',
   StyleSheet:{create:x=>x},Linking:{openURL:async url=>open.push(url)},
  },
  '../Button':{Button:'Button'},
  '../../constants/colors':{Colors:{}},
  '../../constants/typography':{FontFamily:{}},
  '../../lib/servicesApi':{
   savePartnerBusiness:async value=>calls.push(['save-business',value]),
   getMyCapabilities:async()=>{calls.push(['get-capabilities']);if(fail)throw Error('offline');return{capabilities:caps,stripeConnect:{complete:stripeComplete}};},
   updateJobMatching:async(id,input)=>{calls.push(['match',id,input]);return {...caps.find(c=>c.id===id),jobNationwide:input.jobNationwide,jobPostcodeAreas:input.jobPostcodeAreas};},
   createStripeConnectOnboarding:async()=>{calls.push(['stripe']);return 'https://example.invalid/checkout';},
  },
  '../../lib/serviceOperationsApi':{
   getCapabilityVerification:async id=>{calls.push(['get-verification',id]);if(fail)throw Error('offline');return verification(id.slice(4));},
   submitProviderDeclaration:async(id,data)=>{calls.push(['declaration',id,data]);return verification(id.slice(4));},
  },
 };
 const exports={};
 runInNewContext(compiled,{exports,require:n=>{assert.ok(n in modules,'unmocked module '+n);return modules[n];},Date,Error});
 let tree;
 await act(async()=>{tree=create(React.createElement(exports[which],{capabilities:caps,dealer,stripeComplete,onSaved:async()=>calls.push(['refresh'])}));});
 const press=async label=>act(async()=>{
  const button=tree.root.findAllByType('Press').find(n=>n.props.accessibilityLabel===label);
  assert.ok(button,'Press '+label);
  return button.props.onPress();
 });
 const click=async label=>act(async()=>{
  const button=tree.root.findAllByType('Button').find(n=>n.props.label===label);
  assert.ok(button,'Button '+label);
  return button.props.onPress();
 });
 const edit=async(label,value)=>act(async()=>{
  const input=tree.root.findAllByType('Input').find(n=>n.props.accessibilityLabel===label);
  assert.ok(input,'Input '+label);
  return input.props.onChangeText(value);
 });
 const toggle=async(label,value)=>act(async()=>{
  const sw=tree.root.findAllByType('Switch').find(n=>n.props.accessibilityLabel===label);
  assert.ok(sw,'Switch '+label);
  return sw.props.onValueChange(value);
 });
 return {tree,calls,open,press,click,edit,toggle,unmount:()=>act(async()=>tree.unmount())};
}

test('business and payouts section is collapsed by default and never triggers verification requests until expanded',async()=>{
 const h=await mount('ProviderBusinessPaymentsSection');
 assert.match(txt(h.tree),/Business & Payments/);
 assert.deepEqual(h.calls,[]);
 await h.unmount();
});
test('existing service declaration is prepopulated and updates the same capability, no new account',async()=>{
 const h=await mount('ProviderBusinessPaymentsSection');
 await h.press('Business & Payments');
 assert.ok(h.calls.some(c=>c[0]==='get-verification'&&c[1]==='cap-DELIVERY'));
 assert.ok(h.tree.root.findAllByType('Input').some(n=>n.props.accessibilityLabel==='Declaration trading name'&&n.props.value==='Saved provider'));
 await h.toggle('Accept service declaration',true);
 await h.click('Save declaration');
 const write=h.calls.find(c=>c[0]==='declaration');
 assert.ok(write);
 assert.equal(write[1],'cap-DELIVERY');
 assert.equal(write[2].businessName,'Saved provider');
 assert.equal(write[2].registeredBusiness,true);
 assert.equal(write[2].accepted,true);
 assert.equal(h.calls.filter(c=>c[0]==='save-business').length,0);
 await h.unmount();
});
test('dealer business details save inline and do not change approvals or service flags',async()=>{
 const h=await mount('ProviderBusinessPaymentsSection',{dealer:{companyName:'Existing dealership',isVerified:true,phone:'07123456789',businessAddress:'Registered HQ'}});
 await h.press('Business & Payments');
 await h.edit('Business phone','07999999999');
 await h.click('Save business details');
 const save=h.calls.find(c=>c[0]==='save-business');
 assert.deepEqual(JSON.parse(JSON.stringify(save[1])),{companyName:'Existing dealership',phone:'07999999999',businessAddress:'Registered HQ'});
 assert.equal(h.calls.filter(c=>c[0]==='refresh').length,1);
 await h.unmount();
});
test('contractor can complete Stripe payouts without dealer conversion',async()=>{
 const h=await mount('ProviderBusinessPaymentsSection');
 await h.press('Business & Payments');
 await h.click('Set up secure payouts');
 assert.ok(h.calls.some(c=>c[0]==='stripe'));
 assert.equal(h.open.length,1);
 assert.equal(h.calls.filter(c=>c[0]==='save-business').length,0);
 await h.unmount();
});
test('job preferences hydrate existing areas and save valid unique postcode areas only through matching API',async()=>{
 const h=await mount('ProviderJobPreferencesSection');
 await h.press('Job Preferences');
 const input=h.tree.root.findAllByType('Input').find(n=>n.props.accessibilityLabel==='UK postcode areas');
 assert.equal(input.props.value,'B');
 await h.edit('UK postcode areas','b, CV, cv, WS');
 await h.click('Save job preferences');
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(c=>c[0]==='match'))),['match','cap-DELIVERY',{jobNationwide:false,jobPostcodeAreas:['B','CV','WS']}]);
 await h.unmount();
});
test('invalid and empty coverage cannot be saved, preserving existing work areas',async()=>{
 const h=await mount('ProviderJobPreferencesSection');
 await h.press('Job Preferences');
 await h.edit('UK postcode areas','SW1A');
 await h.click('Save job preferences');
 assert.match(txt(h.tree),/Choose nationwide or enter UK postcode areas/);
 assert.equal(h.calls.filter(c=>c[0]==='match').length,0);
 await h.unmount();
});
test('nationwide coverage saves empty area list and does not delete accepted jobs',async()=>{
 const h=await mount('ProviderJobPreferencesSection');
 await h.press('Job Preferences');
 await h.toggle('Available nationwide',true);
 await h.click('Save job preferences');
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(c=>c[0]==='match'))),['match','cap-DELIVERY',{jobNationwide:true,jobPostcodeAreas:[]}]);
 await h.unmount();
});
test('inspection work areas save against inspection capability, never delivery capability',async()=>{
 const h=await mount('ProviderJobPreferencesSection');
 await h.press('Job Preferences');
 await h.click('Inspection');
 await h.edit('UK postcode areas','M');
 await h.click('Save job preferences');
 assert.equal(h.calls.find(c=>c[0]==='match')[1],'cap-INSPECTION');
 await h.unmount();
});
test('unavailable provider settings display errors and never create new applications',async()=>{
 const h=await mount('ProviderJobPreferencesSection',{fail:true});
 await h.press('Job Preferences');
 assert.match(txt(h.tree),/offline/);
 assert.equal(h.calls.filter(c=>c[0]==='match').length,0);
 await h.unmount();
});
