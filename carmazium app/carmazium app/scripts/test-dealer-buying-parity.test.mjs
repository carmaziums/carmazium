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
  const exports={};runInNewContext(code,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];},Date,URLSearchParams,setInterval:()=>1,clearInterval:()=>{},process:{env:{}}});return exports;
}
const rn={...Object.fromEntries(['View','Text','FlatList','ActivityIndicator','RefreshControl'].map(n=>[n,n])),StyleSheet:{create:x=>x,absoluteFillObject:{}},Alert:{alert(){}}};
const common={react:React,'react-native':rn,'expo-image':{Image:'Image'},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{}}};
const click=async(tree,label)=>act(async()=>tree.root.findAllByType('Button').find(n=>n.props.label===label).props.onPress());
const position={listingId:'listing1',auctionId:'auction1',myBidId:'bid/1',myHighestBid:6500,currentHighestBid:6500,nextMinimumBid:6550,isLeading:true,bidCount:25,endTime:new Date(Date.now()+3600000).toISOString(),canCancelCurrentBid:true,cancelDeadline:new Date(Date.now()+3600000).toISOString(),listing:{id:'listing1',title:'Toyota Yaris',year:2019,mileage:51875,images:['https://example.test/car.jpg']}};
async function bidHarness(canPlaceBid=true,extra={}){
 const calls=[],alerts=[];let refreshed=0;
 const {ActiveBidCard}=compile('components/dealer/ActiveBidCard.tsx',{...common,'react-native':{...rn,Alert:{alert:(...args)=>alerts.push(args)}},'../Button':{Button:'Button'},'../../lib/apiClient':{apiClient:async(...args)=>calls.push(args)}});
 let tree;await act(async()=>{tree=create(React.createElement(ActiveBidCard,{position:{...position,...extra},canPlaceBid,onRefresh:async()=>{refreshed++;},onOpen(){}}));});return{tree,calls,alerts,refreshed:()=>refreshed};
}
test('active bid card exposes title, bid count and confirmed current-bid cancellation',async()=>{
 const h=await bidHarness();assert.ok(h.tree.root.findAllByType('Text').some(n=>n.children.includes('Toyota Yaris')));
 await click(h.tree,'Cancel Current Bid');assert.equal(h.calls.length,0);assert.equal(h.alerts.length,1);assert.match(h.alerts[0][1],/earlier lower bid/);
 await act(async()=>h.alerts[0][2].find(b=>b.text==='Cancel Current Bid').onPress());assert.equal(h.calls[0][0],'/bids/bid%2F1/cancel');assert.equal(h.calls[0][1].method,'PATCH');assert.equal(h.refreshed(),1);await act(async()=>h.tree.unmount());
});
test('view-only staff and expired windows cannot cancel from the bid card',async()=>{
 const staff=await bidHarness(false);assert.equal(staff.tree.root.findAllByType('Button').some(n=>n.props.label==='Cancel Current Bid'),false);await act(async()=>staff.tree.unmount());
 const expired=await bidHarness(true,{cancelDeadline:'2020-01-01'});assert.equal(expired.tree.root.findAllByType('Button').find(n=>n.props.label==='24h Cancel Window Ended').props.disabled,true);await click(expired.tree,'24h Cancel Window Ended');assert.equal(expired.alerts.length,0);assert.equal(expired.calls.length,0);await act(async()=>expired.tree.unmount());
});
async function savedHarness(){
 const calls=[],nav=[];
 const entries=Array.from({length:3},(_,i)=>({id:`save${i}`,listingId:`car${i}`,listing:{id:`car${i}`,title:`Saved car ${i}`,status:'SOLD',images:[],auction:{id:`auction${i}`,status:'ENDED',startingBid:1000,endTime:'2020-01-01',startTime:'2019-01-01'}}}));
 const {DealerSavedScreen}=compile('screens/main/DealerSavedScreen.tsx',{...common,'@react-navigation/native':{useNavigation:()=>({navigate:(...args)=>nav.push(args)}),useFocusEffect:fn=>React.useEffect(fn,[fn])},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../lib/listingsApi':{getListingById:async()=>({id:'retail'})},'../../lib/apiClient':{apiClient:async(path,options)=>{calls.push([path,options]);return{data:path.startsWith('/watchlist/auctions')?entries:[],pagination:{total:path.startsWith('/watchlist/auctions')?3:0,totalPages:1}};}}});
 let tree;await act(async()=>{tree=create(React.createElement(DealerSavedScreen));});return{tree,calls,nav};
}
test('dealer saved auctions include ended records and opening a record never removes it',async()=>{
 const h=await savedHarness();assert.equal(h.calls[0][0],'/watchlist/auctions?page=1&limit=12&view=all');const list=h.tree.root.findByType('FlatList');assert.equal(list.props.data.length,3);
 let card;await act(async()=>{card=create(list.props.renderItem({item:list.props.data[0]}));});await click(card,'View Auction');assert.equal(h.nav[0][0],'AuctionDeepLink');assert.equal(h.nav[0][1].auctionId,'auction0');assert.equal(h.calls.length,1);await act(async()=>{h.tree.unmount();card.unmount();});
});
test('dealer retail saved tab requests the separate retail feed',async()=>{
 const h=await savedHarness();let header;await act(async()=>{header=create(h.tree.root.findByType('FlatList').props.ListHeaderComponent);});await click(header,'Retail cars');assert.equal(h.calls[1][0],'/watchlist?page=1&limit=12&type=retail');await act(async()=>{h.tree.unmount();header.unmount();});
});
