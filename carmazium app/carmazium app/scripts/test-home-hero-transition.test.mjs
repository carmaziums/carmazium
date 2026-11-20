import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/WebsiteHomeHero.tsx',import.meta.url),'utf8');
const fragment=source.slice(source.indexOf('const vehicles'),source.indexOf('export function WebsiteHomeHero'));
const code=ts.transpileModule(fragment,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const html=runInNewContext(code+';sceneHtml(false,false)',{art:new Proxy({},{get:(_,key)=>String(key)})});
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function harness(decode=()=>Promise.resolve()) {
  let current='hatchback';const changes=[],animations=[];
  const vehicle={style:{opacity:1},get src(){return current;},set src(value){assert.equal(Number(this.style.opacity),0,'source must change only while fully invisible');current=value;changes.push(value);},getAnimations:()=>animations.filter(a=>!a.cancelled),animate(frames,options){let resolve,reject;const a={frames,options,cancelled:false,finished:new Promise((a,b)=>{resolve=a;reject=b;}),finish(){resolve();},cancel(){this.cancelled=true;reject(Error('cancelled'));}};animations.push(a);return a;}};
  const window={};runInNewContext(script,{window,document:{querySelector:()=>vehicle},Image:class{decode(){return decode();}}});
  return{vehicle,window,changes,animations,advance:async()=>{animations.at(-1).finish();await flush();}};
}
test('the full vehicle cycle uses one rendered image, swapping only when invisible',async()=>{
  assert.equal((html.match(/<img\b/g)||[]).length,1,'two rendered images allow crossfade overlap');
  const h=harness();const running=h.window.setSceneActive(true);await flush();
  for(let i=0;i<10;i++){assert.equal(h.animations.at(-1).options.duration,1000);await h.advance();assert.equal(h.animations.at(-1).frames.at(-1).opacity,0);await h.advance();assert.equal(h.changes.length,i+1);assert.equal(h.animations.at(-1).options.duration,2000);await h.advance();}
  assert.equal(new Set(h.changes).size,10);assert.equal(h.vehicle.src,'hatchback');h.window.setSceneActive(false);await running;assert.equal(h.vehicle.style.opacity,1);
});
test('pause during fade-out or fade-in leaves one still vehicle and resumes safely',async()=>{
  for(const steps of [1,2]){const h=harness();const run=h.window.setSceneActive(true);await flush();for(let n=0;n<steps;n++)await h.advance();h.window.setSceneActive(false);await run;const frozen=h.vehicle.src;await flush();assert.equal(h.vehicle.src,frozen);assert.equal(h.vehicle.style.opacity,1);assert.equal(h.vehicle.getAnimations().length,0);const resumed=h.window.setSceneActive(true);await flush();await h.advance();await h.advance();assert.notEqual(h.vehicle.src,frozen);h.window.setSceneActive(false);await resumed;}
});
test('late preload completion cannot restart a paused scene',async()=>{
  let ready;const h=harness(()=>new Promise(resolve=>{ready=resolve;}));const run=h.window.setSceneActive(true);await flush();h.animations.at(-1).finish();h.window.setSceneActive(false);ready();await run;assert.equal(h.changes.length,0);assert.equal(h.vehicle.style.opacity,1);assert.equal(h.vehicle.getAnimations().length,0);
});
