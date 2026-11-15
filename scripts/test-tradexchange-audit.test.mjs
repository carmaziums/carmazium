import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path) {
 const exports = {};
 new Function('exports', ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports);
 return exports;
}
const {sessionDraftKey:key,loadSessionDraft:restore,saveSessionDraft:save}=load('../src/lib/sessionDraftStorage.ts');
const ns='inspection'; const empty={address:'',notes:''};
function storage() { const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; }
test('inspection drafts stay isolated when accounts change in the same tab',()=>{
 const s=storage(); save(s,key(ns,'A'),{key:key(ns,'A'),value:{address:'A address',notes:'A notes'},cleared:false});
 assert.deepEqual(restore(s,ns,'B',empty),empty);
 assert.deepEqual(restore(s,ns,null,empty),empty);
 assert.equal(restore(s,ns,'A',empty).address,'A address');
 save(s,key(ns,'B'),{key:key(ns,'A'),value:{address:'leaked'},cleared:false});
 assert.deepEqual(restore(s,ns,'B',empty),empty);
});
test('guest draft transfers only after explicit sign-in intent and only once',()=>{
 const s=storage(); s.setItem(key(ns,null),JSON.stringify({address:'Guest address',notes:'Check tyres'}));
 assert.deepEqual(restore(s,ns,'A',empty),empty);
 s.setItem(`${ns}:sign-in`,'pending');
 assert.equal(restore(s,ns,'A',empty).address,'Guest address');
 assert.deepEqual(restore(s,ns,'B',empty),empty);
 assert.deepEqual(restore(s,ns,null,empty),empty);
});
test('legacy, malformed and unexpected field types cannot contaminate restored forms',()=>{
 const s=storage(); s.setItem(ns,JSON.stringify({address:'legacy private address'}));
 assert.deepEqual(restore(s,ns,'A',empty),empty);
 s.setItem(key(ns,'A'),'not json'); assert.deepEqual(restore(s,ns,'A',empty),empty);
 s.setItem(key(ns,'A'),JSON.stringify({address:123,notes:'valid',other:'drop'}));
 assert.deepEqual(restore(s,ns,'A',empty),{address:'',notes:'valid'});
});
test('completed and unhydrated drafts cannot be recreated by persistence',()=>{
 const s=storage(); save(s,key(ns,'A'),{key:key(ns,'A'),value:{address:'done'},cleared:true});
 save(s,null,{key:key(ns,'A'),value:{address:'loading'},cleared:false});
 assert.deepEqual(restore(s,ns,'A',empty),empty);
});
test('blocked storage never prevents form completion',()=>{
 const s={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 assert.deepEqual(restore(s,ns,'A',empty),empty);
 assert.doesNotThrow(()=>save(s,key(ns,'A'),{key:key(ns,'A'),value:empty,cleared:false}));
});
const {analyticsRangeIssue}=load('../src/lib/analyticsDateRange.ts');
test('custom analytics requires real dates in ascending order',()=>{
 for(const [start,end] of [['',''],['2026-11-01',''],['bad','bad'],['2026-02-30','2026-03-01'],['2026-11-15','2026-11-01']]) assert.ok(analyticsRangeIssue('custom',start,end));
 assert.equal(analyticsRangeIssue('custom','2026-11-01','2026-11-15'),null);
 assert.equal(analyticsRangeIssue('custom','2026-11-15','2026-11-15'),null);
 assert.equal(analyticsRangeIssue('30d','',''),null);
});
