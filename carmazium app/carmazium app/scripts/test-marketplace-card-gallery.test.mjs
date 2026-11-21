import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {act,create} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const compile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function load(source,modules={}){const exports={};runInNewContext(compile(source),{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});return exports;}
const parser=load(read('../src/lib/vehicleImagePresentation.ts'));
const labels=load(read('../src/lib/vehicleLabels.ts'));
const rn={View:'View',Text:'Text',ScrollView:'ScrollView',Pressable:'Pressable',TouchableOpacity:'TouchableOpacity',useWindowDimensions:()=>({width:412,fontScale:1}),StyleSheet:{create:s=>s,absoluteFillObject:{}}};
const common={react:React,'react-native':rn,'expo-image':{Image:'Image'},'expo-linear-gradient':{LinearGradient:'Gradient'},'@/components/BrandIcon':{Ionicons:'Icon'},'../constants/colors':{Colors:{},themeMode:'light'},'../constants/typography':{FontFamily:{},FontSize:{}},'../lib/vehicleImagePresentation':parser};
const carousel=load(read('../src/components/ImageCarousel.tsx'),common).ImageCarousel;
const texts=t=>t.root.findAllByType('Text').map(n=>n.children.filter(x=>typeof x==='string'||typeof x==='number').join(''));
test('gallery reaches photo ten, shows the right counter and opens that same photo',async()=>{
 const images=Array.from({length:10},(_,i)=>'https://example.test/'+i+'.jpg');const opened=[],changed=[];let t;
 await act(async()=>{t=create(React.createElement(carousel,{images,width:300,height:192,onPress:i=>opened.push(i),onIndexChange:i=>changed.push(i)}));});
 assert.ok(texts(t).includes('1/10'));
 assert.equal(t.root.findAllByType('Image').length,2,'only current photo and neighbour decode');
 await act(async()=>t.root.findByType('ScrollView').props.onMomentumScrollEnd({nativeEvent:{contentOffset:{x:2700}}}));
 assert.ok(texts(t).includes('10/10'));assert.equal(changed.at(-1),9);
 await act(async()=>t.root.findAllByType('Pressable')[9].props.onPress());assert.deepEqual(opened,[9]);
 await act(async()=>t.update(React.createElement(carousel,{images:images.slice(0,3),width:220,height:192})));
 assert.equal(t.root.findAllByType('Pressable').length,3);
 assert.ok(t.root.findAllByType('Image').some(i=>i.props.source.uri===images[2]));
 await act(async()=>t.unmount());
});
test('vehicle crop settings match web, including malformed metadata, and reach expo-image',async()=>{
 const web=load(read('../../../src/lib/vehicleImagePresentation.ts'));
 for(const raw of [undefined,'','https://example.test/a.jpg','https://example.test/a.jpg#cm-photo=contain,25,75,1.4,EXTERIOR','a#cm-photo=cover,-5,200,9,INTERIOR','a#cm-photo=bad,NaN,no,NaN,DAMAGE']){
   assert.deepEqual(JSON.parse(JSON.stringify(parser.parseVehicleImagePresentation(raw))),JSON.parse(JSON.stringify(web.parseVehicleImagePresentation(raw))));
 }
 let t;await act(async()=>{t=create(React.createElement(carousel,{images:['https://example.test/a.jpg#cm-photo=contain,25,75,1.4,EXTERIOR'],width:300,height:192}));});
 const image=t.root.findByType('Image');assert.equal(image.props.source.uri,'https://example.test/a.jpg');assert.equal(image.props.contentFit,'contain');assert.equal(image.props.contentPosition.left,'25%');assert.equal(image.props.style.transform[0].scale,1.4);await act(async()=>t.unmount());
});
test('result card keeps native gallery, detail, saved and warranty actions with website facts',async()=>{
 const opened=[],saved=[],warranties=[];const modules={...common,'../data/listings':{getNativeListingPrice:()=>({amount:'£24,600.00',label:'Retail asking price'})},'../store/watchlistStore':{useWatchlistStore:fn=>fn({savedIds:new Set(),toggle:l=>saved.push(l.id)})},'../context/LocationContext':{useLocation:()=>({latitude:null,longitude:null})},'../lib/distance':{haversineDistanceMiles:()=>0},'../lib/vehicleLabels':labels,'./ImageCarousel':{ImageCarousel:'Carousel'},'./ImageLightbox':{ImageLightbox:'Lightbox'},'./SellerServiceBadges':{SellerServiceBadges:'Services'},'./IconButton':{IconButton:'IconButton'},'./Button':{Button:'Button'}};
 const Card=load(read('../src/components/HorizontalVehicleCard.tsx'),modules).HorizontalVehicleCard;
 const listing={id:'bmw',title:'BMW 7 SERIES 2018',make:'BMW',model:'7 SERIES',year:2018,price:24600,mileage:52000,fuelTypeRaw:'HYBRID',transmissionRaw:'AUTOMATIC',bodyTypeRaw:'SEDAN',location:'Liverpool',status:'ACTIVE',listingType:'CLASSIFIED',badgeTier:'PREMIUM',isFeatured:true,exteriorGrade:1,deliveryAvailable:true,images:Array.from({length:10},(_,i)=>'https://example.test/'+i+'.jpg')};
 let t;await act(async()=>{t=create(React.createElement(Card,{listing,onPress:id=>opened.push(id),onWarranty:()=>warranties.push('quote')}));});
 const text=texts(t).join(' ');for(const fact of ['OFFERS WELCOME','PREMIUM','EXTERIOR GRADE 1','Sedan','Hybrid','Automatic','Liverpool','Delivery','History Report Included'])assert.ok(text.includes(fact),fact);
 await act(async()=>t.root.findByType('Carousel').props.onPress(9));assert.equal(t.root.findByType('Lightbox').props.initialIndex,9);assert.equal(t.root.findByType('Lightbox').props.visible,true);assert.equal(opened.length,0);
 await act(async()=>t.root.findByType('Button').props.onPress());assert.deepEqual(opened,['bmw']);
 await act(async()=>t.root.findByType('IconButton').props.onPress());assert.deepEqual(saved,['bmw']);
 await act(async()=>t.root.findByType('TouchableOpacity').props.onPress());assert.deepEqual(warranties,['quote']);
 await act(async()=>t.update(React.createElement(Card,{listing:{...listing,writeOffCategory:'NONE'},onPress:()=>{}})));
 assert.equal(texts(t).join(' ').includes('Category NONE'),false);
 await act(async()=>t.update(React.createElement(Card,{listing:{...listing,writeOffCategory:'CAT_S'},onPress:()=>{}})));
 assert.ok(texts(t).join(' ').includes('Category S'));
 await act(async()=>t.update(React.createElement(Card,{listing:{...listing,transmissionRaw:'UNKNOWN',transmission:undefined},onPress:id=>opened.push(id)})));
 assert.ok(texts(t).includes('Not specified'));assert.equal(texts(t).includes('Automatic'),false);
 await act(async()=>t.update(React.createElement(Card,{listing:{...listing,status:'SOLD'},onPress:id=>opened.push(id),onWarranty:()=>warranties.push('quote')})));
 assert.equal(t.root.findAllByType('IconButton').length,0);assert.equal(t.root.findAllByType('TouchableOpacity').length,0);assert.equal(t.root.findByType('Button').props.label,'View Sold Vehicle');assert.equal(texts(t).includes('OFFERS WELCOME'),false);await act(async()=>t.unmount());
});
