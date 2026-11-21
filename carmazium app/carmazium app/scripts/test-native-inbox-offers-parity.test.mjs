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
  const exports={};runInNewContext(code,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];},Date,URLSearchParams,setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,process:{env:{}}});return exports;
}
const rn={...Object.fromEntries(['View','Text','FlatList','ActivityIndicator','RefreshControl','TextInput','ScrollView','StatusBar','TouchableOpacity'].map(n=>[n,n])),Dimensions:{get:()=>({width:600})},StyleSheet:{create:x=>x,absoluteFillObject:{}},Alert:{alert(){}}};
const base={react:React,'expo-image':{Image:'Image'},'../../components/Logo':{Logo:'Logo'},'react-native':rn,'@/components/BrandIcon':{Ionicons:'Icon'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'expo-linear-gradient':{LinearGradient:'LinearGradient'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Radius:{},Elevation:{}},'../../lib/haptics':{haptics:{success(){}}}};
for(const name of ['WebsiteTopBar','IconButton','BottomSheet','SaleCancellationSheet'])base['../../components/'+name]={[name]:name};
for(const name of ['Skeleton','EmptyState','ErrorBanner'])base['../../components/ui/'+name]={[name]:name};
base['../../components/dealer/DealerPageTabs']={DealerPageTabs:'DealerPageTabs'};
const texts=tree=>tree.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
const pressText=async(tree,label)=>act(async()=>tree.root.findAllByType('TouchableOpacity').find(n=>n.findAllByType('Text').some(t=>t.children.join('').includes(label))).props.onPress());
test('inbox exposes unread and support filters without marking or sending messages',async()=>{
 let marked=0;const rooms=[{id:'support',context:'SUPPORT',otherUser:{firstName:'Support'},listing:null,unreadCount:0},{id:'read',context:'RETAIL',otherUser:{firstName:'Buyer'},listing:{title:'Car'},unreadCount:0},{id:'unread',context:'AUCTION',otherUser:{firstName:'Bidder'},listing:{title:'Auction'},unreadCount:2}];
 const refreshRooms=async()=>{};
 const {MessagesScreen}=compile('screens/main/MessagesScreen.tsx',{...base,'@react-navigation/native':{useNavigation:()=>({navigate(){}}),useFocusEffect:fn=>React.useEffect(fn,[fn])},'../../store/authStore':{useAuthStore:s=>s({accountRole:'dealer'})},'../../context/ChatContext':{useChat:()=>({rooms,unreadCount:2,markAsRead:()=>marked++,refreshRooms,isLoading:false,onlineUserIds:new Set()})}});
 let tree,header;await act(async()=>{tree=create(React.createElement(MessagesScreen));});await act(async()=>{header=create(tree.root.findByType('FlatList').props.ListHeaderComponent);});await pressText(header,'Unread');assert.equal(tree.root.findByType('FlatList').props.data[0].id,'unread');assert.equal(tree.root.findByType('FlatList').props.data.length,1);
 await pressText(header,'CarMazium support');assert.equal(tree.root.findByType('FlatList').props.data[0].id,'support');assert.equal(marked,0);await act(async()=>{tree.unmount();header.unmount();});
});
async function offers(status='WITHDRAWN',fail=false){
 const calls=[];const record={id:'offer',status,amount:7900,finalAmount:8000,listingId:'listing',listing:{id:'listing',title:'Toyota Aygo',price:11000,status:'ACTIVE'},buyer:{id:'buyer',firstName:'Buyer',email:'buyer@example.test'}};
 const {DealerOffersScreen}=compile('screens/main/DealerOffersScreen.tsx',{...base,'@react-navigation/native':{useNavigation:()=>({navigate(){}}),useFocusEffect:fn=>React.useEffect(fn,[fn])},'../../components/offers/CounterLedger':{CounterLedger:'CounterLedger'},'../../components/delivery/ReceivedDeliveryRequestsPanel':{ReceivedDeliveryRequestsPanel:'ReceivedDeliveryRequestsPanel'},'../../lib/apiClient':{apiClient:async(path,options)=>{calls.push([path,options]);if(fail)throw Error('offline');return{success:true,data:[record]};}}});
 let tree,card;await act(async()=>{tree=create(React.createElement(DealerOffersScreen));});if(!fail)await act(async()=>{card=create(tree.root.findByType('FlatList').props.renderItem({item:record}));});return{tree,card,calls};
}
test('withdrawn offers retain the authoritative status and offer no pending actions',async()=>{
 const h=await offers();assert.match(texts(h.card),/WITHDRAWN/);assert.doesNotMatch(texts(h.card),/PENDING|Accept|Reject|Mark as Sold/);await act(async()=>{h.tree.unmount();h.card.unmount();});
});
test('failed received-offer request shows retry instead of an empty success',async()=>{
 const h=await offers('PENDING',true);assert.equal(h.tree.root.findAllByType('FlatList').length,0);assert.ok(h.tree.root.findByType('ErrorBanner').props.onRetry);await act(async()=>h.tree.unmount());
});
test('recording an accepted offer uses final amount and validates optional buyer postcode',async()=>{
 const h=await offers('ACCEPTED');await pressText(h.card,'Mark as Sold');const inputs=h.tree.root.findAllByType('TextInput');const price=inputs.find(n=>n.props.placeholder==='Enter sale price');assert.equal(price.props.value,'8000');
 let postcode=h.tree.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel==='Buyer postcode (optional)');await act(async()=>postcode.props.onChangeText('invalid'));await pressText(h.tree,'Confirm Sold');assert.equal(h.calls.filter(([,options])=>options?.method==='PATCH').length,0);
 postcode=h.tree.root.findAllByType('TextInput').find(n=>n.props.accessibilityLabel==='Buyer postcode (optional)');await act(async()=>postcode.props.onChangeText('B19 1ES'));await pressText(h.tree,'Confirm Sold');const write=h.calls.find(([,options])=>options?.method==='PATCH');assert.equal(write[0],'/listings/listing/sold');assert.equal(JSON.parse(write[1].body).buyerPostcode,'B19 1ES');assert.equal(JSON.parse(write[1].body).soldPrice,8000);await act(async()=>{h.tree.unmount();h.card.unmount();});
});
