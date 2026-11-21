import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function compile(path, modules = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, Set, process: { env: {} } }); return exports;
}
const rules = compile('lib/dealerPurchaseRecords.ts');
test('collected retail status is preserved and pending agreed sales stay in progress', () => {
  assert.equal(rules.normalisePurchaseStatus({status:'CHECKS_COMPLETE',retailSold:true}), 'CHECKS_COMPLETE');
  assert.equal(rules.normalisePurchaseStatus({status:'AWAITING_CONFIRMATION',retailSold:true}), 'SOLD');
  assert.equal(rules.normalisePurchaseStatus({status:'AWAITING_CONFIRMATION',offerAccepted:true}), 'SALE_CONFIRMED');
  assert.equal(rules.normalisePurchaseStatus({status:'DELIVERY_REQUESTED',retailSold:true}), 'DELIVERY_REQUESTED');
});
test('unrecorded prices are explicit and PDF paths retain authenticated record type', () => {
  const [row] = rules.mapReconciledPurchases([{id:'r',purchasePrice:null,imageUrl:null}]);
  assert.equal(row.purchasePriceUnrecorded,true);
  assert.equal(row.status,'CHECKS_COMPLETE');
  assert.equal(row.reconciledPurchase,true);
  assert.throws(()=>rules.mapReconciledPurchases(undefined));
  assert.equal(rules.purchaseReceiptPath('a/b',true),'/dealers/purchases/reconciled/a%2Fb/receipt.pdf');
  assert.equal(rules.purchaseReceiptPath('regular'),'/dealers/purchases/regular/receipt.pdf');
});
async function harness(failRecovered = false) {
  const nav = [], calls=[];
  const normal = Array.from({length:10},(_,i)=>({id:`sale-${i}`,listingId:`car-${i}`,vehicleTitle:`Car ${i}`,purchaseDate:'2026-11-01',purchasePrice:1000,retailSold:true,status:'CHECKS_COMPLETE',purchaseChannel:'RETAIL',buyerCollectedAt:i===0?'2026-11-02':null}));
  const recovered = [1,2].map(i=>({id:`recovered-${i}`,listingId:`old-${i}`,vehicleTitle:`Older car ${i}`,purchaseDate:'2026-09-01',purchasePrice:null,originalListedAt:'2026-08-20',sellerName:'Original seller',purchaseChannel:'RECONCILED',buyerCollectedAt:'2026-09-01',imageUrl:null}));
  const rn=Object.fromEntries(['View','Text','TouchableOpacity','FlatList','ScrollView','StatusBar','RefreshControl','TextInput'].map(x=>[x,x]));
  Object.assign(rn,{Dimensions:{get:()=>({width:600})},StyleSheet:{create:x=>x}});
  const modules={
    react:React,'react-native':rn,'expo-image':{Image:'Image'},'expo-linear-gradient':{LinearGradient:'Gradient'},
    '@/components/BrandIcon':{Ionicons:'Icon'},
    '@react-navigation/native':{useNavigation:()=>({navigate:(...a)=>nav.push(a),setParams:()=>{}}),useRoute:()=>({params:{stage:'completed',channel:'all'}})},
    '../../lib/apiClient':{apiClient:async path=>{calls.push(path); if(path==='/dealers/purchases/reconciled'){if(failRecovered)throw Error('offline'); return {data:recovered};}return {success:true,data:normal,pagination:{totalPages:1}};}},
    '../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Radius:{}},
    '../../lib/saleCancellationApi':{getMySaleCancellations:async()=>[],SALE_CANCELLATION_REASON_LABELS:{}},
    '../../store/authStore':{useAuthStore:s=>s({user:{id:'dealer'}})},'../../hooks/useDealerAccess':{useDealerAccess:()=>({access:{ownerUserId:'dealer'}})},
    '../../lib/dealerPurchaseRecords':rules,
  };
  for(const name of ['WebsiteTopBar','Button'])modules['../../components/'+name]={[name]:name};
  for(const name of ['Skeleton','EmptyState','ErrorBanner'])modules['../../components/ui/'+name]={[name]:name};
  for(const name of ['CompletePurchaseButton','PurchaseReceiptButton'])modules['../../components/purchases/'+name]={[name]:name};
  modules['../../components/dealer/PurchaseDestinations']={PurchaseDestinations:'PurchaseDestinations'};
  const {DealerPurchasesScreen}=compile('screens/main/DealerPurchasesScreen.tsx',modules);
  let tree;await act(async()=>{tree=create(React.createElement(DealerPurchasesScreen));});
  return {tree,nav,calls};
}
test('completed history merges ten regular and two recovered purchases and routes recovered detail natively',async()=>{
  const h=await harness(); const list=h.tree.root.findByType('FlatList');
  assert.equal(list.props.data.length,12);
  assert.equal(list.props.data[0].status,'CHECKS_COMPLETE');
  assert.ok(h.calls.includes('/dealers/purchases/reconciled'));
  let card;await act(async()=>{card=create(list.props.renderItem({item:list.props.data[10]}));});
  const open=card.root.findByType('TouchableOpacity');await act(async()=>open.props.onPress());
  assert.equal(h.nav[0][0],'DealerPurchaseDetail');assert.equal(h.nav[0][1].reconciled,true);
  assert.equal(card.root.findByType('PurchaseReceiptButton').props.reconciled,true);
  assert.ok(card.root.findAllByType('Text').some(n=>n.children.includes('Not recorded')));
  await act(async()=>{h.tree.unmount();card.unmount();});
});
test('recovered history failure keeps regular purchases visible and shows incomplete-data warning',async()=>{
  const h=await harness(true); const list=h.tree.root.findByType('FlatList');assert.equal(list.props.data.length,10);
  let header;await act(async()=>{header=create(list.props.ListHeaderComponent);});
  assert.ok(header.root.findAllByType('Text').some(n=>n.children.join('').includes('This list may be incomplete')));
  assert.ok(header.root.findAllByType('Button').some(n=>n.props.label==='Retry purchases'));
  await act(async()=>{h.tree.unmount();header.unmount();});
});
