import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=t=>t.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
const click=async(t,label)=>act(async()=>t.root.findAllByType('Button').find(n=>n.props.label===label).props.onPress());
const profile={role:'DEALER',dealerProfile:{companyName:'Synthetic dealer',isVerified:true,phone:'07700900000',businessAddress:'Test area'}};
const cap=(serviceType,status='APPROVED')=>({id:serviceType+'-test',serviceType,status,jobNationwide:true,jobPostcodeAreas:[]});
async function render(name,overrides={}){
 const nav=[],calls=[];
 const services={SERVICE_LABELS:{DELIVERY:'Delivery & Recovery',INSPECTION:'Vehicle Inspections'},getPartnerProfile:async()=>profile,getPartnerTeam:async()=>({capabilities:[cap('DELIVERY'),cap('INSPECTION')],stripeConnect:{complete:true}}),getMyCapabilities:async()=>({profile:null,capabilities:[cap('DELIVERY'),cap('INSPECTION')],stripeConnect:{complete:true}}),applyPartnerCapability:async type=>{calls.push(type);return cap(type,'PENDING');},...overrides};
 const modules={react:React,'react-native':{...Object.fromEntries(['View','Text','ScrollView','TextInput','StatusBar','ActivityIndicator'].map(n=>[n,n])),StyleSheet:{create:x=>x},Alert:{alert(){}},Linking:{openURL:async()=>{}},AppState:{addEventListener:()=>({remove(){}})}},'@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},'@/components/BrandIcon':{Ionicons:'Icon'},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../components/dealer/DealerPageTabs':{DealerPageTabs:'DealerPageTabs'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{}},'../../store/authStore':{useAuthStore:cb=>cb({accountRole:'dealer',initializeAuth:async()=>{}})},'../../lib/servicesApi':services,'../../lib/apiClient':{apiClient:async()=>{throw Error('Unexpected write');}}};
 const exports={};const source=readFileSync(new URL('../src/screens/main/'+name+'.tsx',import.meta.url),'utf8');runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
 let tree;await act(async()=>{tree=create(React.createElement(exports[name],{navigation:{navigate:(...a)=>nav.push(a)}}));});return{tree,nav,calls};
}
test('Partner home has three native add-ons and settings link without duplicate preference switches',async()=>{
 const h=await render('PartnerDashboardScreen');assert.match(text(h.tree),/Vehicle Dealer/);assert.match(text(h.tree),/Business payouts enabled/);assert.match(text(h.tree),/One team, service permissions/);assert.doesNotMatch(text(h.tree),/My dealership services/);assert.equal(h.calls.length,0);
 await click(h.tree,'Open dealer tools');assert.equal(h.nav[0][0],'Tabs');await click(h.tree,'Edit business details');assert.equal(h.nav[1][1].section,'business');await click(h.tree,'Open jobs');assert.equal(h.nav[2][0],'ProviderJobs');await act(async()=>h.tree.unmount());
});
test('Pending setup opens existing declaration without reapplying and failed status blocks applications',async()=>{
 const h=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>({capabilities:[cap('DELIVERY','PENDING')],stripeConnect:{complete:false}})});
 await click(h.tree,'Complete service setup');assert.equal(h.nav[0][1].capabilityId,'DELIVERY-test');assert.equal(h.calls.length,0);await click(h.tree,'Complete setup');assert.equal(h.calls[0],'INSPECTION');assert.equal(h.nav[1][1].capabilityId,'INSPECTION-test');await act(async()=>h.tree.unmount());
 const f=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>{throw Error('offline');}});assert.match(text(f.tree),/Status unavailable/);assert.ok(f.tree.root.findAllByType('Button').filter(n=>n.props.label==='Complete setup').every(n=>n.props.disabled));await act(async()=>f.tree.unmount());
});
test('Services shows read-only business and correct declaration, matching and job destinations',async()=>{
 const h=await render('ProviderCapabilitiesScreen');const inputs=h.tree.root.findAllByType('TextInput');assert.equal(inputs.length,3);assert.ok(inputs.every(n=>n.props.editable===false));assert.equal(inputs[0].props.value,'Synthetic dealer');
 await click(h.tree,'Service declaration');assert.equal(h.nav[0][1].capabilityId,'INSPECTION-test');await click(h.tree,'Matching settings');assert.equal(h.nav[1][0],'ProviderMatching');await click(h.tree,'See jobs');assert.equal(h.nav[2][0],'ProviderJobs');assert.equal(h.calls.length,0);await act(async()=>h.tree.unmount());
});
test('Wrong-service application response cannot navigate to a substituted capability',async()=>{
 const h=await render('ProviderCapabilitiesScreen',{getMyCapabilities:async()=>({profile:null,capabilities:[],stripeConnect:{complete:false}}),applyPartnerCapability:async()=>cap('INSPECTION','PENDING')});await click(h.tree,'Add service');assert.equal(h.nav.length,0);assert.match(text(h.tree),/Service setup is unavailable/);await act(async()=>h.tree.unmount());
});
