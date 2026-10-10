#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  evaluateVisualAcceptance, readPngEvidence, REQUIRED_SCENARIOS, VIEWPORTS, MANUAL_CHECKS,
} from './verify-native-visual-acceptance.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = p => readFileSync(resolve(root,p),'utf8');
const sha = 'a'.repeat(40);
const passingManifest = () => ({
  version: 1,
  repository: 'carmaziums/carmazium',
  issue: 477,
  sourceCommit: sha,
  staging: {
    apiUrl: 'https://staging-fixture.example.invalid',
    approvedBy: 'Staging QA owner', syntheticDataOnly: true, separateFromProduction: true,
  },
  privateStorage: true, redactedOfPersonalData: true, userConsentForCapture: true,
  tester: 'Tester', reviewer: 'Separate QA reviewer', testedAt: '2026-10-10T12:00:00Z',
  manualChecks: Object.fromEntries(MANUAL_CHECKS.map(name =>
    [name,{result:'pass',tester:'Tester',evidence:'Private acceptance notes supplied'}])),
  finalDecision: 'APPROVED', finalReviewer: 'Separate QA reviewer',
  finalNotes: 'Matched all required screens and reviewed accessibility',
  pairs: REQUIRED_SCENARIOS.flatMap(s => VIEWPORTS.map(viewport => ({
    ...s, viewport, fixtureId: 'SYNTHETIC-477', theme: 'dark', stateMatch: true,
    humanReview: { result:'pass', reviewer:'Separate QA reviewer', notes:'Compared approved fixture visually' },
    screenshots: Object.fromEntries(['web','android','ios'].map(platform => [
      platform, { path: 'private/'+s.id+'/'+viewport+'/'+platform+'.png',
        sha256:'b'.repeat(64), pixelRatio:1 },
    ])),
  }))),
});
const fakeImage = () => ({width:360,height:800});
const decide = m => evaluateVisualAcceptance(m, {
  expectedSha:sha, imageReader: a => {
    const match = a.path.match(/(360x800|390x844)/);
    const [width,height] = match[1].split('x').map(Number);
    return {width:Math.round(width*a.pixelRatio),height:Math.round(height*a.pixelRatio)};
  },
});

test('Block 10 manual gate refuses missing private manifest; no default sign-off',()=>{
  const path=resolve(root,'scripts/verify-native-visual-acceptance.mjs');
  const run=spawnSync(process.execPath,[path,'--sha',sha],{encoding:'utf8'});
  assert.equal(run.status,1);
  assert.match(run.stdout,/BLOCKED/);
  assert.match(run.stderr,/Missing --manifest/);
});

test('an explicit COMPLETE, reviewed and isolated synthetic evidence fixture can pass',()=>{
  const result=decide(passingManifest());
  assert.equal(result.requiredPairCount,REQUIRED_SCENARIOS.length*VIEWPORTS.length);
  assert.equal(result.approved,true,result.errors.join('\n'));
});

test('production backend or stale app SHA ALWAYS block evidence acceptance',()=>{
  const m=passingManifest();
  m.staging.apiUrl='https://carmazium-hjoh9w.fly.dev';
  assert.equal(decide(m).approved,false);
  assert.match(decide(m).errors.join(' '),/live Fly/);
  m.staging.apiUrl='https://staging-fixture.example.invalid';
  m.sourceCommit='c'.repeat(40);
  assert.equal(decide(m).approved,false);
  assert.match(decide(m).errors.join(' '),/sourceCommit/);
});

test('old or absent native/iOS screenshots, wrong role or missing reviewer never count as parity',()=>{
  const m=passingManifest();
  m.pairs=m.pairs.filter(p=>p.id!=='D02');
  assert.equal(decide(m).approved,false);
  assert.match(decide(m).errors.join(' '),/D02@360x800/);
  const n=passingManifest();
  n.pairs[0].role='buyer';
  assert.equal(decide(n).approved,false);
  const v=passingManifest();
  v.pairs[0].screenshots.ios.pixelRatio=0;
  assert.equal(decide(v).approved,false);
  const q=passingManifest();
  q.reviewer=q.tester;
  assert.equal(decide(q).approved,false);
});

test('accessible theme/consent, banking and synthetic dealer permissions cannot be waived silently',()=>{
  for(const name of ['nativeLightTheme','maziumDisclosureAndConsent','dealerKycAndStaffPermissions','iosInstall','talkBack','voiceOver']){
    const m=passingManifest();
    m.manualChecks[name].result='pending';
    assert.equal(decide(m).approved,false,name);
  }
});

test('PNG evidence cannot be path-traversed or declared using a guessed hash',()=>{
  assert.throws(()=>readPngEvidence(root,{path:'../../secret.png',sha256:'a'.repeat(64)}),/outside/);
  assert.throws(()=>readPngEvidence(root,{path:'not-there.png',sha256:'invalid'}),/missing/);
});

test('native MaziuM exists and is kept above accessible tabs with consent still gating all AI sends',()=>{
  const ai=read('carmazium app/carmazium app/src/components/GlobalAIChatBot.tsx');
  assert.ok(ai.includes('getBottomTabBarHeight(fontScale) + 8'));
  assert.ok(ai.includes('const tabClearance = Math.max(MAZIUM_TAB_CLEARANCE,'));
  assert.ok(ai.includes('hasAiConsent !== true) return;'));
  assert.ok(ai.includes('AsyncStorage.getItem(aiConsentKey)'));
  assert.ok(ai.includes("AsyncStorage.setItem(aiConsentKey, 'accepted')"));
  assert.ok(ai.includes('editable={!isThinking && hasAiConsent === true}'));
  assert.ok(ai.includes('MaziuM AI privacy'));
  assert.ok(!ai.includes("setHasAiConsent(true);\n  const sendMessage"),'AI sending must not auto-consent');
});

test('source gate and docs cannot silently claim public website capture is a matched device pair',()=>{
  const workflow=read('.github/workflows/carmazium-visual-baseline.yml');
  const android=read('.github/workflows/carmazium-android-preview-apk.yml');
  const eas=JSON.parse(read('carmazium app/carmazium app/eas.json'));
  const docs=read('docs/native/website-native-visual-parity-block10-20261010.md');
  assert.ok(workflow.includes('ANONYMOUS_WEB_ONLY_NOT_NATIVE_PARITY'));
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_API_URL,'https://carmazium-hjoh9w.fly.dev');
  assert.ok(android.includes('EXPO_TOKEN:'));
  assert.ok(android.includes('channel ===') || android.includes("channel !== 'preview'"));
  for(const word of ['VISUAL SIGN-OFF: PENDING','RELEASE APPROVAL: BLOCKED','360×800','390×844',
    'androidInstall','iosInstall','TalkBack','VoiceOver','MaziuM','PR #486',
    'private','revert','No production release']){
    assert.ok(docs.toLowerCase().includes(word.toLowerCase()),word);
  }
});
