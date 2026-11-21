import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
async function screen(api) {
  const alerts=[];
  const modules={
    react:React,
    'react-native':{View:'View',Text:'Text',TouchableOpacity:'Press',ScrollView:'Scroll',StatusBar:'Status',RefreshControl:'Refresh',TextInput:'Input',ActivityIndicator:'Spinner',
      Alert:{alert:(...args)=>alerts.push(args)},StyleSheet:{create:x=>x},
      FlatList:({data,renderItem,ListHeaderComponent,ListFooterComponent})=>React.createElement('List',null,ListHeaderComponent,...data.map((item,index)=>renderItem({item,index})),ListFooterComponent)},
    '@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
    'expo-linear-gradient':{LinearGradient:'Gradient'},'@/components/BrandIcon':{Ionicons:'Icon'},
    'expo-image':{Image:'Image'},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../lib/myListingsApi':{fetchAllMyListings:async()=>[]},
    '../../lib/apiClient':{apiClient:api},'../../lib/haptics':{haptics:{success:()=>{}}},
    '../../components/BottomSheet':{BottomSheet:({visible,children,...props})=>visible?React.createElement('Sheet',props,children):null},
    '../../components/ui/ErrorBanner':{ErrorBanner:'Error'},'../../components/ui/Skeleton':{Skeleton:'Skeleton'},'../../components/ui/EmptyState':{EmptyState:'Empty'},
    '../../components/offers/CounterLedger':{CounterLedger:'Ledger'},'../../components/delivery/ReceivedDeliveryRequestsPanel':{ReceivedDeliveryRequestsPanel:'Delivery'},
    '../../components/SaleCancellationSheet':{SaleCancellationSheet:'CancelSale'},'../../components/IconButton':{IconButton:'IconButton'},'../../components/HamburgerButton':{HamburgerButton:'Hamburger'},
    '../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Elevation:{},Radius:{}},
  };
  const source=readFileSync(new URL('../src/screens/seller/SellerOffersScreen.tsx',import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}});
  const exports={};runInNewContext(compiled.outputText,{exports,setTimeout:()=>0,require:n=>{assert.ok(n in modules,n);return modules[n];}});
  let tree;await act(async()=>{tree=create(React.createElement(exports.SellerOffersScreen,{navigation:{}}));});
  const expand=async()=>{const group=tree.root.findAllByType('Press').find(n=>n.props.accessibilityLabel?.startsWith('Offers for ')&&!n.props.accessibilityState?.expanded);if(group)await act(async()=>group.props.onPress());};
  await expand();
  const text=()=>tree.root.findAllByType('Text').flatMap(n=>n.children).filter(x=>typeof x==='string');
  const press=label=>tree.root.findAllByType('Press').find(p=>p.findAllByType('Text').some(t=>t.children.includes(label)));
  return {tree,alerts,text,press,expand};
}
const fixture=()=>({id:'offer-1',amount:'7000',status:'PENDING',buyerId:'buyer-1',buyer:{firstName:'Synthetic',lastName:'Buyer'},listingId:'listing-1',listing:{id:'listing-1',title:'Synthetic vehicle',status:'ACTIVE',price:'7500'}});
test('accepting an offer retains sale controls; sold listings prevent duplicate sale',async()=>{
  let offer=fixture();const calls=[];
  const s=await screen(async(path,options)=>{
    calls.push(path);
    if(path==='/offers/received')return{success:true,data:[offer]};
    if(path==='/offers/pending-count')return{success:true,data:{count:offer.status==='PENDING'?1:0}};
    if(path==='/offers/offer-1/respond'){assert.equal(JSON.parse(options.body).status,'ACCEPTED');offer={...offer,status:'ACCEPTED',finalAmount:'7000',listing:{...offer.listing,status:'OFFER_ACCEPTED'}};return{success:true};}
    if(path==='/listings/listing-1/sold'){assert.equal(JSON.parse(options.body).soldPrice,7000);offer={...offer,listing:{...offer.listing,status:'SOLD'}};return{success:true};}
    throw Error('Unexpected '+path);
  });
  assert.ok(s.text().includes('£7,000'));
  await act(async()=>s.press('Accept').props.onPress());
  await act(async()=>s.alerts.at(-1)[2].find(b=>b.text==='Accept').onPress());
  assert.ok(s.text().includes('ACCEPTED'));
  assert.ok(s.press('Mark as Sold'));
  await act(async()=>s.press('Mark as Sold').props.onPress());
  assert.equal(s.tree.root.findByType('Input').props.value,'7000');
  const confirm=s.press('Confirm Sold');
  assert.ok(confirm,'sale confirmation control');
  await act(async()=>confirm.props.onPress());
  assert.ok(s.text().includes('Vehicle already sold'));
  assert.equal(s.press('Mark as Sold'),undefined);
  assert.ok(!calls.includes('/dashboard/seller'));
  await act(async()=>s.tree.unmount());
});
test('string decimal offer uses numeric counter arithmetic',async()=>{
  const s=await screen(async path=>path==='/offers/received'?{success:true,data:[fixture()]}:{success:true,data:{count:1}});
  await act(async()=>s.press('Counter').props.onPress());
  assert.equal(s.tree.root.findByType('Input').props.value,'9500');
  await act(async()=>s.tree.unmount());
});
test('failed offer request shows retry instead of a false empty inbox',async()=>{
  let fail=true;const s=await screen(async path=>{if(path==='/offers/received'){if(fail)throw Error('offline');return{success:true,data:[{...fixture(),status:'ACCEPTED'}]};}return{success:true,data:{count:0}};});
  assert.equal(s.tree.root.findAllByType('Empty').length,0);
  assert.match(s.tree.root.findByType('Error').props.message,/Could not load received offers/);
  fail=false;await act(async()=>s.tree.root.findByType('Error').props.onRetry());
  assert.equal(s.tree.root.findAllByType('Error').length,0);
  await s.expand();
  assert.ok(s.press('Mark as Sold'));
  await act(async()=>s.tree.unmount());
});
