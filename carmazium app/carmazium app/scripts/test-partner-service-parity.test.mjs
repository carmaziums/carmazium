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
 const modules={react:React,'react-native':{...Object.fromEntries(['View','Text','ScrollView','TextInput','StatusBar','ActivityIndicator'].map(n=>[n,n])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:600,fontScale:1}),Alert:{alert(){}},Linking:{openURL:async()=>{}},AppState:{addEventListener:()=>({remove(){}})}},'@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},'@/components/BrandIcon':{Ionicons:'Icon'},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../components/dealer/DealerPageTabs':{DealerPageTabs:'DealerPageTabs'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../store/authStore':{useAuthStore:cb=>cb({accountRole:overrides.__accountRole??'dealer',initializeAuth:async()=>{}})},'../../lib/servicesApi':services,'../../lib/apiClient':{apiClient:async()=>{throw Error('Unexpected write');}}};
 const rules={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/tradeXchangeProviderJobLoad.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:rules,Error});
 modules['../../lib/tradeXchangeProviderJobLoad']=rules;modules['../../constants/spacing']={Elevation:{},Radius:{}};modules['react-native'].TouchableOpacity='Press';modules['react-native'].RefreshControl='Refresh';modules['react-native'].FlatList=({ListHeaderComponent,ListEmptyComponent,data,renderItem,onEndReached})=>React.createElement('List',{onEndReached},ListHeaderComponent,data.length?data.map((item)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent);
 const exports={};const source=readFileSync(new URL('../src/screens/main/'+name+'.tsx',import.meta.url),'utf8');runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
 let tree;await act(async()=>{tree=create(React.createElement(exports[name],{navigation:{navigate:(...a)=>nav.push(a)}}));});return{tree,nav,calls};
}
test('Partner home has three native add-ons and settings link without duplicate preference switches',async()=>{
 const h=await render('PartnerDashboardScreen');assert.match(text(h.tree),/Vehicle Dealer/);assert.match(text(h.tree),/Business payouts enabled/);assert.match(text(h.tree),/One team, service permissions/);assert.doesNotMatch(text(h.tree),/My dealership services/);assert.equal(h.calls.length,0);
 await click(h.tree,'Open dealer tools');assert.equal(h.nav[0][0],'Tabs');await click(h.tree,'Edit business details');assert.equal(h.nav[1][1].section,'business');await click(h.tree,'Open jobs');assert.equal(h.nav[2][0],'ProviderJobs');await act(async()=>h.tree.unmount());
});
test('Pending setup opens existing declaration without reapplying and failed status blocks applications',async()=>{
 const h=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>({capabilities:[cap('DELIVERY','PENDING')],stripeConnect:{complete:false}})});
 await click(h.tree,'Continue setup');assert.equal(h.nav[0][1].capabilityId,'DELIVERY-test');assert.equal(h.calls.length,0);await click(h.tree,'Complete setup');assert.equal(h.calls[0],'INSPECTION');assert.equal(h.nav[1][1].capabilityId,'INSPECTION-test');await act(async()=>h.tree.unmount());
 const f=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>{throw Error('offline');}});assert.match(text(f.tree),/Status unavailable/);assert.ok(f.tree.root.findAllByType('Button').filter(n=>n.props.label==='Complete setup').every(n=>n.props.disabled));await act(async()=>f.tree.unmount());
});
test('Services shows read-only business and correct declaration, matching and job destinations',async()=>{
 const h=await render('ProviderCapabilitiesScreen');const inputs=h.tree.root.findAllByType('TextInput');assert.equal(inputs.length,3);assert.ok(inputs.every(n=>n.props.editable===false));assert.equal(inputs[0].props.value,'Synthetic dealer');
 await click(h.tree,'Service declaration');assert.equal(h.nav[0][1].capabilityId,'INSPECTION-test');await click(h.tree,'Matching settings');assert.equal(h.nav[1][0],'ProviderMatching');await click(h.tree,'See jobs');assert.equal(h.nav[2][0],'ProviderJobs');assert.equal(h.calls.length,0);await act(async()=>h.tree.unmount());
});
test('Wrong-service application response cannot navigate to a substituted capability',async()=>{
 const h=await render('ProviderCapabilitiesScreen',{getMyCapabilities:async()=>({profile:null,capabilities:[],stripeConnect:{complete:false}}),applyPartnerCapability:async()=>cap('INSPECTION','PENDING')});await click(h.tree,'Add service');assert.equal(h.nav.length,0);assert.match(text(h.tree),/Service setup is unavailable/);await act(async()=>h.tree.unmount());
});

