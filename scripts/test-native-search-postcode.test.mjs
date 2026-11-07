import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
function harness(fetch) {
 const states=[],refs=[],storage=new Map();let s=0,r=0;
 const react={...React,createContext:()=>({Provider:'provider'}),useEffect:()=>{},useCallback:f=>f,useMemo:f=>f(),
 useState:initial=>{const i=s++;if(!(i in states))states[i]=initial;return[states[i],next=>states[i]=next];},
 useRef:value=>refs[r++]??=( {current:value} )};
 const exports={};const source=readFileSync(new URL('../carmazium app/carmazium app/src/context/LocationContext.tsx',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,fetch,require:name=>{
 if(name==='react')return {__esModule:true,default:react,...react};if(name==='react/jsx-runtime')return jsx;
 if(name==='expo-secure-store')return{getItemAsync:async k=>storage.get(k),setItemAsync:async(k,v)=>storage.set(k,v),deleteItemAsync:async k=>storage.delete(k)};throw Error(name);
 }});
 return {render(){s=0;r=0;return exports.LocationProvider({children:null}).props.value;},storage};
}
const result=(latitude,longitude)=>({ok:true,json:async()=>({result:{latitude,longitude}})});
test('native replacement immediately clears old location and an invalid postcode cannot reuse it',async()=>{
 const h=harness(async url=>url.endsWith('B191ES')?result(52.5,-1.9):{ok:false});
 await h.render().setPostcode('B19 1ES');assert.equal(h.render().latitude,52.5);
 const pending=h.render().setPostcode('invalid');assert.equal(h.render().latitude,null);await pending;
 assert.equal(h.render().latitude,null);await h.render().clear();assert.equal(h.storage.size,0);
});
test('native late postcode lookup cannot restore a cleared or newer location',async()=>{
 let finish;const h=harness(url=>url.endsWith('B191ES')?new Promise(resolve=>finish=resolve):Promise.resolve(result(51.5,-0.14)));
 const old=h.render().setPostcode('B19 1ES');await h.render().setPostcode('SW1A 1AA');finish(result(52.5,-1.9));await old;
 assert.equal(h.render().postcode,'SW1A 1AA');assert.equal(JSON.parse([...h.storage.values()][0]).postcode,'SW1A 1AA');
 const other=h.render().setPostcode('B19 1ES');await h.render().clear();finish(result(52.5,-1.9));await other;
 assert.equal(h.render().latitude,null);assert.equal(h.storage.size,0);
});
