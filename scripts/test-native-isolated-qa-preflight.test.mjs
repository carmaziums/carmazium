#!/usr/bin/env node
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validateIsolatedQa,createIsolatedQaConfig,ENV_KEYS} from './prepare-native-isolated-qa.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const app=JSON.parse(readFileSync(resolve(root,'carmazium app/carmazium app/app.json'),'utf8'));
const eas=JSON.parse(readFileSync(resolve(root,'carmazium app/carmazium app/eas.json'),'utf8'));
const sample=()=>({
  CARMAZIUM_QA_API_URL:'https://qa-api.example.test',
  CARMAZIUM_QA_SUPABASE_URL:'https://ffkqnswgfdgpsrhnjrqu.supabase.co',
  CARMAZIUM_QA_SUPABASE_ANON_KEY:'qa-anon-key-that-is-not-production',
  CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY:'pk_test_1234567890',
  CARMAZIUM_QA_EAS_PROJECT_ID:'11111111-2222-4333-8444-555555555555',
  CARMAZIUM_QA_ISOLATED_CONFIRMED:'YES_APPROVED_SYNTHETIC_ONLY',
});
test('exposes all five staging-specific config requirements, rejects missing secrets',()=>{
  assert.equal(ENV_KEYS.length,5);
  assert.equal(validateIsolatedQa({},app,eas).ok,false);
  assert.equal(validateIsolatedQa(sample(),app,eas).ok,true);
});
test('never allow live backend, production Supabase, production EAS or Stripe live key',()=>{
  const changes=[
    ['CARMAZIUM_QA_API_URL','https://carmazium-hjoh9w.fly.dev'],
    ['CARMAZIUM_QA_API_URL','https://www.carmazium.com'],
    ['CARMAZIUM_QA_API_URL','http://qa-api.example.test'],
    ['CARMAZIUM_QA_API_URL','https://example.com'],
    ['CARMAZIUM_QA_SUPABASE_URL','https://bwtnzmevjlowwronylxm.supabase.co'],
    ['CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY','pk_live_sample'],
    ['CARMAZIUM_QA_EAS_PROJECT_ID',app.expo.extra.eas.projectId],
    ['CARMAZIUM_QA_SUPABASE_ANON_KEY',eas.build.preview.env.EXPO_PUBLIC_SUPABASE_ANON_KEY],
    ['CARMAZIUM_QA_ISOLATED_CONFIRMED',''],
  ];
  for(const [key,value] of changes){
    const env={...sample(),[key]:value};
    assert.equal(validateIsolatedQa(env,app,eas).ok,false,key+' unsafe config accepted');
  }
});
test('ephemeral QA package uses unique app identity, separate EAS and NO production OTA/deep links',()=>{
  const out=createIsolatedQaConfig(sample(),app,eas);
  assert.equal(out.app.expo.name,'CarMazium QA');
  assert.equal(out.app.expo.android.package,'uk.carmazium.qa');
  assert.equal(out.app.expo.ios.bundleIdentifier,'uk.carmazium.qa');
  assert.equal(out.app.expo.scheme,'carmazium-qa');
  assert.equal(out.app.expo.updates.enabled,false);
  assert.equal(out.app.expo.updates.url,undefined);
  assert.deepEqual(out.app.expo.android.intentFilters,[]);
  assert.deepEqual(out.app.expo.ios.associatedDomains,[]);
  assert.equal(out.app.expo.extra.eas.projectId,sample().CARMAZIUM_QA_EAS_PROJECT_ID);
  assert.equal(out.eas.build['qa-isolated'].channel,'qa-isolated');
  assert.equal(out.eas.build['qa-isolated'].distribution,'internal');
  assert.equal(out.eas.build['qa-isolated'].env.EXPO_PUBLIC_QA_READ_ONLY,'1');
  assert.equal(out.eas.build['qa-isolated'].env.EXPO_PUBLIC_QA_ISOLATED,'1');
  assert.equal(out.eas.build['qa-isolated'].env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,sample().CARMAZIUM_QA_STRIPE_PUBLISHABLE_KEY);
  assert.equal(out.eas.build['qa-isolated'].android.buildType,'apk');
  assert.equal(out.eas.build['qa-isolated'].ios.simulator,true);
  assert.deepEqual(out.eas.build.preview,eas.build.preview);
  assert.deepEqual(out.eas.build.production,eas.build.production);
  assert.deepEqual(app.expo.android.package,'uk.carmazium.app' );
  assert.equal(eas.build['qa-isolated'],undefined,'must not persist generated QA profile in repository');
});
test('CLI refuses accidental local mutation, and absent staging fails closed',()=>{
  const script=resolve(root,'scripts/prepare-native-isolated-qa.mjs');
  const noEnv=spawnSync(process.execPath,[script],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(noEnv.status,1);
  assert.match(noEnv.stdout,/BLOCKED/);
  const noCi=spawnSync(process.execPath,[script,'--prepare'],{
    encoding:'utf8',env:{...process.env,...sample(),GITHUB_ACTIONS:'false',CI:'false'},
  });
  assert.equal(noCi.status,1);
  assert.match(noCi.stderr,/only be generated on a CI checkout/);
});
