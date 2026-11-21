import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
function load(source,modules={}){const exports={};runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in modules))throw Error(n);return modules[n];}});return exports;}
const metadata=load(read('../src/lib/vehicleImageMetadata.ts'));
const plain=v=>JSON.parse(JSON.stringify(v));
const photo=(name,category='EXTERIOR')=>'https://example.test/'+name+'.jpg#cm-photo=contain,25,75,1.4,'+category;
function setup(answer){const calls=[];const lib=load(read('../src/lib/vehicleCoverSelection.ts'),{'./vehicleImageMetadata':metadata,'./apiClient':{apiClient:async(...args)=>{calls.push(args);if(answer instanceof Error)throw answer;return {data:answer};}}});return {...lib,calls};}
test('native calls the website cover service with stripped sources and promotes the chosen front photo without losing metadata',async()=>{
 const lib=setup({recommendedIndex:2,confidence:.9,view:'front'}),images=[photo('rear'),photo('side'),photo('front')];
 const result=await lib.selectAutomaticVehicleCover(images);
 assert.deepEqual(plain(result.images),[images[2],images[0],images[1]]);
 assert.deepEqual(images,[photo('rear'),photo('side'),photo('front')],'input remains untouched');
 assert.match(result.message,/Front photo selected automatically/);
 const [endpoint,request]=lib.calls[0];assert.equal(endpoint,'/listings/photo-cover-recommendation');assert.equal(request.method,'POST');
 assert.deepEqual(JSON.parse(request.body),{imageUrls:['rear','side','front'].map(n=>'https://example.test/'+n+'.jpg')});
});
test('same first-thirty candidates and .6 confidence threshold as website',async()=>{
 const images=Array.from({length:100},(_,i)=>photo(String(i)));
 const lib=setup({recommendedIndex:29,confidence:.6,view:'front_three_quarter'});
 const result=await lib.selectAutomaticVehicleCover(images);
 assert.equal(JSON.parse(lib.calls[0][1].body).imageUrls.length,30);
 assert.equal(result.images.length,100);assert.equal(result.images[0],images[29]);assert.equal(result.images[99],images[99]);
 assert.match(result.message,/front-angle/);
 for(const recommendedIndex of [null,-1,30,1.5]){
   const l=setup({recommendedIndex,confidence:.95,view:'front'});
   assert.deepEqual(plain((await l.selectAutomaticVehicleCover(images)).images),images);
 }
});
test('low confidence, malformed response, network errors and current cover preserve every photo',async()=>{
 const images=[photo('rear'),photo('front')];
 for(const answer of [{recommendedIndex:1,confidence:.59},undefined,new Error('offline'),{recommendedIndex:1,confidence:NaN},{recommendedIndex:0,confidence:.8}]){
   const lib=setup(answer);const result=await lib.selectAutomaticVehicleCover(images);
   assert.deepEqual(plain(result.images),images);assert.ok(result.message);
 }
 const lib=setup({recommendedIndex:0,confidence:.9});
 assert.equal((await lib.selectAutomaticVehicleCover(images.slice(0,1))).images.length,1);assert.equal(lib.calls.length,0);
});
test('saved order survives category grouping, reload, removal, additions and updated crop settings',()=>{
 const lib=setup(null),exterior=photo('front'),interior=photo('cabin','INTERIOR'),damage=photo('dent','DAMAGE'),newExterior=photo('side');
 const saved=[interior,exterior,damage];
 assert.deepEqual(plain(lib.orderedVehicleImages([exterior,interior,damage],saved)),saved);
 assert.deepEqual(plain(lib.orderedVehicleImages([exterior,damage,newExterior],saved)),[exterior,damage,newExterior]);
 const changed=interior.replace(',25,75,1.4,',',50,50,1.00,');
 assert.deepEqual(plain(lib.orderedVehicleImages([exterior,changed,damage],saved)),[changed,exterior,damage]);
});
test('wizard sends the selected order to create/edit and persists it in account-scoped drafts',()=>{
 const screen=read('../src/screens/sell/SellCarFlowScreen.tsx'),store=read('../src/lib/sellWizardStore.ts');
 assert.match(screen,/uploadTab === 'Exterior' && combined.length > 1/);
 assert.match(screen,/await selectAutomaticVehicleCover\(combined\)/);
 assert.match(screen,/setPhotoOrder\(l.images\)/);assert.match(screen,/setPhotoOrder\(store.photoOrder \?\? \[\]\)/);
 assert.equal((screen.match(/images: allImages/g)||[]).length,2);
 assert.equal((screen.match(/photoOrder: allImages/g)||[]).length,2);
 assert.match(store,/photoOrder: state.photoOrder/);
 assert.match(screen,/function handleNext\(\) {\s+if \(uploadingPhoto\) return/);
 assert.match(screen,/onPress={\(\) => makeCoverPhoto\(uri\)}/);
 assert.equal((screen.match(/parseVehicleImageMetadata\(x\).src !== source/g)||[]).length,3,'remove category-tagged thumbnails by original source');
});
