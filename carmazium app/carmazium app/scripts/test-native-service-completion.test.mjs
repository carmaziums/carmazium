import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(path, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, URL, require: name => { assert.ok(name in modules, name); return modules[name]; }, setTimeout, clearTimeout }); return exports;
}
const warranty = compile('lib/nativeWarranty.ts');
const fixture = () => ({ title:'Mr', firstName:'Synthetic', lastName:'Customer', email:'synthetic@example.invalid', phone:'07700900000', addressLine1:'1 Test Street', town:'Birmingham', postcode:'B1 1AA', vrm:'TEST123', make:'Toyota', model:'Yaris', mileage:'20000', engineCc:'1500', fuelType:'HYBRID', vehicleCategory:'CAR', firstRegistrationDate:'2020-01-01', retailValue:'10000', origin:'UK', serviceHistory:'FULL', purchaseDate:'2026-11-20', requestedStartDate:'2026-11-20', knownFaults:'NONE', repairLimit:'2000', labourRate:'75' });
test('warranty validates dates, required fields, consent and faults without inventing a price', () => {
  const valid = warranty.warrantyPayload(fixture(), [], true, true);
  assert.equal(valid.vehicle.retailValuePence, 1000000); assert.equal(valid.selection.repairLimit, 2000); assert.equal(valid.totalPence, undefined);
  for (const [change, message] of [[{mileage:''}, /Current mileage/], [{firstRegistrationDate:'2020-02-31'}, /First registration date/], [{knownFaults:'KNOWN',faultDetails:'x'}, /known faults/]]) assert.throws(() => warranty.warrantyPayload({...fixture(),...change},[],true,true), message);
  assert.throws(() => warranty.warrantyPayload(fixture(),[],true,false), /agree/);
});
async function render(name, api, params={}) {
  const nav=[],opened=[],secure=new Map();
  const modules={
    react:React,'react-native':{ActivityIndicator:'Loading',Text:'Text',View:'View',Modal:'Modal'},
    '@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},
    'expo-web-browser':{openBrowserAsync:async url=>{opened.push(url);}},
    'expo-crypto':{randomUUID:()=> '11111111-1111-4111-8111-111111111111',getRandomBytesAsync:async()=>new Uint8Array(32).fill(10)},
    'expo-secure-store':{getItemAsync:async key=>secure.get(key)||null,setItemAsync:async(key,value)=>{secure.set(key,value);}},
    'react-native-webview':{WebView:'WebView'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
    '../../components/NativePage':{NativePage:({children})=>React.createElement('Page',null,children),FormField:'Field',CheckField:'Check',pageStyles:{}},
    '../../components/Button':{Button:'Button'},'../../lib/apiClient':{apiClient:api},'../../constants/colors':{Colors:{}},
    '../../store/authStore':{useAuthStore:select=>select({user:null})},'../../lib/nativeWarranty':warranty,
  };
  const exports=compile('screens/main/'+(name==='FinanceScreen'?'FinanceScreen':'WarrantyScreens')+'.tsx',modules);
  let tree;await act(async()=>{tree=create(React.createElement(exports[name],{navigation:{navigate:(...args)=>nav.push(args)},route:{params}}));});
  return {tree,nav,opened,secure,button:label=>tree.root.findAllByType('Button').find(n=>n.props.label===label),field:label=>tree.root.findAllByType('Field').find(n=>n.props.label===label)};
}
const provider={id:'provider',version:'version-test-2026',name:'Test provider',applicationUrl:'https://finance.example.invalid/apply',disclosure:'Test disclosure'};
test('finance requires consent, retries idempotently and rejects a substituted provider URL',async()=>{
  const posted=[];let bad=true;
  const h=await render('FinanceScreen',async(path,options)=>{
    if(path.startsWith('/finance/referrals/listing/'))return{data:{enabled:true,title:'Test car',provider}};
    posted.push(JSON.parse(options.body));return{data:{redirectUrl:bad?'https://wrong.example.invalid':provider.applicationUrl}};
  },{listingId:'listing'});
  await act(async()=>h.button('Continue to Test provider').props.onPress());assert.equal(posted.length,0);
  for(const [label,value] of [['Full name','Synthetic Customer'],['Email address','synthetic@example.invalid'],['Phone number','07700900000']])await act(async()=>h.field(label).props.onChangeText(value));
  await act(async()=>h.tree.root.findByType('Check').props.onChange(true));
  await act(async()=>h.button('Continue to Test provider').props.onPress());assert.equal(posted.length,1);assert.equal(h.opened.length,0);
  bad=false;await act(async()=>h.button('Continue to Test provider').props.onPress());assert.equal(posted[0].requestId,posted[1].requestId);assert.equal(h.opened[0],provider.applicationUrl);
  await act(async()=>h.tree.unmount());
});
test('disabled finance does not offer enquiry submission',async()=>{
  const h=await render('FinanceScreen',async()=>({data:{enabled:false,title:'Removed',provider:null}}),{listingId:'listing'});
  assert.equal(h.button('Continue to Test provider'),undefined);assert.ok(h.button('Browse cars'));await act(async()=>h.tree.unmount());
});
test('warranty retries preserve its secure access key and never initiate checkout before review',async()=>{
  const calls=[];let failing=true;
  const h=await render('WarrantyScreen',async(path,options)=>{calls.push([path,JSON.parse(options.body)]);if(failing)throw Error('timeout');return{data:{id:'11111111-1111-4111-8111-111111111111'}};});
  const values=fixture();
  for(const field of [...warranty.vehicleFields,...warranty.customerFields]) {
    if(field.optional)continue;
    if(field.options){const label=field.options.find(([key])=>key===values[field.key])[1];await act(async()=>h.button(label).props.onPress());}
    else {const label=field.label+(field.date?' — YYYY-MM-DD':'');await act(async()=>h.field(label).props.onChangeText(values[field.key]));}
  }
  await act(async()=>h.tree.root.findAllByType('Check').find(c=>c.props.label.startsWith('I have checked')).props.onChange(true));
  await act(async()=>h.tree.root.findAllByType('Check').find(c=>c.props.label.startsWith('I agree')).props.onChange(true));
  await act(async()=>h.button('Get a quote').props.onPress());assert.equal(calls.length,1);assert.equal(h.nav.length,0);
  failing=false;await act(async()=>h.button('Get a quote').props.onPress());
  assert.equal(calls[0][0],'/warranties/quotes');assert.equal(calls[0][1].accessToken,calls[1][1].accessToken);assert.equal(calls[0][1].requestId,calls[1][1].requestId);
  assert.equal(h.secure.get('carmazium-warranty-'+calls[0][1].requestId),calls[0][1].accessToken);assert.equal(h.nav[0][0],'WarrantyOrder');
  await act(async()=>h.tree.unmount());
});
test('Stripe return refreshes the server status instead of assuming success',async()=>{
  let reads=0;
  const order={id:'order',status:'QUOTED',statusLabel:'Quoted',vehicle:{vrm:'TEST123',make:'Toyota',model:'Yaris'},price:{lines:[]},totalPence:36000,expiresAt:'2026-11-21T12:00:00Z'};
  const h=await render('WarrantyOrderScreen',async path=>{if(path.endsWith('/checkout'))return{data:{url:'https://checkout.stripe.com/c/pay/test'}};reads++;return{data:order};},{id:'order'});
  await act(async()=>h.button('Pay £360.00 with Stripe').props.onPress());
  let allowed;await act(async()=>{allowed=h.tree.root.findByType('WebView').props.onShouldStartLoadWithRequest({url:'https://www.carmazium.com/services/warranty/order?id=order&paid=1'});});
  assert.equal(allowed,false);assert.ok(reads>=2);assert.ok(h.button('Pay £360.00 with Stripe'));assert.equal(h.tree.root.findAllByType('WebView').length,0);
  await act(async()=>h.tree.unmount());
});
