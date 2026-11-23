import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=t=>t.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
const click=async(t,label)=>act(async()=>{
 const control=t.root.findAllByType('Button').find(n=>n.props.label===label)
  ||t.root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel===label);
 assert.ok(control,'Missing native control: '+label);control.props.onPress();
});
function compile(file,extra={}){
 const rn={...Object.fromEntries(['View','Text','TouchableOpacity','ScrollView','StatusBar','RefreshControl','ActivityIndicator'].map(n=>[n,n])),StyleSheet:{create:x=>x},Alert:{alert(){}},FlatList:({data,renderItem,ListHeaderComponent,ListFooterComponent,ListEmptyComponent})=>React.createElement('List',null,ListHeaderComponent,data.length?data.map(item=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))):ListEmptyComponent,ListFooterComponent)};
 const modules={react:React,'react-native':rn,'@react-navigation/native':{useNavigation:()=>({navigate(){}}),useFocusEffect:cb=>React.useEffect(cb,[cb])},'expo-image':{Image:'Image'},'expo-linear-gradient':{LinearGradient:'Gradient'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'@/components/BrandIcon':{Ionicons:'Icon'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Radius:{},Elevation:{}},'../../constants/layout':{Layout:{}},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../components/ImportListingModal':{ImportListingModal:'ImportModal'},'../../components/ui/ErrorBanner':{ErrorBanner:'ErrorBanner'},'../../lib/listingsApi':{},'../../lib/supabase':{},'expo-file-system/legacy':{},'expo-sharing':{},'../../components/purchases/CompletePurchaseButton':{CompletePurchaseButton:'CompletePurchase'},'../../components/purchases/BuyerCollectedButton':{BuyerCollectedButton:'CollectVehicle'},...extra};const exports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];},process:{env:{}}});return exports;
}
test('My Cars shows ten-page slices, missing statuses and explicit native edit/sale controls',async()=>{
 const nav=[];const {MyCarsScreen}=compile('screens/account/MyCarsScreen.tsx',{'@react-navigation/native':{useNavigation:()=>({navigate:(...a)=>nav.push(a)}),useFocusEffect:cb=>React.useEffect(cb,[cb])},'../../lib/myListingsApi':{fetchAllMyListings:async()=>Array.from({length:48},(_,i)=>({id:String(i),title:'Vehicle '+i,price:11000,status:i===47?'WITHDRAWN':'ACTIVE',images:[]}))},'../../lib/myAuctionsApi':{fetchAllMyAuctions:async()=>[]}});let t;await act(async()=>{t=create(React.createElement(MyCarsScreen));});assert.match(text(t),/Page 1 of 5/);assert.match(text(t),/£11,000.00/);
 const thumbnails=t.root.findAllByType('View').filter(n=>n.props.style?.width===80&&n.props.style?.height===64);
 assert.equal(thumbnails.length,10,'mobile cards must use website-sized 80×64 thumbnails');
 const actionRows=t.root.findAllByType('View').filter(n=>n.props.style?.flexDirection==='row'&&n.props.style?.alignItems==='stretch');
 assert.ok(actionRows.length>=10,'all ten cards need paired primary actions');assert.doesNotMatch(text(t),/Vehicle 10/);await click(t,'Mark Sold');assert.equal(nav[0][1].focusAction,'mark_sold');await click(t,'Edit listing');assert.equal(nav[1][0],'SellCarFlow');await click(t,'Next');assert.match(text(t),/Vehicle 10/);await click(t,'withdrawn');assert.match(text(t),/Vehicle 47/);assert.equal(t.root.findAllByType('TouchableOpacity').filter(n=>n.props.accessibilityLabel==='Mark Sold').length,0);await act(async()=>t.unmount());
});
test('Purchases shows recorded collections, real accepted state and only purchase-related receipts',async()=>{
 const calls=[];const {BuyerPurchaseHistoryScreen}=compile('screens/buyer/BuyerPurchaseHistoryScreen.tsx',{'../../lib/apiClient':{apiClient:async p=>{calls.push(p);if(p.startsWith('/transactions'))return{success:true,data:[{id:'fee',type:'LISTING_FEE',amount:1,status:'COMPLETED'},{id:'receipt',listingId:'vehicle',type:'COMMISSION',amount:125,status:'COMPLETED',createdAt:'2026-11-20',listing:{title:'Auction fee'}}],pagination:{totalPages:1}};if(p==='/offers/my')return{success:true,data:[{id:'completed',status:'ACCEPTED',amount:7500,listing:{id:'sold',title:'Completed car',status:'SOLD'}},{id:'waiting',listingId:'accepted',status:'ACCEPTED',amount:4000,listing:{id:'accepted',title:'Waiting car',status:'OFFER_ACCEPTED'}}]};return{data:[{id:'collected',title:'Collected car',price:7500,purchasedAt:'2026-11-01',purchaseStatus:'CHECKS_COMPLETE',buyerCollectedAt:'2026-11-04',canConfirmCollection:false},{id:'ready',title:'Ready car',price:884,purchasedAt:'2026-11-20',purchaseStatus:'READY',buyerCollectedAt:null,canConfirmCollection:true}]};}}});let t;await act(async()=>{t=create(React.createElement(BuyerPurchaseHistoryScreen,{navigation:{navigate(){}}}));});assert.ok(calls.includes('/listings/my-purchase-sales'));assert.match(text(t),/Purchase completed/);assert.match(text(t),/Collected · 04\/11\/2026/);assert.match(text(t),/Recorded vehicle purchases \(2\)/);assert.equal(t.root.findAllByType('CompletePurchase').length,1);assert.equal(t.root.findByType('CollectVehicle').props.saleId,'ready');assert.match(text(t),/Receipts and payments \(1\)/);await act(async()=>t.unmount());
});
test('Collection writes only after explicit confirmation and ignores duplicate submits',async()=>{
 let alert,finish;const writes=[];const {BuyerCollectedButton}=compile('components/purchases/BuyerCollectedButton.tsx',{'../Button':{Button:'Button'},'react-native':{View:'View',Text:'Text',Alert:{alert:(...args)=>{alert=args;}}},'../../lib/apiClient':{apiClient:(path,options)=>{writes.push([path,options]);return new Promise(resolve=>finish=resolve);}}});let t;await act(async()=>{t=create(React.createElement(BuyerCollectedButton,{saleId:'safe/id'}));});await click(t,"I've collected this car");assert.equal(writes.length,0);assert.match(alert[1],/physically received/);const confirm=alert[2].find(b=>b.text==='Confirm collected');await act(async()=>{confirm.onPress();confirm.onPress();});assert.equal(writes.length,1);assert.equal(writes[0][0],'/listings/purchase-sales/safe%2Fid/confirm-collection');await act(async()=>finish({}));assert.match(text(t),/Collection recorded/);await act(async()=>t.unmount());
});


test('dealer completed purchase rows follow website stage groups and preserve receipt actions', () => {
 const source=readFileSync(new URL('../src/screens/main/DealerPurchasesScreen.tsx',import.meta.url),'utf8');
 for(const required of [
  'const groupedVisible = useMemo',
  'if (!isHistory) return visible',
  'HISTORY_STATUSES.indexOf(a.status)',
  'historyGroupCounts = useMemo',
  'startsGroup = isHistory &&',
  'styles.statusSectionHeader',
  'styles.statusSectionCount',
  'data={groupedVisible}',
  'PurchaseReceiptButton saleId={item.id}',
  "navigation.navigate('DealerPurchaseDetail'",
 ]) assert.ok(source.includes(required),required);
});
