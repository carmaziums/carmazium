import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source=readFileSync(new URL('../src/screens/main/SearchScreen.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('screen.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='fetch')callback=node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
function harness(api){
  const state={page:1,listings:[{id:'old'}],total:21,searchError:null};
  const context={page:1,maxDistanceMi:null,userLat:null,userLng:null,activeSearchRequest:{current:0},requestedPage:{current:1},resultList:{current:{scrollToOffset:()=>{state.scrolled=true;}}},buildParams:page=>({page,limit:10}),searchListings:api};
  for(const key of ['Loading','LoadingMore','SearchError','Listings','Total','HasMore','Page','Refreshing'])context['set'+key]=value=>{state[key[0].toLowerCase()+key.slice(1)]=value;};
  runInNewContext(ts.transpileModule('globalThis.fetch='+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {state,context,fetch:context.fetch};
}
test('next page replaces cards, uses ten results and stops at the final page',async()=>{
  const calls=[];const h=harness(async params=>{calls.push(params);return {listings:[{id:'page-'+params.page}],total:21};});
  await h.fetch(false,2);assert.equal(calls[0].page,2);assert.equal(calls[0].limit,10);assert.equal(h.state.listings[0].id,'page-2');assert.equal(h.state.listings.length,1);assert.equal(h.state.page,2);assert.equal(h.state.hasMore,true);assert.equal(h.state.scrolled,true);
  await h.fetch(false,3);assert.equal(h.state.hasMore,false);assert.equal(h.state.page,3);
  await h.fetch(true);assert.equal(h.state.page,1);assert.equal(calls[2].page,1);
});
test('failed page retains previous cars and retry clears the error at the requested page',async()=>{
  let fail=true;const h=harness(async params=>{if(fail)throw Error('offline');return {listings:[{id:'retry-'+params.page}],total:21};});
  await h.fetch(false,2);assert.equal(h.state.page,1);assert.equal(h.state.listings[0].id,'old');assert.ok(h.state.searchError);assert.equal(h.context.requestedPage.current,2);
  fail=false;await h.fetch(false,h.context.requestedPage.current);assert.equal(h.state.searchError,null);assert.equal(h.state.page,2);assert.equal(h.state.listings[0].id,'retry-2');
});
test('late pagination cannot replace a newer filter reset',async()=>{
  const pending=[];const h=harness(params=>new Promise(resolve=>pending.push({params,resolve})));
  const old=h.fetch(false,2);const fresh=h.fetch(true);
  pending[1].resolve({listings:[{id:'filtered'}],total:1});await fresh;
  pending[0].resolve({listings:[{id:'stale'}],total:100});await old;
  assert.equal(h.state.page,1);assert.equal(h.state.listings[0].id,'filtered');assert.equal(h.state.total,1);assert.equal(h.state.hasMore,false);
});
