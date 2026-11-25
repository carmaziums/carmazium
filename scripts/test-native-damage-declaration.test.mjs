import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const native = new URL('../carmazium app/carmazium app/src/', import.meta.url);
const read = name => readFileSync(new URL(name,native),'utf8');
const wizard=read('screens/sell/SellCarFlowScreen.tsx');
const viewer=read('components/damage/ThreeDVehicleViewer.tsx');
const html=read('assets/3d/viewer.html');
const media=wizard.slice(wizard.indexOf('function renderStep2()'),wizard.indexOf('function renderStep3()'));
test('both native platforms expose damage map independently of photo category, except leisure vehicles',()=>{
  assert.match(media,/\{!isLeisure \? \([\s\S]*?<Damage3DMapper/);
  assert.doesNotMatch(media,/photoTab !== 'Damage' \|\| isLeisure/);
  assert.match(media,/Photograph every damaged area of your caravan or campervan/);
  assert.match(media,/scrollEnabled=\{!scrollLocked\}/);
  assert.match(wizard,/<DamageViewerErrorBoundary height=\{280\}>/);
  assert.match(media,/onAdd=\{entry => setDamageRecords/);
  assert.match(media,/onPhoto=\{handleZonePhoto\}/);
});
test('native viewer waits for readiness, transfers small chunks, acknowledges loaded model and retries a new view',()=>{
  assert.match(viewer,/msg.type === 'viewerReady'/);
  assert.match(viewer,/base64.match\(\/\.\{1,65536\}\/g\)/);
  assert.match(viewer,/msg.type === 'modelReady'/);
  assert.match(viewer,/key=\{attempt\}/);
  assert.match(viewer,/setTimeout\(fail, 45000\)/);
  assert.match(viewer,/onRenderProcessGone=\{fail\}/);
  assert.match(viewer,/onContentProcessDidTerminate=\{fail\}/);
  assert.match(viewer,/onTouchStart=\{\(\) => \{ if \(readyRef.current\) lockScroll\(\)/);
});
function harness(){
  const messages=[], parsed=[];
  const vector=()=>({clone:vector,multiplyScalar(){return this},x:1,y:1,z:1});
  const model={scale:{setScalar(){}},position:{copy(){}}};
  const context={window:{ReactNativeWebView:{postMessage:x=>messages.push(JSON.parse(x))},addEventListener(){}},document:{getElementById:()=>({style:{}})},atob,Uint8Array,Number,JSON,Math,
    GLTFLoader:class{parse(bytes,_,done){parsed.push(Buffer.from(bytes));done({scene:model});}},
    THREE:{Box3:class{setFromObject(){return this} getCenter(){return vector()} getSize(){return vector()} min=vector()},Vector3:class{}},
    scene:{add(){}},controls:{target:{set(){}},update(){}},renderer:{render(){},domElement:{addEventListener(){}}},camera:{},postZonePositions(){},_zones:[],_modelInfo:null};
  runInNewContext(html.slice(html.indexOf('function report(type)'),html.indexOf('</script>')),context);
  runInNewContext(html.slice(html.indexOf('var loader = new GLTFLoader();'),html.lastIndexOf('</script>')),context);
  return {messages,parsed,window:context.window};
}
test('ordered chunks reconstruct actual bundled GLB byte-for-byte before renderer acknowledgement',()=>{
  const h=harness(), glb=readFileSync(new URL('assets/3d/vehicle.glb',native));
  assert.equal(glb.subarray(0,4).toString(),'glTF');
  assert.equal(glb.readUInt32LE(8),glb.length);
  const chunks=glb.toString('base64').match(/.{1,65536}/g);
  h.window.beginModel(chunks.length);
  chunks.forEach((c,i)=>h.window.appendModelChunk(i,c));
  h.window.finishModel();
  assert.equal(h.messages[0].type,'viewerReady');
  assert.deepEqual(h.parsed[0],glb);
  assert.equal(h.messages.at(-1).type,'modelReady');
  h.window.finishModel();
  assert.equal(h.parsed.length,1);
});
test('missing chunks fail visibly without parsing an incomplete model',()=>{
  const h=harness();h.window.beginModel(2);h.window.appendModelChunk(0,'YWJj');h.window.finishModel();
  assert.equal(h.parsed.length,0);assert.equal(h.messages.at(-1).type,'viewerError');
});