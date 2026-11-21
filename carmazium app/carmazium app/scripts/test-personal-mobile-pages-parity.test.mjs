import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const rn={...Object.fromEntries(['View','Text','ScrollView','TouchableOpacity','ActivityIndicator','RefreshControl','StatusBar'].map(n=>[n,n])),StyleSheet:{create:x=>x},Platform:{OS:'android'},useWindowDimensions:()=>({width:600,fontScale:1}),Dimensions:{get:()=>({width:600})},Alert:{alert(){}}};
function compile(file,extra){const modules={react:React,'react-native':rn,'@react-navigation/native':{useFocusEffect:cb=>React.useEffect(cb,[cb])},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:24})},'../../constants/colors':{Colors:{}},'../../constants/typography':{FontFamily:{},FontSize:{}},'../../constants/spacing':{Elevation:{},Radius:{}},'../../components/WebsiteTopBar':{WebsiteTopBar:'WebsiteTopBar'},'../../components/Button':{Button:'Button'},'../../components/ui/ErrorBanner':{ErrorBanner:'ErrorBanner'},'../../components/ui/Skeleton':{Skeleton:'Skeleton'},'../../components/ui/EmptyState':{EmptyState:'EmptyState'},'@/components/BrandIcon':{Ionicons:'Icon'},'expo-linear-gradient':{LinearGradient:'Gradient'},'expo-image':{Image:'Image'},'expo-file-system/legacy':{},'expo-sharing':{},'../../lib/supabase':{},...extra};const exports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in modules,n);return modules[n];},Date,process:{env:{}}});return exports;}
const words=t=>t.root.findAllByType('Text').map(n=>n.children.join('')).join('|');
const performance={totalListings:48,conversionRate:0,avgResponseHours:97.2,sellerRating:null,totalReviews:0,recentListingViews:Array.from({length:12},(_,i)=>({id:String(i),title:'Car '+i,views:i}))};
test('Personal performance uses response time and rating, and all 12 recent vehicle bars',async()=>{
 const paths=[];const {SellerPerformanceScreen}=compile('screens/seller/SellerPerformanceScreen.tsx',{'../../lib/apiClient':{apiClient:async p=>{paths.push(p);return{data:performance};}}});let t;await act(async()=>{t=create(React.createElement(SellerPerformanceScreen));});assert.deepEqual(paths,['/listings/performance?scope=personal']);assert.match(words(t),/97.2h/);assert.match(words(t),/No reviews/);assert.match(words(t),/Car 11/);assert.doesNotMatch(words(t),/VIEWS OVER TIME|TOTAL REVENUE/);await act(async()=>t.unmount());
});
test('Personal performance rejects malformed and failed reads without false no-data metrics',async()=>{
 for(const result of [{data:{}},null]){const {SellerPerformanceScreen}=compile('screens/seller/SellerPerformanceScreen.tsx',{'../../lib/apiClient':{apiClient:async()=>{if(!result)throw Error('offline');return result;}}});let t;await act(async()=>{t=create(React.createElement(SellerPerformanceScreen));});assert.equal(t.root.findAllByType('ErrorBanner').length,1);assert.doesNotMatch(words(t),/No listing data available|No reviews|0%/);await act(async()=>t.unmount());}
});
test('Personal earnings preserves pennies, average sale and native receipts; failure hides zero totals',async()=>{
 for(const fail of [false,true]){const nav=[],paths=[];const {EarningsScreen}=compile('screens/seller/EarningsScreen.tsx',{'../../lib/apiClient':{apiClient:async p=>{paths.push(p);if(fail)throw Error('offline');return{success:true,data:{sales:[],totalRevenue:701.05,totalSales:1,auctionSales:[]}};}}});let t;await act(async()=>{t=create(React.createElement(EarningsScreen,{navigation:{navigate:p=>nav.push(p)}}));});assert.equal(paths[0],'/listings/earnings?scope=personal');if(fail){assert.equal(t.root.findAllByType('ErrorBanner').length,1);assert.doesNotMatch(words(t),/£0.00|TOTAL REVENUE/);}else{assert.match(words(t),/Avg. Sale Price/);assert.match(words(t),/£701.05/);await act(async()=>t.root.findAllByType('Button').find(n=>n.props.label==='Payment receipts').props.onPress());assert.deepEqual(nav,['PaymentHistory']);}await act(async()=>t.unmount());}
});
test('Saved dispatch follows personal preview without granting dealer permissions',()=>{
 let state={accountRole:'dealer',role:'dealer'};function DealerSavedScreen(){};
 const {SavedScreen}=compile('screens/main/SavedScreen.tsx',{'expo-image':{Image:'Image'},'../../screens/main/DealerSavedScreen':{},'./DealerSavedScreen':{DealerSavedScreen},'../../lib/nativeLayoutParity':{},'../../components/IconButton':{},'../../data/listings':{},'../../store/watchlistStore':{},'../../store/authStore':{useAuthStore:selector=>selector(state)},'../../lib/listingsApi':{},'../../lib/watchlistApi':{},'../../navigation/MainStackNavigator':{}});
 assert.equal(SavedScreen().type,DealerSavedScreen);state={accountRole:'dealer',role:'buyer'};assert.equal(SavedScreen().type.name,'PersonalSavedScreen');state={accountRole:'buyer',role:'dealer'};assert.equal(SavedScreen().type.name,'PersonalSavedScreen');
});

test('Saved hydration retains hearts on failure, rejects repeated pages and ignores stale responses',async()=>{
 const {create:zustandCreate}=await import('zustand');let resolver;let mode='initial';let reads=0;
 const item=id=>({id, mappedListing:{id,make:'Test',model:'Car'}});
 const modules={zustand:{create:zustandCreate},'./authStore':{useAuthStore:{getState:()=>({user:{id:'user'},isAuthenticated:true})}},'../lib/navigationRef':{navigationRef:{}},'../lib/watchlistApi':{getWatchlist:async()=>{reads++;if(mode==='initial')return{items:[item('saved')],total:1};if(mode==='old')return new Promise(resolve=>resolver=resolve);if(mode==='failure')throw Error('offline');if(mode==='duplicate')return{items:[item('loop')],total:2};return{items:[item('fresh')],total:1};}}};
 const exports={};runInNewContext(ts.transpileModule(readFileSync(new URL('../src/store/watchlistStore.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>modules[n]});const store=exports.useWatchlistStore;
 await store.getState().hydrateFromApi();mode='failure';await store.getState().hydrateFromApi();assert.equal(store.getState().savedListings[0].id,'saved');assert.match(store.getState().loadError,/could not be loaded/);
 mode='duplicate';reads=0;await store.getState().hydrateFromApi();assert.equal(reads,2);assert.equal(store.getState().savedListings[0].id,'saved');
 mode='old';const pending=store.getState().hydrateFromApi();mode='fresh';await store.getState().hydrateFromApi();resolver({items:[item('stale')],total:1});await pending;assert.equal(store.getState().savedListings[0].id,'fresh');assert.equal(store.getState().loadError,null);
});
