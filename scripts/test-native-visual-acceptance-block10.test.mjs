#!/usr/bin/env node
// Tests of the *separate* offline, fail-closed visual acceptance checker.
// Passing these source tests is NEVER an Android/iOS visual acceptance.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateVisualAcceptance, REQUIRED_SCENARIOS, VIEWPORTS, MANUAL_CHECKS } from './verify-native-visual-acceptance.mjs';
const SHA='a'.repeat(40);
const REVIEWER='independent-reviewer';
const makeManifest=()=>({
  version:1,sourceCommit:SHA,repository:'carmaziums/carmazium',issue:477,
  privateStorage:true,redactedOfPersonalData:true,userConsentForCapture:true,
  tester:'synthetic-fixture-tester',reviewer:REVIEWER,testedAt:'2026-10-10T10:00:00Z',
  staging:{apiUrl:'https://staging.example.test',approvedBy:'release-owner',
    syntheticDataOnly:true,separateFromProduction:true},
  manualChecks:Object.fromEntries(MANUAL_CHECKS.map(k=>[k,{
    result:'pass',tester:'synthetic-fixture-tester',evidence:'local test only',
  }])),
  pairs:REQUIRED_SCENARIOS.flatMap(s=>VIEWPORTS.map(viewport=>({
    ...s,viewport,fixtureId:'synthetic-fixture-001',theme:'dark',stateMatch:true,
    humanReview:{result:'pass',reviewer:REVIEWER,notes:'hypothetical paired pixels'},
    screenshots:Object.fromEntries(['web','android','ios'].map(platform=>[platform,{
      path:`private/${s.id}-${viewport}-${platform}.png`,
      sha256:'b'.repeat(64),pixelRatio:2,
    }])),
  }))),
  finalDecision:'APPROVED',finalReviewer:REVIEWER,finalNotes:'Synthetic unit test only',
});
const stubReader=record=>{
  // The real CLI always reads PNG BYTES and checks sha256. This is a unit test.
  const key=String(record.path).match(/(360x800|390x844)/)?.[1];
  const [w,h]=(key||'360x800').split('x').map(Number);
  // Simulate intrinsic screenshot bytes independently of what the manifest claims.
  // Otherwise tampering with pixelRatio would also change the mock's dimensions.
  return {width:w*2,height:h*2};
};
const check=(manifest=makeManifest())=>evaluateVisualAcceptance(manifest,{
  base:'/private/evidence',expectedSha:SHA,imageReader:stubReader,
});
test('acceptance requires two real viewports, 16 role/screen states and all three platforms',()=>{
  assert.deepEqual(VIEWPORTS,['360x800','390x844']);
  assert.equal(REQUIRED_SCENARIOS.length,16);
  assert.equal(MANUAL_CHECKS.length,16);
  const hypothetic=check();
  assert.equal(hypothetic.requiredPairCount,32);
  assert.equal(hypothetic.approved,true,'positive test ensures the gate is not permanently closed');
});
test('no manifest, no screenshots or mismatch in exact commit cannot be approved',()=>{
  assert.equal(check(null).approved,false);
  const m=makeManifest();m.pairs=[];assert.equal(check(m).approved,false);
  const n=makeManifest();n.sourceCommit='c'.repeat(40);assert.equal(check(n).approved,false);
});
test('live production backend or unapproved staging cannot be used for mutable QA',()=>{
  const m=makeManifest();m.staging.apiUrl='https://carmazium-hjoh9w.fly.dev';
  assert.ok(check(m).errors.some(e=>e.includes('isolated HTTPS staging')));
  m.staging.apiUrl='https://www.carmazium.com';
  assert.equal(check(m).approved,false);
  m.staging.apiUrl='https://staging.example.test';m.staging.syntheticDataOnly=false;
  assert.equal(check(m).approved,false);
});
test('consent, private redaction and independent review are mandatory',()=>{
  const m=makeManifest();m.userConsentForCapture=false;assert.equal(check(m).approved,false);
  m.userConsentForCapture=true;m.redactedOfPersonalData=false;assert.equal(check(m).approved,false);
  m.redactedOfPersonalData=true;m.reviewer=m.tester;assert.equal(check(m).approved,false);
});
test('light theme, MaziuM consent, iOS and accessibility cannot be silently skipped',()=>{
  for(const name of ['iosInstall','nativeLightTheme','maziumDisclosureAndConsent',
    'talkBack','voiceOver','largeText200Percent','noDeadControls']){
    const m=makeManifest();delete m.manualChecks[name];
    assert.ok(check(m).errors.some(e=>e.includes(name)),name);
  }
});
test('must have every screenshot, matching density, state, theme and reviewer',()=>{
  const m=makeManifest();m.pairs[0].screenshots.ios=undefined;
  assert.equal(check(m).approved,false);
  const n=makeManifest();n.pairs[0].screenshots.android.pixelRatio=3;
  assert.equal(check(n).approved,false);
  const o=makeManifest();o.pairs[0].stateMatch=false;
  assert.equal(check(o).approved,false);
  const q=makeManifest();q.pairs[0].humanReview.reviewer='self';
  assert.equal(check(q).approved,false);
  const u=makeManifest();u.pairs[0].fixtureId='';
  assert.equal(check(u).approved,false);
});
test('duplicate IDs or missing final approval must fail closed',()=>{
  const m=makeManifest();m.pairs.push({...m.pairs[0]});
  assert.ok(check(m).errors.some(e=>e.includes('Duplicate screen pair')));
  const n=makeManifest();n.finalDecision='BLOCKED';
  assert.ok(check(n).errors.some(e=>e.includes('not approved')));
});