const job=id=>({id,title:'Synthetic work '+id,status:'PAID',serviceType:'DELIVERY',pickupPostcode:'B1 1AA',deliveryPostcode:'B2 2BB',vehicles:[],quotes:[],_count:{quotes:0}});
test('Unavailable new-job approval cannot conceal accepted work and tabs show both counts',async()=>{
 const h=await render('ProviderJobsScreen',{getJobFeedPage:async()=>{throw Error('verification expired');},getAssignedJobsPage:async()=>({items:[job('existing')],nextCursor:null}),formatPence:p=>'£'+p/100});
 assert.match(text(h.tree),/Verification required for new jobs/);
 const tab=h.tree.root.findAllByType('Press').find(n=>n.props.accessibilityLabel==='My assigned service work');await act(async()=>tab.props.onPress());
 assert.match(text(h.tree),/Synthetic work existing/);assert.doesNotMatch(text(h.tree),/Verification required for new jobs/);assert.match(text(h.tree),/My Work \(1\)/);
 await act(async()=>h.tree.unmount());
});
test('Late pagination after refresh cannot reinsert stale provider jobs',async()=>{
 let finishMore;let reads=0;
 const h=await render('ProviderJobsScreen',{getJobFeedPage:async(_type,cursor)=>cursor?new Promise(resolve=>{finishMore=resolve;}):({items:[job(++reads===1?'old':'fresh')],nextCursor:reads===1?'next':null}),getAssignedJobsPage:async()=>({items:[],nextCursor:null}),formatPence:p=>'£'+p/100});
 // The real list's end callback is retained on the test host below.
 const list=h.tree.root.findByType('List');
 await act(async()=>list.props.onEndReached?.());
 await click(h.tree,'Refresh jobs');assert.match(text(h.tree),/Synthetic work fresh/);
 assert.ok(finishMore);{await act(async()=>finishMore({items:[job('stale')],nextCursor:null}));assert.doesNotMatch(text(h.tree),/Synthetic work stale/);}
 await act(async()=>h.tree.unmount());
});

test('Provider overview aggregates every page for released earnings and preserves work when approvals fail',async()=>{
 const calls=[];
 const h=await render('ProviderOverviewScreen',{
   getMyCapabilities:async()=>{throw Error('offline');},
   getJobFeedPage:async()=>{throw Error('verification expired');},
   getAssignedJobsPage:async cursor=>{calls.push(cursor);return cursor?{items:[{...job('release2'),status:'RELEASED',contractorAmountPence:20025,updatedAt:'2026-11-21'}],nextCursor:null}:{items:[{...job('live'),updatedAt:'2026-11-21'},{...job('release1'),status:'RELEASED',contractorAmountPence:10050,updatedAt:'2026-11-20'}],nextCursor:'next'};},
   formatPence:p=>'£'+(p/100).toFixed(2),
 });
 assert.equal(calls.length,2);assert.match(text(h.tree),/£300.75/);assert.match(text(h.tree),/Setup needed/);assert.match(text(h.tree),/Unavailable/);assert.match(text(h.tree),/Synthetic work live/);
 await click(h.tree,'My Work');assert.equal(h.nav[0][0],'ProviderJobs');assert.equal(h.nav[0][1].initialTab,'assigned');await act(async()=>h.tree.unmount());
});

test('Existing contractor can use TradeXchange without converting to a dealer account',async()=>{
 const h=await render('PartnerDashboardScreen',{
   __accountRole:'provider',
   getPartnerProfile:async()=>({id:'legacy-provider',role:'CONTRACTOR',dealerProfile:null}),
 });
 assert.match(text(h.tree),/Use your existing service-provider account/);
 assert.doesNotMatch(text(h.tree),/Create a Partner Account/);
 await click(h.tree,'My services');
 assert.equal(h.nav[0][0],'ProviderCapabilities');
 await click(h.tree,'Find jobs');
 assert.equal(h.nav[1][0],'ProviderJobs');
 assert.equal(h.nav[1][1].initialTab,'open');
 await click(h.tree,'My work');
 assert.equal(h.nav[2][0],'ProviderJobs');
 assert.equal(h.nav[2][1].initialTab,'assigned');
 await act(async()=>h.tree.unmount());
});

test('Suspended services are not re-applied through another onboarding path',async()=>{
 const h=await render('PartnerDashboardScreen',{
   getPartnerTeam:async()=>({capabilities:[cap('DELIVERY','SUSPENDED'),cap('INSPECTION','APPROVED')],stripeConnect:{complete:true}}),
 });
 assert.match(text(h.tree),/Contact CarMazium to reactivate this service/);
 assert.equal(h.calls.length,0);
 assert.equal(h.tree.root.findAllByType('Button').filter(x=>x.props.label==='Complete setup').length,0);
 await act(async()=>h.tree.unmount());
});

test('Unverified existing dealer goes to saved KYC rather than creating another dealer profile',async()=>{
 const h=await render('PartnerDashboardScreen',{
   getPartnerProfile:async()=>({role:'DEALER',dealerProfile:{companyName:'Saved dealer',isVerified:false,kyc:{status:'PENDING'}}}),
   getPartnerTeam:async()=>({capabilities:[],stripeConnect:{complete:false}}),
 });
 await click(h.tree,'Continue verification');
 assert.equal(h.nav.at(-1)[0],'DealerKYC');
 assert.equal(h.calls.length,0);
 await act(async()=>h.tree.unmount());
});
