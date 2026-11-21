import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function compile(path,modules={}){
  const code=ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};runInNewContext(code,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];},Date,URLSearchParams,process:{env:{}}});return exports;
}
const receipts=compile('lib/paymentReceipts.ts');
const csv=compile('lib/csvExport.ts');
const rn={...Object.fromEntries(['View','Text','ScrollView','TextInput','ActivityIndicator','Image','RefreshControl','Switch','TouchableOpacity'].map(n=>[n,n])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:600,fontScale:1}),Alert:{alert(){}}};
const base={react:React,'react-native':rn,'@react-navigation/native':{useFocusEffect:fn=>React.useEffect(fn,[fn])},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}}};
for(const n of ['WebsiteTopBar','Button'])base['../../components/'+n]={[n]:n};
base['../../components/dealer/DealerPageTabs']={DealerPageTabs:'DealerPageTabs'};
const textOf=tree=>tree.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
const click=async(tree,label)=>act(async()=>tree.root.findAllByType('Button').find(n=>n.props.label===label).props.onPress());
test('canonical KYC fee is not duplicated; legacy receipt remains visible but cannot download',()=>{
  const kyc={stripeChargedAt:'2026-01-01',stripePaymentIntentId:'pi_same'};
  const tx={id:'real',type:'KYC_VERIFICATION',stripePaymentId:'pi_same',amount:1,createdAt:'2026-01-01',status:'COMPLETED'};
  assert.equal(receipts.mergePaymentReceipts([tx],kyc).length,1);
  const legacy=receipts.mergePaymentReceipts([],kyc);assert.equal(legacy.length,1);assert.equal(legacy[0].synthetic,true);
  assert.throws(()=>receipts.paymentReceiptPath(legacy[0]));
  assert.equal(receipts.paymentReceiptPath({...tx,id:'a/b'}),'/transactions/a%2Fb/receipt.pdf');
});
async function earnings(fail=false){
  const writes=[];
  const sales=[{id:'sale1',createdAt:'2026-01-01',listing:{title:'First car',vrm:'AA11AAA'},buyerName:'=FORMULA()',listedPrice:800.25,soldPrice:701.05},{id:'sale2',createdAt:'2026-01-02',listing:{title:'Second car',vrm:'BB22BBB'},soldPrice:1000,listedPrice:1000}];
  const auctionSales=Array.from({length:7},(_,i)=>({id:`a${i}`,listing:{title:`Auction vehicle ${i}`},winningBidAmount:3000,sellerBonus:100}));
  const {DealerEarningsScreen}=compile('screens/main/DealerEarningsScreen.tsx',{...base,'react-native-svg':{default:'Svg',Path:'Path',__esModule:true},'@/components/BrandIcon':{Ionicons:'Icon'},'expo-file-system/legacy':{cacheDirectory:'/cache/',EncodingType:{UTF8:'utf8'},writeAsStringAsync:async(path,value)=>writes.push(value)},'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async()=>{}},'../../lib/apiClient':{apiClient:async()=>{if(fail)throw Error('offline');return {success:true,data:{sales,auctionSales,totalRevenue:1701.05,totalSales:2,totalAuctionBonus:700,totalAuctionSales:7}};}},'../../lib/csvExport':csv,'../../components/payments/PaymentReceipts':{PaymentReceipts:'PaymentReceipts'}});
  let tree;await act(async()=>{tree=create(React.createElement(DealerEarningsScreen));});return{tree,writes};
}
test('earnings shows every verified auction, all four metrics and native receipt tab',async()=>{
  const {tree}=await earnings();assert.match(textOf(tree),/Average Sale Price/);assert.match(textOf(tree),/Auction Bonuses Earned/);
  await click(tree,'Auction Sales (7)');assert.equal(tree.root.findAllByType('Text').filter(n=>n.children[0]?.startsWith?.('Auction vehicle')).length,7);
  await click(tree,'Receipts');assert.equal(tree.root.findByType('PaymentReceipts').props.isDealer,true);
  await act(async()=>tree.unmount());
});
test('sales CSV matches filtered records, preserves pennies and neutralises spreadsheet formulas',async()=>{
  const {tree,writes}=await earnings();await act(async()=>tree.root.findByType('TextInput').props.onChangeText('AA11AAA'));await click(tree,'Export sales CSV');
  assert.equal(writes.length,1);assert.match(writes[0],/701.05/);assert.match(writes[0],/"'=FORMULA\(\)"/);assert.doesNotMatch(writes[0],/Second car/);
  await act(async()=>tree.unmount());
});
test('failed earnings load shows an error, blocks export and does not assert no sales',async()=>{
  const {tree}=await earnings(true);assert.match(textOf(tree),/could not be loaded/);assert.doesNotMatch(textOf(tree),/No sales yet/);assert.equal(tree.root.findAllByType('Button').find(n=>n.props.label==='Export sales CSV').props.disabled,true);await act(async()=>tree.unmount());
});
test('finance failure ends loading and offers retry before showing the authoritative preference',async()=>{
  let fail=true,calls=0;
  const {DealerFinanceScreen}=compile('screens/main/DealerFinanceScreen.tsx',{...base,'../../lib/apiClient':{apiClient:async()=>{calls++;if(fail)throw Error('offline');return{data:{enabled:true}};}}});
  let tree;await act(async()=>{tree=create(React.createElement(DealerFinanceScreen));});assert.equal(tree.root.findAllByType('ActivityIndicator').length,0);assert.equal(tree.root.findAllByType('Switch').length,0);assert.match(textOf(tree),/Could not load/);
  fail=false;await click(tree,'Try again');assert.equal(tree.root.findByType('Switch').props.value,true);assert.equal(calls,2);await act(async()=>tree.unmount());
});

test('payment PDF uses authenticated transaction endpoint and failed download is not shared',async()=>{
  const calls=[],shared=[],deleted=[];
  let status=200;
  const tx={id:'tx/1',type:'LISTING_FEE',amount:1,status:'COMPLETED',createdAt:'2026-01-01'};
  const {PaymentReceipts}=compile('components/payments/PaymentReceipts.tsx',{...base,'../Button':{Button:'Button'},'../../lib/paymentReceipts':receipts,'../../lib/apiClient':{apiClient:async()=>({data:[tx]})},'../../lib/supabase':{getAccessToken:async()=>'session-test-token'},'expo-file-system/legacy':{cacheDirectory:'/cache/',downloadAsync:async(...args)=>{calls.push(args);return{status,uri:'/cache/receipt.pdf'};},deleteAsync:async uri=>deleted.push(uri)},'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async uri=>shared.push(uri)}});
  let tree;await act(async()=>{tree=create(React.createElement(PaymentReceipts));});await click(tree,'Download PDF');
  assert.ok(calls[0][0].endsWith('/transactions/tx%2F1/receipt.pdf'));assert.equal(calls[0][2].headers.Authorization,'Bearer session-test-token');assert.equal(shared.length,1);
  status=403;await click(tree,'Download PDF');assert.equal(shared.length,1);assert.equal(deleted.length,1);assert.match(textOf(tree),/Could not download/);await act(async()=>tree.unmount());
});
test('Team exposes business approval and payout state even before any staff are added',async()=>{
  const {DealerTeamScreen}=compile('screens/main/DealerTeamScreen.tsx',{...base,'react-native':{...rn,Dimensions:{get:()=>({width:600})},FlatList:'FlatList',StatusBar:'StatusBar'},'@/components/BrandIcon':{Ionicons:'Icon'},'expo-linear-gradient':{LinearGradient:'LinearGradient'},'../../constants/spacing':{Radius:{}},'../../components/PrimaryCTA':{PrimaryCTA:'PrimaryCTA'},'../../components/BottomSheet':{BottomSheet:'BottomSheet'},'../../components/ui/Skeleton':{Skeleton:'Skeleton'},'../../components/ui/EmptyState':{EmptyState:'EmptyState'},'../../lib/apiClient':{apiClient:async()=>({success:true,data:{active:[],pending:[]}})},'../../lib/servicesApi':{getPartnerTeam:async()=>({companyName:'Test dealer',permissions:[],capabilities:[{serviceType:'DELIVERY',status:'APPROVED'},{serviceType:'INSPECTION',status:'PENDING'}],stripeConnect:{complete:true},payoutPolicy:'Business payout policy'}),applyPartnerCapability:async()=>{throw Error('Must not submit on render');},updatePartnerTeamPermissions:async()=>{throw Error('Must not save on render');}}});
  let tree,header;await act(async()=>{tree=create(React.createElement(DealerTeamScreen));});await act(async()=>{header=create(tree.root.findByType('FlatList').props.ListHeaderComponent);});
  assert.match(textOf(header),/Ready for payouts/);assert.match(textOf(header),/APPROVED/);assert.match(textOf(header),/PENDING/);assert.equal(header.root.findAllByType('Button').filter(n=>n.props.label==='Apply for approval').length,0);
  await act(async()=>{tree.unmount();header.unmount();});
});

const analyticsRules=compile('lib/dealerAnalytics.ts');
const rangeRules=compile('lib/analyticsDateRange.ts');
function report(stock=48){return {kpis:{totalRevenue:0,totalRevenueTrend:0,totalUnitsSold:0,totalUnitsSoldTrend:0,avgSoldPrice:0,avgDaysToSell:0,avgDaysToSellTrend:0,offerConversionRate:0,offerConversionRateTrend:0,leadConversionRate:0,leadConversionRateTrend:0,avgViewsPerListing:1,avgViewsPerListingTrend:100,stockValue:479600,marginVsListed:0},revenueTrend:[],leadFunnel:{NEW:0,CONTACTED:1,QUALIFIED:0,NEGOTIATING:0,WON:0,LOST:0},offerBreakdown:{PENDING:0,ACCEPTED:0,COUNTERED:0,REJECTED:0,WITHDRAWN:0,avgAcceptedAmount:0,avgTimeToRespond:0},inventoryHealth:{ACTIVE:stock,DRAFT:0,OFFER_ACCEPTED:0,SOLD:0,WITHDRAWN:0,staleCount:17,avgAge:46,agingBuckets:{'0-7d':0,'8-30d':13,'31-60d':18,'60d+':17}},topVehicles:Array.from({length:10},(_,i)=>({id:`v${i}`,title:`Top car ${i}`,views:100,offerCount:0,price:10000,status:'ACTIVE',daysListed:30})),topSellingModels:[],fastMovers:[],slowMovers:[{make:'Toyota',model:'Aygo',count:1,avgDays:192}],leadSourceBreakdown:[{source:'CHAT',count:1}],salesByType:{AUCTION:{units:0,revenue:0},CLASSIFIED:{units:0,revenue:0}},customersByArea:[],salespersonPerformance:[]};}
async function analyticsHarness(api){
 const {DealerAnalyticsScreen}=compile('screens/main/DealerAnalyticsScreen.tsx',{...base,'lucide-react-native':Object.fromEntries(['DollarSign','TrendingUp','TrendingDown','Minus','Tag','Clock','Car','BarChart3','Percent','Users','Eye','MapPin'].map(n=>[n,n])),'react-native-gifted-charts':{LineChart:'LineChart'},'expo-file-system/legacy':{},'expo-sharing':{},'../../lib/apiClient':{apiClient:api},'../../lib/csvExport':csv,'../../lib/analyticsDateRange':rangeRules,'../../lib/dealerAnalytics':analyticsRules});
 let tree;await act(async()=>{tree=create(React.createElement(DealerAnalyticsScreen));});return tree;
}
test('zero-sale analytics still renders inventory, leads and all ten top vehicles',async()=>{
 const tree=await analyticsHarness(async()=>({data:report()}));assert.match(textOf(tree),/48/);assert.match(textOf(tree),/£479.6k/);assert.match(textOf(tree),/Slow Movers/);assert.match(textOf(tree),/Toyota Aygo/);assert.equal(tree.root.findAllByType('Text').filter(n=>n.children.join('').includes('Top car ')).length,10);assert.doesNotMatch(textOf(tree),/No analytics data yet/);await act(async()=>tree.unmount());
});
test('invalid analytics date ranges clear the prior report and prevent fetching or exporting',async()=>{
 const calls=[];const tree=await analyticsHarness(async path=>{calls.push(path);return {data:report()};});await click(tree,'Custom');assert.match(textOf(tree),/Choose both/);assert.equal(calls.length,1);
 const inputs=tree.root.findAllByType('TextInput');await act(async()=>{inputs[0].props.onChangeText('2026-11-20');inputs[1].props.onChangeText('2026-11-01');});assert.match(textOf(tree),/end date must/);assert.equal(calls.length,1);assert.equal(tree.root.findAllByType('Button').find(n=>n.props.label==='Export Report').props.disabled,true);
 await act(async()=>tree.root.findAllByType('TextInput')[1].props.onChangeText('2026-11-21'));assert.equal(calls.length,2);assert.match(calls[1],/from=2026-11-20&to=2026-11-21/);await act(async()=>tree.unmount());
});
test('late analytics responses cannot overwrite the selected reporting period',async()=>{
 let finishOld;const tree=await analyticsHarness(path=>path.includes('30d')?new Promise(resolve=>{finishOld=resolve;}):Promise.resolve({data:report(7)}));await click(tree,'Last 7 days');assert.match(textOf(tree),/7/);
 await act(async()=>finishOld({data:report(987)}));assert.doesNotMatch(textOf(tree),/987/);await act(async()=>tree.unmount());
});
