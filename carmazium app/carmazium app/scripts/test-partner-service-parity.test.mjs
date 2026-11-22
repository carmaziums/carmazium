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
const cap=(serviceType,status='APPROVED')=>({id:serviceType+'-test',serviceType,status,verificationStatus:'VERIFIED',verificationExpiresAt:'2099-12-31T00:00:00Z',jobNationwide:true,jobPostcodeAreas:[]});
async function render(name,overrides={}){
 const nav=[],calls=[];
 const services={SERVICE_LABELS:{DELIVERY:'Delivery & Recovery',INSPECTION:'Vehicle Inspections'},getPartnerProfile:async()=>profile,getPartnerTeam:async()=>({capabilities:[cap('DELIVERY'),cap('INSPECTION')],stripeConnect:{complete:true}}),getMyCapabilities:async()=>({profile:null,capabilities:[cap('DELIVERY'),cap('INSPECTION')],stripeConnect:{complete:true}}),applyPartnerCapability:async type=>{calls.push(type);return cap(type,'PENDING');},updatePartnerServicePreference:async(key,enabled)=>{calls.push({key,enabled});},...overrides};
 const modules={react:React,'react-native':{...Object.fromEntries(['View','Text','ScrollView','TextInput','StatusBar','ActivityIndicator','Switch'].map(n=>[n,n])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:600,fontScale:1}),Alert:{alert(){}},Linking:{openURL:async()=>{}},AppState:{addEventListener:()=>({remove(){}})}},'@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},'@/components/BrandIcon':{Ionicons:'Icon'},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/tradexchange/ProviderDocumentsSection':{ProviderDocumentsSection:'ProviderDocumentsSection'},'../../components/tradexchange/ContractorServicesInline':{ContractorServicesInline:'ContractorServicesInline'},'../../components/tradexchange/ProviderSettingsSections':{ProviderBusinessPaymentsSection:'ProviderBusinessPaymentsSection',ProviderJobPreferencesSection:'ProviderJobPreferencesSection'},'../../components/Button':{Button:'Button'},'../../components/dealer/DealerPageTabs':{DealerPageTabs:'DealerPageTabs'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../store/authStore':{useAuthStore:cb=>cb({accountRole:overrides.__accountRole??'dealer',initializeAuth:async()=>{}})},'../../lib/servicesApi':services,'../../lib/apiClient':{apiClient:async()=>{throw Error('Unexpected write');}}};
 const rules={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/tradeXchangeProviderJobLoad.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:rules,Error});
 modules['../../lib/tradeXchangeProviderJobLoad']=rules;modules['../../constants/spacing']={Elevation:{},Radius:{}};modules['react-native'].TouchableOpacity='Press';modules['react-native'].RefreshControl='Refresh';modules['react-native'].FlatList=({ListHeaderComponent,ListEmptyComponent,data,renderItem,onEndReached})=>React.createElement('List',{onEndReached},ListHeaderComponent,data.length?data.map((item)=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent);
 const exports={};const source=readFileSync(new URL('../src/screens/main/'+name+'.tsx',import.meta.url),'utf8');runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];}});
 let tree;await act(async()=>{tree=create(React.createElement(exports[name],{navigation:{navigate:(...a)=>nav.push(a)}}));});return{tree,nav,calls};
}
test('Partner home has one My Services section and inline business, documents and preferences',async()=>{
 const h=await render('PartnerDashboardScreen');assert.match(text(h.tree),/My Services/);assert.doesNotMatch(text(h.tree),/Your add-ons|My dealership services|One team, service permissions/);
 assert.equal(h.tree.root.findAllByType('Switch').length,2);assert.equal(h.tree.root.findAllByType('ProviderBusinessPaymentsSection').length,1);
 assert.equal(h.tree.root.findAllByType('ProviderDocumentsSection').length,1);
 assert.equal(h.tree.root.findAllByType('ProviderJobPreferencesSection').length,1);
 assert.equal(h.tree.root.findByType('ProviderBusinessPaymentsSection').props.stripeComplete,true);
 assert.equal(h.calls.length,0);
 await click(h.tree,'View jobs');assert.equal(h.nav[0][0],'ProviderJobs');await act(async()=>h.tree.unmount());
});
test('Pending setup opens existing declaration without reapplying and failed status blocks applications',async()=>{
 const h=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>({capabilities:[cap('DELIVERY','PENDING')],stripeConnect:{complete:false}})});
 await click(h.tree,'Continue setup');assert.equal(h.tree.root.findByType('ProviderBusinessPaymentsSection').props.openRequest,1);assert.equal(h.calls.length,0);await click(h.tree,'Apply for service');assert.equal(h.calls[0],'INSPECTION');assert.equal(h.tree.root.findByType('ProviderBusinessPaymentsSection').props.openRequest,2);assert.equal(h.nav.length,0);await act(async()=>h.tree.unmount());
 const f=await render('PartnerDashboardScreen',{getPartnerTeam:async()=>{throw Error('offline');}});assert.match(text(f.tree),/Status unavailable/);assert.equal(f.tree.root.findAllByType('Switch').filter(n=>!n.props.disabled).length,0);await act(async()=>f.tree.unmount());
});
test('Existing contractor keeps one inline provider service manager, not the old setup page',async()=>{
 const h=await render('PartnerDashboardScreen',{
   getPartnerProfile:async()=>({role:'CONTRACTOR',dealerProfile:null}),
   getMyCapabilities:async()=>({profile:{businessName:'Saved contractor',phone:'07700900000',serviceArea:'B'},capabilities:[cap('DELIVERY','PENDING')],stripeConnect:{complete:true}})
 });
 assert.equal(h.tree.root.findAllByType('ContractorServicesInline').length,1);
 assert.equal(h.tree.root.findByType('ContractorServicesInline').props.profile.businessName,'Saved contractor');
 assert.equal(h.tree.root.findAllByType('ProviderDocumentsSection').length,1);
 assert.equal(h.nav.length,0);
 await act(async()=>h.tree.unmount());
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

test('Existing contractor uses inline My Services and jobs without forced dealer conversion',async()=>{
 const h=await render('PartnerDashboardScreen',{
   __accountRole:'provider',
   getPartnerProfile:async()=>({id:'legacy-provider',role:'CONTRACTOR',dealerProfile:null}),
 });
 assert.match(text(h.tree),/Use your existing service-provider account/);
 assert.doesNotMatch(text(h.tree),/Create a Partner Account/);
 assert.equal(h.tree.root.findAllByType('ContractorServicesInline').length,1);
 await click(h.tree,'Find jobs');assert.equal(h.nav[0][0],'ProviderJobs');assert.equal(h.nav[0][1].initialTab,'open');
 await click(h.tree,'My work');assert.equal(h.nav[1][0],'ProviderJobs');assert.equal(h.nav[1][1].initialTab,'assigned');
 await act(async()=>h.tree.unmount());
});

test('Suspended services are not re-applied through another onboarding path',async()=>{
 const h=await render('PartnerDashboardScreen',{
   getPartnerTeam:async()=>({capabilities:[cap('DELIVERY','SUSPENDED'),cap('INSPECTION','APPROVED')],stripeConnect:{complete:true}}),
 });
 assert.match(text(h.tree),/Contact CarMazium to reactivate this service/);
 assert.equal(h.calls.length,0);
 assert.equal(h.tree.root.findAllByType('Button').filter(x=>x.props.label==='Reapply').length,0);
 await act(async()=>h.tree.unmount());
});

test('Unverified existing dealer goes to saved KYC rather than creating another dealer profile',async()=>{
 const h=await render('PartnerDashboardScreen',{
   getPartnerProfile:async()=>({role:'DEALER',dealerProfile:{companyName:'Saved dealer',isVerified:false,kyc:{status:'PENDING'}}}),
   getPartnerTeam:async()=>({capabilities:[],stripeConnect:{complete:false}}),
 });
 await act(async()=>h.tree.root.findByType('ProviderBusinessPaymentsSection').props.onVerifyDealer());
 assert.equal(h.nav.at(-1)[0],'DealerKYC');
 assert.equal(h.calls.length,0);
 await act(async()=>h.tree.unmount());
});

test('TradeXchange is the only writer of provider opt-in, with existing approval preserved',async()=>{
 const dealer={role:'DEALER',dealerProfile:{companyName:'Example dealer',isVerified:true,deliveryServicesEnabled:false,inspectionServicesEnabled:true}};
 const updated=[];
 const h=await render('PartnerDashboardScreen',{
   getPartnerProfile:async()=>dealer,
   updatePartnerServicePreference:async(key,value)=>{updated.push({key,value});dealer.dealerProfile[key]=value;},
 });
 const delivery=h.tree.root.findAllByType('Switch').find(n=>n.props.accessibilityLabel==='Offer collection, delivery and recovery');
 assert.ok(delivery);assert.equal(delivery.props.value,false);
 assert.match(text(h.tree),/Paused/);
 await click(h.tree,'View existing work');
 assert.equal(h.nav.at(-1)[0],'ProviderJobs');
 assert.equal(h.nav.at(-1)[1].initialTab,'assigned');
 await act(async()=>delivery.props.onValueChange(true));
 assert.deepEqual(updated,[{key:'deliveryServicesEnabled',value:true}]);
 assert.equal(h.calls.length,0, 'enabling a preference must not create a new application');
 await act(async()=>h.tree.unmount());
});

test('Approved but expired provider is not incorrectly advertised as ready for new jobs',async()=>{
 const expired={...cap('DELIVERY'),verificationExpiresAt:'2020-01-01T00:00:00Z'};
 const h=await render('PartnerDashboardScreen',{
   getPartnerTeam:async()=>({capabilities:[expired,cap('INSPECTION')],stripeConnect:{complete:true}}),
 });
 assert.match(text(h.tree),/Verification required/);
 await click(h.tree,'Review verification');
 assert.equal(h.tree.root.findByType('ProviderBusinessPaymentsSection').props.openRequest,1);
 assert.equal(h.nav.length,0);
 await act(async()=>h.tree.unmount());
});
