import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const compile=(file)=>ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
test('old Android route names open the correct inline TradeXchange section with existing capability id',async()=>{
 const src=compile('screens/main/LegacyProviderRouteRedirectScreen.tsx');
 const modules={react:React,'react-native':{View:'View',ActivityIndicator:'Spinner',StyleSheet:{create:x=>x}},'../../constants/colors':{Colors:{accent:'accent',bgPrimary:'base'}}};
 const exports={};
 runInNewContext(src,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
 for(const [name,section,id] of [
  ['ProviderCapabilities','services',undefined],
  ['ProviderVerification','business','inspection-test'],
  ['ProviderMatching','preferences','delivery-test'],
 ]){
  const changes=[];
  let tree;
  await act(async()=>{tree=create(React.createElement(exports.LegacyProviderRouteRedirectScreen,{
   navigation:{replace:(...a)=>changes.push(a)},
   route:{name,params:id?{capabilityId:id}:undefined}
  }));});
  assert.equal(changes.length,1,name);
  assert.equal(changes[0][0],'PartnerDashboard');
  assert.equal(changes[0][1].openSection,section);
  assert.equal(changes[0][1].capabilityId,id);
  await act(async()=>tree.unmount());
 }
});

test('contractor applies once through the existing API, not via a second dealer account',async()=>{
 const src=compile('components/tradexchange/ContractorServicesInline.tsx');
 const records=[],updates=[],submitted=[];
 const modules={
  react:React,
  'react-native':{View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'Press',StyleSheet:{create:x=>x}},
  '../Button':{Button:'Button'},
  '../../constants/colors':{Colors:{}},
  '../../constants/typography':{FontFamily:{}},
  '../../lib/apiClient':{apiClient:async(path,options)=>{submitted.push([path,JSON.parse(options.body)]);return{data:{id:'inspection-test',serviceType:'INSPECTION',status:'PENDING'}};}},
 };
 const exports={};
 runInNewContext(src,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
 let tree;
 await act(async()=>{tree=create(React.createElement(exports.ContractorServicesInline,{
  capabilities:[],profile:{businessName:'Existing inspector',phone:'07700900000',serviceArea:'Birmingham'},
  onUpdated:async()=>updates.push('refreshed'),
 }));});
 await act(async()=>{const b=tree.root.findAllByType('Button').find(x=>x.props.label==='Apply for service');assert.ok(b);b.props.onPress();});
 assert.equal(submitted.length,1);
 assert.equal(submitted[0][0],'/services/capabilities');
 assert.equal(submitted[0][1].serviceType,'DELIVERY');
 // The fake endpoint deliberately returned inspection for a delivery request.
 assert.equal(updates.length,0,'wrong service must not change what the UI opens');
 assert.equal(submitted.filter(x=>x[0]==='/users/elevate').length,0,'no dealer registration');
 await act(async()=>tree.unmount());
});
