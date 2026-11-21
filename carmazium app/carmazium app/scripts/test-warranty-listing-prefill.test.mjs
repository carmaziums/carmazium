import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
async function mount(apiClient){
 const fields={};runInNewContext(compile(readFileSync(new URL('../src/lib/nativeWarranty.ts',import.meta.url),'utf8')),{exports:fields});
 const modules={react:React,'react-native':{ActivityIndicator:'Loading',Modal:'Modal',Text:'Text',View:'View'},'@react-navigation/native':{useFocusEffect:()=>{}},'expo-crypto':{randomUUID:()=> 'test-request',getRandomBytesAsync:async()=>new Uint8Array(32)},'expo-secure-store':{setItemAsync:async()=>{}},'react-native-webview':{WebView:'WebView'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'../../components/NativePage':{NativePage:'NativePage',FormField:'FormField',CheckField:'CheckField',pageStyles:{}},'../../components/Button':{Button:'Button'},'../../lib/apiClient':{apiClient},'../../store/authStore':{useAuthStore:fn=>fn({user:null})},'../../constants/colors':{Colors:{}},'../../lib/nativeWarranty':{...fields,warrantyPayload:values=>({vehicle:{vrm:values.vrm}})}};
 const exports={};runInNewContext(compile(readFileSync(new URL('../src/screens/main/WarrantyScreens.tsx',import.meta.url),'utf8')),{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});
 const nav=[];let t;await act(async()=>{t=create(React.createElement(exports.WarrantyScreen,{route:{params:{listingId:'listing/a'}},navigation:{navigate:(...args)=>nav.push(args)}}));});return {t,nav};
}
const input=(t,label)=>t.root.findAllByType('FormField').find(n=>n.props.label===label);
const quote=t=>act(async()=>t.root.findAllByType('Button').find(n=>n.props.label==='Get a quote').props.onPress());
test('linked quote waits for listing data and preserves edits made during the read',async()=>{
 let resolve;const calls=[];const {t,nav}=await mount((url,options)=>{calls.push({url,options});if(url.includes('/listing/'))return new Promise(r=>resolve=r);return Promise.resolve({data:{id:'quote-1'}});});
 assert.equal(calls[0].url,'/warranties/listing/listing%2Fa');await quote(t);assert.equal(calls.length,1);
 await act(async()=>input(t,'Make').props.onChangeText('Edited make'));
 await act(async()=>resolve({data:{title:'Example car',vrm:'AB12CDE',make:'Original',model:'Model',engineSize:0,fuelType:'ELECTRIC',price:'1234.56'}}));
 assert.equal(input(t,'Make').props.value,'Edited make');assert.equal(input(t,'Vehicle registration').props.value,'AB12CDE');assert.equal(input(t,'Engine size (cc; 0 for electric)').props.value,'0');assert.equal(input(t,'Purchase / retail value (£)').props.value,'1234.56');await quote(t);
 assert.equal(JSON.parse(calls[1].options.body).listingId,'listing/a');assert.deepEqual(JSON.parse(JSON.stringify(nav)),[['WarrantyOrder',{id:'quote-1'}]]);await act(async()=>t.unmount());
});
test('unavailable listing exposes manual fallback and removes invalid listing linkage',async()=>{
 const calls=[];const {t}=await mount(async(url,options)=>{calls.push({url,options});if(url.includes('/listing/'))throw Error('unavailable');return {data:{id:'manual-quote'}};});
 assert.ok(t.root.findAllByType('Text').some(n=>String(n.props.children).includes('standalone quote')));await act(async()=>input(t,'Vehicle registration').props.onChangeText('ZZ99ZZZ'));await quote(t);assert.equal('listingId' in JSON.parse(calls[1].options.body),false);await act(async()=>t.unmount());
});
