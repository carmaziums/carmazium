import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function load(source,modules={}){const exports={};runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});return exports;}
const documents=load(read('../src/data/nativeDocuments.ts')),labels=load(read('../src/lib/vehicleLabels.ts'));
const common={react:React,'react-native':{Text:'Text',View:'View',TouchableOpacity:'TouchableOpacity',Alert:{alert:()=>{}},Linking:{openURL:async()=>{}}},'expo-image':{Image:'Image'},'expo-linear-gradient':{LinearGradient:'Gradient'},'@/components/BrandIcon':{Ionicons:'Icon'},'../../components/PublicInfoPage':{PublicInfoPage:'Page',infoStyles:{}},'../../components/Button':{Button:'Button'},'../../constants/colors':{Colors:{}},'../../data/nativeDocuments':documents,'../../lib/vehicleLabels':labels};
const text=t=>t.root.findAllByType('Text').map(n=>n.children.filter(x=>typeof x==='string'||typeof x==='number').join('')).join(' ');
test('reviews match current website payment and review claims and keep all first-party actions native',async()=>{
 const navigated=[],emails=[];const lib=load(read('../src/screens/main/ReviewsScreen.tsx'),{...common,'react-native':{...common['react-native'],Linking:{openURL:async u=>emails.push(u)}},'@react-navigation/native':{useNavigation:()=>({navigate:(...a)=>navigated.push(a)})}});
 let t;await act(async()=>{t=create(React.createElement(lib.ReviewsScreen));});
 const visible=text(t),web=read('../../../src/app/reviews/page.tsx');
 for(const item of lib.REVIEW_BUYER_CHECKS)assert.ok(web.includes(item.description),item.title);
 for(const heading of ['CarMazium reviews and customer feedback','Our approach to genuine reviews','What to check before buying','Use independent vehicle checks','Tell us about your experience']){assert.ok(visible.includes(heading));assert.ok(web.includes(heading));}
 assert.match(visible,/buyers pay the seller directly/);assert.match(visible,/does not hold vehicle purchase funds/);assert.match(visible,/does not automatically publish a public review/);
 assert.doesNotMatch(visible,/All transactions run through Stripe|Deposit and delivery safeguards|50k/);assert.equal(visible.includes('4.9/5'),false);
 for(const label of ['Browse used cars','Explore retail listings','How the marketplace works','Understand marketplace fees','Compare used-car body types'])await act(async()=>t.root.findAllByType('Button').find(b=>b.props.label===label).props.onPress());
 assert.deepEqual(navigated.map(a=>a[0]),['Tabs','Tabs','HowItWorks','Pricing','CarBodyGuide']);assert.equal(emails.length,0);
 await act(async()=>t.root.findAllByType('Button').find(b=>b.props.label==='Share your experience').props.onPress());
 assert.deepEqual(emails,['mailto:info@carmazium.com?subject=CarMazium%20customer%20feedback']);
 await act(async()=>t.unmount());
});
test('all eight body types, illustrations and checks come from the website',()=>{
 const web=read('../../../src/app/used-car-types/page.tsx');
 const literal=web.match(/const BODY_TYPES = (\[[\s\S]*?\]) as const/)[1];
 const expected=load('export const BODY_TYPES = '+literal+';').BODY_TYPES;
 assert.deepEqual(JSON.parse(JSON.stringify(documents.nativeBodyTypes)),JSON.parse(JSON.stringify(expected)));
 assert.equal(expected.length,8);
});
test('body guide routes filters and real retail previews natively; sold and auction stock never appear',async()=>{
 const navigation=[],good={id:'live-car',title:'Live hatchback',listingType:'CLASSIFIED',status:'ACTIVE',price:4000,year:2020,fuelTypeRaw:'PETROL',transmissionRaw:'MANUAL'};
 const listings=[good,{...good,id:'auction',listingType:'AUCTION'},{...good,id:'sold',status:'SOLD'},{...good,id:'pending',status:'OFFER_ACCEPTED'},{...good,id:'invalid',price:0}];
 const requests=[];const lib=load(read('../src/screens/main/CarBodyGuideScreen.tsx'),{...common,'../../lib/listingsApi':{searchListings:async p=>{requests.push(p);return {listings};}}});
 let t;await act(async()=>{t=create(React.createElement(lib.CarBodyGuideScreen,{navigation:{navigate:(...a)=>navigation.push(a)}}));});
 assert.deepEqual(JSON.parse(JSON.stringify(lib.bodyGuidePreview(listings))).map(x=>x.id),['live-car']);
 assert.equal(requests[0].listingType,'CLASSIFIED');assert.equal(t.root.findAllByType('Image').length,8);
 assert.equal(t.root.findAllByType('TouchableOpacity').length,1);
 for(const body of documents.nativeBodyTypes){const label='Browse used '+(/^[A-Z]{2}/.test(body.name)?body.name:body.name.toLowerCase());await act(async()=>t.root.findAllByType('Button').find(b=>b.props.label===label).props.onPress());assert.equal(navigation.at(-1)[0],'Tabs');assert.equal(navigation.at(-1)[1].params.bodyType,body.key);}
 await act(async()=>t.root.findByType('TouchableOpacity').props.onPress());assert.equal(navigation.at(-1)[0],'VehicleDetail');assert.equal(navigation.at(-1)[1].listing.id,'live-car');
 await act(async()=>t.unmount());
});
test('body guide remains usable when the optional stock preview fails',async()=>{
 const lib=load(read('../src/screens/main/CarBodyGuideScreen.tsx'),{...common,'../../lib/listingsApi':{searchListings:async()=>{throw Error('offline');}}});
 let t;await act(async()=>{t=create(React.createElement(lib.CarBodyGuideScreen,{navigation:{navigate:()=>{}}}));});
 assert.equal(t.root.findAllByType('Image').length,8);assert.equal(t.root.findAllByType('TouchableOpacity').length,0);
 assert.ok(text(t).includes('Checks that matter for every used car'));await act(async()=>t.unmount());
});
